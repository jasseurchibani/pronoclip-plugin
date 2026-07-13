---
description: Sème et gèle l'effectif fictif d'une équipe (bibliothèque de portraits canonique)
argument-hint: "<équipe> [--namespace <marque>]"
---

Construit et **gèle** les portraits de référence fictifs d'une équipe. C'est la
**seule** commande qui génère des portraits — les vidéos, elles, ne font que **lire**
dans la bibliothèque (cf. `reference/decisions/2026-07-13-bibliotheque-portraits-canonique.md`).

Arguments reçus : $ARGUMENTS

## Rôle

Les portraits sont des **assets de marque curés**, pas du cache jetable : générés une
fois, **relus par un humain**, corrigés si ratés, puis **gelés** (immuables). Ils sont
**partagés** : un portrait `pronoclip/<équipe>` sert toutes les vidéos et tous les
clients. C'est le moat du projet.

## Namespace

- Sans `--namespace` : semé sous `pronoclip/<équipe>` (canonique — réservé au
  propriétaire du projet).
- Avec `--namespace <marque>` : semé sous `<marque>/<équipe>` (override d'un revendeur).
- Le résolveur de vidéo lit **`<marque>` d'abord, puis `pronoclip`** : un revendeur
  hérite des effectifs canoniques et ne sème que ce qu'il veut personnaliser.

## Flux (à dérouler)

1. **Résoudre l'effectif à semer** : la liste des joueurs vedettes / buteurs probables
   de l'équipe (donnée d'entrée, jamais la mémoire du modèle — cf. garde-fou effectif).
2. **Vérifier l'existant** : pour chaque joueur déjà gelé dans le namespace cible,
   **ne pas régénérer** (idempotence — on ne repaie pas un portrait déjà curé).
3. **Générer les portraits manquants** — plan héros neutre, en kit, cadrage
   « visage non-ancre » (contre-jour), athlète fictif indépendant (Décision A2 /
   Option 5). ⚠️ **Étape PAYANTE (Phase 4a)** :
   - afficher le **coût estimé** (nb de portraits × tarif image) **avant** ;
   - attendre l'**accord explicite** de l'utilisateur ;
   - ne rien générer sans ce OUI.
4. **Revue humaine** : présenter chaque portrait, laisser **valider / refuser /
   régénérer**. Un portrait refusé n'est jamais gelé.
5. **Geler** : écrire l'entrée dans l'index `./pronoclip-data/squads/<namespace>/<équipe>.json`
   (`portrait_url`, `descriptor`, `seed`, `version`, `status: "frozen"`), et déposer
   l'image dans la bibliothèque d'assets. Une correction crée une **nouvelle version** ;
   le pointeur canonique ne bouge qu'après validation.

## Garde-fous

- **Aucune génération sans coût affiché + accord explicite.**
- Les portraits canoniques sont **lus en HTTPS** par les revendeurs (URLs publiques) —
  aucun compte RapidoCMS requis pour *consommer* (cf. ADR §7).
- Si une vidéo demande un joueur non semé → **erreur dure « effectif non semé »**,
  jamais de génération silencieuse (barrière côté lecture, `core/portrait-index.ts`).

> État : squelette posé (résolveur, index, erreur « non semé » — `core/portrait-index.ts`).
> L'étape de **génération** (3) reste inactive tant que l'outil serveur `edit_image`
> (`reference/specs/edit_image-mcp-rapidocms.md`) et la validation juridique de
> l'Option 5 ne sont pas livrés.
