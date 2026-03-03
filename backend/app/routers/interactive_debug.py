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
        return "Aucun échange précédent."

    selected = history[-max_turns:]
    chunks: list[str] = []
    for turn in selected:
        step = turn.get("step")
        student_answer = str(turn.get("student_answer") or "").strip()
        assistant_response = str(turn.get("assistant_response") or "").strip()
        chunks.append(
            f"Étape {step}:\n"
            f"- Réponse étudiant: {student_answer or '[vide]'}\n"
            f"- Réponse assistant: {assistant_response or '[vide]'}"
        )
    return "\n\n".join(chunks)


@router.post("/interactive-debug/")
async def interactive_debug(req: DebugRequest):
    incoming_code = (req.code or "").strip()
    if incoming_code and len(incoming_code) > MAX_DEBUG_CODE_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Le code est trop long. Maximum autorisé: {MAX_DEBUG_CODE_CHARS} caractères.",
        )

    incoming_level = (req.level or "").strip().lower()
    if incoming_level and incoming_level not in ALLOWED_LEVELS:
        raise HTTPException(
            status_code=400,
            detail="Niveau invalide. Valeurs autorisées: débutant, intermédiaire, avancé.",
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
                "challenge_description": (req.challenge_description or "").strip(),
                "history": [],
            }
        else:
            if incoming_code:
                sessions[session_id]["code"] = incoming_code
            if incoming_level:
                sessions[session_id]["level"] = incoming_level
            if (req.challenge_description or "").strip():
                sessions[session_id]["challenge_description"] = (req.challenge_description or "").strip()

        code = (sessions[session_id].get("code") or "").strip()
        if not code:
            raise HTTPException(status_code=400, detail="Le code est vide. Merci d'ajouter du code à analyser.")

        level = (sessions[session_id].get("level") or "débutant").strip().lower()
        if level not in ALLOWED_LEVELS:
            raise HTTPException(
                status_code=400,
                detail="Niveau invalide. Valeurs autorisées: débutant, intermédiaire, avancé.",
            )

        challenge_description = (sessions[session_id].get("challenge_description") or "").strip()
        history = sessions[session_id].get("history", [])
        _save_sessions(sessions)

    if req.step < 0 or req.step > 50:
        raise HTTPException(status_code=400, detail="Étape invalide. La valeur doit être entre 0 et 50.")

    student_answer = (req.student_answer or "").strip()
    if len(student_answer) > MAX_STUDENT_ANSWER_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"La réponse est trop longue. Maximum autorisé: {MAX_STUDENT_ANSWER_CHARS} caractères.",
        )

    current_step = len(history)
    pedagogy_block = build_pedagogy_block(req.pedagogy_context)
    history_context = _build_history_context(history)

    base_context = f"""
{pedagogy_block}

Tu es un assistant de debug Python pour une plateforme de coding.

Contexte challenge:
{challenge_description or 'Non fourni'}

Code étudiant actuel:
{code}

Historique récent:
{history_context}

Niveau: {level}
Étape courante: {current_step}

Contraintes fortes:
- Adapte toute la réponse au code réel et au challenge réel.
- Interdiction de phrases génériques non liées au code actuel.
- Interdiction de donner la solution complète.
- Interdiction de nommer une fonction/méthode précise à utiliser (ex: capitalize, strip, split, etc.).
- Interdiction de fournir du code ou pseudo-code.
- Formulation orientée apprentissage: expliquer le "quoi vérifier" et "comment tester", sans donner la réponse finale.
- Réponse très courte (4 lignes max), vocabulaire simple, actionnable, spécifique.
- Si aucune erreur bloquante n'est détectée, le dire clairement et proposer un test utile.

Format de sortie STRICT:
Statut : Erreur détectée | Pas d'erreur bloquante
Erreur détectée : ...
Conseil : ...
Prochaine action : ...
"""

    if student_answer == "":
        prompt = f"""
{base_context}

Objectif de cette étape:
- Démarrer le guidage depuis l'état actuel du code.
- Identifier précisément le blocage principal le plus utile à corriger maintenant.
"""
    else:
        prompt = f"""
{base_context}

Nouvelle réponse étudiant:
"{student_answer}"

Objectif de cette étape:
- Évaluer cette réponse dans le contexte du code et du challenge.
- Ajuster la priorité de correction si nécessaire.
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
        )
        assistant_response = response.choices[0].message.content or ""
    except Exception:
        raise HTTPException(status_code=503, detail="Service de debug IA temporairement indisponible.")

    try:
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
            "prompt_version": "v3.2-ai-debug-learning-simple",
            "session_id": session_id,
            "step": len(updated_history),
            "response": assistant_response,
            "history": updated_history,
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur interne lors de l'analyse interactive.")
