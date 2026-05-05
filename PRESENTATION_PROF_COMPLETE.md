# Plateforme IA-Edu - Dossier de presentation (prof)

Date: 05/05/2026

## 1) Vision du projet
La plateforme IA-Edu est une application web pedagogique pour l'apprentissage du Python.
Elle combine:
- generation de contenu par IA,
- exercices adaptatifs selon le niveau de l'apprenant,
- evaluation automatique par tests,
- suivi de progression et analytics.

Objectif pedagogique principal:
- faire pratiquer l'etudiant avec un parcours progressif (du debutant vers avance),
- offrir un feedback immediat et actionnable,
- mesurer les progres avec des indicateurs concrets.

## 2) Stack technique
- Frontend: Next.js (App Router), React, TypeScript.
- Editeur de code: Monaco.
- Backend IA/execution Python: API Python dediee (proxy via routes Next).
- Donnees: Prisma + base SQL (avec fallback local sur certaines routes en dev).
- Authentification: Clerk (desactivable en local).
- Temps reel: WebSocket/Socket.IO pour console interactive.

## 3) Modules fonctionnels
- Module Cours/Formations.
- Module Defis/Challenges.
- Module Generateur IA (code + exercices adaptatifs).
- Module Correcteur/Debugger/Tuteur.
- Module Dashboard/Profil/Insights.
- Module Administration.

## 4) Inventaire des pages Frontend

## 4.1 Pages principales utilisateur

### / (page d'accueil)
- Presentation academique du projet.
- Acces rapide aux modules de demonstration.
- Contenu principalement statique.

### /dashboard
- Vue synthese des activites de l'apprenant.
- Cartes KPI (progression, activite, performance).
- Agregation d'evenements de la plateforme.

### /dashboard/insights
- Analyse pedagogique plus detaillee.
- Visualisation d'indicateurs de progression.
- Recommandations d'axes d'amelioration.

### /profile
- Informations utilisateur.
- Resume progression, badges/objectifs (selon donnees disponibles).

## 4.2 Cours et formations

### /courses
- Catalogue des cours.
- Organisation par parcours/formation.
- Acces aux contenus d'apprentissage.

### /courses/[slug]
- Detail d'un cours.
- Ressources du cours + progression.
- Acces aux activites associees (quiz/mini-defi selon configuration).

### /courses/[slug]/mini-challenge
- Mini-defi pratique lie au cours.
- Editeur code + validation par tests.
- Feedback immediat sur la solution.

### /courses/formations/[formationSlug]
- Vue d'une formation complete.
- Cours inclus + etat d'avancement.

## 4.3 Defis

### /challenges
- Liste des defis disponibles.
- Classement et progression sur les defis.

### /challenges/[challengeId]
- Defi detaille.
- Editeur + consignes + tests.
- Soumission et evaluation.

### /challenges/[challengeId]/resultat
- Resultat d'une tentative.
- Resume des tests passes/echoues.
- Feedback pedagogique.

## 4.4 Generateur IA

### /generator
- Hub de navigation vers les 2 modes:
  - generation libre de code,
  - exercices adaptatifs.

### /generator/code
- Generation libre de code Python a partir d'une demande.
- Explication de la solution generee.
- Console interactive (WebSocket) pour execution.
- Evaluation de la solution selon tests.
- Mode utile pour apprendre par demonstration guidee.

### /generator/exercise
- Coeur pedagogique adaptatif.
- Generation automatique d'exercices selon niveau/difficulte utilisateur.
- Difficulty evolue avec les performances (points, succes, serie de victoires).
- Execution locale/sandbox + soumission + score.
- Mesure de temps de resolution et performance.
- Nouvelle logique validee:
  - exo aleatoire selon niveau,
  - combinaison de plusieurs concepts,
  - resolution multi-etapes,
  - 2e ligne en haut = affichage informatif des concepts de l'exercice (non selectable).

## 4.5 Outils d'assistance

### /corrector
- Correcteur de code pedagogique.
- Analyse et suggestions d'amelioration.

### /debugger
- Debogage guide et interactif.
- Aide a comprendre les erreurs et la logique de correction.

### /tuteur
- Assistant conversationnel pedagogique.
- Echanges pour clarifier concepts et methode.

## 4.6 Administration

### /admin
- Point d'entree administration.
- Acces aux modules de gestion.

### /admin/cours
- Gestion du catalogue de cours (CRUD).

### /admin/challenge
- Gestion des challenges (CRUD).

### /admin/formations
- Gestion des formations/parcours (CRUD).

### /admin/formules
- Gestion des formules/offres (CRUD).

### /admin/formation
- Parametres pedagogiques globaux (selon configuration actuelle).

### /admin/page
- Vue synthese admin (compteurs et acces rapides).

## 4.7 Auth

### /(auth)/(routes)/sign-in/[[...sign-in]]
- Connexion utilisateur.

### /(auth)/(routes)/sign-up/[[...sign-up]]
- Inscription utilisateur.

## 5) Inventaire API (frontend/app/api)

## 5.1 Domaine Exercise
- /api/exercise/generate: genere exercice adapte.
- /api/exercise/latest: dernier exercice brouillon de l'utilisateur.
- /api/exercise/execute: execution code.
- /api/exercise/submit: soumission + score + progression.
- /api/exercise/stats: stats progression exercise.

## 5.2 Domaine Generator Code
- /api/generator/code/generate: generation libre de code.
- /api/generator/code/generate-challenge: generation d'un challenge complet.
- /api/generator/code/submit-challenge: evaluation d'une solution.
- /api/generator/code/interactive-debug: aide de debogage interactive.

## 5.3 Domaine Challenges
- /api/challenges: listing defis.
- /api/challenges/[challengeId]: detail d'un defi.
- /api/challenges/attempts: historique + soumissions.
- /api/challenges/classement: leaderboard.

## 5.4 Domaine Cours et progression
- /api/course-progress: enregistrement progression cours.
- /api/course-orchestration: orchestration pedagogique.

## 5.5 Domaine Learner
- /api/learner/progression: profil progression.
- /api/learner/ai-profile: profil pedagogique derive des interactions.
- /api/learner/ai-settings: reglages IA utilisateur.

## 5.6 Domaine Events/Analytics
- /api/events: tracking d'evenements pedagogiques.
- /api/events/summary: resume analytique.
- /api/events/mini-challenge-kpis: KPI mini-defis.

## 5.7 Domaine utilisateur
- /api/me: utilisateur courant.
- /api/sync-user: synchronisation compte.

## 5.8 Domaine admin
- /api/admin/courses (+ [id]).
- /api/admin/challenges (+ [id], analytics).
- /api/admin/formations (+ [id]).
- /api/admin/formules (+ [id]).
- /api/admin/analytics.
- /api/admin/training-settings.

## 6) Mecanique pedagogique adapative (point cle pour soutenance)

### 6.1 Adaptation automatique
- Le systeme suit points, succes/erreurs, difficultes.
- La difficulte de l'exercice est ajustee automatiquement.
- Les themes/concepts sont choisis automatiquement selon niveau.

### 6.2 Evaluation objective
- Execution et verification par tests.
- Retour sur cas passes/echoues.
- Score exploitable pour progression.

### 6.3 Boucle d'apprentissage
- Generer -> coder -> executer -> soumettre -> feedback -> ajuster difficulte.
- Cette boucle est au centre de /generator/exercise.

## 7) Demonstration recommandee devant le prof

### Scenario 1: Exercice adaptatif
1. Ouvrir /generator/exercise.
2. Montrer niveau/difficulte/points en top bar.
3. Generer un exo et montrer la ligne "concepts de l'exercice".
4. Faire une tentative partielle puis soumettre.
5. Montrer feedback + evolution stats.

### Scenario 2: Generation libre + explication
1. Ouvrir /generator/code.
2. Saisir une demande Python.
3. Montrer code genere + console execution + evaluation.
4. Souligner la valeur pedagogique "exemple explique".

### Scenario 3: Tracking & insights
1. Ouvrir /dashboard puis /dashboard/insights.
2. Montrer KPI et progression globale.
3. Expliquer comment les donnees guident la personnalisation.

## 8) Forces du projet
- Integration complete: generation IA + execution + evaluation + analytics.
- Orientation pedagogique (pas uniquement generation brute de code).
- Progression adaptative par performance.
- Architecture modulaire et evolutive (frontend routes + API domain-driven).

## 9) Limites actuelles et evolutions possibles
- Uniformiser encore certains textes/UI entre modules.
- Ajouter plus de visualisations de performance (comparaisons historiques).
- Etendre les parcours multi-langages (au-dela de Python).
- Renforcer la couche admin analytique (rapports exportables).

## 10) Conclusion pour soutenance
La plateforme ne se limite pas a "generer du code".
Elle implemente un cycle pedagogique complet:
- personnalisation,
- pratique active,
- correction mesurable,
- suivi longitudinal.

C'est cette boucle d'apprentissage instrumentee qui constitue la contribution principale du projet.
