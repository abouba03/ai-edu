import sys

try:
    # Lecture du code depuis l'entrée standard
    code = sys.stdin.read()
    exec(code)
except Exception as e:
    print(f"Erreur d'exécution : {e}")
