import { describe, it, expect } from 'vitest'
import { buildMatchScript, serializeMatchScript } from '../core/match-script'
import { HOME, AWAY } from './fixtures'

describe('buildMatchScript', () => {
  it('assemble un artefact complet et valide (L0)', () => {
    const ms = buildMatchScript({ home: HOME, away: AWAY, seed: 2026 })
    expect(ms.version).toBe('1.0')
    expect(ms.inputLevel).toBe('L0')
    expect(ms.seed).toBe(2026)
    expect(ms.shots).toHaveLength(8)
    expect(ms.prediction.goals).toHaveLength(ms.prediction.score.home + ms.prediction.score.away)
  })

  it('est déterministe (même entrée → même sérialisation)', () => {
    const a = serializeMatchScript(buildMatchScript({ home: HOME, away: AWAY, seed: 55 }))
    const b = serializeMatchScript(buildMatchScript({ home: HOME, away: AWAY, seed: 55 }))
    expect(a).toBe(b)
    expect(() => JSON.parse(a)).not.toThrow()
  })

  it('signale un buteur fourni absent de l’effectif (note, sans bloquer)', () => {
    const ms = buildMatchScript({
      home: HOME,
      away: AWAY,
      score: { home: 1, away: 0 },
      goals: [{ teamSide: 'home', playerName: 'Inconnu' }],
    })
    expect(ms.notes.some(n => n.includes('Inconnu'))).toBe(true)
  })
})
