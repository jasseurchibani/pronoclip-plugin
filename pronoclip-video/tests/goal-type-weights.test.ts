// Répartition PLATE des types de but pour les buteurs SANS profil football.
// Raison d'être : un effectif semé depuis un dossier de portraits ne porte que des noms.
// La pondération par aptitude n'a alors rien à mordre — `goal_normal` écrase le tirage et
// coup franc / penalty sont mathématiquement impossibles (facteurs à 0).
// Règle vérifiée ici : sans profil → table plate ; avec profil → aptitudes, curation intacte.

import { describe, it, expect } from 'vitest'
import { predictMatch, DEFAULT_FLAT_GOAL_TYPE_WEIGHTS } from '../core/prediction'
import type { GoalType, Player, Team } from '../core/types'

/** Effectif « nu » : des noms, aucun profil — exactement ce que produit le semis de masse. */
const bare = (names: string[]): Player[] => names.map(name => ({ name }))

const teamA: Team = { name: 'A', players: bare(['A1', 'A2', 'A3', 'A4', 'A5', 'A6']) }
const teamB: Team = { name: 'B', players: bare(['B1', 'B2', 'B3', 'B4', 'B5', 'B6']) }

/** Types observés sur N matchs à graines distinctes, score imposé pour garantir des buts. */
function observedTypes(runs: number, weights?: Partial<Record<GoalType, number>>): GoalType[] {
  const out: GoalType[] = []
  for (let seed = 1; seed <= runs; seed++) {
    const p = predictMatch({
      home: teamA, away: teamB, score: { home: 2, away: 1 }, seed,
      ...(weights ? { goalTypeWeights: weights } : {}),
    })
    out.push(...p.goals.map(g => g.goalType))
  }
  return out
}

describe('table plate (buteurs sans profil)', () => {
  it('la somme du défaut fait 100', () => {
    expect(Object.values(DEFAULT_FLAT_GOAL_TYPE_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('rallume coup franc ET penalty — impossibles avant', () => {
    const types = new Set(observedTypes(400))
    expect(types.has('goal_freekick')).toBe(true)
    expect(types.has('goal_penalty')).toBe(true)
  })

  it('produit les 7 types sur un échantillon suffisant', () => {
    const types = new Set(observedTypes(600))
    expect(types.size).toBe(7)
  })

  it('goal_normal ne domine plus (~55 %, contre ~72 % avant)', () => {
    const types = observedTypes(500)
    const share = types.filter(t => t === 'goal_normal').length / types.length
    expect(share).toBeGreaterThan(0.42)
    expect(share).toBeLessThan(0.68)
  })

  it('respecte une surcharge appelant', () => {
    // Tout en penalty → tous les buts doivent être des penaltys.
    const types = new Set(observedTypes(30, {
      goal_normal: 0, goal_header: 0, goal_longrange: 0, goal_volley: 0,
      goal_freekick: 0, goal_penalty: 100, goal_bicycle: 0,
    }))
    expect([...types]).toEqual(['goal_penalty'])
  })

  it('une surcharge entièrement nulle ne bloque pas le rendu', () => {
    const all0 = Object.fromEntries(Object.keys(DEFAULT_FLAT_GOAL_TYPE_WEIGHTS).map(k => [k, 0]))
    expect(() => observedTypes(3, all0 as Partial<Record<GoalType, number>>)).not.toThrow()
  })

  it('reste déterministe pour une graine donnée', () => {
    const a = predictMatch({ home: teamA, away: teamB, score: { home: 2, away: 1 }, seed: 99 })
    const b = predictMatch({ home: teamA, away: teamB, score: { home: 2, away: 1 }, seed: 99 })
    expect(a.goals.map(g => g.goalType)).toEqual(b.goals.map(g => g.goalType))
  })
})

describe('curation préservée', () => {
  it('un buteur AVEC profil garde la pondération par aptitude, pas la table plate', () => {
    // Ailier au jeu de tête nul + non-tireur : il ne doit jamais marquer de la tête,
    // ni sur coup franc, ni sur penalty — ce que la table plate autoriserait.
    const winger: Team = {
      name: 'W',
      players: [{ name: 'Ailier', profile: { position: 'WG', heading: 0, setPieces: 0, isPenaltyTaker: false } }],
    }
    const types = new Set<GoalType>()
    for (let seed = 1; seed <= 300; seed++) {
      const p = predictMatch({ home: winger, away: teamB, score: { home: 1, away: 0 }, seed })
      types.add(p.goals[0].goalType)
    }
    expect(types.has('goal_header')).toBe(false)
    expect(types.has('goal_freekick')).toBe(false)
    expect(types.has('goal_penalty')).toBe(false)
  })
})
