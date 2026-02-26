# Synthèse Mémoire (1 page)

## Titre
Analyse de l’applicabilité des transformeurs pour la génération et la correction automatique de code dans un système éducatif.

## Problématique
L’apprentissage de la programmation souffre d’un manque de feedback immédiat, d’un accompagnement peu personnalisé, et d’une forte charge de correction pour les enseignants. La question centrale est: comment utiliser efficacement les modèles de type Transformer pour générer, corriger et expliquer du code de façon pédagogique?

## Objectif
Concevoir une plateforme intelligente d’apprentissage Python capable de:
- générer du code à partir d’un besoin,
- corriger et expliquer les erreurs,
- guider l’étudiant dans un débogage interactif,
- proposer quiz/défis,
- tracer les interactions pour évaluer la progression.

## Méthodologie
1. Analyse des besoins pédagogiques.
2. Conception d’une architecture modulaire.
3. Développement d’un MVP fonctionnel.
4. Validation technique (tests API non-régression).
5. Préparation d’une évaluation utilisateur (protocole + questionnaire + KPI).

## Architecture technique
- Frontend: Next.js + Monaco Editor + UI interactive.
- Backend: FastAPI + endpoints IA (génération, correction, debug, quiz, défis).
- Données: PostgreSQL (Supabase) + Prisma.
- Traçabilité: API `events` + endpoint `events/summary`.

## Résultats obtenus (MVP)
- Parcours principal opérationnel (`/generator`, `/debugger`, `/challenges`).
- Validation d’entrée renforcée sur endpoints critiques.
- Tests non-régression backend implémentés et passants.
- Persistance minimale des interactions et calcul KPI de base.

## Apports
- Pour l’étudiant: feedback immédiat, guidage pas à pas, apprentissage plus autonome.
- Pour l’enseignant: réduction de la charge de correction, meilleure visibilité sur la progression.

## Limites
- Dépendance à des services externes (LLM/API/DB).
- Qualité de réponse variable selon prompts et contexte.
- Gamification avancée et adaptation fine encore hors MVP.

## Perspectives
- Améliorer la personnalisation pédagogique par profil d’erreurs.
- Étendre l’évaluation avec un panel plus large d’étudiants.
- Ajouter un tableau de bord enseignant et des recommandations automatiques.
