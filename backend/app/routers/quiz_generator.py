from fastapi import APIRouter
from pydantic import BaseModel
import openai
from app.config import settings

router = APIRouter()
openai.api_key = settings.OPENAI_API_KEY

class QuizRequest(BaseModel):
    theme: str
    level: str = "débutant"
    nb_questions: int = 3

@router.post("/generate-quiz/")
async def generate_quiz(req: QuizRequest):
    prompt = f"""
Tu es un professeur de programmation Python. Crée un quiz de {req.nb_questions} questions pour un étudiant de niveau {req.level}, sur le thème suivant : "{req.theme}".

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
Réponds uniquement avec du JSON valide.
"""

    response = openai.ChatCompletion.create(
        model="gpt-4-turbo",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4
    )

    # Extraire le JSON du texte généré
    content = response['choices'][0]['message']['content']

    try:
        quiz_data = eval(content)  # 💥 Pour sécuriser plus tard, utilise `json.loads()` si le modèle retourne du vrai JSON
        return {"quiz": quiz_data}
    except Exception:
        return {"raw_output": content, "error": "Échec du parsing du JSON"}
