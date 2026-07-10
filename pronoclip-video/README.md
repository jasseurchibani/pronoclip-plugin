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

| Commande | Phase(s) | Description |
|---|---|---|
| `/pronoclip-video:planifier-journee` | Sense → Plan | Détecte la prochaine journée de matchs, sélectionne les affiches, crée le projet / les tâches RapidoRH et programme la routine de production. |
| `/pronoclip-video:generer-video` | Act | Génère la vidéo de pronostic (score exact) pour un match ou une journée : composition HTML/GSAP puis rendu **local** via le CLI HyperFrames. |
| `/pronoclip-video:publier-dailies` | Feed → Report | Publie ou planifie les vidéos via RapidoCMS, puis transforme les logs d'exécution en **dailies** RapidoRH. |

*(Squelette : le contenu des commandes/skills n'est pas encore implémenté.)*

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

## Structure du plugin

```
pronoclip-video/
├── .claude-plugin/
│   └── plugin.json      # Manifeste du plugin
├── commands/            # Slash commands (à venir)
├── skills/              # Skills (à venir)
├── agents/              # Agents spécialisés (à venir)
├── reference/           # Documentation de référence (à venir)
└── README.md
```

## Enregistrement dans le marketplace

Entrée à ajouter dans `.claude-plugin/marketplace.json` (format identique aux plugins `rapido-*`) :

```json
{ "name": "pronoclip-video", "source": "./pronoclip-video", "description": "Vidéos de pronostics football (score exact) rendues en local avec HyperFrames, routines par journée de matchs via RapidoRH, publication RapidoCMS, logs transformés en dailies" }
```
