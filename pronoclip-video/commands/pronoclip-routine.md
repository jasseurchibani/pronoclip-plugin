---
description: Routine PronoClip complète pour une journée de matchs (Sense → Plan → Act → Feed → Report)
argument-hint: "[date | journée de compétition]"
---

Lance la routine PronoClip de production vidéo pour une journée de matchs.

Arguments reçus : $ARGUMENTS

1. Déterminer la période visée à partir des arguments : une date
   (`demain`, `12/07`…) ou une journée de compétition (`J3 Ligue des
   Champions`). Sans argument, proposer la prochaine journée détectée.
2. Invoquer le skill **`routine-matchs`** et dérouler ses 5 phases dans
   l'ordre : Phase 0 CONFIG (onboarding au premier lancement) → Sense →
   Plan (validation **GO ?** obligatoire avant toute génération) → Act
   (subagents `video-composer`, max 3 en parallèle) → Feed → Report.

Rappels non négociables (détail dans le skill) : max 10 vidéos par
exécution sans re-confirmation, aucune planification CMS à moins de 2 h du
coup d'envoi, jamais de bascule vers un service payant sans confirmation
humaine explicite.
