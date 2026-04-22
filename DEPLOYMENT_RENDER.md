# AI Edu Platform - Guide de Déploiement sur Render

## Vue d'ensemble du projet

Plateforme EdTech intelligente pour l'apprentissage de Python avec IA, comprenant:
- **Frontend**: Next.js 15 (TypeScript, Tailwind CSS)
- **Backend**: FastAPI (Python)
- **Base de données**: PostgreSQL
- **Auth**: Clerk

## Prérequis

1. [Compte Render](https://render.com)
2. [Compte GitHub](https://github.com) (pour connecter votre repo)
3. Clés API:
   - OpenAI API Key
   - Clerk API Keys (Publishable & Secret)
4. Base de données PostgreSQL (fournie par Render)

## Déploiement sur Render

### Étape 1: Préparer votre repo

1. Committez tous les changements:
```bash
git add .
git commit -m "Préparer pour déploiement sur Render"
git push origin main
```

### Étape 2: Créer une base de données PostgreSQL

1. Dans le Dashboard Render, cliquez sur **+ New**
2. Sélectionnez **PostgreSQL**
3. Configurez:
   - **Name**: ai-edu-db
   - **Database**: ai_edu_platform
   - **User**: default_user
   - Copiez l'Internal Database URL

### Étape 3: Déployer le backend FastAPI

1. Cliquez sur **+ New** → **Web Service**
2. Connectez votre repo GitHub
3. Configurez:
   - **Name**: ai-edu-backend
   - **Environment**: Docker
   - **Dockerfile Path**: `./backend/Dockerfile`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port 8000`

4. Ajoutez les Environment Variables:
   ```
   DATABASE_URL=<votre PostgreSQL URL>
   OPENAI_API_KEY=<votre clé OpenAI>
   EXECUTION_MODE=local
   EXECUTION_TIMEOUT_SECONDS=5
   EXECUTION_MAX_CODE_CHARS=20000
   PYTHONUNBUFFERED=1
   ```

5. Cliquez sur **Create Web Service**
6. Attendez le déploiement et copiez l'URL du service

### Étape 4: Préparer le Frontend

1. Cliquez sur **+ New** → **Web Service**
2. Connectez votre repo GitHub
3. Configurez:
   - **Name**: ai-edu-frontend
   - **Environment**: Node
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Start Command**: `cd frontend && npm start`
   - **Root Directory**: `/`

4. Ajoutez les Environment Variables:
   ```
   NEXT_PUBLIC_API_URL=https://ai-edu-backend.onrender.com
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<votre clé publique Clerk>
   CLERK_SECRET_KEY=<votre clé secrète Clerk>
   DATABASE_URL=<votre PostgreSQL URL>
   NODE_ENV=production
   ```

5. Cliquez sur **Create Web Service**

### Étape 5: Initialiser la base de données (première fois seulement)

Une fois le backend déployé:

1. Accédez au shell Render du backend
2. Exécutez:
   ```bash
   prisma migrate deploy
   ```

## Vérification du déploiement

### Backend
Testez l'endpoint de santé:
```
GET https://ai-edu-backend.onrender.com/health
```

### Frontend
Accédez à:
```
https://ai-edu-frontend.onrender.com
```

## Variables d'environnement requises

### Backend (.env)
```
OPENAI_API_KEY=sk-...
EXECUTION_MODE=local
EXECUTION_TIMEOUT_SECONDS=5
EXECUTION_MAX_CODE_CHARS=20000
DATABASE_URL=postgresql://...
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=https://ai-edu-backend.onrender.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
DATABASE_URL=postgresql://...
```

## Dépannage

### Erreur: "Import failed"
- Vérifiez que tous les dépendances sont installées
- Pour le backend: `pip install -r backend/requirements.txt`
- Pour le frontend: `cd frontend && npm install`

### Erreur: "Database connection failed"
- Vérifiez que DATABASE_URL est correct
- Vérifiez que la base de données PostgreSQL est créée

### Erreur: "Clerk authentication failed"
- Vérifiez vos clés Clerk
- Assurez-vous que l'URL de frontend est ajoutée dans les settings Clerk

### Logs en temps réel
Dans le dashboard Render, cliquez sur le service et allez à **Logs** pour voir les erreurs

## Structure du projet

```
ai-edu-platform/
├── backend/                 # FastAPI Server
│   ├── app/
│   │   ├── main.py         # Application principale
│   │   ├── routers/        # Endpoints API
│   │   └── config.py       # Configuration
│   ├── requirements.txt    # Dépendances Python
│   └── Dockerfile          # Configuration Docker
├── frontend/               # Next.js Application
│   ├── app/                # Pages et layouts
│   ├── components/         # Composants React
│   ├── lib/                # Utilitaires
│   ├── prisma/             # Schéma DB
│   └── package.json        # Dépendances Node
└── render.yaml             # Configuration Render (optionnel)
```

## Informations de contact

Pour des questions, consultez:
- [Documentation Render](https://render.com/docs)
- [Documentation Next.js](https://nextjs.org/docs)
- [Documentation FastAPI](https://fastapi.tiangolo.com)
- [Documentation Clerk](https://clerk.com/docs)
