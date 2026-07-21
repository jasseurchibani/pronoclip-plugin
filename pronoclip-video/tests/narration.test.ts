import { describe, it, expect } from 'vitest'
import { buildNarration, IA_TAG } from '../core/narration'
import { buildMatchScript } from '../core/match-script'
import { HOME, AWAY } from './fixtures'

// Score fourni (L1) → 3 buts déterministes (2 domicile, 1 extérieur).
const script = buildMatchScript({ home: HOME, away: AWAY, competition: 'Amical', score: { home: 2, away: 1 }, seed: 1 })

describe('buildNarration', () => {
  it('inclut hook, annonce, une ligne par but, final, puis le tag IA en dernier', () => {
    const n = buildNarration(script)
    const beats = n.segments.map(s => s.beat)
    expect(beats).toContain('hook')
    expect(beats).toContain('annonce')
    expect(beats.filter(b => b === 'but')).toHaveLength(3)
    expect(beats).toContain('final')
    expect(beats[beats.length - 1]).toBe('ia')
  })
  it('la transparence IA est TOUJOURS présente (tag oral)', () => {
    expect(buildNarration(script).text).toContain(IA_TAG)
  })
  it('mentionne les deux équipes et le score final', () => {
    const n = buildNarration(script)
    expect(n.text).toContain('Alpha')
    expect(n.text).toContain('Beta')
    expect(n.text).toContain('Score final')
    expect(n.chars).toBeGreaterThan(20)
  })
})
