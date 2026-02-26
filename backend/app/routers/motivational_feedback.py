from fastapi import APIRouter
from pydantic import BaseModel
from openai import OpenAI
from app.config import settings

router = APIRouter()
client = OpenAI(api_key=settings.OPENAI_API_KEY)

class FeedbackRequest(BaseModel):
    username: str
    recent_result: str  # ex: "a terminé un quiz avec 3/3", "a corrigé une erreur", etc.
    mood: str = "neutre"  # facultatif : "heureux", "frustré", "douteux"

@router.post("/motivational-feedback/")
async def generate_feedback(req: FeedbackRequest):
    prompt = f"""
Tu es un assistant motivant et bienveillant pour les étudiants en programmation.

L’étudiant {req.username} vient de faire ceci : {req.recent_result}.
Son humeur actuelle est : {req.mood}.

Tu dois générer un message court (1-2 phrases) pour l'encourager ou le féliciter, selon la situation.

Exemples :
- "Excellent travail, continue comme ça !"
- "Tu t’améliores à chaque étape. Garde le cap."

Le message doit être toujours positif, encourageant et adapté au contexte.
"""

    response = client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.8
    )

    return {"message": response.choices[0].message.content or ""}
