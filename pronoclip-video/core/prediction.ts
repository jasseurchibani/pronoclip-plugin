// Moteur de pronostic (Phase 2, cf. MISSION §6).
// Portage de auto-prediction + prediction-validator, adapté au contexte football
// (pas de ticket). Ne prédit QUE ce qui manque (L0–L3). Pur, sans I/O.
// Aucune logique implémentée à ce stade.

import type { InputLevel, MatchScript } from './types'

export interface PredictionInput {
  // TODO(Phase 2): équipes, effectif, contexte (forme), et valeurs optionnelles
  // fournies par l'utilisateur (score, buteurs, types de but).
  readonly _placeholder?: never
}

/** Détecte le niveau d'entrée (L0–L3) selon ce que l'utilisateur a fourni. */
export function detectInputLevel(_input: PredictionInput): InputLevel {
  throw new Error('Not implemented — Phase 2 (core/prediction.ts)')
}

/** Produit un match-script complet en ne prédisant que ce qui manque. */
export function predictMatch(_input: PredictionInput): MatchScript {
  throw new Error('Not implemented — Phase 2 (core/prediction.ts)')
}
