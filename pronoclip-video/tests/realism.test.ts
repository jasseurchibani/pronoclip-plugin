import { describe, it, expect } from 'vitest'
import { predictMatch } from '../core/prediction'
import { allocateShots } from '../core/shot-budget'
import { buildMatchScript } from '../core/match-script'
import type { GoalType, Team } from '../core/types'
import { HOME, AWAY } from './fixtures'

// Collecte les types de but du buteur domicile sur de nombreuses graines.
function homeGoalTypes(home: Team, seeds = 300): Set<GoalType> {
  const types = new Set<GoalType>()
  for (let seed = 0; seed < seeds; seed++) {
    const p = predictMatch({ home, away: AWAY, score: { home: 2, away: 0 }, seed })
    for (const g of p.goals) if (g.teamSide === 'home') types.add(g.goalType)
  }
  return types
}

describe('correction 1 — type de but selon le profil du joueur', () => {
  it('un ailier ne marque ni de la tête, ni penalty, ni coup franc', () => {
    const winger: Team = { name: 'W', players: [{ name: 'Ailier', profile: { position: 'WG', heading: 0, setPieces: 0 } }] }
    const types = homeGoalTypes(winger)
    expect(types.has('goal_header')).toBe(false)
    expect(types.has('goal_penalty')).toBe(false)
    expect(types.has('goal_freekick')).toBe(false)
  })
  it('seul le tireur désigné marque un penalty', () => {
    const taker: Team = { name: 'T', players: [{ name: 'Tireur', profile: { position: 'FW', heading: 0.5, isPenaltyTaker: true } }] }
    const nonTaker: Team = { name: 'N', players: [{ name: 'Avant', profile: { position: 'FW', heading: 0.5 } }] }
    expect(homeGoalTypes(taker).has('goal_penalty')).toBe(true)
    expect(homeGoalTypes(nonTaker).has('goal_penalty')).toBe(false)
  })
  it('coup franc réservé au tireur sur coups de pied arrêtés', () => {
    const fkTaker: Team = { name: 'F', players: [{ name: 'CoupFranc', profile: { position: 'MF', setPieces: 0.9 } }] }
    const plainMf: Team = { name: 'P', players: [{ name: 'Milieu', profile: { position: 'MF' } }] }
    expect(homeGoalTypes(fkTaker).has('goal_freekick')).toBe(true)
    expect(homeGoalTypes(plainMf).has('goal_freekick')).toBe(false)
  })
  it('un buteur de surface / défenseur peut marquer de la tête', () => {
    const targetMan: Team = { name: 'H', players: [{ name: 'Pivot', profile: { position: 'FW', heading: 0.85 } }] }
    expect(homeGoalTypes(targetMan).has('goal_header')).toBe(true)
  })
})

describe('correction 2 — le camp adverse reste présent dans l’acte central', () => {
  it('sur un clean sheet 2-0, goalkeeper_save est obligatoire et met en scène l’adversaire', () => {
    const p = predictMatch({ home: HOME, away: AWAY, score: { home: 2, away: 0 }, seed: 5 })
    const shots = allocateShots({
      home: { name: HOME.name, keyPlayer: 'Alonso' },
      away: { name: AWAY.name, keyPlayer: 'Bardo' },
      score: p.score,
      goals: p.goals,
    })
    const middle = shots.slice(3, 7)
    expect(middle.some(s => s.sceneType === 'goalkeeper_save' && s.teamSide === 'away')).toBe(true)
    // Au moins un plan parmi 4–7 met en scène le camp opposé.
    expect(middle.some(s => s.teamSide === 'away' || s.teamSide === 'both')).toBe(true)
  })
})

describe('correction 3 — le seed est un paramètre d’entrée', () => {
  it('graine explicite → déterministe', () => {
    expect(predictMatch({ home: HOME, away: AWAY, seed: 3 }))
      .toEqual(predictMatch({ home: HOME, away: AWAY, seed: 3 }))
  })
  it('sans graine → résultat valide (aléatoire par défaut)', () => {
    const r = predictMatch({ home: HOME, away: AWAY })
    expect(r.goals).toHaveLength(r.score.home + r.score.away)
    const ms = buildMatchScript({ home: HOME, away: AWAY })
    expect(typeof ms.seed).toBe('number')
  })
})

describe('correction 4 — l’effectif est une entrée, jamais une connaissance du modèle', () => {
  it('refuse de prédire des buteurs sans effectif', () => {
    expect(() => predictMatch({ home: { name: 'H', players: [] }, away: AWAY, score: { home: 1, away: 0 }, seed: 1 }))
      .toThrow(/Effectif domicile/)
  })
  it('n’exige pas d’effectif quand les buteurs sont fournis (L3)', () => {
    expect(() => predictMatch({
      home: { name: 'H', players: [] },
      away: { name: 'A', players: [] },
      score: { home: 1, away: 0 },
      goals: [{ teamSide: 'home', playerName: 'Fourni', goalType: 'goal_normal' }],
      seed: 1,
    })).not.toThrow()
  })
})
