import { describe, it, expect } from 'vitest'
import { assertDisclosure, buildVideoMetadata, MissingDisclosureError } from '../core/render-guard'

const ok = {
  ai_disclosure: {
    watermark: 'Vidéo générée par IA',
    end_card: ['Vidéo générée par intelligence artificielle — PronoClip', 'Contenu de divertissement.'],
    metadata: 'Vidéo générée par intelligence artificielle.',
  },
  image: { mode: 'B3', b3_metadata_note: 'preview technique — cohérence de personnage non garantie' },
}

describe('assertDisclosure — hook bloquant mention IA', () => {
  it('passe quand filigrane + carton de fin sont présents', () => {
    expect(() => assertDisclosure(ok)).not.toThrow()
  })
  it('refuse si le filigrane est vide', () => {
    expect(() => assertDisclosure({ ...ok, ai_disclosure: { ...ok.ai_disclosure, watermark: '  ' } }))
      .toThrow(MissingDisclosureError)
  })
  it('refuse si le carton de fin est absent', () => {
    expect(() => assertDisclosure({ ...ok, ai_disclosure: { watermark: 'x', end_card: [] } }))
      .toThrow(MissingDisclosureError)
  })
  it('refuse si une ligne du carton de fin est vide', () => {
    expect(() => assertDisclosure({ ...ok, ai_disclosure: { watermark: 'x', end_card: ['ok', '  '] } }))
      .toThrow(MissingDisclosureError)
  })
})

describe('buildVideoMetadata', () => {
  it('inclut la note B3 en mode dégradé', () => {
    const m = buildVideoMetadata(ok, 'B3')
    expect(m).toContain('intelligence artificielle')
    expect(m).toContain('preview technique — cohérence de personnage non garantie')
  })
  it('n’inclut PAS la note B3 en mode B1', () => {
    const m = buildVideoMetadata(ok, 'B1')
    expect(m).toContain('intelligence artificielle')
    expect(m).not.toContain('preview technique')
  })
})
