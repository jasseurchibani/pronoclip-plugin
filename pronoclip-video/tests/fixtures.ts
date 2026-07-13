import type { Team } from '../core/types'

export const HOME: Team = {
  name: 'Alpha',
  players: [
    { id: 'a1', name: 'Alonso', isKeyPlayer: true, profile: { position: 'FW', heading: 0.5, isPenaltyTaker: true } },
    { id: 'a2', name: 'Aubert', profile: { position: 'MF', longRange: 0.7 } },
    { id: 'a3', name: 'Amiot', profile: { position: 'WG', heading: 0.1 } },
    { id: 'a4', name: 'Arnaud', profile: { position: 'DF', heading: 0.85 } },
    { id: 'a5', name: 'Auber', profile: { position: 'MF', setPieces: 0.85 } },
  ],
}

export const AWAY: Team = {
  name: 'Beta',
  players: [
    { id: 'b1', name: 'Bardo', isKeyPlayer: true, profile: { position: 'FW', heading: 0.8, isPenaltyTaker: true } },
    { id: 'b2', name: 'Berger', profile: { position: 'WG', heading: 0.1 } },
    { id: 'b3', name: 'Blanc', profile: { position: 'DF', heading: 0.85 } },
    { id: 'b4', name: 'Boyer', profile: { position: 'MF' } },
    { id: 'b5', name: 'Bruno', profile: { position: 'FW' } },
  ],
}

export const GOAL_TYPES_SET = new Set([
  'goal_normal', 'goal_header', 'goal_volley', 'goal_bicycle',
  'goal_freekick', 'goal_penalty', 'goal_longrange',
])
