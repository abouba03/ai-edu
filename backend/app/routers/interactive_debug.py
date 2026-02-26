from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI
from app.config import settings
from pathlib import Path
from threading import Lock
from datetime import datetime, timezone
from uuid import uuid4
import json
from app.prompting import build_pedagogy_block
from typing import Any

# Créer un routeur FastAPI
router = APIRouter()

# Charger la clé API depuis le fichier de config
client = OpenAI(api_key=settings.OPENAI_API_KEY)

# Modèle Pydantic
class DebugRequest(BaseModel):
    code: str = ""
    level: str = "débutant"
    step: int = 0
    student_answer: str = ""
    session_id: str | None = None
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
    SESSIONS_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


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

# Route POST
@router.post("/interactive-debug/")
async def interactive_debug(req: DebugRequest):
    incoming_code = (req.code or "").strip()
    if incoming_code and len(incoming_code) > MAX_DEBUG_CODE_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Le code est trop long. Maximum autorisé: {MAX_DEBUG_CODE_CHARS} caractères."
        )

    incoming_level = (req.level or "").strip().lower()
    if incoming_level and incoming_level not in ALLOWED_LEVELS:
        raise HTTPException(
            status_code=400,
            detail="Niveau invalide. Valeurs autorisées: débutant, intermédiaire, avancé."
        )

    with SESSIONS_LOCK:
        sessions = _load_sessions()

        session_id = (req.session_id or "").strip() or None
        if session_id and session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session introuvable. Merci de relancer une nouvelle session.")

        if session_id is None:
            if not incoming_code:
                raise HTTPException(status_code=400, detail="Le code est vide. Merci d'ajouter du code à analyser.")
            session_id = str(uuid4())
            level_for_session = incoming_level if incoming_level else "débutant"
            sessions[session_id] = {
                "session_id": session_id,
                "created_at": _utc_now_iso(),
                "updated_at": _utc_now_iso(),
                "code": incoming_code,
                "level": level_for_session,
                "history": [],
            }
        else:
            if incoming_code:
                sessions[session_id]["code"] = incoming_code
            if incoming_level:
                sessions[session_id]["level"] = incoming_level

        code = (sessions[session_id].get("code") or "").strip()
        if not code:
            raise HTTPException(status_code=400, detail="Le code est vide. Merci d'ajouter du code à analyser.")

        level = (sessions[session_id].get("level") or "débutant").strip().lower()
        if level not in ALLOWED_LEVELS:
            raise HTTPException(
                status_code=400,
                detail="Niveau invalide. Valeurs autorisées: débutant, intermédiaire, avancé."
            )

        history = sessions[session_id].get("history", [])
        _save_sessions(sessions)

    if req.step < 0 or req.step > 50:
        raise HTTPException(status_code=400, detail="Étape invalide. La valeur doit être entre 0 et 50.")

    student_answer = (req.student_answer or "").strip()
    if len(student_answer) > MAX_STUDENT_ANSWER_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"La réponse est trop longue. Maximum autorisé: {MAX_STUDENT_ANSWER_CHARS} caractères."
        )

    current_step = len(history)
    pedagogy_block = build_pedagogy_block(req.pedagogy_context)

    # Si l'étudiant n’a pas encore répondu, l’IA pose une première question
    if student_answer == "":
        prompt = f"""
{pedagogy_block}

Tu es un tuteur en programmation. Voici un code donné par un étudiant :

{code}

Tu ne dois pas corriger le code directement. Tu dois :
1. Identifier une erreur dans le code.
2. Poser une question guidée pour aider l’étudiant à comprendre cette erreur.
3. Donner un petit indice pour l’aider à y réfléchir, sans donner la réponse.

Niveau de l’étudiant : {level}
Étape : {current_step}

Réponds avec ce format :
Question : ...
Indice : ...
"""
    else:
        # Si l’étudiant a déjà répondu, on analyse sa réponse
        prompt = f"""
{pedagogy_block}

Tu es un tuteur bienveillant en programmation. L’étudiant t’a donné ce code :

{code}

Tu lui as posé une question, et voici sa réponse :

\"{student_answer}\"

Maintenant, tu dois :
1. Dire si cette réponse est correcte ou incorrecte.
2. Fournir un retour constructif.
3. Si la réponse est correcte, donne un indice vers la correction ou la suite logique.
4. Sinon, reformule ta question ou propose un nouvel indice.

Niveau de l’étudiant : {level}
Étape : {current_step}

Réponds avec ce format :
Feedback : ...
Nouvelle question ou indice : ...
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5
        )

        assistant_response = response.choices[0].message.content or ""

        with SESSIONS_LOCK:
            sessions = _load_sessions()
            if session_id not in sessions:
                raise HTTPException(status_code=404, detail="Session expirée. Merci de redémarrer une session.")
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
            "prompt_version": "v2.1",
            "session_id": session_id,
            "step": len(updated_history),
            "response": assistant_response,
            "history": updated_history,
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur interne lors de l'analyse interactive.")
