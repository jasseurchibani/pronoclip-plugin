---
description: Génère une vidéo de pronostic ANIMÉE (~40 s, clips image→vidéo — PAYANT)
argument-hint: "<équipe domicile> <équipe extérieur> [--provider <nom>]"
---

Génère une vidéo de pronostic en tier **`animated`** : chaque plan est un vrai clip
image→vidéo, au lieu du mouvement HTML du tier gratuit.

Arguments reçus : $ARGUMENTS

> ⚠️ **ÉTAPE PAYANTE.** Environ **4,50 $ par vidéo** avec le modèle par défaut
> (8 plans × 0,56 $). Ne jamais lancer sans accord explicite de l'utilisateur, et
> **jamais en routine automatique** (§8). Le tier gratuit reste `/pronoclip-match`.

## Flux (à dérouler)

1. **Toujours commencer par le devis**, qui ne dépense rien :

   ```
   npm run animate-video -- <domicile> <extérieur> --estimate
   ```

   Il affiche le fournisseur, le nombre de clips et le coût estimé.

2. **Présenter le montant à l'utilisateur et attendre un OUI explicite.** Ne jamais
   enchaîner de soi-même sur l'étape payante.

3. **Après accord seulement** :

   ```
   npm run animate-video -- <domicile> <extérieur> --yes
   ```

   Options : `--provider=<nom>` (fournisseur déclaré dans `render.animated.providers`),
   `--competition="…"`, `--voice=elevenlabs` (opt-in payant supplémentaire).

4. **Rendre le chemin du MP4 final** et le coût réellement engagé.

## Fournisseurs

Le fournisseur est **décrit en configuration**, jamais codé : `render.animated.providers`
dans `pronoclip.config.json`. `provider: "http"` couvre n'importe quelle API REST
(url, en-têtes, corps, chemin de la vidéo, sondage). La clé est lue dans l'environnement
sous le nom déclaré par `api_key_env` — elle n'est jamais écrite dans la configuration.

Clé absente → refus explicite, aucune dépense.

## Ce qui peut mal se passer

- **Dérive du visage.** Le modèle image→vidéo déforme le visage en cours de clip
  (constaté vers 2,5–4,5 s — cf. `reference/decisions/2026-07-21-recette-clip-anime-kling.md`).
  Prévenir l'utilisateur : la cohérence de personnage n'est pas garantie en animé.
- **Plan en échec.** Il dégrade en image figée sur sa première frame ; les clips déjà
  payés sont conservés et la vidéo sort quand même.

## Garde-fous

Mention IA obligatoire (filigrane, carton de fin, métadonnées) — le hook bloquant
s'exécute AVANT toute dépense. Effectifs semés requis (aucun joueur inventé). Jamais le
MCP payant `render_video`.
