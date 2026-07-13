# USAGE — pronoclip-video

## État actuel (pré-1.0)

Le cœur du pipeline est opérationnel et testé : **pronostic (L0→L3) → `match-script.json`
(relisible/corrigible) → Match Bible (monde verrouillé) → 8 prompts d'image**. La
génération d'images tourne en **mode B3 (stopgap temporaire, voir ci-dessous)**. Le
rendu vidéo (Phase 5) et la publication (Phase 6) restent à venir.

## ⚠️ Mode image B3 — stopgap TEMPORAIRE (pas le comportement nominal)

- **Cible (nominal) = B1** : `edit_image` avec **portraits de référence** → cohérence
  de visage/silhouette garantie entre les 8 plans et entre épisodes.
- **Actuel = B3** : `generate_image` **sans référence**. **La cohérence de visage
  n'est PAS garantie.** La dégradation est **bruyante, jamais silencieuse** :
  - un avertissement `MODE DÉGRADÉ B3 — cohérence de visage non garantie` est émis
    **à chaque plan** (`adapters/mcp.ts`) ;
  - la vidéo produite porte une **note métadonnées** :
    `preview technique — cohérence de personnage non garantie`
    (traçable ; **pas** de filigrane visible).
- **Bascule B3 → B1, sans réécriture du cœur** : dès qu'`edit_image` est livré
  (cf. `reference/specs/edit_image-mcp-rapidocms.md`), passer
  `image.mode: "B1"` dans `pronoclip.config.json`. L'interface générique
  `generateImage(prompt, refs[], size)` est déjà en place ; en B1 les `refs`
  (portraits) sont transmis, en B3 ils sont ignorés.

Le semis `/pronoclip-squad` et la bibliothèque canonique **restent au plan** : en B3
les portraits ne sont pas utilisés, mais l'architecture ne change pas.

## Configuration

- **`pronoclip.config.json`** : marque + `namespace`, `world` (monde verrouillé),
  `characters.likeness`, `image.mode` (B1/B3), `voice`, `ai_disclosure`, `render.level`.
- **`.env`** (voir `.env.example`) : `RAPIDOCMS_COMPANY_ID`, URLs MCP, clés API. Jamais
  de secret dans la config ni dans le code.

## Commandes disponibles aujourd'hui (cœur testable)

```sh
npm test          # 66 tests (vitest)
npm run typecheck # tsc --noEmit
npm run example   # → examples/match-script.real-madrid-vs-barcelone.json (L0)
npm run prompts   # → examples/prompts.real-madrid-vs-barcelone.txt (8 prompts)
```

- **`/pronoclip-squad <équipe>`** : sème la bibliothèque de portraits (gaté, sert le
  mode B1 ; inutile en B3 mais l'architecture reste).

## Aperçu du pipeline

```
prédiction (L0–L3)
  → match-script.json     (relu / corrigé AVANT toute image)
  → Match Bible           (monde verrouillé, aura par équipe, fiches personnage)
  → 8 prompts d'image     (STYLE + WORLD + CAMERA + SUBJECT + ACTION + NEGATIVE)
  → images                (B3 aujourd'hui / B1 cible)
  → rendu HyperFrames     (Phase 5 : montage 40 s, overlays, score, mention IA)
  → publication RapidoCMS (Phase 6)
```
