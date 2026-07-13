import type { Team } from '../core/types'

export const HOME: Team = {
  name: 'Alpha',
  players: [
    { id: 'a1', name: 'Alonso', isKeyPlayer: true },
    { id: 'a2', name: 'Aubert' },
    { id: 'a3', name: 'Amiot' },
    { id: 'a4', name: 'Arnaud' },
    { id: 'a5', name: 'Auber' },
  ],
}

export const AWAY: Team = {
  name: 'Beta',
  players: [
    { id: 'b1', name: 'Bardo', isKeyPlayer: true },
    { id: 'b2', name: 'Berger' },
    { id: 'b3', name: 'Blanc' },
    { id: 'b4', name: 'Boyer' },
    { id: 'b5', name: 'Bruno' },
  ],
}

export const GOAL_TYPES_SET = new Set([
  'goal_normal', 'goal_header', 'goal_volley', 'goal_bicycle',
  'goal_freekick', 'goal_penalty', 'goal_longrange',
])
