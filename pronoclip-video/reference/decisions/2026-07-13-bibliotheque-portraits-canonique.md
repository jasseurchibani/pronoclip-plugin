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

## 7. Namespace, résidence et lecture des portraits — LE MOAT (load-bearing)

**Le code est copiable ; la bibliothèque curée ne l'est pas.** C'est le seul actif qui
coûte du temps humain et du jugement à reproduire. **C'est elle le moat, pas le plugin.**
Cette section est donc load-bearing : sans elle, « la bibliothèque est le moat » ne
tient pas.

### 7.1 Namespace (dès le schéma d'index, maintenant)
- `pronoclip/<équipe>` → effectifs **canoniques**, propriété du projet.
- `<marque>/<équipe>` → override d'un **revendeur** qui veut son propre look.

Le **résolveur** cherche `<marque>/<équipe>` **d'abord**, puis retombe sur
`pronoclip/<équipe>`. Un revendeur **hérite** donc des effectifs canoniques par défaut
et peut en **semer d'autres** (par équipe, voire par joueur). `brand.namespace` vit
dans `pronoclip.config.json` (défaut : `pronoclip`).

### 7.2 Où vivent physiquement les portraits `pronoclip/` canoniques ?
Dans un **store canonique appartenant au projet** — aujourd'hui la bibliothèque
RapidoCMS/S3 du propriétaire (bucket `rapido-software…`) — exposé en **lecture publique
via des URLs stables**, idéalement **derrière un CDN** :
`https://cdn.pronoclip.app/portraits/pronoclip/<équipe>/<joueur>.png`. Le CDN découple
des chemins S3 internes (les portraits ne cassent pas si le stockage bouge) et cache
globalement.

Un **manifeste canonique publié** — `…/portraits/pronoclip/squads/<équipe>.json` à une
URL stable — liste `portrait_url` + descripteurs + version. Le plugin embarque un
**snapshot** du manifeste, rafraîchi depuis l'URL canonique.

### 7.3 Comment un revendeur lit-il mes portraits canoniques ?
**Simple HTTPS GET** des URLs publiques (portraits + manifeste). **Aucun compte
RapidoCMS requis pour LIRE.** (Vérifié empiriquement : les URLs S3 renvoyées par
`generate_image` sont directement téléchargeables sans authentification.)

Au rendu, l'`edit_image` du revendeur (sur **son** RapidoCMS) reçoit l'**URL publique**
du portrait canonique comme référence et la fetch en HTTP — **cross-tenant OK** car
l'URL est publique.

### 7.4 Et si le revendeur n'a AUCUN compte RapidoCMS ?
- **Consommation : OUI.** Il tourne 100 % sur `pronoclip/` (lecture publique), **zéro
  infra requise**. La vidéo lit les portraits canoniques et les passe en référence.
  ⚠️ Sans RapidoCMS, il n'a pas non plus d'`edit_image` à lui → il faut alors, au
  choix : un **`edit_image` hébergé par le propriétaire** (service partagé), ou le
  **repli B3** (pas de référence, cohérence dégradée). À arbitrer via le tiering.
- **Semer son propre `<marque>/` : NON** sans backend d'écriture (son RapidoCMS **ou**
  un service de semis hébergé par le propriétaire).

### 7.5 Intégrité du moat
La **lecture publique ne compromet pas le moat** : le moat n'est pas le secret des
octets, c'est **l'autorité de curation + le contrôle d'écriture + l'ampleur qui
grandit**. Seul le propriétaire écrit dans `pronoclip/`. Le namespace canonique est
**lecture seule pour le monde**. Un concurrent peut aspirer des images ; il ne peut pas
répliquer une bibliothèque curée, indexée, cohérente, intégrée au pipeline et qui
s'étend.

### 7.6 Tiering qui en découle
- **Revendeur de base** : consomme `pronoclip/` (lecture publique, sans compte).
  Fonctionne out-of-the-box.
- **Revendeur premium** : sème son `<marque>/` (nécessite RapidoCMS ou service de semis
  hébergé) pour un look propriétaire ; hérite quand même de `pronoclip/` en fallback.

### 7.7 Impact config
- `brand.namespace` (défaut `pronoclip` ; un revendeur met sa marque).
- `portraits.canonical_manifest_base_url` (URL du manifeste/CDN canonique).
- Ordre de résolution : `[brand.namespace, "pronoclip"]`.

## 8. Sous-questions encore ouvertes (non tranchées)

1. **Périmètre du semis** : effectif complet vs sous-ensemble « vedettes + buteurs
   probables » (défaut proposé : le sous-ensemble, extensible à la demande).
2. **Changement de kit** (saison, maillot extérieur) : le portrait gèle un kit →
   versioning / re-semis quand le kit change.
3. **Workflow de revue** : qui valide, où l'état d'approbation est stocké, comment on
   remplace un portrait raté sans casser les vidéos déjà produites.

## 9. Liens
`reference/specs/edit_image-mcp-rapidocms.md` (chemin critique),
`2026-07-13-nom-reel-visage-fictif.md` (Option 5, visage désancré),
`core/match-bible.ts` (`players[]` → à alimenter depuis l'index), MISSION §9 (revendabilité).
