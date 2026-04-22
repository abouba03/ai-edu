from openai import OpenAI
from app.config import settings
from app.prompting import build_pedagogy_block
from typing import Any
import json

client = OpenAI(api_key=settings.OPENAI_API_KEY or "missing-openai-key")

def correct_code(
    code: str,
    pedagogy_context: dict[str, Any] | None = None,
    challenge_description: str = "",
    challenge_tests: dict[str, Any] | None = None,
    failed_tests: list[dict[str, Any]] | None = None,
) -> str:
    try:
        pedagogy_block = build_pedagogy_block(pedagogy_context)
        challenge_block = (
            f"Условие задачи:\n{challenge_description.strip()}\n\n"
            if challenge_description.strip()
            else ""
        )

        tests_block = ""
        if isinstance(challenge_tests, dict) and challenge_tests:
            tests_block = (
                "Тесты и ограничения (главный ориентир):\n"
                f"{json.dumps(challenge_tests, ensure_ascii=False, indent=2)}\n\n"
            )

        failed_block = ""
        if isinstance(failed_tests, list) and failed_tests:
            failed_block = (
                "Тесты, которые сейчас не проходят (приоритет исправления):\n"
                f"{json.dumps(failed_tests, ensure_ascii=False, indent=2)}\n\n"
            )

        prompt = (
            f"{pedagogy_block}\n"
            "Ты надежный наставник по Python. Отвечай только на простом русском языке. "
            "Исправь код без выдумок. "
            "Исправление ДОЛЖНО строго соответствовать условию и тестам. "
            "Не меняй ожидаемые формулировки в тестах на синонимы. "
            "Ответ строго в валидном JSON:\n"
            "{\n"
            '  "prompt_version": "v2.2-challenge-aware",\n'
            '  "corrected_code": "...",\n'
            '  "explanation": "...",\n'
            '  "hint_question": "..."\n'
            "}\n"
            f"{challenge_block}"
            f"{tests_block}"
            f"{failed_block}"
            "Код ученика:\n"
            f"{code}"
        )
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Ты эксперт по исправлению Python-кода и педагогике. "
                        "Пиши только на простом русском языке и отвечай только строгим JSON."
                    ),
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=500
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        return f"Ошибка при проверке запроса: {str(e)}"
