# Décision d'architecture — Bibliothèque de portraits canonique et partagée

**Statut : ACTÉ (décision utilisateur, 2026-07-13). Pas encore implémenté.**
**Portée : structure de la Phase 4 (génération d'images).**

---

## 1. La question (non couverte par MISSION.md)

Avec la Décision A2 (athlètes fictifs) + B1 (`edit_image` à référence), la cohérence
de visage/silhouette entre plans repose sur des **portraits de référence** : un visage
fictif généré une fois puis réutilisé comme image de référence. **Où vivent ces
portraits, et sont-ils partagés ?** Le plan ne tranchait pas.

## 2. La décision

**Bibliothèque de portraits canonique et PARTAGÉE — pas de cache par utilisateur.**

Un seul « Mbappé fictif » pour tout le monde : **même visage/silhouette dans les 60
épisodes d'une série, dans les vidéos de tous les clients, partout.**

**Pourquoi :**
- **Cohérence de marque** : une série ressemble à un seul studio, pas à 60 personnages
  différents pour le même joueur.
- **Coût écrasé à l'échelle** : un portrait généré + curé **une fois** sert toutes les
  vidéos, tous les clients, indéfiniment.

## 3. Conséquences (à cadrer)

### 3.1 Les portraits sont des ASSETS DE MARQUE CURÉS, pas du cache jetable
Cycle de vie : **généré → relu par un humain → corrigé si raté → gelé (immuable)**.
Un portrait gelé ne change plus. Une correction crée une **nouvelle version**, mais le
pointeur « canonique » ne bouge qu'après **validation humaine**. Aucun visage non relu
ne part jamais en production.

### 3.2 Ils sont SEMÉS, jamais générés à la volée
Une **commande dédiée `/pronoclip-squad <équipe>`** construit et gèle l'effectif
fictif d'une équipe (génération + revue + gel). **Les vidéos ne font que LIRE dans la
bibliothèque, elles ne génèrent jamais de portrait.** Séparation nette :
- **Semis** : payant, curé, occasionnel (1 fois par équipe).
- **Rendu vidéo** : lecture seule, fréquent, aucune génération de portrait.

### 3.3 Stockage
- **Images** : bibliothèque d'assets **RapidoCMS** (elles y atterrissent déjà —
  `generate_image`/`edit_image` renvoient une URL S3 de la bibliothèque).
- **Index** : `./pronoclip-data/squads/<code-équipe>.json` (donnée client, non
  versionnée dans le plugin — cf. §9 revendabilité). C'est la **source de vérité** de
  « ce qui est semé ».

Modèle d'index proposé :
```json
{
  "team": "Real Madrid",
  "team_code": "real_madrid",
  "seeded_at": "2026-07-13",
  "players": {
    "Mbappé": {
      "portrait_url": "https://…rapidocms…/portrait_real_madrid_mbappe_v2.png",
      "descriptor": { "build": "…", "hair": "…", "skin": "…", "boots": "…", "number": 9 },
      "seed": 1550747408,
      "version": 2,
      "status": "frozen",
      "approved_by": "…", "approved_at": "…"
    }
  }
}
```
La fiche personnage du Match Bible (`core/match-bible.ts`, `players[]`) est alors
**lue depuis cet index**, plus **jamais** inventée à la volée pour une vidéo.

### 3.4 Portrait manquant → ERREUR EXPLICITE
Si une vidéo a besoin d'un joueur non semé → **erreur dure** :
`Effectif non semé pour « Real Madrid » (joueur : Mbappé). Lance /pronoclip-squad Real Madrid.`
**Jamais** de génération silencieuse. Cette barrière garantit qu'aucun visage
non curé ne se glisse dans une vidéo.

## 4. Place dans l'architecture (core pur / adapters)

- **`core/`** reste pur : il **consomme** un port « résolveur de portraits »
  (`player → reference_image_url`, ou lève « non semé »). Aucune I/O, aucune
  génération dans le core.
- **`adapters/mcp.ts`** : implémente (a) le **semis** (`/pronoclip-squad` : génère via
  MCP, gèle) et (b) la **lecture** de l'index au moment de la vidéo.
- **`./pronoclip-data/squads/`** : l'index (donnée client, gitignoré).

## 5. Impact sur la Phase 4

La Phase 4 initiale (« génération images + voix, par vidéo, à la volée ») se **scinde** :

- **Phase 4a — SEMIS** (`/pronoclip-squad <équipe>`) : génère + fait relire + gèle les
  portraits fictifs d'une équipe. Payant, curé, **une fois par équipe**. Nécessite un
  point de **revue humaine** (valider/refuser/corriger) avant gel.
- **Phase 4b — VIDÉO** : lit les portraits gelés dans l'index ; pour chaque plan,
  `edit_image(prompt_du_plan, [portrait_url])` (le portrait sert de référence) ;
  **ne génère aucun portrait** ; erreur dure si non semé.

Conséquences :
- **`edit_image` reste le chemin critique** : c'est lui qui applique le portrait gelé
  comme référence à chaque plan.
- Le semis produit **1 portrait de référence canonique par joueur** (plan héros neutre,
  en kit) ; les 8 plans d'une vidéo en dérivent.
- La barrière « non semé → erreur » vit à la frontière **lecture (vidéo)**.

**Synergie avec l'Option 5 (visage désancré, cf. décision A2)** : même quand le visage
est en contre-jour dans les plans finaux, le portrait canonique garantit la constance
de **gabarit, silhouette, carnation, coupe, coupe du maillot** — et surtout que **le
même joueur fictif réapparaisse à l'identique sur 60 épisodes**. Les deux décisions se
renforcent.

## 6. Impact sur le coût par vidéo

Estimations basées sur le constat empirique **≈ 0,08 $/image hd** (gpt-image-1.5) ;
`edit_image` peut coûter un peu plus (image de référence en entrée) → fourchette.
**RapidoCMS ne m'expose pas son tarif exact (crédits maison) — à confirmer.**

| Poste | Coût estimé | Fréquence |
|---|---|---|
| **Semis d'une équipe** (`/pronoclip-squad`) | effectif × ~0,08 $ × facteur-rejets | **1 fois / équipe**, partagé tous clients |
| Images d'**1 vidéo** (8 plans via `edit_image`) | ~8 × 0,08–0,15 $ ≈ **0,6–1,2 $** | par vidéo |
| Voix off (ElevenLabs) | selon offre | par vidéo |

Exemple : semer 15 joueurs, ~1,5× pour les rejets → **~1,8 $ une seule fois** par équipe.

- **Première vidéo d'une équipe** = semis (amorti) + vidéo ≈ **~1,8 $ + ~0,9 $ ≈ 2,7 $**.
- **Vidéos suivantes de la même équipe** = **~0,9 $** (images) + voix. Le semis ne se
  repaie **jamais** : portraits gelés, relus.
- **Partage inter-clients** : une équipe semée une fois sert **tous** les clients → le
  coût de semis divisé par le nombre de clients **tend vers 0**.

Sur 60 épisodes d'une même équipe : ~1,8 $ (semis) + 60 × ~0,9 $ ≈ **~56 $** d'images,
contre un modèle « tout régénérer par vidéo » nettement plus cher **et** incohérent.

## 7. Sous-questions ouvertes (à cadrer, non tranchées ici)

1. **Périmètre du semis** : effectif complet vs sous-ensemble « vedettes + buteurs
   probables » (défaut proposé : le sous-ensemble, extensible à la demande).
2. **Global vs par-marque** : « un Mbappé pour tous » = bibliothèque **globale**. Un
   revendeur pourrait vouloir **son propre** look → prévoir un namespace optionnel par
   marque (global par défaut, override possible).
3. **Changement de kit** (saison, maillot extérieur) : le portrait gèle un kit →
   versioning / re-semis quand le kit change.
4. **Workflow de revue** : qui valide, où l'état d'approbation est stocké, comment on
   remplace un portrait raté sans casser les vidéos déjà produites.

## 8. Liens
`reference/specs/edit_image-mcp-rapidocms.md` (chemin critique),
`2026-07-13-nom-reel-visage-fictif.md` (Option 5, visage désancré),
`core/match-bible.ts` (`players[]` → à alimenter depuis l'index), MISSION §9 (revendabilité).
