import { describe, it, expect } from 'vitest'
import { makeImageGenerator, B3_WARNING } from '../adapters/mcp'

describe('makeImageGenerator — dégradation B3 bruyante', () => {
  it('B3 : ignore les refs et avertit À CHAQUE plan', async () => {
    const warnings: string[] = []
    const seenRefs: string[][] = []
    const invoke = async (_p: string, _s: string, refs: string[]) => {
      seenRefs.push(refs)
      return { image_url: 'u' }
    }
    const generateImage = makeImageGenerator({ mode: 'B3', invoke, warn: m => warnings.push(m) })

    await generateImage('plan1', ['ref_home'], 'hd')
    await generateImage('plan2', ['ref_home', 'ref_away'], 'hd')

    expect(warnings).toEqual([B3_WARNING, B3_WARNING]) // un avertissement par plan
    expect(seenRefs).toEqual([[], []]) // refs systématiquement ignorés
  })

  it('B1 : transmet les refs, aucun avertissement', async () => {
    const warnings: string[] = []
    const seenRefs: string[][] = []
    const invoke = async (_p: string, _s: string, refs: string[]) => {
      seenRefs.push(refs)
      return { image_url: 'u' }
    }
    const generateImage = makeImageGenerator({ mode: 'B1', invoke, warn: m => warnings.push(m) })

    await generateImage('plan1', ['ref_home', 'ref_away'], 'hd')

    expect(warnings).toEqual([])
    expect(seenRefs).toEqual([['ref_home', 'ref_away']])
  })
})
