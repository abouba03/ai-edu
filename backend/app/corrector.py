from openai import OpenAI
from app.config import settings
from app.prompting import build_pedagogy_block
from typing import Any

client = OpenAI(api_key=settings.OPENAI_API_KEY)

def correct_code(code: str, pedagogy_context: dict[str, Any] | None = None) -> str:
    try:
        pedagogy_block = build_pedagogy_block(pedagogy_context)
        prompt = (
            f"{pedagogy_block}\n"
            "Tu es un tuteur Python fiable. Corrige le code sans halluciner. "
            "Réponds STRICTEMENT en JSON valide:\n"
            "{\n"
            '  "prompt_version": "v2.1",\n'
            '  "corrected_code": "...",\n'
            '  "explanation": "...",\n'
            '  "hint_question": "..."\n'
            "}\n"
            "Code étudiant:\n"
            f"{code}"
        )
        response = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Vous êtes un expert en correction de code Python et pédagogie. "
                        "Ne répondez qu'en JSON strict."
                    ),
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=500
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        return f"Erreur lors de la correction de votre requete : {str(e)}"
