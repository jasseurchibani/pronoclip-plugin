---
description: Démo — MP4 de pronostic sur un match FICTIF, zéro config, motion gratuit
argument-hint: "[score H-A]"
---

Produit une vidéo de démonstration (~40 s, 9:16) sur un **match fictif** (Rovers vs
Comets), **sans aucune configuration** : pas de company ID, pas de clé API, pas
d'effectif réel. Rendu **local et gratuit** (tier `motion`) — aucune génération payante,
aucun MCP.

Arguments reçus : $ARGUMENTS

1. Sans score → le moteur **prédit** le score (plafonné, buteurs pondérés par profil).
   Avec un score (`2-1`) → il est **respecté à l'identique**.
2. Lancer :

   ```bash
   npm run demo                 # score prédit
   npm run demo -- --score 2-1  # score imposé 2-1
   ```

3. Le MP4 sort dans `./pronoclip-output/demo_rovers-vs-comets_<score>.mp4` :
   face-à-face → buts → résultat final, filigrane IA + carton de fin, voix off locale
   (dégradée en musique + whoosh si aucune TTS locale).

C'est l'exemple de référence de `USAGE.md`. Garde-fous : mention IA garantie par le hook
`assertDisclosure` ; zéro logo/visage (panneaux générés) ; jamais le MCP payant.
