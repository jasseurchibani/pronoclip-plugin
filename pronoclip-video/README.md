# pronoclip-video

Plugin Claude Code pour la génération de **vidéos de pronostics football (score exact)** :
rendu vidéo en local avec **HyperFrames**, planification des routines par **journée de matchs**
via **RapidoRH**, publication via **RapidoCMS**, et transformation des logs d'exécution en **dailies**.

> Version 0.1.0 — squelette. Les commandes, skills et agents seront ajoutés dans les
> prochaines itérations ; ce README fixe les prérequis et l'architecture cible.

---

## Prérequis

| Prérequis | Rôle | Obligatoire |
|---|---|---|
| **MCP RapidoCMS** | Publication des vidéos (drafts, campagnes, planification de posts, upload de fichiers) | Oui |
| **MCP RapidoRh** | Projets, tâches et **dailies** par journée de matchs | Oui |
| **Node ≥ 20** | Exécution des CLI (`npx skills`, tooling HyperFrames) | Oui |
| **bun** | Gestionnaire de paquets / runtime du repo HyperFrames | Oui (pour le rendu vidéo) |

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
| `/pronoclip-daily` | Report | `suivi-rh-daily` | Transforme le log du jour en daily RapidoRH (unique, heures agrégées). |

*(Les fichiers `commands/` restent à créer ; les skills et l'agent sont en place.)*

## Configuration

Toute la configuration client vit dans **`./pronoclip-data/config.json`**
(CONFIG swappable) : `company_id` CMS, comptes sociaux, IDs projet/colonnes
RapidoRH, compétitions suivies, style par défaut, fenêtre de publication
(H-6 → H-2), langue des captions. Le fichier est créé au premier lancement
par le mini-flow d'onboarding de `/pronoclip-routine` (skill
`routine-matchs`, Phase 0) — aucun skill ne code ces valeurs en dur, le
plugin se revend en changeant ce seul fichier.

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

## Structure du plugin

```
pronoclip-video/
├── .claude-plugin/
│   └── plugin.json                    # Manifeste du plugin
├── commands/                          # Slash commands (à venir)
├── skills/
│   ├── video-pronostic/SKILL.md       # Une vidéo : brief → composition → rendu local
│   ├── routine-matchs/SKILL.md        # Journée complète (LOOP ENGINE, onboarding CONFIG)
│   ├── publication-cms/SKILL.md       # Upload, brouillon, planification, campagne
│   ├── audio-narration/SKILL.md       # Voix off TTS, BGM, SFX, captions karaoké
│   └── suivi-rh-daily/SKILL.md        # Kanban RapidoRH + dailies
├── agents/
│   └── video-composer.md              # Subagent de composition (parallélisable, max 3)
├── reference/
│   ├── charte-pronoclip.md            # Identité visuelle/éditoriale, captions, thèmes CSS
│   ├── directives-legales.md          # 3 règles bloquantes
│   ├── scripts-narration.md           # Gabarits de VO (hype/analyse/humour × FR/EN)
│   └── template-composition.html      # Squelette 4 scènes (GSAP)
└── README.md
```

## Enregistrement dans le marketplace

Entrée à ajouter dans `.claude-plugin/marketplace.json` (format identique aux plugins `rapido-*`) :

```json
{ "name": "pronoclip-video", "source": "./pronoclip-video", "description": "Vidéos de pronostics football (score exact) rendues en local avec HyperFrames, routines par journée de matchs via RapidoRH, publication RapidoCMS, logs transformés en dailies" }
```
