import openai
from app.config import settings

openai.api_key = settings.OPENAI_API_KEY

def correct_code(code: str) -> str:
    try:
        prompt = f"Corrige ce code Python et explique les erreurs. Juste ne sois pas long (resume):\n{code}"
        response = openai.ChatCompletion.create(
            model="gpt-4-turbo",
            messages=[
                {"role": "system", "content": "Vous êtes un expert en correction de code Python."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=500
        )
        return response['choices'][0]['message']['content']
    except Exception as e:
        return f"Erreur lors de la correction de votre requete : {str(e)}"
