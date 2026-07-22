---
name: video-pronostic
description: >-
  Utiliser quand l'utilisateur ou une routine veut générer une vidéo de
  pronostic, un clip de score exact, une vidéo de match PronoClip, ou tout
  visuel vidéo football à partir d'un pronostic. Déclencher aussi sur "clip",
  "vidéo du match", "génère la vidéo X-Y".
---

# Vidéo de pronostic PronoClip (score exact)

Génère une vidéo verticale 9:16 de ~40 s de pronostic « score exact » :
prédiction déterministe → script de match → composition HTML animée → rendu
**local et gratuit** (Chrome headless + ffmpeg) → voix off + lit musical + SFX.

> **Le pipeline est CODÉ** dans `core/` + `adapters/` — ce skill l'orchestre, il ne
> réinvente rien. Tier `motion` (gratuit) par défaut ; `animated` (Kling, payant) est
> opt-in et gelé (cf. `reference/decisions/2026-07-21-recette-clip-anime-kling.md`).

## Étape 0 — Références obligatoires

Charger (Read) avant toute production :
- `reference/directives-legales.md` — règles légales bloquantes ;
- `reference/charte-pronoclip.md` — charte (fond `#0A0A0A`, accent `#33D17A` en accent seul).

## Étape 1 — Entrées

| Entrée | Statut | Note |
|---|---|---|
| Équipe domicile / extérieur | **Obligatoire** | fournies explicitement (jamais la mémoire du modèle) |
| Compétition | **Obligatoire** | ex. « Ligue des Nations » |
| Score pronostiqué | Optionnel | fourni → L1/L2/L3 ; absent → **L0** (le moteur prédit un score plafonné 2/équipe) |
| Buteurs / types de but | Optionnel | complètent L2/L3 ; sinon pondérés par le profil (bibliothèque de portraits) |
| Date/heure du match | Recommandé | pour la fenêtre de publication (skill `publication-cms`) |

L'effectif d'une équipe **semée** est lu depuis la bibliothèque (`adapters/squad-library.ts`,
`loadRoster`) ; sinon fournir un effectif minimal. Aucun buteur n'est inventé.

## Étape 2 — Génération (pipeline codé)

Le cœur pur enchaîne (cf. `scripts/render-video.ts`, `npm run render`) :

1. `predictMatch` (`core/prediction.ts`) — score + buteurs + types (déterministe par graine ;
   non-joueurs jamais buteurs ; gardiens en dernier).
2. `buildMatchScript` — artefact relisible (8 plans via `core/shot-budget.ts`).
3. `buildComposition` (`core/composition.ts`) — page HTML 9:16, 8 plans, overlays **HTML
   uniquement** (caption, buteur, type de but, score incrémental, scoreboard final,
   filigrane IA, carton de fin). Aucun texte cuit dans une image. Panneaux **générés**
   (dégradés on-charte) si aucune image → un MP4 sort **sans aucun asset**.
4. Rendu **local** : Chrome headless → frames → MP4 muet (ffmpeg-static). Jamais le MCP
   payant `render_video`.
5. `buildNarration` (`core/narration.ts`) → voix off via `adapters/tts.ts` (**SAPI fr-FR
   gratuit par défaut**, ElevenLabs opt-in `--voice=elevenlabs`) ; `adapters/audio-mux.ts`
   ajoute le lit musical (généré, ducké) + whoosh aux coupes ; mux final.

**Lancer le rendu (motion, gratuit)** : `npm run render` — produit
`pronoclip-output/pronoclip_france-vs-espagne.mp4` (exemple France vs Espagne, aucune
config). Pour un autre match, fournir les équipes au script (via `example-teams.ts` ou un
brief) — l'effectif France est déjà semé (27 portraits).

## Étape 3 — Hook bloquant + contrôle

- **Hook mention IA** : `assertDisclosure` (`core/render-guard.ts`) refuse tout rendu si le
  filigrane OU le carton de fin est vide (§7) — s'exécute AVANT le rendu, jamais contourné.
- **Contrôle légal visuel** (optionnel mais recommandé) : passer le MP4 à l'agent
  `verificateur-legal` (extrait des frames, vérifie zéro logo/visage/mention IA absente).

## Étape 4 — Log

Après chaque rendu, **append** dans `./pronoclip-logs/YYYY-MM-DD.md` :

```markdown
- [HH:MM] Vidéo générée : France vs Espagne 2-0 (motion, 9:16) — OK — ~Xmin
```

Ces logs alimentent les dailies RapidoRH (`/pronoclip-daily`).

## Garde-fous

- **Jamais de logo de club, d'emblème de compétition, ni de visage de joueur identifiable**
  (`reference/directives-legales.md`).
- **Mention IA** toujours à l'écran (filigrane + carton) — garantie par le hook.
- **Rendu 100 % local et gratuit** (Chrome + ffmpeg). Le tier `animated` (Kling) et tout
  provider payant (ElevenLabs) sont **opt-in explicites**, jamais en routine automatisée.
