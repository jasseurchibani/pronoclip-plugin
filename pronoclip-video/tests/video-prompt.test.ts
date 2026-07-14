import { describe, it, expect } from 'vitest'
import { buildVideoPrompt } from '../core/video-prompt'
import { resolveRenderLevel } from '../core/render-guard'
import { buildMatchScript } from '../core/match-script'
import { buildMatchBible } from '../core/match-bible'
import { HOME, AWAY } from './fixtures'

const script = buildMatchScript({ home: HOME, away: AWAY, score: { home: 2, away: 0 }, seed: 3 })
const bible = buildMatchBible({ script, home: HOME, away: AWAY })
const goalShot = script.shots.find(s => s.goalType)!

describe('buildVideoPrompt — verrou anti-morphing (visage + maillot)', () => {
  it('anime la première frame et verrouille l’identité sur la référence', () => {
    const { videoPrompt, negativePrompt, durationSeconds } = buildVideoPrompt(bible, goalShot)
    expect(videoPrompt).toMatch(/first frame/i)
    expect(videoPrompt).toMatch(/no morphing/i)
    expect(videoPrompt).toMatch(/identical to the reference/i)
    expect(negativePrompt).toMatch(/morph/i)
    expect(durationSeconds).toBe(5)
  })
  it('n’introduit aucun texte dans le clip', () => {
    const { videoPrompt } = buildVideoPrompt(bible, goalShot)
    expect(videoPrompt).toMatch(/new text/i)
    expect(videoPrompt).toMatch(/watermark|scoreboard/i)
  })
})

describe('beat FRAPPE : une seule action, fin nette sur le filet (plan de prod)', () => {
  const { videoPrompt, negativePrompt } = buildVideoPrompt(bible, goalShot)
  it('une action, fin sur le filet, ballon visible jusqu’au filet, PAS de célébration', () => {
    expect(videoPrompt).toMatch(/single action/i)
    expect(videoPrompt).toMatch(/net snaps|bulging net/i)
    expect(videoPrompt).toMatch(/ball stays visible until it hits the net/i)
    expect(videoPrompt).toMatch(/end on the bulging net/i)
    expect(videoPrompt).toMatch(/tracks the ball/i)
    expect(videoPrompt).not.toMatch(/corner flag|celebration|knee-slide/i)
    expect(videoPrompt).not.toMatch(/0-1s|3-5s/) // plus de chorégraphie multi-actes
  })
  it('negatives : anti-vide + anti-logos (fix légal)', () => {
    expect(negativePrompt).toMatch(/ball disappears|ball missing/i)
    expect(negativePrompt).toMatch(/player inside the net/i)
    expect(negativePrompt).toMatch(/nike|swoosh|club crest|sponsor logo|brand logo/i)
  })
})

describe('beat CÉLÉBRATION : beat séparé, une seule action, sans ballon', () => {
  const celeb = script.shots.find(s => s.sceneType === 'celebration')!
  const { videoPrompt, negativePrompt } = buildVideoPrompt(bible, celeb)
  it('une action de célébration, sans ballon, fin nette, PAS de frappe', () => {
    expect(videoPrompt).toMatch(/single action/i)
    expect(videoPrompt).toMatch(/knee-slide|arms spread wide/i)
    expect(videoPrompt).toMatch(/no ball/i)
    expect(videoPrompt).not.toMatch(/net snaps|bulging net/i)
  })
  it('negatives anti-logos présents', () => {
    expect(negativePrompt).toMatch(/nike|swoosh|club crest|sponsor logo|brand logo/i)
  })
})

describe('resolveRenderLevel — animated en opt-in explicite (motion par défaut)', () => {
  it('défaut config motion → motion', () => expect(resolveRenderLevel('motion')).toBe('motion'))
  it('opt-in explicite → animated', () => expect(resolveRenderLevel('motion', true)).toBe('animated'))
  it('config animated → animated', () => expect(resolveRenderLevel('animated')).toBe('animated'))
  it('absent → motion', () => expect(resolveRenderLevel(undefined)).toBe('motion'))
})
