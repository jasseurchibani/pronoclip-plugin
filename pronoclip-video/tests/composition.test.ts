import { describe, it, expect } from 'vitest'
import { buildComposition } from '../core/composition'
import { buildMatchScript } from '../core/match-script'
import { HOME, AWAY } from './fixtures'

const script = buildMatchScript({ home: HOME, away: AWAY, score: { home: 2, away: 0 }, seed: 3 })
const images = script.shots.map((_, i) => `b3_plan${i + 1}.jpg`)
const config = {
  brand: { colors: { background: '#0A0A0A', accent: '#33D17A' } },
  ai_disclosure: { watermark: 'Vidéo générée par IA', end_card: ['Ligne un', 'Ligne deux'] },
  video: { scene_length_seconds: 5 },
}
const html = buildComposition({ script, images, config })

function data() {
  const m = html.match(/<script id="pronoclip-data"[^>]*>([\s\S]*?)<\/script>/)!
  return JSON.parse(m[1])
}

describe('buildComposition', () => {
  it('porte le filigrane IA et le carton de fin', () => {
    expect(html).toContain('Vidéo générée par IA')
    expect(html).toContain('Ligne un')
    expect(html).toContain('Ligne deux')
  })
  it('respecte la charte (#0A0A0A fond, #33D17A accent)', () => {
    expect(html).toContain('#0A0A0A')
    expect(html).toContain('#33D17A')
  })
  it('expose le moteur de rendu déterministe (__renderAt) + autoplay', () => {
    expect(html).toContain('window.__renderAt')
    expect(html).toContain('window.__DURATION')
  })
  it('timeline de 8 plans, 40 s, score final 2-0', () => {
    const d = data()
    expect(d.shots).toHaveLength(8)
    expect(d.total).toBe(8 * 5000)
    expect(d.finalHome).toBe(2)
    expect(d.finalAway).toBe(0)
    expect(d.shots[0].src).toBe('b3_plan1.jpg')
  })
  it('le score s’incrémente à chaque but (cumul 2-0)', () => {
    const d = data()
    const goals = d.shots.filter((s: { isGoal: boolean }) => s.isGoal)
    expect(goals.length).toBe(2)
    expect(goals[goals.length - 1].home).toBe(2)
    expect(d.shots[d.shots.length - 1].home).toBe(2) // score porté jusqu'au plan final
  })
})
