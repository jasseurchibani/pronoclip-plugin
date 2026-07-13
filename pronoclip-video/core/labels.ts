// Libellés FR et captions (overlays uniquement — jamais cuits dans une image).
// cf. MISSION §4/§13 : aucun texte, score, nom ou chiffre dans un prompt d'image.

import type { GoalType, SceneType } from './types'

/** Libellé FR d'un type de but (repris de scene-planner.ts du site). */
export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  goal_normal: 'But',
  goal_header: 'But de la tête',
  goal_volley: 'Volée',
  goal_bicycle: 'Retourné',
  goal_freekick: 'Coup franc',
  goal_penalty: 'Penalty',
  goal_longrange: 'Frappe de loin',
}

/** Caption d'un plan de but : « But : Nom ». */
export function goalCaption(goalType: GoalType, playerName: string | null): string {
  const label = GOAL_TYPE_LABELS[goalType]
  return playerName ? `${label} : ${playerName}` : label
}

/** Captions déterministes des plans non-but (overlays). */
export const SCENE_CAPTIONS: Partial<Record<SceneType, string>> = {
  team_reveal: 'DOMICILE',
  rival_reveal: 'EXTÉRIEUR',
  face_off: 'FACE À FACE',
  final_result: 'SCORE FINAL',
  power_up: 'MONTÉE EN PUISSANCE',
  celebration: 'CÉLÉBRATION',
  determination: 'DÉTERMINATION',
  goalkeeper_save: 'ARRÊT DÉCISIF',
  big_chance_missed: 'OCCASION MANQUÉE',
  goal_montage: 'DÉLUGE DE BUTS',
}
