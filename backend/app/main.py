from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import AsyncOpenAI
from pathlib import Path
import sys
from app.config import settings
from app.corrector import correct_code
from app.routers import interactive_debug
from app.routers import challenge
from app.routers import motivational_feedback
from app.routers import quiz_generator
from app.prompting import build_pedagogy_block, parse_json_response
from typing import Any
import json

import subprocess

app = FastAPI()  # 👉 Doit être AVANT include_router

app.include_router(interactive_debug.router)
app.include_router(quiz_generator.router)
app.include_router(motivational_feedback.router)
app.include_router(challenge.router)

openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Autoriser toutes les origines pour le moment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CodeRequest(BaseModel):
    code: str

# Modèle pour la soumission de défi
class SubmissionRequest(BaseModel):
    challenge_description: str
    student_code: str

# Modèle pour la génération de code
class CodePrompt(BaseModel):
    prompt: str
    pedagogy_context: dict[str, Any] | None = None

# Modèle pour la correction de code
class CodeCorrection(BaseModel):
    code: str
    pedagogy_context: dict[str, Any] | None = None

MAX_PROMPT_CHARS = 4000

@app.get("/")
async def root():
    return {"message": "API opérationnelle avec FastAPI et OpenAI"}

@app.post("/generate/")
async def generate(data: CodePrompt):
    prompt = (data.prompt or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Le prompt est vide. Merci de décrire le besoin en code.")
    if len(prompt) > MAX_PROMPT_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Le prompt est trop long. Maximum autorisé: {MAX_PROMPT_CHARS} caractères."
        )

    try:
        generated_code = await generate_code(prompt, data.pedagogy_context)
        return {"code": generated_code}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Le service IA est temporairement indisponible. Vérifiez la clé API OpenAI et réessayez."
        )

async def generate_code(prompt: str, pedagogy_context: dict[str, Any] | None = None) -> str:
    pedagogy_block = build_pedagogy_block(pedagogy_context)
    response = await openai_client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[
            {
                "role": "system",
                "content": (
                    "Vous êtes un assistant expert en programmation Python. "
                    "Rendez une réponse strictement JSON valide au format: "
                    "{\"code\": string, \"explanation\": string, \"safety_checks\": string[]}. "
                    "N'inventez pas de bibliothèques ou API inexistantes."
                ),
            },
            {"role": "user", "content": f"{pedagogy_block}\nDemande utilisateur:\n{prompt}"}
        ],
        temperature=0.5,
        max_tokens=500
    )
    content = response.choices[0].message.content
    try:
        parsed = parse_json_response(content or "")
        code = parsed.get("code")
        if isinstance(code, str) and code.strip():
            return code
    except Exception:
        pass
    return content or ""

@app.post("/correct/")
async def correct(data: CodeCorrection):
    code = (data.code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Le code est vide. Merci d'ajouter du code à corriger.")
    if len(code) > settings.EXECUTION_MAX_CODE_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Le code est trop long. Maximum autorisé: {settings.EXECUTION_MAX_CODE_CHARS} caractères."
        )

    try:
        corrected_code = correct_code(code, data.pedagogy_context)
        parsed = None
        try:
            parsed = parse_json_response(corrected_code)
        except Exception:
            parsed = None

        if isinstance(parsed, dict):
            return {
                "corrected_code": parsed.get("corrected_code") or "",
                "explanation": parsed.get("explanation") or "",
                "hint_question": parsed.get("hint_question") or "",
                "prompt_version": parsed.get("prompt_version") or "v2.1",
            }

        return {
            "corrected_code": corrected_code,
            "explanation": "",
            "hint_question": "",
            "prompt_version": "v2.1-fallback",
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Erreur interne lors de la correction du code.")


@app.post("/execute/")
async def execute_code(request: CodeRequest):
    if len(request.code) > settings.EXECUTION_MAX_CODE_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Code trop long. Maximum autorisé: {settings.EXECUTION_MAX_CODE_CHARS} caractères."
        )

    run_code_path = Path(__file__).resolve().parents[1] / "run_code.py"
    mode = settings.EXECUTION_MODE.lower().strip()

    try:
        if mode == "docker":
            command = ['docker', 'run', '-i', '--rm', 'code-runner']
        elif mode == "local":
            command = [sys.executable, str(run_code_path)]
        else:
            raise HTTPException(
                status_code=500,
                detail=(
                    "EXECUTION_MODE invalide. Utilisez 'local' ou 'docker'."
                )
            )

        result = subprocess.run(
            command,
            input=request.code,
            capture_output=True,
            text=True,
            timeout=settings.EXECUTION_TIMEOUT_SECONDS,
            cwd=str(run_code_path.parent)
        )
        output = result.stdout if result.stdout else result.stderr
        return {"output": output}
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=408,
            detail=f"Temps d'exécution dépassé ({settings.EXECUTION_TIMEOUT_SECONDS}s)."
        )
    except FileNotFoundError:
        if mode == "docker":
            raise HTTPException(
                status_code=500,
                detail="Docker introuvable. Passez EXECUTION_MODE=local ou installez Docker."
            )
        raise HTTPException(status_code=500, detail="Exécutable Python introuvable.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
  