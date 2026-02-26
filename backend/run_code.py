import sys

try:
    code = sys.stdin.read()
    exec(code)
except Exception as e:
    print(f"Erreur d'exécution : {e}")
