from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openai
from app.config import settings
from app.corrector import correct_code

app = FastAPI()

# Charger la clé API explicitement
openai.api_key = settings.OPENAI_API_KEY

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Autoriser toutes les origines pour le moment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modèle pour la génération de code
class CodePrompt(BaseModel):
    prompt: str

# Modèle pour la correction de code
class CodeCorrection(BaseModel):
    code: str

@app.get("/")
async def root():
    return {"message": "API opérationnelle avec FastAPI et OpenAI"}

@app.post("/generate/")
async def generate(data: CodePrompt):
    try:
        generated_code = await generate_code(data.prompt)
        return {"code": generated_code}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def generate_code(prompt: str) -> str:
    try:
        response = await openai.ChatCompletion.acreate(
            model="gpt-4-turbo",
            messages=[
                {"role": "system", "content": "Vous êtes un assistant expert en programmation Python."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            max_tokens=150
        )
        return response['choices'][0]['message']['content']
    except Exception as e:
        return f"Erreur lors de la génération du code : {str(e)}"

@app.post("/correct/")
async def correct(data: CodeCorrection):
    try:
        corrected_code = correct_code(data.code)
        return {"corrected_code": corrected_code}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
