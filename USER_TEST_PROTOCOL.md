# Protocole de test utilisateur (MVP)

## Objectif
Évaluer la valeur pédagogique de la plateforme sur un mini-parcours réel.

## Population cible
- 5 à 10 étudiants
- Niveau débutant/intermédiaire Python

## Durée par participant
- 25 à 30 minutes

## Scénario de test (ordre)
1. Ouvrir `/generator` et demander un code simple (boucle/fonction).
2. Ouvrir `/debugger` et soumettre une réponse guidée.
3. Ouvrir `/challenges` et soumettre une solution.
4. Répondre au questionnaire post-test.

## Données collectées
- Logs automatiques via `/api/events`
- Résumé KPI via `/api/events/summary`
- Feedback subjectif (questionnaire)

## KPI de base
- Taux de complétion = `success / start`
- Taux d’erreur = `error / start`
- Actions par feature (generator/debugger/challenge)
- Satisfaction moyenne (échelle 1-5)

## Critères de réussite MVP
- Complétion >= 70%
- Erreur <= 20%
- Satisfaction moyenne >= 4/5

## Commandes utiles (local)
```bash
curl http://localhost:3000/api/events?limit=50
curl http://localhost:3000/api/events/summary?limit=200
```

## Format de restitution (mémoire)
- Tableau KPI global
- 3 verbatims étudiants
- 3 améliorations prioritaires
