---
description: Génère UNE vidéo de pronostic score exact (~40 s, rendu local gratuit)
argument-hint: "<équipe domicile> <équipe extérieur> [score] [compétition]"
---

Génère une vidéo de pronostic PronoClip pour un match unique (9:16, ~40 s).

Arguments reçus : $ARGUMENTS

1. Parser : équipe domicile, équipe extérieur, puis optionnellement le score
   (`2-0` → L1 ; absent → **L0**, le moteur prédit le score) et la compétition.
2. Invoquer le skill **`video-pronostic`** et suivre son pipeline (predict →
   match-script → composition → rendu local → voix off + audio). Il demande les
   entrées obligatoires manquantes (compétition, date/heure) — ne rien inventer.
3. Rendu **local et gratuit** par défaut (tier `motion`, Chrome + ffmpeg). Le tier
   `animated` (Kling, payant) et la voix `elevenlabs` sont **opt-in explicites**.

Démo immédiate sans argument ni config : `npm run render` produit le MP4 France vs
Espagne. Garde-fous (zéro logo/visage, mention IA, jamais le MCP payant `render_video`)
dans le skill `video-pronostic` — les suivre intégralement.
