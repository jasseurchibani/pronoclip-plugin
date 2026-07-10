---
name: sequences-match
description: >-
  Utiliser quand une vidéo de pronostic a besoin de visuels de match :
  ambiance stade, action de jeu stylisée, célébration, tifo. Génère les
  images via RapidoCMS puis les transforme en mini-séquences animées dans
  la composition HyperFrames.
---

# Séquences de match — images RapidoCMS animées dans HyperFrames

Enrichit une vidéo de pronostic avec des plans visuels de match : les images
sont générées par le MCP **RapidoCMS** (`generate_image`), gelées en local,
puis transformées en **mini-séquences animées** de 2–4 s dans la composition
HyperFrames. Les interdits de `reference/directives-legales.md` s'appliquent
à chaque image.

## Étape 0 — Références

1. **Invoquer** les skills :
   - `rapidocms:prompts-visuels-pro` — negative prompts + protocole
     **zéro faute** si du texte est incrusté ;
   - `prompt-engineering-visuel` — méthode de construction des prompts
     `generate_image`.
2. **Charger** :
   - `${CLAUDE_PLUGIN_ROOT}/reference/prompts-sequences.md` — les 5 prompts
     complets par plan ;
   - `${CLAUDE_PLUGIN_ROOT}/reference/charte-pronoclip.md` — style néon,
     couleurs.

## Étape 1 — Storyboard image (3 à 5 plans par vidéo)

Plans standards — chaque plan a son prompt complet (positif + négatif +
variables couleurs + déclinaisons de format) dans
`reference/prompts-sequences.md` :

| # | Plan | Contenu | Statut |
|---|---|---|---|
| 1 | **AMBIANCE** | stade de nuit vu des tribunes, fumigènes aux couleurs des deux équipes, style néon stylisé, **sans texte** | standard |
| 2 | **FACE-À-FACE** | deux silhouettes de joueurs **de dos**, maillots unis aux couleurs `{home}` et `{away}`, SANS logo, SANS visage, SANS numéro de joueur réel, éclairage dramatique | standard |
| 3 | **ACTION** | frappe/tacle en silhouette, traînées de lumière, motion blur pictural — l'image doit « appeler » l'animation | standard |
| 4 | **CÉLÉBRATION** | foule en liesse, confettis aux couleurs du vainqueur pronostiqué | standard |
| 5 | **TIFO** | motif géométrique abstrait aux deux couleurs, pour le fond du carton final | option |

Chaque prompt embarque le negative prompt de `prompts-visuels-pro`
(logos, visages reconnaissables, texte parasite, watermarks, mains
difformes) + les couleurs passées en variables.

## Étape 2 — Génération (MCP RapidoCMS)

1. `generate_image` pour chaque plan du storyboard — **format vertical si
   la vidéo est en 9:16** (déclinaisons par format dans
   `prompts-sequences.md`).
2. **Contrôle qualité systématique** : re-regarder chaque image générée.
   Si un logo, un visage identifiable ou du texte parasite apparaît →
   **régénérer avec negative renforcé**. **Max 2 retries** par plan ;
   au-delà, fallback : fond dégradé aux couleurs de la charte + formes
   géométriques (jamais de plan non conforme dans la vidéo).
3. Chaque image validée :
   - **télécharger dans `.media/sequences/`** — les compositions
     référencent des fichiers locaux **gelés** (logique manifest de
     `/media-use`) ;
   - **uploader une copie dans la bibliothèque RapidoCMS** — réutilisable
     pour les posts images de la campagne.

## Étape 3 — Animation « mini-séquence » (le cœur du skill)

Transformer chaque image statique en plan animé de **2–4 s** via `/gsap` :

| Plan | Animation |
|---|---|
| **AMBIANCE** | Ken Burns lent (zoom 1.0 → 1.12) + grain léger + pulsation de la lueur des fumigènes (opacity oscillante sur un calque dupliqué) |
| **FACE-À-FACE** | parallax 2 calques — `npx hyperframes remove-background` pour détacher les silhouettes du fond, le premier plan glisse plus vite que le fond — + slow zoom |
| **ACTION** | zoom-punch rapide (1.0 → 1.25 en 0.4 s, ease `power4`) synchronisé sur un SFX d'impact + speed lines CSS par-dessus |
| **CÉLÉBRATION** | shake léger + particules confettis CSS aux couleurs du vainqueur + flash blanc 2 frames à l'entrée |

**Transitions entre plans** : shader-transitions HyperFrames ou wipe GSAP,
**calées sur les beats de la BGM** (couche audio du skill `audio-narration`).

**Diagnostics** : lancer `animation-map` (scripts du skill `/hyperframes`)
après composition et **corriger tout flag** (`offscreen`, `collision`,
`paced-fast`) avant de passer au rendu.

## Étape 4 — Option premium : clip présentateur HeyGen (avatar)

**SI** l'utilisateur demande un « présentateur » / « avatar » :

1. Générer via l'**API HeyGen** (avatar vidéo) un clip de 3–5 s du
   présentateur annonçant le prono — script issu du skill
   `audio-narration` ;
2. Télécharger le clip, l'insérer en **PiP** (pattern PiP des references
   `/hyperframes`) dans la **scène 2** (face-à-face).

**PAYANT** → même règle que `render_video` MCP :

- annoncer le coût **avant** l'appel ;
- attendre un **OUI explicite** ;
- **jamais en routine automatisée** ;
- clé `HEYGEN_API_KEY` lue dans l'environnement, **jamais en dur**.

## Étape 5 — Log

Append dans `./pronoclip-logs/YYYY-MM-DD.md` :

```markdown
- [HH:MM] Séquences : {n} images RapidoCMS générées ({retries} retries), {n} plans animés, avatar {oui/non} — ~Xmin
```
