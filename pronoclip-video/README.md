# pronoclip-video

Plugin Claude Code pour la génération de **vidéos de pronostics football (score exact)** :
rendu vidéo en local avec **HyperFrames**, planification des routines par **journée de matchs**
via **RapidoRH**, publication via **RapidoCMS**, et transformation des logs d'exécution en **dailies**.

> Version 0.5.0-dev — cœur porté (`core/` + `adapters/` + `scripts/`), pipeline vidéo
> **local et gratuit opérationnel** (rendu 40 s avec voix off + audio). **5 commandes,
> 6 skills, 2 agents, 3 références** — la branche cartoon (studio + 2 agents) et
> `sequences-match` ont été retirées en Phase 4 (mécanique pré-core ; le style cartoon
> reviendra comme *thème* dans `core/composition`, pas comme studio parallèle).
> **Usage à jour de bout en bout : voir `USAGE.md`.**

---

## Prérequis

| Prérequis | Rôle | Obligatoire |
|---|---|---|
| **MCP RapidoCMS** | Publication des vidéos (drafts, campagnes, planification de posts, upload de fichiers) | Oui |
| **MCP RapidoRh** | Projets, tâches et **dailies** par journée de matchs | Oui |
| **Node ≥ 20** | Exécution des CLI (`npx skills`, tooling HyperFrames) | Oui |
| **bun** | Gestionnaire de paquets / runtime du repo HyperFrames | Oui (pour le rendu vidéo) |

### HeyGen — présentateur animé qui parle (option premium, PAYANT)

Débloqué via le skill `presentateur-heygen` : l'API HeyGen **Talking Photo**
anime un portrait de présentateur cartoon (humain, jamais un joueur réel)
qui **parle** avec une voix française, pour annoncer un pronostic.

- Flux : `remaining_quota` → upload `talking_photo` → `video/generate`
  (payant) → poll `video_status.get` → download.
- **Facturation au temps : ~1 crédit HeyGen par seconde de vidéo.**
- Clé `HEYGEN_API_KEY` **dans l'environnement uniquement**, jamais dans un
  fichier versionné.
- **OUI explicite sur le coût avant chaque rendu** ; jamais dans une routine
  automatisée. Pour une simple voix off sans visage, préférer
  `audio-narration` (Kokoro, gratuit et local).

### HyperFrames — rendu vidéo EN LOCAL (voie principale)

Le rendu vidéo se fait **en local** avec le CLI [HyperFrames](https://github.com/heygen-com/hyperframes)
(« *Write HTML. Render video. Built for agents.* ») : on écrit une composition HTML/GSAP,
le CLI la rend en vidéo, sans dépendance à un service payant.

1. **Installer les skills officiels** :

   ```bash
   npx skills add heygen-com/hyperframes
   ```

   Cela fournit les slash commands : `/hyperframes`, `/hyperframes-cli`,
   `/hyperframes-media`, `/tailwind`, `/gsap`.

2. **⚠️ Le repo HyperFrames utilise BUN, jamais pnpm.** Toute commande d'installation
   ou de script dans le repo HyperFrames doit passer par `bun` (`bun install`, `bun run …`).

### Fallback : MCP « HyperFrames by HeyGen » (compose → render_video)

En alternative, le MCP hébergé HyperFrames by HeyGen expose `compose` puis `render_video`.

**⚠️ `render_video` est PAYANT.** Il est donc :

- réservé aux **vidéos premium** (contenus exceptionnels à forte valeur) ;
- **interdit dans une routine automatisée** sans **confirmation explicite** de
  l'utilisateur à chaque déclenchement.

Par défaut, toutes les routines par journée de matchs utilisent le rendu local CLI.

---

## Commandes

| Commande | Phase(s) | Skill sous-jacent | Description |
|---|---|---|---|
| `/pronoclip-match` | Act | `video-pronostic` | Génère UNE vidéo de pronostic (score exact) : composition HTML/GSAP puis rendu **local** via le CLI HyperFrames. Ex. : `/pronoclip-match PSG Real 2-1 néon`. |
| `/pronoclip-routine` | Sense → Report | `routine-matchs` | Traite une journée complète : détection des matchs, tâches RapidoRH, validation GO, compositions en parallèle (`video-composer`), publication CMS, log. Ex. : `/pronoclip-routine demain`. |
| `/pronoclip-daily` | Report | `suivi-rh-daily` | Transforme le log du jour en daily RapidoRH (unique, heures agrégées). ⚠️ Création réservée aux comptes **membre** (pas l'owner). |
| `/pronoclip-presentateur` | Act | `presentateur-heygen` | **Présentateur animé qui parle** (HeyGen Talking Photo), voix FR. **PAYANT** (~1 crédit/s), opt-in avec confirmation du coût. |

## Agents (2)

- **`video-composer`** — rend UNE vidéo par match (parallélisable, max 3 en routine),
  wrapper du pipeline local (`scripts/render-video.ts`). Contrat de sortie JSON.
- **`verificateur-legal`** — modération **adversariale** des frames d'un MP4 rendu
  (zéro logo/visage/mention IA absente) ; verdict OK/REJET **bloquant**. Complète le
  hook `assertDisclosure` (qui, lui, ne vérifie que la config).


## Configuration

Toute la configuration client vit dans **`./pronoclip-data/config.json`**
(CONFIG swappable) : `company_id` CMS, comptes sociaux, IDs projet/colonnes
RapidoRH, compétitions suivies, style par défaut, fenêtre de publication
(H-6 → H-2), langue des captions. Le fichier est créé au premier lancement
par le mini-flow d'onboarding de `/pronoclip-routine` (skill
`routine-matchs`, Phase 0) — aucun skill ne code ces valeurs en dur, le
plugin se revend en changeant ce seul fichier.

Deux surfaces de configuration, à ne pas confondre :

| Fichier | Versionné ? | Contenu |
|---|---|---|
| `pronoclip.config.json` | oui | config **produit** : marque, couleurs, durée, nb de plans, langue, texte de la mention IA, niveau de rendu, voix. Aucun secret, aucun ID client. |
| `.env` (voir `.env.example`) | **non** | identifiants et secrets : `RAPIDOCMS_COMPANY_ID`, URLs MCP, clés API. |
| `./pronoclip-data/config.json` | **non** | données **client** de runtime : comptes sociaux, IDs projet/colonnes RapidoRH (résolus à l'onboarding). |

### Mode image B3 — stopgap temporaire

La génération d'images tourne actuellement en **mode B3** (`image.mode` dans
`pronoclip.config.json`) : `generate_image` **sans image de référence**. C'est un
**stopgap temporaire**, **pas** le comportement nominal — la cohérence de visage
n'est **pas** garantie. La dégradation est **bruyante** : avertissement par plan +
note métadonnées `preview technique — cohérence de personnage non garantie`. Le mode
nominal est **B1** (`edit_image` + portraits de référence) ; bascule sans réécriture du
cœur dès que l'outil serveur est livré (`reference/specs/edit_image-mcp-rapidocms.md`).
Détails dans `USAGE.md`.

### Anti-régression : ne laisser fuir aucune donnée client

Un ID d'établissement, un ID projet/colonne ou une URL de tenant codés en dur
rendent le plugin invendable. Test à faire passer (doit revenir **vide**) :

```sh
git grep -nE "\"(company_id|projet_id)\"[[:space:]]*:[[:space:]]*[0-9]|foodeatup|https?://[^\" ]*rapido[^\" ]*\.(com|io|app|net)" \
  -- pronoclip-video ":(exclude)pronoclip-video/README.md"
```

Le test cible une **affectation** d'ID client (`"company_id": 321`), pas un
nombre nu — il ignore ainsi `node_modules/` (via `git grep`) et les nombres sans
rapport. Ce qu'il traque : IDs d'établissement (`321`), IDs projet/colonnes
(`29`, `101`…) réintroduits en affectation, noms de tenants clients
(`foodeatup`…) et URLs de services en dur.

**Distinction importante** — `BraindCode` / `braindcode.com` est le **nom de
l'éditeur** du plugin (`author` dans `plugin.json`), **pas** une donnée client :
il est **volontairement conservé** et n'est donc **pas** ciblé par ce test.

---

## Workflow : Sense → Plan → Act → Feed → Report

Cycle appliqué à chaque **journée de matchs** :

```
        ┌─────────────────────────────────────────────────────────────┐
        │                    JOURNÉE DE MATCHS N                       │
        └─────────────────────────────────────────────────────────────┘

  [SENSE]            [PLAN]              [ACT]              [FEED]             [REPORT]
  Détecter    →   Planifier      →   Produire       →   Publier       →   Rendre compte
──────────────  ────────────────   ───────────────    ──────────────    ────────────────
• Calendrier    • Projet/tâches    • Pronostics       • Upload vidéo    • Logs → daily
  de la          RapidoRH par       score exact        (RapidoCMS)       RapidoRH
  journée        match             • Composition      • Draft + post    • Bilan : vidéos
• Sélection     • Routine par       HTML/GSAP           planifié par      produites /
  des affiches   journée de         (skills            match ou          publiées /
  (matchs à      matchs             HyperFrames)        journée           échecs
  couvrir)      • Créneaux de      • Rendu vidéo      • Campagne        • Préparation de
                 publication         LOCAL (CLI          multi-réseaux    la journée N+1
                                     HyperFrames,
                                     bun)
```

- **Sense** — observer : quelle est la prochaine journée, quels matchs couvrir.
- **Plan** — organiser : tâches RapidoRH par match, routine de production, créneaux de publication.
- **Act** — produire : pronostic score exact + vidéo rendue en local (jamais `render_video` payant sans confirmation).
- **Feed** — diffuser : upload et publication/planification via RapidoCMS.
- **Report** — capitaliser : les logs de la routine deviennent des dailies RapidoRH, et alimentent la journée suivante.

---

## Recette

Tests de recette à dérouler avant toute mise en production chez un client :

| # | Test | Critères de succès |
|---|---|---|
| 1 | `/pronoclip-match PSG Real 2-1 néon` | MP4 rendu **localement** dans `./pronoclip-output/` ; `hyperframes lint` OK ; mention « généré par IA » visible ; **aucun logo** de club ni de compétition. |
| 2 | `/pronoclip-routine demain` | Le plan (N matchs → N tâches → GO ?) est présenté **avant** toute génération ; les tâches sont créées dans les **bonnes colonnes** Kanban ; les posts sont planifiés avec `post_heure` au format **HH:MM:SS**, dans la fenêtre H-6 → H-2. |
| 3 | `/pronoclip-daily` | Un daily **unique** est créé (pas de doublon si relancé) ; les heures sont cohérentes avec les durées des logs (somme arrondie au 0,5 h). |
| 4 | Cas d'échec : match sans couleurs connues | Les couleurs **par défaut** du template sont appliquées ; l'échec éventuel est loggé en **KO** ; la routine **continue** sur les matchs suivants sans blocage. |
| 5 | `/pronoclip-match PSG Real 2-1` (mode standard) | Vidéo avec **4 séquences animées**, VO **Kokoro FR**, BGM, **captions karaoké** ; aucune image avec logo ou visage identifiable. |
| 6 | Même commande avec `tts_provider: "elevenlabs"` en config | Voix **ElevenLabs** utilisée (`elevenlabs_voice_id` de la config) ; le **nombre de caractères envoyés est loggé**. |
| 7 | `/pronoclip-routine demain` avec `mode_routine: "light"` | Vidéos **sans images ni audio** (template texte + formes) ; temps de production nettement réduit. |
| 8 | Demande « ajoute un présentateur » | **Annonce du coût HeyGen** puis **attente d'une confirmation explicite** avant tout appel API ; aucun appel sans OUI. |
| 9 | MP4 rendu passé à `verificateur-legal` | Frames extraites + inspectées : **verdict OK** si zéro logo/écusson/visage identifiable et mention IA présente sur toutes les frames ; **REJET** sinon (bloque la publication). |

## Structure du plugin

```
pronoclip-video/
├── .claude-plugin/plugin.json         # Manifeste du plugin
├── core/                              # Cœur PUR (aucune I/O, aucun MCP) — testé (vitest)
│   ├── prediction.ts  match-script.ts  shot-budget.ts  match-bible.ts
│   ├── composition.ts (HTML→overlays) narration.ts  labels.ts  render-guard.ts
│   ├── prompt-builder.ts video-prompt.ts scene-*.ts portrait-index.ts  types.ts  rng.ts
├── adapters/                          # Frontière I/O — transport injecté, MCP jamais appelé ici
│   ├── tts.ts (SAPI/ElevenLabs)  audio-mux.ts (musique+whoosh+mux)
│   ├── openai-image.ts (B2)  fal.ts (Kling)  squad-library.ts (portraits)
│   ├── rapidocms.ts (publication)  mcp.ts  rest.ts
├── scripts/                           # Drivers exécutables (tsx)
│   ├── render-video.ts (npm run render)  publish-video.ts  animate-shot.ts
│   ├── example-teams.ts  generate-example.ts  tunnel.mjs (upload éphémère)
├── commands/    (5)  match · routine · daily · presentateur · squad
├── skills/      (6)  video-pronostic · routine-matchs · publication-cms
│                     audio-narration · suivi-rh-daily · presentateur-heygen
├── agents/      (2)  video-composer · verificateur-legal
├── reference/   (3)  charte-pronoclip.md · directives-legales.md · scripts-narration.md
│   ├── decisions/    ADR (portraits, nom/visage, recette clip animé)
│   └── specs/        edit_image, hyperframes-pipeline, squad-index, backend-asks
├── pronoclip.config.json  .env.example  package.json
└── README.md  USAGE.md
```

## Enregistrement dans le marketplace

Entrée à ajouter dans `.claude-plugin/marketplace.json` (format identique aux plugins `rapido-*`) :

```json
{ "name": "pronoclip-video", "source": "./pronoclip-video", "description": "Vidéos de pronostics football (score exact) rendues en local avec HyperFrames, routines par journée de matchs via RapidoRH, publication RapidoCMS, logs transformés en dailies" }
```
