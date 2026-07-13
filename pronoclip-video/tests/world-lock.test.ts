import { describe, it, expect } from 'vitest'
import { buildMatchScript } from '../core/match-script'
import { buildMatchBible, WORLD_PRESETS, worldSelectionFromConfig } from '../core/match-bible'
import { buildImagePrompt, buildAllPrompts } from '../core/prompt-builder'
import type { Shot } from '../core/types'
import { HOME, AWAY } from './fixtures'

const script = buildMatchScript({ home: HOME, away: AWAY, score: { home: 1, away: 1 }, seed: 11 })
const bible = buildMatchBible({ script, home: HOME, away: AWAY })
const prompts = buildAllPrompts(bible, script.shots).map(p => p.prompt)

const worldLine = (prompt: string) => prompt.split('\n').find(l => l.startsWith('World (identical'))!

describe('verrouillage du monde — preuve byte-identique', () => {
  it('le bloc World est BYTE-identique dans les 8 plans', () => {
    const ref = Buffer.from(worldLine(prompts[0]), 'utf8')
    for (const p of prompts) {
      expect(Buffer.from(worldLine(p), 'utf8').equals(ref)).toBe(true)
    }
  })

  it('le monde est verrouillé de marque par défaut (night), pas tiré par la graine', () => {
    // Deux matches différents, même sélection par défaut → même monde.
    const s2 = buildMatchScript({ home: HOME, away: AWAY, score: { home: 2, away: 0 }, seed: 999 })
    const b2 = buildMatchBible({ script: s2, home: HOME, away: AWAY })
    expect(bible.world).toEqual(WORLD_PRESETS.night)
    expect(b2.world).toEqual(WORLD_PRESETS.night)
  })

  it('le câblage config → sélection respecte preset / vary / custom', () => {
    expect(worldSelectionFromConfig({ vary_per_match: false, preset: 'dusk' })).toEqual({ mode: 'preset', preset: 'dusk' })
    expect(worldSelectionFromConfig({ vary_per_match: true })).toEqual({ mode: 'vary' })
    expect(worldSelectionFromConfig(undefined)).toEqual({ mode: 'preset', preset: 'night' })
    // preset explicite → toute la chaîne partage ce monde.
    const b = buildMatchBible({ script, home: HOME, away: AWAY, world: { mode: 'preset', preset: 'overcast' } })
    expect(b.world).toEqual(WORLD_PRESETS.overcast)
  })
})

describe('provenance de l’aura — jamais codée en dur', () => {
  const homeName = script.shots.find(s => s.teamSide === 'home' && s.playerName)!.playerName!
  const awayName = script.shots.find(s => s.teamSide === 'away' && s.playerName)!.playerName!
  const HOME_AURA = 'warm white-gold'
  const AWAY_AURA = 'cold electric-blue'
  const powerUp = (name: string, side: 'home' | 'away'): Shot =>
    ({ order: 1, sceneType: 'power_up', teamSide: side, playerName: name, caption: '' })

  it('plan 1 = reveal domicile → aura domicile ; plan 2 = reveal extérieur → aura extérieure', () => {
    expect(prompts[0]).toContain(HOME_AURA)
    expect(prompts[0]).not.toContain(AWAY_AURA)
    expect(prompts[1]).toContain(AWAY_AURA)
    expect(prompts[1]).not.toContain(HOME_AURA)
  })

  it('power_up : l’aura suit le camp du joueur — jamais blanche en dur pour l’extérieur (bug §4)', () => {
    expect(buildImagePrompt(bible, powerUp(homeName, 'home'))).toContain(HOME_AURA)
    const awayPowerUp = buildImagePrompt(bible, powerUp(awayName, 'away'))
    expect(awayPowerUp).toContain(AWAY_AURA)
    expect(awayPowerUp).not.toContain(HOME_AURA) // le bug : aura blanche imposée à l'extérieur
  })
})
