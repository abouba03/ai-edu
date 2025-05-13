# Utilise une image officielle Python légère
FROM python:3.11-slim

# Définit le dossier de travail dans le conteneur
WORKDIR /app

# Copie le fichier Python qui exécutera le code utilisateur
COPY run_code.py .

# Lance le script à chaque démarrage du conteneur
CMD ["python", "run_code.py"]
