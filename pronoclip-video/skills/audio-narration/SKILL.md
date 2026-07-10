---
name: audio-narration
description: >-
  Utiliser quand une vidéo de pronostic doit avoir une voix off, une
  narration, un commentaire de match, de la musique de fond ou des
  sous-titres synchronisés. Déclencher aussi sur "ajoute une voix",
  "commentateur", "narration", "musique", "captions".
---

# Audio & narration — voix off, musique et captions PronoClip

Ajoute la couche audio d'une vidéo de pronostic : script de commentateur,
voix off TTS, musique de fond, SFX et captions karaoké synchronisées.
S'applique sur une composition produite par `video-pronostic` ou
`video-composer`. Lire la section **Garde-fous** avant toute génération.

## Étape 0 — Références

1. **Invoquer** les skills :
   - `/hyperframes-media` — préprocessing TTS / BGM / transcription ;
   - `/media-use` — résolution et **gel des assets** dans `.media/` avec
     manifest.
2. **Vérifier l'installation** ; si absents :

   ```bash
   npx skills add heygen-com/hyperframes --full-depth
   ```

   **TOUJOURS `--full-depth`** : sans lui, `skills add` récupère un blob en
   retard sur `main`.
3. **Charger** :
   - `${CLAUDE_PLUGIN_ROOT}/reference/scripts-narration.md` — gabarits de
     scripts ;
   - `${CLAUDE_PLUGIN_ROOT}/reference/charte-pronoclip.md` — ton et style.

## Étape 1 — Script de narration

- Générer un script **calibré sur la durée de la vidéo** (~2,5 mots/s ;
  12 s ≈ 30 mots), structuré sur les 4 scènes :

  | Beat | Fenêtre | Rôle |
  |---|---|---|
  | hook | 0–2 s | accroche |
  | annonce | 2–5 s | annonce du match |
  | tension | 5–9 s | montée de tension sur le score |
  | punchline | 9–12 s | punchline + CTA |

- **Ton** : commentateur sportif énergique, complice. **Français par
  défaut** — lire `langue_captions` dans `./pronoclip-data/config.json`.
- Partir des **gabarits** de `reference/scripts-narration.md` : 3 registres
  (hype, analyse froide, humour) × FR/EN, variables `{home}` `{away}`
  `{score}` `{pseudo}`.
- **Toujours** inclure la transparence « pronostic généré par IA » —
  oralement (tag de fin de script) ou visuellement (mention à l'écran du
  template, déjà obligatoire).

## Étape 2 — Sélection du provider TTS (cascade économique)

| Priorité | Provider | Condition | Coût |
|---|---|---|---|
| 1 | **Kokoro** | défaut — c'est LE provider des routines automatisées | gratuit, local, aucune clé |
| 2 | **ElevenLabs** | `ELEVENLABS_API_KEY` présent dans l'environnement **ET** (l'utilisateur demande « voix premium » **OU** `config.json` a `tts_provider: "elevenlabs"`) | payant au caractère |
| 3 | **HeyGen Starfish** | utilisateur connecté (`npx hyperframes auth`) **ET** demande explicite | compte HeyGen |

- Pour ElevenLabs : **figer la voix par défaut dans `config.json`**
  (`tts_voice_id`) pour une identité sonore constante ; **logger le nombre
  de caractères envoyés** à chaque appel (API payante au caractère).
- **La routine ne DOIT JAMAIS basculer silencieusement sur un provider
  payant** : Kokoro par défaut ; payant = choix explicite dans
  `config.json` ou en session.

## Étape 3 — Génération

1. **Voix off** :

   ```bash
   npx hyperframes tts   # avec le provider choisi à l'étape 2
   ```

   → WAV dans `.media/vo/`, **un fichier par beat** (pattern per-beat VO
   des launch videos HyperFrames), nommage `{scene}_{n}.wav`.

2. **Musique de fond** — au choix :
   - générée : `npx hyperframes bgm` avec le mood
     `"stadium energy, driving percussion, rising tension"` pour le
     registre hype ;
   - catalogue : via `/media-use`.

   **Règle de mixage** : BGM ducké sous la VO — **VO à −3 dB, BGM à
   −14 dB sous la voix**.

3. **SFX optionnels** via `/media-use` : clameur de stade (intro), coup de
   sifflet (annonce), impact sur la révélation du score.

## Étape 4 — Captions

- **Transcrire la VO** (Whisper, timestamps **mot à mot**).
- Poser des **captions karaoké** stylées charte PronoClip — technique
  `slam` ou `karaoke` des references *dynamic-techniques* de
  `/hyperframes`.
- **Obligatoire en 9:16** : TikTok/Reels se consomment sans le son.

## Étape 5 — Intégration + log

1. Câbler les `<audio>` dans la composition — **playback géré par le
   framework, jamais en autoplay manuel**.
2. Re-passer `npx hyperframes lint` **et** `npx hyperframes validate`.
3. Logger dans `./pronoclip-logs/YYYY-MM-DD.md` :

   ```markdown
   - [HH:MM] Audio : VO {provider} ({n} caractères), BGM {source}, captions OK — ~Xmin
   ```

## Garde-fous

- **Musique** : uniquement générée (Lyria/MusicGen) ou issue du catalogue
  HeyGen / d'une licence libre **documentée dans le manifest `.media/`** —
  **jamais de track commerciale**.
- **Kokoro par défaut en routine** ; ElevenLabs / HeyGen Starfish =
  **opt-in explicite** (config ou session), jamais de bascule silencieuse
  vers du payant.
- `npx hyperframes lint` **ET** `npx hyperframes validate` doivent passer
  **tous les deux** avant tout rendu.
