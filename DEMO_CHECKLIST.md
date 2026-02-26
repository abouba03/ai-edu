# Demo Checklist — AI Edu Platform

## 1) Pré-requis
- [ ] Python env actif et dépendances backend installées.
- [ ] Node modules frontend installés.
- [ ] Fichier `backend/.env` configuré (OPENAI_API_KEY + mode exécution).
- [ ] Fichier `frontend/.env` configuré (DATABASE_URL valide).
- [ ] Fichier `frontend/.env.local` configuré (NEXT_PUBLIC_API_URL, mode local auth si besoin).
- [ ] (Optionnel prod) `ADMIN_CLERK_IDS` configuré pour restreindre l’accès admin.

## 2) Lancement
- [ ] Backend lancé:
  - `cd backend`
  - `python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`
- [ ] Frontend lancé:
  - `cd frontend`
  - `npm run dev`

## 3) Vérifications rapides
- [ ] API backend répond: `GET http://127.0.0.1:8000/`
- [ ] Frontend répond: `GET http://127.0.0.1:3000/`
- [ ] Pages clés répondent:
  - `/admin/formation`
  - `/generator`
  - `/debugger`
  - `/challenges`

## 4) Script de démo (3–5 minutes)
1. Ouvrir `/admin/formation` et ajuster un paramètre global + créer un cours.
2. Ouvrir `/generator` et générer un snippet Python simple.
3. Ouvrir `/debugger` et lancer une analyse guidée.
4. Ouvrir `/challenges`, générer un défi et soumettre une solution.
5. Montrer la persistance minimale:
   - `GET /api/events`
   - `GET /api/events/summary?limit=200`

## 5) Points à verbaliser pendant la démo
- IA pédagogique (génération + correction + guidage).
- Parcours utilisateur complet disponible.
- Traçabilité des interactions (events + KPI).
- Architecture découplée (Next.js / FastAPI / Prisma / Supabase).

## 6) Plan B en cas de problème
- [ ] Si erreur Clerk: activer `NEXT_PUBLIC_DISABLE_AUTH=true` en local.
- [ ] Si DB distante indisponible: fallback API local actif (`/api/me`, `/api/sync-user`, `/api/events`).
- [ ] Si port occupé: relancer backend sur un autre port et ajuster `NEXT_PUBLIC_API_URL`.

## 7) Post-démo
- [ ] Exporter les KPI via `/api/events/summary`.
- [ ] Noter les retours utilisateurs (questionnaire).
- [ ] Lister 3 améliorations prioritaires.
