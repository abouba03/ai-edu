## Exécution sans Docker (100% opérationnel)

### 1) Backend

Terminal dans le dossier `/backend` :

```bash
env\Scripts\activate
```

Créer un fichier `.env` dans `/backend` avec :

```env
OPENAI_API_KEY=ta_cle_openai
EXECUTION_MODE=local
EXECUTION_TIMEOUT_SECONDS=5
EXECUTION_MAX_CODE_CHARS=20000
```

Lancer l'API :

```bash
uvicorn app.main:app --reload
```

### 2) Frontend

Terminal dans le dossier `/frontend` :

```bash
npm install
npm run dev
```

Ouvrir `http://localhost:3000`.

Créer aussi un fichier `/frontend/.env.local` :

```env
# Obligatoire si tu utilises Prisma côté frontend API routes
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB?schema=public

# Optionnel: bypass Clerk en local
NEXT_PUBLIC_DISABLE_AUTH=true
```

Si `DATABASE_URL` est invalide/non accessible, l'app passe en mode fallback (pas de persistance DB) sur `/api/me` et `/api/sync-user`.

### Persistance minimale des interactions (MVP)

Le projet enregistre maintenant des événements d'apprentissage via `/api/events` (génération, debug, soumission, etc.).

Après toute modification du schéma Prisma, exécuter dans `/frontend` :

```bash
npx prisma generate
npx prisma db push
```

Récupérer les 10 dernières actions :

```bash
curl http://localhost:3000/api/events
```

Résumé KPI (complétion/erreurs) :

```bash
curl http://localhost:3000/api/events/summary?limit=200
```

Protocoles de test utilisateur :
- `USER_TEST_PROTOCOL.md`
- `USER_TEST_QUESTIONNAIRE.md`

Si Clerk bloque en local (erreur `token-not-active-yet` / `Clock skew detected`), créer un fichier `.env.local` dans `/frontend` :

```env
NEXT_PUBLIC_DISABLE_AUTH=true
```

Puis relancer le frontend. Cela désactive temporairement la protection Clerk en développement local.

Option recommandée (pour garder Clerk actif) : corriger l'heure Windows puis resynchroniser :

```powershell
Set-TimeZone -Id "Morocco Standard Time"
w32tm /resync
```

## Mode Docker (optionnel)

Si tu veux isoler l'exécution de code dans un conteneur :

```bash
cd backend
docker build -t code-runner .
```

Puis mettre dans `/backend/.env` :

```env
EXECUTION_MODE=docker
```