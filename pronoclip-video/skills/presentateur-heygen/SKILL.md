---
name: presentateur-heygen
description: >-
  Utiliser quand l'utilisateur veut un présentateur animé qui PARLE dans une
  vidéo de pronostic (avatar cartoon commentateur, mascotte parlante, host
  vidéo), via l'API HeyGen Talking Photo. Déclencher sur "présentateur",
  "avatar qui parle", "commentateur animé", "host HeyGen". PAYANT — opt-in.
---

# Présentateur animé HeyGen (Talking Photo)

Anime un **portrait cartoon en présentateur qui parle** (bouche + tête
synchronisées sur une voix), via l'API **HeyGen Talking Photo**. Sert de
« clip présentateur » premium pour une vidéo de pronostic — soit inséré en
PiP dans une composition HyperFrames, soit livré tel quel.

> ⚠️ **Service PAYANT au temps** — voir Coûts et garde-fous. Ce skill n'est
> JAMAIS déclenché dans une routine automatisée sans confirmation humaine
> explicite du coût, à chaque appel.

## Prérequis

- `HEYGEN_API_KEY` dans l'environnement — **jamais** dans `config.json` ni
  aucun fichier versionné (le fichier est revendable, sans secret).
- Un portrait **avec un visage détectable par HeyGen** : un humain (réel ou
  cartoon 3D façon Pixar) fonctionne ; **une mascotte animale ne passe pas**
  (« No face detected »). Pour un présentateur, générer un humain cartoon
  original via RapidoCMS (`generate_image`) — jamais un joueur réel.

## Flux API (validé)

Tous les appels portent l'en-tête `X-Api-Key: $HEYGEN_API_KEY`.

1. **Vérifier le quota** avant tout :

   ```
   GET https://api.heygen.com/v2/user/remaining_quota
   → data.remaining_quota  (1 crédit ≈ 1 seconde de vidéo)
   ```

2. **Créer le Talking Photo** (upload du portrait) :

   ```
   POST https://upload.heygen.com/v1/talking_photo
   Content-Type: image/png   (⚠️ HeyGen exige image/png même pour un .jpg)
   body = binaire de l'image
   → data.talking_photo_id
   ```

   Erreur `400127 No face detected` → l'image n'a pas de visage exploitable
   (cas mascotte animale) : régénérer un portrait humain cartoon de face.

3. **Choisir une voix** (2391 dispo ; filtrer FR) :

   ```
   GET https://api.heygen.com/v2/voices
   → data.voices[] ; garder language == "French"
   # ex. Étienne Lefebvre 68c7001d8ff34d168d287e1bd7653041 (male)
   #     Gaëlle 67375f26ab6e44ce8569cea3840ef594 (female)
   ```

4. **Générer la vidéo** (⚠️ appel PAYANT — confirmation avant) :

   ```
   POST https://api.heygen.com/v2/video/generate
   {
     "video_inputs": [{
       "character": { "type": "talking_photo",
                      "talking_photo_id": "<id>", "scale": 1.0 },
       "voice": { "type": "text", "input_text": "<script FR>",
                  "voice_id": "<fr voice>", "speed": 1.05 },
       "background": { "type": "color", "value": "#0a0a14" }
     }],
     "dimension": { "width": 720, "height": 1280 },
     "title": "PronoClip presentateur <match>"
   }
   → data.video_id
   ```

5. **Poller le statut** (respecter le rythme, ne pas marteler) :

   ```
   GET https://api.heygen.com/v1/video_status.get?video_id=<id>
   → data.status : processing | completed | failed
     completed → data.video_url (URL signée, à télécharger tout de suite)
   ```

6. **Télécharger** dans `./pronoclip-output/` et, si besoin, insérer en PiP
   dans la composition (pattern PiP de `/hyperframes`).

## Script du présentateur

- Ton charte PronoClip (complice, énergique) ; réutiliser un gabarit de
  `reference/scripts-narration.md` en le déroulant à l'oral.
- ~2,5 mots/s → un script de 12 s ≈ 30 mots. Rester court : chaque seconde
  est facturée.
- Toujours conclure sur la transparence IA (à l'oral ou à l'écran).

## Coûts et garde-fous

- **Facturation au temps : ~1 crédit par seconde de vidéo rendue.** Une
  vidéo de 11 s a coûté **12 crédits** en test — estimer le coût = durée du
  script en secondes, et l'annoncer AVANT l'appel.
- **OUI explicite obligatoire** sur le coût avant chaque `video/generate` —
  jamais de rendu silencieux, jamais dans une routine automatisée
  (cohérent avec `directives-legales.md` règle 3 et le verrou
  `avatar_presentateur`/`premium` du studio).
- Vérifier `remaining_quota` avant : si le quota est insuffisant pour la
  durée estimée, ne pas lancer, prévenir l'utilisateur.
- Personnage **original** (humain cartoon) — jamais un joueur réel animé
  (droit à l'image ; `directives-legales.md` règle 1).
- Alternative gratuite : pour une simple voix off sans visage animé, rester
  sur `audio-narration` (Kokoro local). HeyGen n'est justifié que pour le
  **visage qui parle**.

## Intégration

- Champ `avatar_presentateur: true` dans `config.json` = intention, **pas**
  un blanc-seing : la confirmation du coût reste requise à chaque rendu.
- Dans le studio cartoon : le clip présentateur s'insère en PiP dans la
  scène d'ouverture ou de conclusion, posé par l'orchestrateur seulement
  après le OUI humain (brief `premium: true`).
