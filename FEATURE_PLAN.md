# Feature Plan - AI EDU Platform

## Objectif
Renforcer la valeur pedagogique et la preuve technique pour la soutenance.

## Priorite P0 (a faire d'abord)
- Validation finale basee sur execution reelle des tests
  - Etat: done
  - Description: la route submit s'appuie maintenant sur le moteur backend /submit-challenge/ et non sur une notation IA seule.
  - Impact: coherente avec l'exigence "programme correcte = tests passes".

- Comparaison de performance d'algorithmes
  - Etat: done
  - Description: affichage runs/courant/meilleur/moyenne + gain/perte vs meilleur dans l'onglet Tests.
  - Impact: comparaison objective entre versions d'algorithmes.

## Priorite P1
- Console erreurs visible (syntaxe + runtime + traceback)
  - Etat: pending (tab retire temporairement)
  - Description: afficher clairement erreurs Python et ligne fautive, dans un panneau dedie.

- Challenges multi-etapes (2-3 sous-objectifs)
  - Etat: pending
  - Description: generation de problemes combines avec validation par etapes.

- Visualisation graphique de sorties numeriques/fonctionnelles
  - Etat: partial
  - Description: etendre les graphes actuels vers des courbes de fonction sur domaine.

## Priorite P2
- Sandbox d'execution securisee
  - Etat: pending
  - Description: isolation de exec Python (process limite, restrictions modules, timeout strict).

- Suite de tests automatises pour routes exercise
  - Etat: pending
  - Description: tests non-regression pour generate/latest/execute/submit/stats.

## Criteres de validation soutenance
- Le code est valide uniquement par execution de tests reels.
- L'interface montre la performance de maniere comparee et lisible.
- Une demo montre au moins un cas multi-etapes + un cas avec comparaison d'algorithmes.
