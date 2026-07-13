import { describe, it, expect } from 'vitest'
import { allocateShots, type ShotBudgetInput } from '../core/shot-budget'
import { predictMatch } from '../core/prediction'
import type { GoalPrediction, Score } from '../core/types'
import { HOME, AWAY } from './fixtures'

function shotsFor(score: Score, seed = 42) {
  const p = predictMatch({ home: HOME, away: AWAY, score, seed })
  const input: ShotBudgetInput = {
    home: { name: HOME.name, keyPlayer: 'Alonso' },
    away: { name: AWAY.name, keyPlayer: 'Bardo' },
    score: p.score,
    goals: p.goals,
  }
  return { shots: allocateShots(input), goals: p.goals }
}

describe('structure fixe des 8 plans', () => {
  it('renvoie toujours 8 plans numérotés 1..8', () => {
    for (const s of [{ home: 0, away: 0 }, { home: 1, away: 0 }, { home: 2, away: 1 }, { home: 4, away: 3 }] as Score[]) {
      const { shots } = shotsFor(s)
      expect(shots).toHaveLength(8)
      expect(shots.map(x => x.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    }
  })
  it('intro et outro sont fixes', () => {
    const { shots } = shotsFor({ home: 2, away: 1 })
    expect(shots[0].sceneType).toBe('team_reveal')
    expect(shots[1].sceneType).toBe('rival_reveal')
    expect(shots[2].sceneType).toBe('face_off')
    expect(shots[7].sceneType).toBe('final_result')
  })
})

describe('G = 0 (0-0)', () => {
  it('remplit avec occasion manquée / arrêts / détermination', () => {
    const { shots } = shotsFor({ home: 0, away: 0 })
    expect(shots.slice(3, 7).map(x => x.sceneType)).toEqual([
      'big_chance_missed', 'goalkeeper_save', 'determination', 'goalkeeper_save',
    ])
  })
})

describe('1 ≤ G ≤ 4', () => {
  it('2-1 → 3 plans de but chronologiques + 1 remplissage (célébration)', () => {
    const { shots, goals } = shotsFor({ home: 2, away: 1 })
    const middle = shots.slice(3, 7)
    const goalShots = middle.filter(x => x.goalType)
    expect(goalShots).toHaveLength(3)
    // ordre chronologique des buts respecté
    const chronoNames = [...goals].sort((a, b) => a.matchOrder - b.matchOrder).map(g => g.playerName)
    expect(goalShots.map(x => x.playerName)).toEqual(chronoNames)
    // il reste un plan de remplissage, et le vainqueur existe → célébration prioritaire
    expect(middle.some(x => x.sceneType === 'celebration')).toBe(true)
  })
})

describe('G > 4', () => {
  it('4-3 → 3 buts pleins + 1 goal_montage absorbant le reste', () => {
    const { shots } = shotsFor({ home: 4, away: 3 })
    const middle = shots.slice(3, 7)
    const fullGoals = middle.filter(x => x.goalType)
    const montage = middle.find(x => x.sceneType === 'goal_montage')
    expect(fullGoals).toHaveLength(3)
    expect(montage).toBeDefined()
    expect(montage!.mergedScorers).toHaveLength(4)
  })
})
