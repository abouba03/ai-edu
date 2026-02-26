from fastapi import APIRouter
from pydantic import BaseModel
from openai import OpenAI
from app.config import settings
from app.prompting import build_pedagogy_block, parse_json_response
from typing import Any

router = APIRouter()
client = OpenAI(api_key=settings.OPENAI_API_KEY)

class SubmissionRequest(BaseModel):
    challenge_description: str
    student_code: str
    pedagogy_context: dict[str, Any] | None = None

class ChallengeRequest(BaseModel):
    level: str = "intermédiaire"
    language: str = "Python"
    pedagogy_context: dict[str, Any] | None = None



@router.post("/submit-challenge/")
async def submit_challenge(req: SubmissionRequest):
    pedagogy_block = build_pedagogy_block(req.pedagogy_context)
    prompt = f"""
{pedagogy_block}

Voici un défi de code :

{req.challenge_description}

Et voici la solution proposée par un étudiant :

{req.student_code}

1. Analyse la solution et vérifie si elle est correcte.
2. Attribue une note sur 10.
3. Donne un commentaire constructif, simple, et motivant.
4. Donne uniquement des consignes, idées, et prochaines étapes.

RÈGLES IMPORTANTES :
- Interdiction de fournir une solution complète.
- Interdiction de fournir du code exécutable complet.
- Interdiction de fournir une réponse directe à l'exercice.
- Tu peux donner des pistes algorithmiques courtes et générales.

Réponds strictement en JSON :
{{
    "prompt_version": "v2.2",
    "note": ".../10",
    "commentaire": "...",
    "consignes": ["...", "..."],
    "idees": ["...", "..."],
    "prochaines_etapes": ["...", "..."]
}}
"""

    response = client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5
    )

    raw = response.choices[0].message.content or ""
    try:
        parsed = parse_json_response(raw)
        note = str(parsed.get("note") or "N/A")
        commentaire = str(parsed.get("commentaire") or "")
        consignes = parsed.get("consignes") if isinstance(parsed.get("consignes"), list) else []
        idees = parsed.get("idees") if isinstance(parsed.get("idees"), list) else []
        prochaines_etapes = parsed.get("prochaines_etapes") if isinstance(parsed.get("prochaines_etapes"), list) else []

        consignes_text = "\n".join([f"- {item}" for item in consignes if isinstance(item, str)])
        idees_text = "\n".join([f"- {item}" for item in idees if isinstance(item, str)])
        prochaines_etapes_text = "\n".join([f"- {item}" for item in prochaines_etapes if isinstance(item, str)])

        formatted = f"Note: {note}\nCommentaire: {commentaire}"
        if consignes_text:
            formatted += f"\nConsignes:\n{consignes_text}"
        if idees_text:
            formatted += f"\nIdées:\n{idees_text}"
        if prochaines_etapes_text:
            formatted += f"\nProchaines étapes:\n{prochaines_etapes_text}"

        return {
            "evaluation": formatted,
            "evaluation_json": parsed,
        }
    except Exception:
        return {"evaluation": raw}



@router.post("/generate-challenge/")
async def generate_challenge(req: ChallengeRequest):
    pedagogy_block = build_pedagogy_block(req.pedagogy_context)
    prompt = f"""
{pedagogy_block}

Tu es un professeur de programmation. Crée un défi de code pour un étudiant de niveau {req.level} en {req.language}.
Le défi doit contenir :

1. Un énoncé clair
2. Une ou deux contraintes (ex: pas de fonction intégrée, temps de complexité, etc.)
3. Un exemple d’entrée/sortie

Réponds strictement en JSON :
{{
    "prompt_version": "v2.1",
    "enonce": "...",
    "contraintes": ["...", "..."],
    "exemple": "..."
}}
"""

    response = client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7
    )

    raw = response.choices[0].message.content or ""
    try:
        parsed = parse_json_response(raw)
        enonce = str(parsed.get("enonce") or "")
        contraintes = parsed.get("contraintes") if isinstance(parsed.get("contraintes"), list) else []
        contraintes_text = "\n".join([f"- {item}" for item in contraintes if isinstance(item, str)])
        exemple = str(parsed.get("exemple") or "")

        formatted = f"Énoncé: {enonce}\nContraintes:\n{contraintes_text}\nExemple: {exemple}"
        return {
            "challenge": formatted,
            "challenge_json": parsed,
        }
    except Exception:
        return {"challenge": raw}
