---
description: Génère UNE vidéo de pronostic score exact (rendu local HyperFrames)
argument-hint: "<équipe domicile> <équipe extérieur> <score> [style] [--light]"
---

Génère une vidéo de pronostic PronoClip pour un match unique.

Arguments reçus : $ARGUMENTS

1. Parser les arguments : équipe domicile, équipe extérieur, score
   pronostiqué (ex. `2-1`), puis optionnellement le style
   (`réaliste-stylisé` | `cartoon` | `néon` | `rétro`) et le flag `--light`.
2. Invoquer le skill **`video-pronostic`** avec ces entrées. Le skill
   vérifie les entrées obligatoires manquantes (compétition, date/heure du
   match…) et les demande avant de générer — ne rien inventer.
3. Si `--light` est présent : mode léger (template texte + formes, sans
   `sequences-match` ni `audio-narration`).

Tout le workflow (références légales, composition, contrôles, rendu local,
log) est défini dans le skill `video-pronostic` — le suivre intégralement,
garde-fous compris.
