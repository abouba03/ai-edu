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
    level: str = "начинающий"
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
        raise HTTPException(status_code=400, detail="Тема квиза пустая.")
    if len(theme) > MAX_THEME_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Тема слишком длинная. Максимум: {MAX_THEME_CHARS} символов."
        )

    level = (req.level or "").strip().lower()
    if level not in ALLOWED_LEVELS:
        raise HTTPException(
            status_code=400,
            detail="Неверный уровень. Разрешены: débutant, intermédiaire, avancé."
        )

    if req.nb_questions < 1 or req.nb_questions > 12:
        raise HTTPException(status_code=400, detail="Количество вопросов должно быть от 1 до 12.")

    pedagogy_block = build_pedagogy_block(req.pedagogy_context)

    composition_rules = f"""
Требования к квизу:
- Обязательно смешать типы вопросов:
    - минимум 3 вопроса Верно/Неверно с вариантами ["Верно", "Неверно"]
    - остальные вопросы в формате QCM (3-4 правдоподобных варианта)
- Только один правильный ответ.
- Сложность должна постепенно расти и соответствовать уровню {level}.
""" if req.nb_questions >= 8 else f"""
Требования к квизу:
- По возможности смешивай вопросы Верно/Неверно и QCM.
- Только один правильный ответ.
- Сложность должна постепенно расти и соответствовать уровню {level}.
"""

    prompt = f"""
{pedagogy_block}

Ты преподаватель Python. Создай квиз из {req.nb_questions} вопросов для ученика уровня {level} по теме: "{theme}".

{composition_rules}

Формат:
[
    {{
        "question": "...",
        "choices": ["...","...","..."],
        "answer": "...",
        "explanation": "..."
    }},
    ...
]
Пиши просто, только на русском языке, и верни только строгий валидный JSON.
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Внутренняя ошибка при генерации квиза.")

    # Извлекаем JSON из ответа модели
    content = response.choices[0].message.content or ""
    normalized = _extract_json_payload(content)

    try:
        quiz_data = json.loads(normalized)
        if not isinstance(quiz_data, list):
            raise ValueError("Модель не вернула JSON-массив")
        return {"quiz": quiz_data}
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Модель вернула неверный ответ. Попробуйте снова."
        )
