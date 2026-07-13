import { describe, it, expect } from 'vitest'
import { buildMatchScript } from '../core/match-script'
import { buildMatchBible } from '../core/match-bible'
import type { PortraitAsset } from '../core/types'
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

  it('portraitFor fourni → fiches LUES depuis la bibliothèque semée', () => {
    const asset = (name: string): PortraitAsset => ({
      portrait_url: `lib/${name}.png`,
      descriptor: { build: 'lean', hair: 'buzz cut', skin: 'dark', boots: 'gold boots', number: 7 },
      seed: 1, version: 2, status: 'frozen',
    })
    const b = buildMatchBible({ script, home: HOME, away: AWAY, portraitFor: name => asset(name) })
    const someName = Object.keys(b.players)[0]
    expect(b.players[someName].reference_image_url).toBe(`lib/${someName}.png`)
    expect(b.players[someName].build).toBe('lean')
    expect(b.players[someName].boots).toBe('gold boots')
  })

  it('portraitFor qui lève « non semé » → propagé (jamais de génération silencieuse)', () => {
    expect(() => buildMatchBible({
      script, home: HOME, away: AWAY,
      portraitFor: () => { throw new Error('Effectif non semé') },
    })).toThrow(/non semé/)
  })
})
