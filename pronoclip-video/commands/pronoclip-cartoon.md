---
description: Version dessin animé d'un match ou de la journée (équipe d'agents studio-cartoon)
argument-hint: "<équipe domicile> <équipe extérieur> <score> | demain | journée"
---

Produit la version **dessin animé** (mascottes, gags, style cartoon) d'un
ou plusieurs matchs, via l'équipe d'agents du skill `studio-cartoon`.

Arguments reçus : $ARGUMENTS

1. **Un match précis** (`PSG Real 2-1`) : invoquer le skill
   **`studio-cartoon`** avec ces entrées — il dispatche la chaîne
   scénariste → directeur artistique → compositeur → vérificateur légal.
2. **Une période** (`demain`, `J3 Ligue des Champions`) : invoquer le skill
   **`routine-matchs`** en précisant que la phase Act passe par
   `studio-cartoon` (un studio par match, max 2 studios en parallèle).

Rappels non négociables : personnages originaux uniquement (jamais de
caricature de joueur réel), modération `verificateur-legal` bloquante avant
toute publication, rendu 100 % local, durée 5–15 s.
