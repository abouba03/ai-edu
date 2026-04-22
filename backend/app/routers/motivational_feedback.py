from fastapi import APIRouter
from pydantic import BaseModel
from openai import OpenAI
from app.config import settings

router = APIRouter()
client = OpenAI(api_key=settings.OPENAI_API_KEY or "missing-openai-key")

class FeedbackRequest(BaseModel):
    username: str
    recent_result: str
    mood: str = "нейтрально"

@router.post("/motivational-feedback/")
async def generate_feedback(req: FeedbackRequest):
    prompt = f"""
Ты доброжелательный наставник по программированию.

Ученик {req.username} сделал: {req.recent_result}.
Его текущее настроение: {req.mood}.

Сгенерируй короткое сообщение (1-2 фразы), чтобы поддержать или похвалить ученика.
Пиши только на простом русском языке.
Сообщение должно быть позитивным, уместным и понятным.
"""

    response = client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.8
    )

    return {"message": response.choices[0].message.content or ""}
