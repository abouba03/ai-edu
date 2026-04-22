from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI
from app.config import settings
from pathlib import Path
from threading import Lock
from datetime import datetime, timezone
from uuid import uuid4
import json
from app.prompting import build_pedagogy_block, get_response_language
from typing import Any

router = APIRouter()
client = OpenAI(api_key=settings.OPENAI_API_KEY or "missing-openai-key")


class DebugRequest(BaseModel):
    code: str = ""
    level: str = "débutant"
    step: int = 0
    student_answer: str = ""
    session_id: str | None = None
    challenge_description: str = ""
    pedagogy_context: dict[str, Any] | None = None


MAX_DEBUG_CODE_CHARS = 20000
MAX_STUDENT_ANSWER_CHARS = 1000
ALLOWED_LEVELS = {"débutant", "intermédiaire", "avancé"}

SESSIONS_FILE = Path(__file__).resolve().parents[2] / "debug_sessions.json"
SESSIONS_LOCK = Lock()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_sessions() -> dict:
    if not SESSIONS_FILE.exists():
        return {}
    try:
        raw = SESSIONS_FILE.read_text(encoding="utf-8").strip()
        if not raw:
            return {}
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _save_sessions(data: dict) -> None:
    SESSIONS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _append_session_history(
    sessions: dict,
    session_id: str,
    step: int,
    student_answer: str,
    assistant_response: str,
) -> None:
    session = sessions[session_id]
    session.setdefault("history", []).append(
        {
            "step": step,
            "student_answer": student_answer,
            "assistant_response": assistant_response,
            "timestamp": _utc_now_iso(),
        }
    )
    session["updated_at"] = _utc_now_iso()


def _build_history_context(history: list[dict[str, Any]], max_turns: int = 4) -> str:
    if not history:
        return "Предыдущих сообщений нет."

    selected = history[-max_turns:]
    chunks: list[str] = []
    for turn in selected:
        step = turn.get("step")
        student_answer = str(turn.get("student_answer") or "").strip()
        assistant_response = str(turn.get("assistant_response") or "").strip()
        chunks.append(
            f"Шаг {step}:\n"
            f"- Ответ ученика: {student_answer or '[пусто]'}\n"
            f"- Ответ ИИ: {assistant_response or '[пусто]'}"
        )
    return "\n\n".join(chunks)


@router.post("/interactive-debug/")
async def interactive_debug(req: DebugRequest):
    incoming_code = (req.code or "").strip()
    if incoming_code and len(incoming_code) > MAX_DEBUG_CODE_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Код слишком длинный. Максимум: {MAX_DEBUG_CODE_CHARS} символов.",
        )

    incoming_level = (req.level or "").strip().lower()
    # Accept Russian level names or map them to French equivalents
    _level_map = {
        "débutant": "débutant", "debutant": "débutant",
        "intermédiaire": "intermédiaire", "intermediaire": "intermédiaire",
        "avancé": "avancé", "avance": "avancé",
        "начинающий": "débutant", "базовый": "débutant",
        "средний": "intermédiaire", "продвинутый": "avancé",
    }
    incoming_level = _level_map.get(incoming_level, incoming_level) or "débutant"
    if incoming_level and incoming_level not in ALLOWED_LEVELS:
        incoming_level = "débutant"

    tutor_mode = bool((req.pedagogy_context or {}).get("tutorMode"))
    course_title = str((req.pedagogy_context or {}).get("courseTitle") or "")
    course_description = str((req.pedagogy_context or {}).get("courseDescription") or "")

    with SESSIONS_LOCK:
        sessions = _load_sessions()

        session_id = (req.session_id or "").strip() or None
        if session_id and session_id not in sessions:
            raise HTTPException(status_code=404, detail="Сессия не найдена. Запусти новую сессию.")

        if session_id is None:
            if not incoming_code and not tutor_mode:
                raise HTTPException(status_code=400, detail="Код пустой. Добавь код для анализа.")
            session_id = str(uuid4())
            level_for_session = incoming_level if incoming_level else "débutant"
            sessions[session_id] = {
                "session_id": session_id,
                "created_at": _utc_now_iso(),
                "updated_at": _utc_now_iso(),
                "code": incoming_code or "# session tuteur",
                "level": level_for_session,
                "challenge_description": (req.challenge_description or "").strip(),
                "tutor_mode": tutor_mode,
                "history": [],
            }
        else:
            if incoming_code:
                sessions[session_id]["code"] = incoming_code
            if incoming_level:
                sessions[session_id]["level"] = incoming_level
            if (req.challenge_description or "").strip():
                sessions[session_id]["challenge_description"] = (req.challenge_description or "").strip()
            # honour tutor_mode flag from request or stored session
            if tutor_mode:
                sessions[session_id]["tutor_mode"] = True
            tutor_mode = bool(sessions[session_id].get("tutor_mode")) or tutor_mode

        code = (sessions[session_id].get("code") or "").strip()
        if not code and not sessions[session_id].get("tutor_mode"):
            raise HTTPException(status_code=400, detail="Код пустой. Добавь код для анализа.")

        level = (sessions[session_id].get("level") or "débutant").strip().lower()
        if level not in ALLOWED_LEVELS:
            level = "débutant"

        challenge_description = (sessions[session_id].get("challenge_description") or "").strip()
        history = sessions[session_id].get("history", [])
        _save_sessions(sessions)

    if req.step < 0 or req.step > 50:
        raise HTTPException(status_code=400, detail="Неверный шаг. Значение должно быть от 0 до 50.")

    student_answer = (req.student_answer or "").strip()
    if len(student_answer) > MAX_STUDENT_ANSWER_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Ответ слишком длинный. Максимум: {MAX_STUDENT_ANSWER_CHARS} символов.",
        )

    current_step = len(history)
    pedagogy_block = build_pedagogy_block(req.pedagogy_context)
    response_language = get_response_language(req.pedagogy_context, "français simple")
    history_context = _build_history_context(history)
    def _auto_select_strategy(answer: str, hist: list, lvl: str) -> str:
        """
        Choisit la strategie pedagogique optimale en fonction du contexte:
        - 'socratique'  si l etudiant cherche son erreur ou formule une hypothese
        - 'creatif'     si l etudiant demande un exemple, analogie ou defi
        - 'coach'       sinon (explication directe, debut de session, debutant)
        """
        a = answer.lower()
        is_beginner = lvl in ("débutant", "debutant")
        is_first = len(hist) <= 1

        seeking_hints = any(kw in a for kw in [
            "pourquoi", "comment", "je ne comprends", "je suis perdu",
            "c est quoi", "c'est quoi", "aide moi", "qu est ce", "qu'est-ce",
            "aidez", "expliqu", "comprends pas", "erreur",
        ])
        wants_example = any(kw in a for kw in [
            "exemple", "analogie", "comme si", "imagine", "defi", "exercice",
            "montre moi", "montre-moi", "image", "metaphore",
        ])
        reasoning_mode = any(kw in a for kw in [
            "je pense que", "je crois", "peut etre", "peut-etre",
            "si j", "si on", "est ce que", "est-ce que", "non ?", "vrai ?",
        ])

        if is_beginner or is_first:
            return "coach"
        if reasoning_mode or seeking_hints:
            return "socratique"
        if wants_example:
            return "creatif"
        # Alterne entre coach et socratique selon la progression
        return "socratique" if len(hist) % 3 == 0 else "coach"

    tutor_strategy = _auto_select_strategy(student_answer, history, level)

    code_display = (code if code and code.strip() not in ("", "# session tuteur") else "")

    if tutor_mode:
        # ── Tutor mode: natural tutoring in requested language ───────────
        strategy_rules = {
            "coach": "Donne des explications directes et actionnables. Priorise la clarte et l execution pas-a-pas.",
            "socratique": "Guide surtout par questions progressives. Ne donne la reponse qu en dernier recours.",
            "creatif": "Utilise une analogie concrete et propose un mini defi court pour ancrer la comprehension.",
        }

        base_context = f"""{pedagogy_block}

Tu es un tuteur IA bienveillant pour une plateforme d apprentissage de Python.

Cours: {course_title or "Python"}
{("Description: " + course_description) if course_description else ""}
Niveau de l etudiant: {level}
{("Code courant:\n```python\n" + code_display + "\n```") if code_display else "Code non fourni pour le moment."}

Historique:
{history_context}

REGLES OBLIGATOIRES:
- Reponds uniquement en {response_language}.
- Style: chaleureux, clair, pedagogique et concret.
- Strategie active: {tutor_strategy}.
- Regle de strategie: {strategy_rules[tutor_strategy]}
- Si la question porte sur la theorie: explique simplement avec un petit exemple.
- Si du code est present: decompose-le par etapes et explique l intention de chaque bloc.
- Si l etudiant est perdu: reformule autrement, si utile avec une analogie simple.
- Termine par une courte question de verification de comprehension.
- N utilise pas le format Statut/Erreur/Conseil/Etape suivante.
- Reponse en 4 blocs courts et dans cet ordre exact:
    1) Ce que j ai compris
    2) Explication guidee
    3) Action immediate (une micro-tache)
    4) Question checkpoint
- Longueur cible: 5 a 10 phrases, orientee apprentissage actif.
"""

        if student_answer == "":
            prompt = f"""{base_context}

Debut de session. Presente-toi comme tuteur, mentionne le cours "{course_title or 'Python'}" et pose une premiere question pour comprendre le niveau et le besoin de l etudiant."""
        else:
            prompt = f"""{base_context}

Message de l etudiant: "{student_answer}"

Reponds naturellement dans la langue demandee, de facon directement utile pour comprendre l exercice et le code.
Ajoute une mini progression: rappelle ce qui est acquis puis ce qu il reste a debloquer."""

    else:
        # ── Debug mode: original structured format ────────────────────────
        base_context = f"""
{pedagogy_block}

    Ты помощник по отладке Python. Пиши только на простом русском языке.

    Контекст задачи:
    {challenge_description or 'Не указан'}

    Текущий код ученика:
{code}

    Недавняя история:
{history_context}

    Уровень: {level}
    Текущий шаг: {current_step}

    Правила:
    - Ответ должен опираться на текущий код и задачу.
    - Не пиши общие фразы без связи с кодом.
    - Не давай полное готовое решение.
    - Не называй конкретные функции/методы для прямого ответа.
    - Не пиши код и псевдокод.
    - Объясняй, что проверить и как проверить, без готового ответа.
    - Очень коротко: максимум 4 строки, простые слова.
    - Если критической ошибки нет, скажи это и предложи полезную проверку.

    Строгий формат:
    Статус: Ошибка найдена | Критической ошибки нет
    Ошибка: ...
    Совет: ...
    Следующий шаг: ...
"""

        if student_answer == "":
            prompt = f"""
{base_context}

Цель шага:
- Начать разбор текущего состояния кода.
- Найти главный блокер, который полезнее всего исправить сейчас.
"""
        else:
            prompt = f"""
{base_context}

Новый ответ ученика:
"{student_answer}"

Цель шага:
- Оценить ответ в контексте кода и задачи.
- При необходимости поменять приоритет исправления.
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
        )
        assistant_response = response.choices[0].message.content or ""
    except Exception:
        raise HTTPException(status_code=503, detail="Сервис ИИ-отладки временно недоступен.")

    try:
        with SESSIONS_LOCK:
            sessions = _load_sessions()
            if session_id not in sessions:
                raise HTTPException(status_code=404, detail="Сессия истекла. Перезапусти новую сессию.")
            _append_session_history(
                sessions=sessions,
                session_id=session_id,
                step=current_step,
                student_answer=student_answer,
                assistant_response=assistant_response,
            )
            _save_sessions(sessions)

            updated_session = sessions.get(session_id, {})
            updated_history = updated_session.get("history", [])

        return {
            "prompt_version": "v3.4-ai-tutor-adaptive",
            "session_id": session_id,
            "step": len(updated_history),
            "response": assistant_response,
            "tutor_strategy": tutor_strategy,
            "history": updated_history,
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Внутренняя ошибка при интерактивном разборе.")
