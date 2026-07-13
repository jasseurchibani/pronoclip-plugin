// Génération + verrouillage du « monde » (Phase 3, cf. MISSION §4).
// Choisit UNE fois time_of_day/sky/weather/stadium/floodlights/grade, les auras
// par équipe et la fiche de chaque joueur, puis verrouille le tout : les 8 plans
// lisent dedans. Pur, sans I/O. Aucune logique implémentée à ce stade.

import type { MatchBible, MatchScript } from './types'

/** Construit et verrouille le Match Bible pour une vidéo donnée. */
export function buildMatchBible(_script: MatchScript): MatchBible {
  throw new Error('Not implemented — Phase 3 (core/match-bible.ts)')
}
