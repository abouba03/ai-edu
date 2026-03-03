from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
from openai import OpenAI
from app.config import settings
from app.prompting import build_pedagogy_block
from typing import Any

router = APIRouter()
client = OpenAI(api_key=settings.OPENAI_API_KEY or "missing-openai-key")

class QuizRequest(BaseModel):
    theme: str
    level: str = "débutant"
    nb_questions: int = 10
    pedagogy_context: dict[str, Any] | None = None

MAX_THEME_CHARS = 300
ALLOWED_LEVELS = {"débutant", "intermédiaire", "avancé"}


def _extract_json_payload(raw_text: str) -> str:
    content = (raw_text or "").strip()
    if content.startswith("```"):
        lines = content.splitlines()
        if len(lines) >= 3:
            content = "\n".join(lines[1:-1]).strip()
    return content

@router.post("/generate-quiz/")
async def generate_quiz(req: QuizRequest):
    theme = (req.theme or "").strip()
    if not theme:
        raise HTTPException(status_code=400, detail="Le thème du quiz est vide.")
    if len(theme) > MAX_THEME_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Le thème est trop long. Maximum autorisé: {MAX_THEME_CHARS} caractères."
        )

    level = (req.level or "").strip().lower()
    if level not in ALLOWED_LEVELS:
        raise HTTPException(
            status_code=400,
            detail="Niveau invalide. Valeurs autorisées: débutant, intermédiaire, avancé."
        )

    if req.nb_questions < 1 or req.nb_questions > 12:
        raise HTTPException(status_code=400, detail="Le nombre de questions doit être entre 1 et 12.")

    pedagogy_block = build_pedagogy_block(req.pedagogy_context)

    composition_rules = f"""
Contraintes de composition du quiz :
- Mélange obligatoire de types de questions :
    - au moins 3 questions Vrai/Faux avec exactement ces choix : ["Vrai", "Faux"]
    - le reste en QCM (3 ou 4 choix plausibles)
- Une seule bonne réponse par question.
- Niveau de difficulté progressif et adapté au niveau {level}.
""" if req.nb_questions >= 8 else f"""
Contraintes de composition du quiz :
- Mélange recommandé de types de questions (Vrai/Faux + QCM) quand possible.
- Une seule bonne réponse par question.
- Niveau de difficulté progressif et adapté au niveau {level}.
"""

    prompt = f"""
{pedagogy_block}

Tu es un professeur de programmation Python. Crée un quiz de {req.nb_questions} questions pour un étudiant de niveau {level}, sur le thème suivant : "{theme}".

{composition_rules}

Format :
[
  {{
    "question": "...",
    "choices": ["...","...","..."],
    "answer": "...",
    "explanation": "..."
  }},
  ...
]
Réponds uniquement avec un JSON valide et strict.
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur interne lors de la génération du quiz.")

    # Extraire le JSON du texte généré
    content = response.choices[0].message.content or ""
    normalized = _extract_json_payload(content)

    try:
        quiz_data = json.loads(normalized)
        if not isinstance(quiz_data, list):
            raise ValueError("Le modèle n'a pas renvoyé une liste JSON")
        return {"quiz": quiz_data}
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Le modèle a renvoyé une réponse invalide. Merci de réessayer."
        )
