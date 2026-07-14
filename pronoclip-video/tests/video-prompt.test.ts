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
  it('but : chorégraphie horodatée + caméra qui suit le ballon (cf. corrections §2/§3)', () => {
    const { videoPrompt, negativePrompt } = buildVideoPrompt(bible, goalShot)
    // chorégraphie horodatée (remplit les 5 s), pas une action unique
    expect(videoPrompt).toMatch(/0-1s/)
    expect(videoPrompt).toMatch(/2-3s/)
    expect(videoPrompt).toMatch(/3-5s/)
    expect(videoPrompt).toMatch(/ball is visible in every frame/i)
    expect(videoPrompt).toMatch(/never enters the goal/i)
    // caméra qui suit le ballon (plus de locked camera)
    expect(videoPrompt).toMatch(/tracks the ball/i)
    expect(videoPrompt).not.toMatch(/locked camera/i)
    // négatifs anti-vide
    expect(negativePrompt).toMatch(/ball disappears|ball missing/i)
    expect(negativePrompt).toMatch(/player inside the net|player enters the goal/i)
    expect(negativePrompt).toMatch(/two goals|duplicate goalposts/i)
  })
})

describe('resolveRenderLevel — animated en opt-in explicite (motion par défaut)', () => {
  it('défaut config motion → motion', () => expect(resolveRenderLevel('motion')).toBe('motion'))
  it('opt-in explicite → animated', () => expect(resolveRenderLevel('motion', true)).toBe('animated'))
  it('config animated → animated', () => expect(resolveRenderLevel('animated')).toBe('animated'))
  it('absent → motion', () => expect(resolveRenderLevel(undefined)).toBe('motion'))
})
