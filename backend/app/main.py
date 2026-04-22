from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import AsyncOpenAI
from pathlib import Path
import sys
from app.config import settings
from app.corrector import correct_code
from app.routers import interactive_debug
from app.routers import challenge
from app.routers import motivational_feedback
from app.routers import quiz_generator
from app.prompting import build_pedagogy_block, parse_json_response
from typing import Any
import json
import io
import traceback
from contextlib import redirect_stdout

import subprocess

app = FastAPI()  # 👉 Doit être AVANT include_router

app.include_router(interactive_debug.router)
app.include_router(quiz_generator.router)
app.include_router(motivational_feedback.router)
app.include_router(challenge.router)

openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY or "missing-openai-key")

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Autoriser toutes les origines pour le moment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CodeRequest(BaseModel):
    code: str


class ConsoleExecutionRequest(BaseModel):
    code: str
    stdin_lines: list[str] = []

# Modèle pour la soumission de défi
class SubmissionRequest(BaseModel):
    challenge_description: str
    student_code: str

# Modèle pour la génération de code
class CodePrompt(BaseModel):
    prompt: str
    pedagogy_context: dict[str, Any] | None = None

# Modèle pour la correction de code
class CodeCorrection(BaseModel):
    code: str
    challenge_description: str | None = None
    challenge_tests: dict[str, Any] | None = None
    failed_tests: list[dict[str, Any]] | None = None
    pedagogy_context: dict[str, Any] | None = None


class ResolveChallengeRequest(BaseModel):
    code: str
    challenge_description: str
    challenge_tests: dict[str, Any] | None = None
    pedagogy_context: dict[str, Any] | None = None
    max_iterations: int = 3

MAX_PROMPT_CHARS = 4000

@app.get("/")
async def root():
    return {"message": "API работает с FastAPI и OpenAI"}

@app.post("/generate/")
async def generate(data: CodePrompt):
    prompt = (data.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Промпт пустой. Опишите задачу для генерации кода.")
    if len(prompt) > MAX_PROMPT_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Промпт слишком длинный. Максимум: {MAX_PROMPT_CHARS} символов."
        )

    try:
        generated_code = await generate_code(prompt, data.pedagogy_context)
        return {"code": generated_code}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Сервис ИИ временно недоступен. Проверьте ключ OpenAI и попробуйте снова."
        )

async def generate_code(prompt: str, pedagogy_context: dict[str, Any] | None = None) -> str:
    pedagogy_block = build_pedagogy_block(pedagogy_context)
    response = await openai_client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[
            {
                "role": "system",
                "content": (
                    "Ты эксперт по Python и отвечаешь только на простом русском языке. "
                    "Верни строго валидный JSON в формате: "
                    "{\"code\": string, \"explanation\": string, \"safety_checks\": string[]}. "
                    "Не выдумывай несуществующие библиотеки и API."
                ),
            },
            {"role": "user", "content": f"{pedagogy_block}\nЗапрос пользователя:\n{prompt}"}
        ],
        temperature=0.5,
        max_tokens=500
    )
    content = response.choices[0].message.content
    try:
        parsed = parse_json_response(content or "")
        code = parsed.get("code")
        if isinstance(code, str) and code.strip():
            return code
    except Exception:
        pass
    return content or ""

@app.post("/correct/")
async def correct(data: CodeCorrection):
    code = (data.code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Код пустой. Добавьте код для проверки.")
    if len(code) > settings.EXECUTION_MAX_CODE_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Код слишком длинный. Максимум: {settings.EXECUTION_MAX_CODE_CHARS} символов."
        )

    try:
        corrected_code = correct_code(
            code=code,
            pedagogy_context=data.pedagogy_context,
            challenge_description=(data.challenge_description or ""),
            challenge_tests=data.challenge_tests,
            failed_tests=data.failed_tests,
        )
        parsed = None
        try:
            parsed = parse_json_response(corrected_code)
        except Exception:
            parsed = None

        if isinstance(parsed, dict):
            return {
                "corrected_code": parsed.get("corrected_code") or "",
                "explanation": parsed.get("explanation") or "",
                "hint_question": parsed.get("hint_question") or "",
                "prompt_version": parsed.get("prompt_version") or "v2.1",
            }

        return {
            "corrected_code": corrected_code,
            "explanation": "",
            "hint_question": "",
            "prompt_version": "v2.1-fallback",
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Внутренняя ошибка при проверке кода.")


def _extract_correction_payload(raw: str) -> dict[str, str]:
    parsed = None
    try:
        parsed = parse_json_response(raw)
    except Exception:
        parsed = None

    if isinstance(parsed, dict):
        return {
            "corrected_code": str(parsed.get("corrected_code") or "").strip(),
            "explanation": str(parsed.get("explanation") or "").strip(),
            "hint_question": str(parsed.get("hint_question") or "").strip(),
            "prompt_version": str(parsed.get("prompt_version") or "v2.2"),
        }

    return {
        "corrected_code": str(raw or "").strip(),
        "explanation": "",
        "hint_question": "",
        "prompt_version": "v2.2-fallback",
    }


@app.post("/resolve-challenge/")
async def resolve_challenge(data: ResolveChallengeRequest):
    code = (data.code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Код пустой. Добавьте код для проверки.")

    if len(code) > settings.EXECUTION_MAX_CODE_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Код слишком длинный. Максимум: {settings.EXECUTION_MAX_CODE_CHARS} символов."
        )

    iterations = data.max_iterations if 1 <= data.max_iterations <= 5 else 3
    suite = challenge._build_suite_from_generated_tests(data.challenge_tests or {}) if data.challenge_tests else None

    best_payload = {
        "corrected_code": code,
        "explanation": "",
        "hint_question": "",
        "prompt_version": "v2.2-initial",
    }
    best_report = None
    best_passed = -1

    current_code = code
    failed_tests: list[dict[str, Any]] = []

    for _ in range(iterations):
        raw = correct_code(
            code=current_code,
            pedagogy_context=data.pedagogy_context,
            challenge_description=(data.challenge_description or ""),
            challenge_tests=data.challenge_tests,
            failed_tests=failed_tests,
        )
        candidate = _extract_correction_payload(raw)
        candidate_code = candidate.get("corrected_code", "").strip()
        if not candidate_code:
            continue

        if suite is None:
            return {
                **candidate,
                "success": True,
                "test_summary": None,
                "test_results": [],
            }

        report = challenge._run_test_suite(candidate_code, suite)
        passed = int(report.get("passed", 0))
        total = int(report.get("total", 0))

        if passed > best_passed:
            best_passed = passed
            best_payload = candidate
            best_report = report

        if total > 0 and passed == total:
            return {
                **candidate,
                "success": True,
                "test_summary": {
                    "passed": passed,
                    "total": total,
                    "all_passed": True,
                    "runtime_error": str(report.get("runtime_error") or ""),
                },
                "test_results": report.get("results", []),
            }

        failed_tests = [
            item for item in (report.get("results") or [])
            if isinstance(item, dict) and item.get("status") in {"failed", "error"}
        ]
        current_code = candidate_code

    if suite is None:
        return {
            **best_payload,
            "success": False,
            "test_summary": None,
            "test_results": [],
        }

    if best_report is None:
        best_report = challenge._run_test_suite(best_payload.get("corrected_code", ""), suite)

    return {
        **best_payload,
        "success": False,
        "test_summary": {
            "passed": int(best_report.get("passed", 0)),
            "total": int(best_report.get("total", 0)),
            "all_passed": bool(best_report.get("all_passed", False)),
            "runtime_error": str(best_report.get("runtime_error") or ""),
        },
        "test_results": best_report.get("results", []),
    }


@app.post("/execute/")
async def execute_code(request: CodeRequest):
    if len(request.code) > settings.EXECUTION_MAX_CODE_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Код слишком длинный. Максимум: {settings.EXECUTION_MAX_CODE_CHARS} символов."
        )

    run_code_path = Path(__file__).resolve().parents[1] / "run_code.py"
    mode = settings.EXECUTION_MODE.lower().strip()

    try:
        if mode == "docker":
            command = ['docker', 'run', '-i', '--rm', 'code-runner']
        elif mode == "local":
            command = [sys.executable, str(run_code_path)]
        else:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Некорректный EXECUTION_MODE. Используй 'local' или 'docker'."
                )
            )

        result = subprocess.run(
            command,
            input=request.code,
            capture_output=True,
            text=True,
            timeout=settings.EXECUTION_TIMEOUT_SECONDS,
            cwd=str(run_code_path.parent)
        )
        output = result.stdout if result.stdout else result.stderr
        return {"output": output}
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=408,
            detail=f"Превышено время выполнения ({settings.EXECUTION_TIMEOUT_SECONDS}с)."
        )
    except FileNotFoundError:
        if mode == "docker":
            raise HTTPException(
                status_code=500,
                detail="Docker не найден. Используй EXECUTION_MODE=local или установи Docker."
            )
        raise HTTPException(status_code=500, detail="Исполняемый файл Python не найден.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/execute-console/")
async def execute_console_code(request: ConsoleExecutionRequest):
    code = (request.code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Код пустой. Добавьте код для запуска.")

    if len(code) > settings.EXECUTION_MAX_CODE_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Код слишком длинный. Максимум: {settings.EXECUTION_MAX_CODE_CHARS} символов."
        )

    stdin_lines = request.stdin_lines if isinstance(request.stdin_lines, list) else []
    normalized_inputs = [str(item) for item in stdin_lines[:50]]

    iterator = iter(normalized_inputs)

    def fake_input(_: str = "") -> str:
        try:
            return next(iterator)
        except StopIteration:
            raise RuntimeError("Недостаточно данных для input(). Добавь больше строк во входные данные консоли.")

    namespace: dict[str, Any] = {"__builtins__": __builtins__, "input": fake_input}
    output_buffer = io.StringIO()

    try:
        with redirect_stdout(output_buffer):
            exec(code, namespace, namespace)
        return {
            "success": True,
            "stdout": output_buffer.getvalue(),
            "error": "",
        }
    except Exception as exc:
        return {
            "success": False,
            "stdout": output_buffer.getvalue(),
            "error": str(exc),
            "trace": traceback.format_exc(limit=1),
        }
    
  