# Missions déjà faites

1. Flux principal défini et parcours principal disponible.
2. Routes frontend stabilisées (`/generator`, `/debugger`, `/challenges`).
3. Mode développement local stabilisé (bypass auth local + fallback API).
4. URLs backend uniformisées avec `NEXT_PUBLIC_API_URL`.
5. Persistance minimale implémentée (`LearningEvent`, `/api/events`, `/api/events/summary`).
6. Protocole de test utilisateur et questionnaire préparés.
7. Tests API non-régression ajoutés et validés (`pytest`: 6 passés).
8. Pack démo initial préparé (`DEMO_CHECKLIST.md` + `MEMOIRE_SYNTHESE_1PAGE.md`).

# Missions restantes

1. Compléter la validation d’entrée backend (`/generate`, `/correct`, `/interactive-debug`, `/generate-quiz`).
2. Normaliser les prompts pédagogiques en 3 blocs (explication, indice, correction possible).
3. Finaliser la rédaction mémoire avec résultats réels des tests utilisateurs (KPI + analyse).
