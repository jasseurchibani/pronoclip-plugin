// Allocation des 8 plans — créneaux 4 à 7 (Phase 2, cf. MISSION §5).
// 3 plans d'intro fixes + 1 outro fixe → 4 créneaux libres selon le nombre de
// buts (G). Ordre chronologique par matchOrder. Pur, sans I/O.
// Aucune logique implémentée à ce stade.

import type { MatchScript } from './types'

export interface Shot {
  // TODO(Phase 2): scene_order, scene_type, team_side, player, caption, merged_goals.
  readonly _placeholder?: never
}

/** Répartit les buts et les plans de remplissage sur les 8 créneaux. */
export function allocateShots(_script: MatchScript): Shot[] {
  throw new Error('Not implemented — Phase 2 (core/shot-budget.ts)')
}
