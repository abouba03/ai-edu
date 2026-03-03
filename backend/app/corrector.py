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
            f"Énoncé du challenge:\n{challenge_description.strip()}\n\n"
            if challenge_description.strip()
            else ""
        )

        tests_block = ""
        if isinstance(challenge_tests, dict) and challenge_tests:
            tests_block = (
                "Tests/contraintes à respecter (source de vérité):\n"
                f"{json.dumps(challenge_tests, ensure_ascii=False, indent=2)}\n\n"
            )

        failed_block = ""
        if isinstance(failed_tests, list) and failed_tests:
            failed_block = (
                "Tests actuellement en échec (priorité de correction):\n"
                f"{json.dumps(failed_tests, ensure_ascii=False, indent=2)}\n\n"
            )

        prompt = (
            f"{pedagogy_block}\n"
            "Tu es un tuteur Python fiable. Corrige le code sans halluciner. "
            "La correction DOIT respecter strictement l'énoncé et les tests fournis. "
            "N'invente jamais des catégories/sorties différentes de celles attendues dans les tests. "
            "Si un libellé attendu est 'tarif réduit', ne le remplace pas par un synonyme. "
            "Réponds STRICTEMENT en JSON valide:\n"
            "{\n"
            '  "prompt_version": "v2.2-challenge-aware",\n'
            '  "corrected_code": "...",\n'
            '  "explanation": "...",\n'
            '  "hint_question": "..."\n'
            "}\n"
            f"{challenge_block}"
            f"{tests_block}"
            f"{failed_block}"
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
