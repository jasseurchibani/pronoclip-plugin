import { describe, it, expect } from 'vitest'
import { buildCaption, makePublisher, type PublishPlan, type PublishTransport } from '../adapters/rapidocms'

describe('buildCaption (mention IA obligatoire §7)', () => {
  it('ajoute la mention IA si absente', () => {
    const c = buildCaption('Super pronostic', 'Vidéo générée par IA.')
    expect(c).toContain('Super pronostic')
    expect(c).toContain('Vidéo générée par IA.')
  })
  it('ne duplique pas une mention déjà présente', () => {
    const c = buildCaption('Texte. Vidéo générée par IA.', 'Vidéo générée par IA.')
    expect(c.match(/Vidéo générée par IA\./g)).toHaveLength(1)
  })
  it('refuse une mention IA vide', () => {
    expect(() => buildCaption('Texte', '   ')).toThrow(/Mention IA/)
  })
})

describe('makePublisher (orchestration, transport injecté)', () => {
  const plan: PublishPlan = {
    postName: 'p', socialType: 'instagram', accountId: '123', postType: 'media',
    mediaType: 'video', caption: 'c', schedule: { date: '2026-07-27', heure: '18-00-00' },
  }
  it('orchestre upload → brouillon → planification, dans l’ordre', async () => {
    const calls: string[] = []
    const t: PublishTransport = {
      async uploadFileFromUrl(a) { calls.push('upload:' + a.fileUrl); return { mediaUrl: 'biblio://x' } },
      async createDraft(a) { calls.push('draft:' + a.mediaUrl); return { draftId: 'D1' } },
      async scheduleDraft(a) { calls.push('schedule:' + a.draftId + '@' + a.postDate); return {} },
    }
    const res = await makePublisher(t, plan)('https://pub/x.mp4', 'x.mp4')
    expect(calls).toEqual(['upload:https://pub/x.mp4', 'draft:biblio://x', 'schedule:D1@2026-07-27'])
    expect(res.draft.draftId).toBe('D1')
  })
  it('ne planifie pas si schedule=null (brouillon simple)', async () => {
    const calls: string[] = []
    const t: PublishTransport = {
      async uploadFileFromUrl() { return { mediaUrl: 'b' } },
      async createDraft() { calls.push('draft'); return { draftId: 'D' } },
      async scheduleDraft() { calls.push('schedule'); return {} },
    }
    await makePublisher(t, { ...plan, schedule: null })('u', 'f')
    expect(calls).toEqual(['draft'])
  })
})
