import { describe, it, expect } from 'vitest'
import { buildMatchScript } from '../core/match-script'
import { buildMatchBible } from '../core/match-bible'
import { HOME, AWAY } from './fixtures'

const script = buildMatchScript({ home: HOME, away: AWAY, score: { home: 1, away: 1 }, seed: 7 })

describe('buildMatchBible', () => {
  it('reprend la graine du match-script et un monde cohérent complet', () => {
    const b = buildMatchBible({ script, home: HOME, away: AWAY })
    expect(b.seed).toBe(script.seed)
    for (const k of ['time_of_day', 'sky', 'weather', 'stadium', 'floodlights', 'crowd', 'grade'] as const) {
      expect(typeof b.world[k]).toBe('string')
      expect(b.world[k].length).toBeGreaterThan(0)
    }
  })

  it('l’aura vient de l’équipe (domicile chaud, extérieur froid)', () => {
    const b = buildMatchBible({ script, home: HOME, away: AWAY })
    expect(b.teams.home.aura).toMatch(/warm|white|gold/i)
    expect(b.teams.away.aura).toMatch(/cold|blue/i)
  })

  it('ne référence que les joueurs présents dans les plans', () => {
    const b = buildMatchBible({ script, home: HOME, away: AWAY })
    const appearing = new Set(script.shots.map(s => s.playerName).filter(Boolean))
    expect(new Set(Object.keys(b.players))).toEqual(appearing)
  })

  it('est déterministe pour une graine donnée', () => {
    expect(buildMatchBible({ script, home: HOME, away: AWAY }))
      .toEqual(buildMatchBible({ script, home: HOME, away: AWAY }))
  })
})
