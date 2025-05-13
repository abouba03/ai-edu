from fastapi import APIRouter
from pydantic import BaseModel
import openai
from app.config import settings

# Créer un routeur FastAPI
router = APIRouter()

# Charger la clé API depuis le fichier de config
openai.api_key = settings.OPENAI_API_KEY

# Modèle Pydantic
class DebugRequest(BaseModel):
    code: str
    level: str = "débutant"
    step: int = 0
    student_answer: str = ""

# Route POST
@router.post("/interactive-debug/")
async def interactive_debug(req: DebugRequest):
    # Si l'étudiant n’a pas encore répondu, l’IA pose une première question
    if req.student_answer.strip() == "":
        prompt = f"""
Tu es un tuteur en programmation. Voici un code donné par un étudiant :

{req.code}

Tu ne dois pas corriger le code directement. Tu dois :
1. Identifier une erreur dans le code.
2. Poser une question guidée pour aider l’étudiant à comprendre cette erreur.
3. Donner un petit indice pour l’aider à y réfléchir, sans donner la réponse.

Niveau de l’étudiant : {req.level}
Étape : {req.step}

Réponds avec ce format :
Question : ...
Indice : ...
"""
    else:
        # Si l’étudiant a déjà répondu, on analyse sa réponse
        prompt = f"""
Tu es un tuteur bienveillant en programmation. L’étudiant t’a donné ce code :

{req.code}

Tu lui as posé une question, et voici sa réponse :

\"{req.student_answer}\"

Maintenant, tu dois :
1. Dire si cette réponse est correcte ou incorrecte.
2. Fournir un retour constructif.
3. Si la réponse est correcte, donne un indice vers la correction ou la suite logique.
4. Sinon, reformule ta question ou propose un nouvel indice.

Niveau de l’étudiant : {req.level}
Étape : {req.step}

Réponds avec ce format :
Feedback : ...
Nouvelle question ou indice : ...
"""

    # Appel GPT-4
    response = openai.ChatCompletion.create(
        model="gpt-4-turbo",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5
    )

    return {
        "response": response.choices[0].message.content
    }
