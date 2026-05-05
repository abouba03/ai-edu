import asyncio
import os
import sys
import tempfile
import time
import traceback
import subprocess
from typing import Any

import socketio

# Windows + asyncio subprocess support
if sys.platform.startswith("win"):
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception:
        pass

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = socketio.ASGIApp(sio)

MAX_CODE_CHARS = int(os.getenv("EXECUTION_MAX_CODE_CHARS", "12000"))
EXEC_TIMEOUT_SECONDS = int(os.getenv("EXECUTION_TIMEOUT_SECONDS", "30"))

_sessions: dict[str, dict[str, Any]] = {}


async def _emit_stream(sid: str, event_name: str, payload: dict[str, Any]) -> None:
    try:
        await sio.emit(event_name, payload, room=sid)
    except Exception:
        pass


async def _run_code_session(sid: str, code: str) -> None:
    tmp_path: str | None = None
    proc: Any = None
    started_at = time.perf_counter()

    session = _sessions.setdefault(sid, {})
    stdin_queue: asyncio.Queue[str] = session.setdefault("stdin_queue", asyncio.Queue())
    stop_event: asyncio.Event = session.setdefault("stop_event", asyncio.Event())
    stop_event.clear()

    try:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as f:
            f.write(code)
            tmp_path = f.name

        proc_env = {
            **os.environ,
            "PYTHONUNBUFFERED": "1",
            "PYTHONIOENCODING": "utf-8",
            "PYTHONUTF8": "1",
        }

        if os.name == "nt":
            proc = subprocess.Popen(
                [sys.executable, "-X", "utf8", "-u", tmp_path],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=proc_env,
            )
        else:
            proc = await asyncio.create_subprocess_exec(
                sys.executable,
                "-X",
                "utf8",
                "-u",
                tmp_path,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=proc_env,
            )

        session["proc"] = proc

        async def stream_pipe(stream: Any, kind: str) -> None:
            try:
                if os.name == "nt":
                    loop = asyncio.get_running_loop()
                    queue: asyncio.Queue[bytes | None] = asyncio.Queue()

                    def _reader() -> None:
                        try:
                            while True:
                                # Use read(1) so input() prompts (no newline) are
                                # flushed immediately instead of waiting for '\n'.
                                chunk = stream.read(1)
                                if not chunk:
                                    break
                                loop.call_soon_threadsafe(queue.put_nowait, chunk)
                        finally:
                            loop.call_soon_threadsafe(queue.put_nowait, None)

                    import threading

                    threading.Thread(target=_reader, daemon=True).start()

                    while True:
                        chunk = await queue.get()
                        if chunk is None:
                            break
                        await _emit_stream(sid, kind, {"data": chunk.decode("utf-8", errors="replace")})
                    return

                while True:
                    chunk = await stream.read(512)
                    if not chunk:
                        break
                    await _emit_stream(sid, kind, {"data": chunk.decode("utf-8", errors="replace")})
            except Exception:
                pass

        async def forward_stdin() -> None:
            try:
                while not stop_event.is_set() and proc and proc.stdin:
                    try:
                        line = await asyncio.wait_for(stdin_queue.get(), timeout=1.0)
                    except asyncio.TimeoutError:
                        continue

                    proc.stdin.write((line + "\n").encode())
                    if os.name == "nt":
                        proc.stdin.flush()
                    else:
                        await proc.stdin.drain()
            except Exception:
                pass
            finally:
                try:
                    if proc and proc.stdin:
                        proc.stdin.close()
                except Exception:
                    pass

        stdin_task = asyncio.create_task(forward_stdin())

        try:
            await asyncio.wait_for(
                asyncio.gather(
                    stream_pipe(proc.stdout, "stdout"),
                    stream_pipe(proc.stderr, "stderr"),
                ),
                timeout=EXEC_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            if proc and proc.returncode is None:
                proc.kill()
            await _emit_stream(
                sid,
                "stderr",
                {"data": f"\n[Timeout: {EXEC_TIMEOUT_SECONDS}s depasse — processus tue]"},
            )
        finally:
            stop_event.set()
            stdin_task.cancel()
            try:
                await stdin_task
            except asyncio.CancelledError:
                pass

        if proc is not None:
            if os.name == "nt":
                rc = await asyncio.to_thread(proc.wait)
            else:
                rc = await proc.wait()
        else:
            rc = 1

        elapsed = time.perf_counter() - started_at
        await _emit_stream(sid, "meta", {"data": f"\nTemps d'execution : {elapsed:.3f}s"})
        await _emit_stream(sid, "exit", {"code": rc})

    except Exception as exc:
        trace = traceback.format_exc()
        await _emit_stream(sid, "stderr", {"data": f"Erreur serveur: {type(exc).__name__}: {exc}\n{trace}"})
        await _emit_stream(sid, "exit", {"code": 1})
    finally:
        session = _sessions.get(sid)
        if session:
            session["proc"] = None
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


@sio.event
async def connect(sid: str, environ: dict[str, Any], auth: dict[str, Any] | None = None) -> None:
    _sessions[sid] = {
        "stdin_queue": asyncio.Queue(),
        "stop_event": asyncio.Event(),
        "proc": None,
        "task": None,
    }


@sio.event
async def disconnect(sid: str) -> None:
    session = _sessions.pop(sid, None)
    if not session:
        return

    stop_event: asyncio.Event | None = session.get("stop_event")
    if stop_event:
        stop_event.set()

    proc = session.get("proc")
    try:
        if proc and proc.returncode is None:
            proc.kill()
    except Exception:
        pass


@sio.on("execute_code")
async def execute_code(sid: str, data: dict[str, Any]) -> None:
    code = str((data or {}).get("code") or "").strip()
    if not code:
        await _emit_stream(sid, "stderr", {"data": "Code vide."})
        await _emit_stream(sid, "exit", {"code": 1})
        return

    if len(code) > MAX_CODE_CHARS:
        await _emit_stream(sid, "stderr", {"data": f"Code trop long (max {MAX_CODE_CHARS} chars)."})
        await _emit_stream(sid, "exit", {"code": 1})
        return

    session = _sessions.get(sid)
    if not session:
        return

    previous_task: asyncio.Task | None = session.get("task")
    if previous_task and not previous_task.done():
        try:
            previous_task.cancel()
        except Exception:
            pass

    task = asyncio.create_task(_run_code_session(sid, code))
    session["task"] = task


@sio.on("stdin")
async def stdin_event(sid: str, data: dict[str, Any]) -> None:
    session = _sessions.get(sid)
    if not session:
        return

    line = str((data or {}).get("data") or "")
    queue: asyncio.Queue[str] = session.get("stdin_queue")
    if queue is not None:
        try:
            queue.put_nowait(line)
        except Exception:
            pass
