import openai
from app.config import settings

openai.api_key = settings.OPENAI_API_KEY

def generate_code(prompt: str) -> str:
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4-turbo",
            messages=[
                {"role": "system", "content": "Ты экспертный помощник по Python. Отвечай только на простом русском языке."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            max_tokens=300
        )
        return response['choices'][0]['message']['content']
    except Exception as e:
        return f"Ошибка при генерации кода: {str(e)}"
