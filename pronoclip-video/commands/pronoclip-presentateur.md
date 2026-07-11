---
description: Présentateur cartoon animé qui parle (HeyGen Talking Photo) — PAYANT
argument-hint: "<équipe domicile> <équipe extérieur> <score> [voix fr]"
---

Génère un **présentateur animé qui parle** (avatar cartoon commentateur) via
l'API HeyGen Talking Photo, pour annoncer un pronostic.

Arguments reçus : $ARGUMENTS

Invoquer le skill **`presentateur-heygen`** :

1. Générer un portrait de présentateur **humain cartoon original** (jamais
   un joueur réel) via RapidoCMS.
2. Créer le Talking Photo HeyGen, choisir une voix française.
3. **Annoncer le coût estimé** (~1 crédit HeyGen par seconde de vidéo) et
   **attendre un OUI explicite** avant la génération payante.
4. Générer, poller, télécharger dans `./pronoclip-output/`.

⚠️ **Service PAYANT** au temps de rendu. Jamais dans une routine
automatisée. Vérifier `remaining_quota` avant de lancer.
