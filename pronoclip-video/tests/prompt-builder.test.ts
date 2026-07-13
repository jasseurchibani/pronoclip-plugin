import { describe, it, expect } from 'vitest'
import { buildMatchScript } from '../core/match-script'
import { buildMatchBible } from '../core/match-bible'
import { buildImagePrompt, buildAllPrompts } from '../core/prompt-builder'
import { SCENE_FRAGMENTS } from '../core/scene-fragments'
import type { GoalType, Shot } from '../core/types'
import { HOME, AWAY } from './fixtures'

const script = buildMatchScript({ home: HOME, away: AWAY, score: { home: 2, away: 1 }, seed: 11 })
const bible = buildMatchBible({ script, home: HOME, away: AWAY })

const worldLine = (prompt: string) => prompt.split('\n').find(l => l.startsWith('World (identical'))!

describe('gabarit des prompts', () => {
  it('produit 8 prompts', () => {
    expect(buildAllPrompts(bible, script.shots)).toHaveLength(8)
  })
  it('le bloc WORLD est identique mot pour mot dans les 8 plans', () => {
    const prompts = buildAllPrompts(bible, script.shots).map(p => p.prompt)
    const worlds = prompts.map(worldLine)
    expect(new Set(worlds).size).toBe(1)
  })
})

describe('fragments : action/pose/caméra uniquement (aucun décor)', () => {
  const DECOR = /stadium|floodlight|crowd|\bsky\b|\bnight\b|dusk|sunset|storm|overcast|weather/i
  it('aucun fragment ne contient de décor', () => {
    for (const [key, frag] of Object.entries(SCENE_FRAGMENTS)) {
      expect(frag, key).not.toMatch(DECOR)
    }
  })
  it('aucun fragment ne fixe une couleur d’aura', () => {
    for (const [key, frag] of Object.entries(SCENE_FRAGMENTS)) {
      expect(frag, key).not.toMatch(/white aura|blue aura|golden aura|red aura/i)
    }
  })
})

describe('fragments de but : le ballon franchit la ligne / le filet se tend', () => {
  const GOALS: GoalType[] = ['goal_normal', 'goal_header', 'goal_volley', 'goal_bicycle', 'goal_freekick', 'goal_penalty', 'goal_longrange']
  it('chaque goal_* montre le filet ou la ligne', () => {
    for (const g of GOALS) {
      expect(SCENE_FRAGMENTS[g], g).toMatch(/net|line/i)
    }
  })
  it('goal_penalty montre le ballon franchir la ligne (plus d’arrêt à la course d’élan)', () => {
    expect(SCENE_FRAGMENTS.goal_penalty).toMatch(/line/i)
    expect(SCENE_FRAGMENTS.goal_penalty).not.toMatch(/run-up|mid-run/i)
  })
})

describe('l’aura injectée vient de l’équipe, pas du fragment', () => {
  const homeName = script.shots.find(s => s.teamSide === 'home' && s.playerName)!.playerName!
  const awayName = script.shots.find(s => s.teamSide === 'away' && s.playerName)!.playerName!
  const powerUp = (name: string, side: 'home' | 'away'): Shot =>
    ({ order: 1, sceneType: 'power_up', teamSide: side, playerName: name, caption: '' })

  it('power_up domicile → aura chaude ; extérieur → aura froide', () => {
    expect(buildImagePrompt(bible, powerUp(homeName, 'home'))).toContain('warm white-gold')
    expect(buildImagePrompt(bible, powerUp(awayName, 'away'))).toContain('cold electric-blue')
  })
})

describe('final_result : aucun scoreboard dans l’image', () => {
  it('ni le fragment ni le prompt ne mentionnent de scoreboard', () => {
    const finalShot = script.shots.find(s => s.sceneType === 'final_result')!
    const prompt = buildImagePrompt(bible, finalShot)
    expect(SCENE_FRAGMENTS.final_result).not.toMatch(/scoreboard/i)
    // "scoreboard" n'apparaît que dans la liste négative (ce qu'il faut EXCLURE).
    expect(prompt).toMatch(/Negative:[^]*scoreboard/i)
    expect(prompt.split('Negative:')[0]).not.toMatch(/scoreboard/i)
  })
})
