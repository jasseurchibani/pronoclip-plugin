# Décision d'architecture — Recette du clip animé (tier `animated`), GELÉE

**Statut : ACTÉ + GELÉ (décision utilisateur, 2026-07-21).**
**Portée : tier `animated` (image→vidéo). Le tier `motion` (gratuit) redevient le défaut.**

---

## 1. La décision

On **gèle la qualité vidéo** et on finit le plugin. La cohérence d'un clip i2v est un
**problème de MODÈLE, pas d'architecture** : passer de Kling 2.1 à Kling 3.0 a fait un
bond **sans toucher au code**. On y reviendra quand un meilleur modèle sortira.

Conséquences immédiates :
- `render.level` = **`motion`** par défaut (gratuit) → chaque test coûte **zéro**.
- `animated` **reste entièrement câblé** (adaptateurs, prompts, config) mais **désactivé
  par défaut** : il ne s'active que par opt-in explicite (`--animated`), jamais en routine.
- Ce document **fige la recette qui marche** pour ne pas reperdre ce qu'on a **payé pour
  apprendre** (~0,8 $ le clip validé du 2026-07-19/21).

## 2. La recette qui marche (validée empiriquement)

### 2.1 Modèle & transport
- **Kling 3.0** via **fal.ai** — `fal-ai/kling-video/v3/pro/image-to-video`.
- Vertical **9:16**, **audio off** (sortie muette, moins chère ; le son est muxé à part).
- Coût vérifié : **≈ 0,56 $ / clip** (5 s) — c'est le **tier `pro`**. Le nom du modèle vit
  en **config** (`render.animated.model`), jamais en dur → changer de modèle = changer la config.

> **⚠️ Coût réel par vidéo** : le clip de test a utilisé le tier **`pro`** (~0,56 $). Une
> vidéo complète = 8 plans + buts découpés en 2 beats ≈ **~9–10 clips → ~5 $/vidéo**, pas 3.
> À la réactivation, **tester d'abord un tier moins cher** avant de figer le prix (déjà en
> config sous `render.animated._alternatives`) :
> `fal-ai/kling-video/v2.1/standard/image-to-video` (**$0.28**, ~2,8 $/vidéo) ou
> `fal-ai/kling-video/v2.6/pro/image-to-video` (**$0.35**, ~3,5 $/vidéo). Comparer le drift
> de visage (§3) : si le std tient, l'économie est de moitié.

### 2.2 Un clip = UN SEUL geste (~3,5–4,5 s), fin nette
La règle centrale. **Jamais frappe + célébration dans le même clip** : c'est ce qui
faisait apparaître le **poteau de corner fantôme / la deuxième cage** et le morphing.
Un beat = une action, une fin claire. La durée utile d'un geste tient en **~3,5–4,5 s**
(le clip Kling minimal est 5 s ; le geste se cale dedans, la queue est coupée au montage).

### 2.3 Les buts se découpent en DEUX beats
- **Beat STRIKE** : la frappe, **se termine sur le filet qui se tend** (`End on the
  bulging net`). Le ballon reste visible jusqu'au filet.
- **Beat CELEBRATION** : beat **séparé** — course + glissade genoux, bras écartés, **sans
  ballon**. Fin sur la glissade.

### 2.4 Image de départ = le SETUP, pas le PAYOFF
La première frame donnée au modèle est **l'instant AVANT** (le setup 3D « juste avant »),
**pas** le résultat. Un modèle i2v **anime vers l'issue** : lui donner le payoff en
première frame écrase le mouvement (il n'a plus rien à jouer). On lui donne l'élan, il
produit la frappe.

### 2.5 La caméra suit le ballon
Beat strike : **`The camera tracks the ball from boot to net and ends on the net.`**
Beat célébration : la caméra **reste sur le buteur**. C'est ce cadrage « qui suit le
ballon » qui rend le geste lisible et cohérent.

### 2.6 Verrous (identité + légal) dans le prompt
- **Identity lock** : pas de morphing, visage/cheveux/carnation/gabarit/couleur de kit
  **identiques à la frame de référence**, aucun texte ajouté.
- **Negative prompt** : dérives i2v (`morphing, face morph, warping, extra limbs, jersey
  colour change…`) **+ légal** (`text, watermark, nike, adidas, puma, swoosh, club crest,
  sponsor logo, badge, shirt number…`). Le contrôle « pas de logo/écusson/numéro » vaut
  **aussi sur les clips**, pas seulement sur les images fixes.

## 3. Ce qu'on a appris du clip payé (2026-07-19/21)

Test isolé Mbappé (France), plan « frappe », pipeline **B2 (image fixe) → Kling 3.0 → 5 frames** :

| Critère | Constat |
|---|---|
| **(a) Visage repris** | ✅ **Excellent dans l'image fixe B2** (`gpt-image-1.5` edit, `input_fidelity:high`). ⚠️ **Dérive dans le clip Kling** : la coupe glisse (fade bouclé → cheveux spiky) sur ~2,5–4,5 s. Drift d'identité i2v classique. |
| **(b) Anime tenu sur 5 s** | ✅ Style cel-shaded **stable**, aucun basculement photoréaliste, pas de flicker. |
| **(c) Maillot cohérent** | ✅ Bleu roi + short blanc + chaussettes bleues **cohérents de bout en bout**. |

**Implication de conception (renforce la Décision A2 / Option 5)** : le drift de visage sur
i2v est précisément pourquoi la prod **désancre le visage** (contre-jour, plan large,
visage dans l'ombre). Tant que le visage n'est pas l'ancre du plan, le drift est invisible.
Le clip plein-cadre du test l'exposait volontairement — pour le **mesurer**, pas pour le
mettre en prod.

**Ce que corrige (et ne corrige PAS) B2/`edit_image`** — important, car ça recadre
l'attente côté RapidoCMS : le portrait de référence passé à `edit_image`/`images.edit`
verrouille la cohérence **ENTRE les plans** (le même visage réapparaît d'un plan à l'autre)
— **pas DANS un plan animé** (le modèle i2v reste libre de dériver au fil des frames d'un
même clip). Conséquence directe : `edit_image` **n'est pas** un remède au drift intra-clip
— c'est un **argument de plus pour des beats courts** (moins de frames = moins de dérive) et
pour le désancrage du visage. On attendra donc d'`edit_image` la **constance inter-plans**,
et de la **durée courte** la constance intra-plan.

## 4. Où la recette est implémentée (ne pas dupliquer)

- **`core/video-prompt.ts`** : beats strike/celebration, `CAMERA_STRIKE`, `IDENTITY_LOCK`,
  `BASE_NEGATIVE` + `STRIKE_NEGATIVE` (règle §2.2–2.6). Pur, testé.
- **`adapters/fal.ts`** : transport Kling (mapping d'entrée par famille, clé env).
- **`adapters/openai-image.ts`** : image fixe B2 (`openai.images.edit` direct, hors MCP)
  — voir aussi la Décision B1 (`edit_image` MCP) pour la variante serveur.
- **`scripts/animate-shot.ts`** : driver (first frame = setup, puis clip). Opt-in `--animated`.
- **Config** : `render.animated.{provider,model,duration_seconds,cost_per_clip_usd_estimate}`.

## 5. Réactivation (quand ?)

Rebasculer `render.level` sur `animated` (ou opt-in `--animated`) **uniquement** :
1. pour un rendu **premium** explicitement demandé (jamais en routine auto), **ou**
2. quand un **meilleur modèle i2v** sort — auquel cas : changer `render.animated.model`,
   relancer **un** clip de contrôle, comparer le drift de visage aux constats du §3. Si le
   drift est réglé, on peut envisager d'ancrer le visage (revoir Option 5 avec le juriste).

## 6. Liens
`2026-07-13-bibliotheque-portraits-canonique.md` (portraits de référence),
`2026-07-13-nom-reel-visage-fictif.md` (Option 5, visage désancré),
`core/video-prompt.ts`, `adapters/fal.ts`, `adapters/openai-image.ts`, MISSION §8 (tiering).
