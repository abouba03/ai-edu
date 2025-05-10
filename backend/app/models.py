import openai
from app.config import settings

openai.api_key = settings.OPENAI_API_KEY

def generate_code(prompt: str) -> str:
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4-turbo",
            messages=[
                {"role": "system", "content": "Vous êtes un assistant expert en programmation Python."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            max_tokens=300
        )
        return response['choices'][0]['message']['content']
    except Exception as e:
        return f"Erreur lors de la génération du code : {str(e)}"
