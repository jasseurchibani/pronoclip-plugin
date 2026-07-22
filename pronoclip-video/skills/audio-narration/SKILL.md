---
name: audio-narration
description: >-
  Utiliser quand une vidéo de pronostic doit avoir une voix off, une
  narration, un commentaire de match, de la musique de fond ou des SFX.
  Déclencher aussi sur "ajoute une voix", "commentateur", "narration",
  "musique", "whoosh".
---

# Audio & narration — voix off, lit musical et SFX PronoClip

Ajoute la couche audio d'une vidéo de pronostic. **Le pipeline est CODÉ** — ce skill
l'orchestre, il ne réimplémente rien :

| Étape | Module | Rôle |
|---|---|---|
| Script | `core/narration.ts` (`buildNarration`) | commentateur FR dérivé du MatchScript, tag IA obligatoire |
| Voix off | `adapters/tts.ts` (`synthesizeVoice`) | cascade TTS (gratuit défaut / ElevenLabs opt-in) |
| Lit musical + SFX + mux | `adapters/audio-mux.ts` | musique GÉNÉRÉE + whoosh aux coupes, mux ffmpeg |

Tout est déjà branché dans `scripts/render-video.ts` (`npm run render`). Lire la section
**Garde-fous** avant toute génération payante.

## Étape 1 — Script de narration

`buildNarration(script)` produit : hook → annonce du match → une ligne par but (ordre
chrono) → score final → **tag de transparence IA** (« Pronostic généré par intelligence
artificielle. »). Calibré ~2,5 mots/s. Ton commentateur énergique (charte). Pour varier le
registre (hype / analyse / humour), s'inspirer de `reference/scripts-narration.md`.

## Étape 2 — Voix off (cascade ÉCONOMIQUE)

`resolveTtsProvider` — **jamais de bascule silencieuse vers le payant** :

| Priorité | Provider | Condition | Coût |
|---|---|---|---|
| 1 | **SAPI** (fr-FR local, voix Hortense) | défaut | **gratuit, aucune clé** |
| 1bis | **Kokoro** (`hyperframes tts`) | quand le CLI HyperFrames est installé | gratuit, local |
| 2 | **ElevenLabs** | opt-in : `--voice=elevenlabs` (ou `tts_provider` en config) **ET** `ELEVENLABS_API_KEY` présent | payant au caractère |

- **Logger le nombre de caractères** envoyés à un provider payant (fait par `tts.ts`).
- La clé `ELEVENLABS_API_KEY` vit dans l'environnement, **jamais dans un fichier versionné**.

## Étape 3 — Lit musical + SFX + mix

`audio-mux.ts` génère (aucune track commerciale — musique **générée** uniquement) :
- **lit musical** : triade adoucie, fondu in/out, sur toute la durée ;
- **whoosh** : rafale de bruit filtrée, placée à **chaque coupe** de plan.

**Mixage** : voix ≈ 0 dB, lit musical **ducké ≈ −16 dB** sous la voix, whoosh moyen — la
voix domine toujours. Mux dans la vidéo muette via ffmpeg-static → flux AAC.

## Étape 4 — Log

Append dans `./pronoclip-logs/YYYY-MM-DD.md` :

```markdown
- [HH:MM] Audio : VO {provider} ({n} caractères), lit musical + {n} whoosh, mux OK — ~Xmin
```

## Garde-fous

- **Musique GÉNÉRÉE** uniquement (jamais de track commerciale).
- **Gratuit par défaut** (SAPI/Kokoro) ; ElevenLabs / HeyGen = **opt-in explicite**, jamais
  de bascule silencieuse vers du payant.
- La **transparence IA** est toujours dans la narration (tag oral) EN PLUS du filigrane/carton.
