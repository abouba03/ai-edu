import os
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")

class Settings:
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    EXECUTION_MODE = os.getenv("EXECUTION_MODE", "local")
    EXECUTION_TIMEOUT_SECONDS = int(os.getenv("EXECUTION_TIMEOUT_SECONDS", "5"))
    EXECUTION_MAX_CODE_CHARS = int(os.getenv("EXECUTION_MAX_CODE_CHARS", "20000"))

settings = Settings()
