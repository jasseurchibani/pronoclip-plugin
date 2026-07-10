---
name: suivi-rh-daily
description: >-
  Utiliser pour la planification RapidoRH des routines PronoClip (projet,
  tâches, Kanban) et pour transformer les logs d'exécution en daily.
---

# Suivi RH — projet Kanban PronoClip et dailies

Deux responsabilités, via le MCP **RapidoRh** :

- **Partie A** — gérer le projet Kanban « PronoClip — Production vidéo »
  (projet, colonnes, tâches) pour le compte des autres skills ;
- **Partie B** — transformer le log d'exécution du jour en **daily**.

## Partie A — Projet et Kanban

### Initialisation (premier usage uniquement)

1. Chercher un projet **« PronoClip — Production vidéo »** via
   `get-projects-list-tool`.
2. S'il n'existe pas :
   - le créer avec `create-project-tool` ;
   - puis créer les colonnes avec `create-task-list-tool`, dans cet ordre :

     | Colonne | Rôle |
     |---|---|
     | `Matchs à traiter` | Todo — tâches créées en phase Plan |
     | `Vidéo en cours` | Doing — match en production |
     | `Publié` | Done — vidéo rendue ET post planifié |
     | `Échecs à reprendre` | tâches KO à re-traiter |

3. **Mémoriser les IDs** (projet + chaque colonne) dans
   `./pronoclip-data/config.json` pour ne plus jamais les redemander.
   Les colonnes sont des **IDs numériques** : les résoudre **une fois**,
   puis toujours réutiliser les valeurs du fichier — ne jamais re-résoudre
   par nom à chaque appel.

   ```json
   {
     "rh": {
       "projet_id": 29,
       "colonnes": {
         "matchs_a_traiter": 101,
         "video_en_cours": 102,
         "publie": 103,
         "echecs_a_reprendre": 104
       }
     }
   }
   ```

   (Fichier partagé avec le skill `publication-cms` : fusionner les clés,
   ne pas écraser la section `comptes`/`company_id`.)

### Opérations exposées aux autres skills

Les skills `routine-matchs` et `video-pronostic` s'appuient sur ces trois
opérations — toujours passer par les IDs mémorisés dans `config.json` :

1. **`créer-tâche-match(brief)`** — `create-task-tool` dans la colonne
   `matchs_a_traiter` : titre
   `🎬 Vidéo prono : {home} vs {away} ({competition} — {date})`,
   description = brief de composition (score, style, format).
2. **`déplacer-tâche(id, colonne)`** — `move-task-tool` vers l'ID numérique
   de la colonne cible (`video_en_cours`, `publie`, …).
3. **`commenter-échec(id, raison)`** — consigner la raison de l'échec sur la
   tâche et la déplacer vers `echecs_a_reprendre`.

## Partie B — Daily

1. **Lire** le log du jour : `./pronoclip-logs/YYYY-MM-DD.md`.
   - **Si aucun log aujourd'hui : le dire à l'utilisateur et ne RIEN créer.**
2. **Agréger** :
   - nombre de vidéos générées (et répartition OK / KO) ;
   - nombre de posts planifiés (et sur quels réseaux) ;
   - échecs (avec leurs causes) ;
   - **temps total estimé** = somme des durées loggées (`~Xmin`).
3. **Créer le daily** via `create-daily-tool`, en respectant STRICTEMENT les
   règles du serveur RapidoRh :
   - **tâches travaillées** = les tâches du projet PronoClip **touchées
     aujourd'hui** (créées, déplacées ou commentées) ;
   - **heures** = temps total estimé, **arrondi au 0,5 h**.
4. **Format du résumé** du daily :

   ```
   Routine PronoClip : X vidéos générées (Y OK / Z KO), X posts planifiés
   sur {réseaux}. Détail par match : ...
   ```

## Garde-fou — un seul daily par jour

Avant toute création, vérifier via `get-dailies-tool` qu'aucun daily
n'existe déjà pour aujourd'hui :

- **aucun daily** → créer normalement (Partie B) ;
- **un daily existe déjà** → ne pas en créer un second ; présenter le bilan
  agrégé à l'utilisateur et **proposer de compléter le daily existant à la
  main**.
