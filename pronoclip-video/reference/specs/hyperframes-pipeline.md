# Pipeline de rendu HyperFrames (local, gratuit) — Phase 5 réelle

La vraie animation ne vient PAS du moteur mais de la **composition** : calques
détourés (fond + sujet) animés indépendamment par **timelines GSAP**, pas une image
plate zoomée. Tout est **local et gratuit** (CLI HyperFrames + Chrome + ffmpeg) ; on
n'appelle **jamais** le rendu cloud/MCP payant.

## Prérequis (une fois)

- **bun** (`npm i -g bun`) — requis par la CLI HyperFrames.
- **ffmpeg + ffprobe** sur le PATH. En dev on stage `ffmpeg-static` + `ffprobe-static`
  dans un dossier (`.hfbin/`) ajouté au PATH.
- Skills IA (optionnel, pour l'authoring assisté) : `npx hyperframes skills update`
  → `/hyperframes`, `/hyperframes-animation`, `/gsap`, `/media-use`.

## Étapes (Real Madrid 2-0 Barça, 8 plans, 40 s)

1. **Images fixes** : les 8 plans (tier B3 aujourd'hui) — `pronoclip-output/b3_plan*.jpg`.
2. **Détourage** (calque sujet) : `hyperframes remove-background bgN.jpg -o subN.png`
   (modèle local `u2net_human_seg`, transparent PNG). Le fond reste `bgN.jpg`.
3. **Composition GSAP** : `scripts/hyperframes/gen-composition.mjs` génère `index.html`
   (format HyperFrames : `#root` + clips `data-start/duration/track-index`, timeline
   `window.__timelines["main"]`). Par plan :
   - **fond** (track 0) + **sujet détouré** (track 1) animés séparément → parallaxe ;
   - caméra par type : **push-in** (reveals), **whip-pan** (face_off), **punch-in +
     speed lines** (buts), punch (arrêt), bob (célébration) ;
   - overlays HTML (track 6-10) : caption, buteur, **score incrémental** (états
     successifs via clip lifecycle), **filigrane IA** persistant, **carton de fin**.
   - Charte : fond `#0A0A0A`, accent `#33D17A` en filets seulement. Déterministe
     (aucun `Math.random`/`Date.now`).
4. **Vérif** : `hyperframes check` (lint + runtime + layout + **contraste WCAG AA**).
   0 erreur avant de rendre.
5. **Rendu** : `hyperframes render -o out.mp4 -q high -f 30` → MP4 1080×1920, 30 fps.
6. **Métadonnées** : ffmpeg remux `-metadata comment/description` = mention IA
   (+ note B3 en mode dégradé). Filigrane + carton de fin sont déjà à l'écran.
7. **Voix off** (optionnel) : `hyperframes tts` (Kokoro, local, gratuit) ou ElevenLabs
   (clé requise, payant) → muxée via ffmpeg. Non incluse dans ce rendu (muet).

## Reproduire

```sh
export PATH="$PWD/.hfbin:$PATH"          # ffmpeg + ffprobe
cd pronoclip-output/hf
for n in 1 2 3 4 5 6 7 8; do bunx hyperframes remove-background assets/bg$n.jpg -o assets/sub$n.png; done
node ../../scripts/hyperframes/gen-composition.mjs   # → index.html
bunx hyperframes check
bunx hyperframes render -o ../pronoclip_real-madrid-vs-barcelone_ANIMATED.mp4 -q high -f 30
```

> Le tier `motion` (Ken Burns simple, `core/composition.ts`) reste le repli sans bun.
> Ce pipeline GSAP est la Phase 5 « correcte » (vraie animation par calques).
