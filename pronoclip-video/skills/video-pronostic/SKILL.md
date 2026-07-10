---
name: video-pronostic
description: >-
  Utiliser quand l'utilisateur ou une routine veut générer une vidéo de
  pronostic, un clip de score exact, une vidéo de match PronoClip, ou tout
  visuel vidéo football à partir d'un pronostic. Déclencher aussi sur "clip",
  "vidéo du match", "génère la vidéo X-Y".
---

# Vidéo de pronostic PronoClip (score exact)

Génère une vidéo courte (5–15 s) de pronostic football « score exact » :
composition HTML animée, rendue **en local** avec le CLI HyperFrames, prête à
publier sur TikTok/Reels.

Suivre les étapes dans l'ordre. Ne jamais sauter l'étape 0 ni la section
**Garde-fous**.

## Étape 0 — Références obligatoires

1. **Charger** (Read) avant toute production :
   - `${CLAUDE_PLUGIN_ROOT}/reference/directives-legales.md` — règles légales bloquantes ;
   - `${CLAUDE_PLUGIN_ROOT}/reference/charte-pronoclip.md` — charte graphique et ton PronoClip.
2. **Invoquer les skills HyperFrames officiels** :
   - `/hyperframes` — authoring de la composition HTML ;
   - `/hyperframes-cli` — boucle de dev (preview / lint / render) ;
   - si un adaptateur d'animation est utilisé : `/gsap` ou `/css-animations` ;
   - si narration TTS ou musique : `/hyperframes-media`.
3. Si ces skills ne sont pas installés :

   ```bash
   npx skills add heygen-com/hyperframes
   ```

## Étape 1 — Entrées requises (refuser si incomplet)

Vérifier que TOUTES les entrées obligatoires sont fournies ; sinon, **refuser
de générer** et demander les informations manquantes.

| Entrée | Statut | Valeurs |
|---|---|---|
| Équipe domicile | **Obligatoire** | ex. « PSG » |
| Équipe extérieur | **Obligatoire** | ex. « Real Madrid » |
| Score pronostiqué | **Obligatoire** | ex. `2-1` |
| Compétition | **Obligatoire** | ex. « Ligue des Champions » |
| Date/heure du match | **Obligatoire** | ex. « 12/07 21:00 » |
| Pseudo à afficher | Optionnel | affiché sur le carton final |
| Style graphique | Optionnel | `réaliste-stylisé`, `cartoon`, `néon`, `rétro` — **défaut : `style_defaut` de `./pronoclip-data/config.json`** (`néon` à l'installation, cohérent avec la charte PronoClip) |
| Format | Optionnel | `9:16` (**défaut**, TikTok/Reels), `1:1`, `16:9` |
| Durée | Optionnel | 5 à 15 s |

## Étape 2 — Composition : pipeline enrichi (mode standard)

Mode par défaut (`mode_routine: "standard"` dans `config.json`) :

a. **Invoquer le skill `sequences-match`** → 3–5 plans de match animés
   (nombre : `sequences_par_video` de `config.json`) ;
b. **Invoquer le skill `audio-narration`** → VO + BGM + captions karaoké ;
c. **Assembler** dans
   `${CLAUDE_PLUGIN_ROOT}/reference/template-composition.html` :

   | Scène | Fenêtre | Assemblage |
   |---|---|---|
   | 1. Intro | 0–2 s | plan AMBIANCE animé |
   | 2. Équipes | 2–5 s | plan FACE-À-FACE animé, noms d'équipes par-dessus |
   | 3. Score | 5–9 s | le **compteur de score animé reste par-dessus** le plan ACTION |
   | 4. Carton final | 9–12 s | carton « Pronostic de @pseudo — PronoClip » + CTA **sur** le plan TIFO/CÉLÉBRATION |

   Textes à l'écran (tous obligatoires) : noms des équipes, score
   pronostiqué, compétition, mention **« Pronostic — contenu généré par
   IA »** (obligation de transparence du cahier des charges PronoClip).
   Les couleurs des équipes sont passées en **variables CSS**
   (`--color-home`, `--color-away`, …) — jamais en dur dans les scènes.

d. **Contrôles puis rendu** : voir Étape 3 (`lint` + `validate` +
   `animation-map`, puis render local).

### Mode `--light` (fallback rapide)

La composition « texte + formes » d'origine — le template seul, sans images
`sequences-match` ni audio `audio-narration` : intro ambiance en formes CSS,
maillots en aplats, compteur, carton final. À utiliser pour **les tests** et
**les jours à 10 matchs**. Activation : flag `--light` en session, ou
`mode_routine: "light"` dans `config.json`.

## Étape 3 — Contrôles et rendu local (CLI HyperFrames)

Rappel : le repo HyperFrames utilise **bun, jamais pnpm**.

1. `hyperframes preview` — itérer sur la composition jusqu'à validation ;
2. `hyperframes lint` **ET** `hyperframes validate` — les deux doivent
   passer avant tout rendu ;
3. `animation-map` (mode standard) — corriger tout flag `offscreen`,
   `collision`, `paced-fast` ;
4. `hyperframes render` — produit le MP4 dans `./pronoclip-output/`.

Nommage du fichier de sortie :

```
{date}_{equipeA}-vs-{equipeB}_{score}_{style}.mp4
# ex. 2026-07-12_psg-vs-real_2-1_neon.mp4
```

## Étape 4 — Log

Après chaque rendu (succès ou échec), **append** une ligne dans
`./pronoclip-logs/YYYY-MM-DD.md` :

```markdown
- [HH:MM] Vidéo générée : PSG vs Real 2-1 (néon, 9:16) — OK — ~Xmin
```

Ces logs alimentent les dailies RapidoRH (phase Report du workflow).

## Garde-fous

- **JAMAIS de logos de clubs, d'emblèmes de compétitions, ni de visages de
  joueurs identifiables.** Utiliser uniquement : silhouettes, avatars
  génériques, maillots aux couleurs des équipes (point de vigilance légale
  PronoClip — détail dans `reference/directives-legales.md`).
- **Toujours** la mention « généré par IA » visible à l'écran.
- **Fallback MCP HyperFrames** (`compose` → `render_video`) uniquement sur
  **demande explicite** de l'utilisateur :
  - annoncer clairement que `render_video` est **PAYANT** ;
  - attendre un **OUI explicite** avant l'appel — jamais dans une routine
    automatisée ;
  - respecter `retry_after_seconds` lors des polls de statut
    (`get_render_status`).
