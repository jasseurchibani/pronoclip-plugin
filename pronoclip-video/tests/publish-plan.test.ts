// Plan de publication d'un match quelconque.
// Deux exigences dures : la mention IA figure TOUJOURS dans la légende (§7), et aucun
// identifiant client n'est codé en dur — le compte vient de la configuration.

import { describe, it, expect } from 'vitest'
import { buildPublishPlan, makePublisher, makeLogTransport } from '../adapters/rapidocms'

const DISCLOSURE = 'Vidéo générée par intelligence artificielle. Contenu de divertissement.'

const base = {
  home: 'Algeria', away: 'Morocco',
  score: { home: 2, away: 1 },
  competition: 'CAN 2026',
  scorers: ['Ibrahim Maza', 'Nayef Aguerd', 'Zineddine Belaid'],
  aiDisclosure: DISCLOSURE,
  accountId: 'acct-123',
}

describe('buildPublishPlan', () => {
  it('compose une légende avec le score, la compétition et les buteurs', () => {
    const p = buildPublishPlan(base)
    expect(p.caption).toContain('Algeria 2-1 Morocco')
    expect(p.caption).toContain('CAN 2026')
    expect(p.caption).toContain('Ibrahim Maza, Nayef Aguerd, Zineddine Belaid')
  })

  it('inclut TOUJOURS la mention IA', () => {
    expect(buildPublishPlan(base).caption).toContain(DISCLOSURE)
  })

  it('refuse de composer sans mention IA', () => {
    expect(() => buildPublishPlan({ ...base, aiDisclosure: '   ' })).toThrow(/mention ia/i)
  })

  it('refuse un compte absent — aucun identifiant client en dur', () => {
    expect(() => buildPublishPlan({ ...base, accountId: '' })).toThrow(/RAPIDOCMS_ACCOUNT_ID/)
  })

  it('sans planification → brouillon non planifié', () => {
    expect(buildPublishPlan(base).schedule).toBeNull()
  })

  it('avec planification → date et heure conservées', () => {
    const p = buildPublishPlan({ ...base, schedule: { date: '2026-08-20', heure: '18:00:00' } })
    expect(p.schedule).toEqual({ date: '2026-08-20', heure: '18:00:00' })
  })

  it('média vidéo, post média, réseau par défaut instagram', () => {
    const p = buildPublishPlan(base)
    expect(p.mediaType).toBe('video')
    expect(p.postType).toBe('media')
    expect(p.socialType).toBe('instagram')
  })

  it('gère un match sans buteur (0-0) sans produire de liste vide', () => {
    const p = buildPublishPlan({ ...base, score: { home: 0, away: 0 }, scorers: [] })
    expect(p.caption).toContain('Algeria 0-0 Morocco')
    expect(p.caption).not.toContain('Buts :')
  })
})

describe('orchestration', () => {
  it('enchaîne upload → brouillon → planification, dans cet ordre', async () => {
    const calls: string[] = []
    const plan = buildPublishPlan({ ...base, schedule: { date: '2026-08-20', heure: '18:00:00' } })
    const publish = makePublisher(makeLogTransport(m => calls.push(m)), plan)
    await publish('https://exemple.test/clip.mp4', 'clip.mp4')
    expect(calls[0]).toContain('upload_file_tool')
    expect(calls[1]).toContain('create_draft_tool')
    expect(calls.at(-1)).toContain('schedule_draft_tool')
  })

  it('sans planification, schedule_draft_tool n\'est pas appelé', async () => {
    const calls: string[] = []
    const publish = makePublisher(makeLogTransport(m => calls.push(m)), buildPublishPlan(base))
    const res = await publish('https://exemple.test/clip.mp4', 'clip.mp4')
    expect(calls.some(c => c.includes('schedule_draft_tool'))).toBe(false)
    expect(res.scheduled).toBeNull()
  })
})
