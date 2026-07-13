// Domaine partagé du cœur pronoclip-video.
// Types structurels uniquement — la logique métier arrive en Phase 2+.
// Ce module ne connaît ni MCP ni REST (cf. MISSION §10).

/** Les 7 types de but autorisés (cf. MISSION §6). Vocabulaire figé, pas de logique. */
export type GoalType =
  | 'goal_normal'
  | 'goal_header'
  | 'goal_volley'
  | 'goal_bicycle'
  | 'goal_freekick'
  | 'goal_penalty'
  | 'goal_longrange'

export type TeamSide = 'home' | 'away'

/**
 * Niveau d'entrée fourni par l'utilisateur (cf. MISSION §6) :
 * L0 = rien, L1 = score, L2 = score + buteurs, L3 = tout donné.
 * On ne prédit jamais par-dessus une valeur fournie.
 */
export type InputLevel = 'L0' | 'L1' | 'L2' | 'L3'

/** Niveau de rendu (cf. MISSION §8) : `motion` (gratuit) ou `animated` (premium). */
export type RenderLevel = 'motion' | 'animated'

// Les formes complètes ci-dessous seront définies dans leur module et/ou leur
// phase. Placeholders volontairement vides — aucune décision de schéma figée ici.

/** Script de match relisible/corrigible avant toute génération (cf. MISSION §6). */
export interface MatchScript {
  // TODO(Phase 2): score, buteurs, types de but, ordre chronologique,
  // squelette des 8 plans, captions.
  readonly _placeholder?: never
}

/** « Match Bible » : le monde verrouillé une fois, lu par les 8 plans (cf. MISSION §4). */
export interface MatchBible {
  // TODO(Phase 3): world, camera, teams, players, seed.
  readonly _placeholder?: never
}
