---
name: routine-matchs
description: >-
  Utiliser quand l'utilisateur veut lancer la routine PronoClip, traiter les
  matchs du jour ou de la journée, générer les vidéos de tous les matchs, ou
  planifier la production vidéo d'une journée de compétition.
---

# Routine PronoClip — production vidéo par journée de matchs

Orchestre la production de toutes les vidéos de pronostics d'une journée de
compétition, en 5 phases calquées sur le LOOP ENGINE :
**Sense → Plan → Act → Feed → Report**.

Cette routine ne génère rien elle-même : elle dispatche le subagent
`video-composer` (rendu, parallélisable) et le skill `publication-cms`
(publication), et s'appuie sur le MCP **RapidoRh** pour le suivi des tâches.
Pour une vidéo unique hors routine, c'est le skill `video-pronostic` qui
s'applique. Lire la section **Garde-fous** avant toute exécution.

## Phase 1 — SENSE : récupérer les matchs

1. Déterminer la période demandée : une **date** (« les matchs du 12/07 »)
   ou une **journée de compétition** (« la J3 de Ligue des Champions »).
2. Chercher la liste des matchs, dans cet ordre :
   - **Fichier local** `./pronoclip-data/matchs-{date}.json` s'il existe
     (source de vérité prioritaire) ;
   - sinon, **recherche web** sur les calendriers officiels des compétitions.
3. Compétitions par défaut (si l'utilisateur ne précise pas) :
   **Ligue des Champions, Ligue Europa, Euro**.

Format du fichier `matchs-{date}.json` :

```json
[
  {
    "home": "PSG",
    "away": "Real Madrid",
    "competition": "Ligue des Champions",
    "kickoff": "2026-07-12T21:00:00+02:00",
    "colors": { "home": "#004170", "away": "#ffffff" }
  }
]
```

## Phase 2 — PLAN : tâches RapidoRH + validation

1. Via le MCP **RapidoRh**, créer **une tâche par match** dans le projet
   PronoClip (projet et colonnes définis dans le skill `suivi-rh-daily`) :
   - **Titre** : `🎬 Vidéo prono : {home} vs {away} ({competition} — {date})`
   - **Description** : le brief de composition — score à pronostiquer, style
     graphique, format ;
   - **Colonne** : `Todo`.
2. **Résumer le plan à l'utilisateur** et attendre sa validation :

   > N matchs détectés → N tâches créées dans RapidoRH → **GO ?**

   **Aucune génération avant validation explicite.** Sans « GO » (ou
   équivalent clair), s'arrêter là.

## Phase 3 — ACT : composition en parallèle, Kanban en séquentiel

La composition vidéo est **parallélisée** via le subagent
**`video-composer`** (un agent par match, voir `agents/video-composer.md`) ;
tous les mouvements Kanban et la publication restent **séquentiels**.

Traiter les matchs **dans l'ordre des coups d'envoi**, par **lots de 3
compositions simultanées maximum** :

1. **Dispatch du lot** — pour chaque match du lot, séquentiellement :
   déplacer sa tâche en **Doing** (`move-task`) ; puis lancer **en
   parallèle** un subagent `video-composer` par match, avec le brief JSON
   (home, away, score, compétition, kickoff, couleurs, pseudo, style,
   format, durée).
2. **Collecte** — attendre la fin du lot ; chaque subagent retourne son JSON
   contractuel `{status, mp4_path, duration_s, match, error?}`.
3. **Suite séquentielle**, match par match dans l'ordre du lot :
   - `status: "OK"` → invoquer le skill **`publication-cms`** (upload +
     planification du brouillon), puis déplacer la tâche en **Done** ;
   - `status: "KO"` → logger l'erreur (voir Phase 4), laisser la tâche en
     **Doing** avec un commentaire décrivant l'échec (`error` du JSON), et
     **PASSER AU MATCH SUIVANT** — un échec ne bloque jamais la routine.
4. Passer au lot suivant.

## Phase 4 — FEED : compléter le log du jour

Compléter `./pronoclip-logs/YYYY-MM-DD.md` avec le bilan d'exécution :

- vidéos **OK / KO** (avec la cause des KO) ;
- posts planifiés (plateforme + créneau) ;
- durées de production par vidéo.

Ce log est la matière première du skill de dailies (`/pronoclip-daily`).

## Phase 5 — REPORT : récapitulatif et suite

1. Présenter à l'utilisateur un tableau récapitulatif :

   | Match | Vidéo | Post CMS | Tâche RH |
   |---|---|---|---|
   | PSG vs Real 2-1 | ✅ `2026-07-12_psg-vs-real_2-1_neon.mp4` | ✅ planifié 18:30 | Done |
   | OM vs Inter | ❌ rendu KO (lint) | — | Doing (commentaire) |

2. **Proposer de lancer `/pronoclip-daily`** pour transformer le log du jour
   en daily RapidoRH.

## Garde-fous

- **Max 10 vidéos par exécution.** Au-delà de 10 matchs, traiter les 10
  premiers (ordre des coups d'envoi) puis **re-demander confirmation** avant
  de poursuivre.
- **Jamais de planification CMS à moins de 2 h du coup d'envoi** : la vidéo
  doit sortir **AVANT** le match. Si le créneau viable est déjà passé ou trop
  proche, ne pas planifier le post ; le signaler dans le log et le rapport.
- **Max 3 compositions simultanées** : jamais plus de 3 subagents
  `video-composer` en parallèle, quel que soit le nombre de matchs.
- Les garde-fous de `video-pronostic` et les interdits de `video-composer`
  s'appliquent à chaque vidéo (pas de logos ni visages, mention IA, rendu
  local uniquement — jamais le fallback MCP payant dans cette routine).
