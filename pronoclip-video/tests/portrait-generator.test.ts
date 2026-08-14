// Générateur de portraits — reprise EXACTE de la recette de la bibliothèque existante.
// Ces tests verrouillent les paramètres : toute dérive du prompt, du modèle, de la
// qualité, de la taille ou de l'ORDRE des références casserait la cohérence du set.
// Aucun appel réseau réel : `fetch` est injecté.

import { describe, it, expect } from 'vitest'
import {
  generatePortrait, PORTRAIT_PROMPT, PORTRAIT_MODEL, PORTRAIT_QUALITY, PORTRAIT_SIZE,
  OPENAI_IMAGE_EDITS_URL,
} from '../adapters/portrait-generator'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const dir = mkdtempSync(join(tmpdir(), 'pronoclip-portrait-'))
const facePath = join(dir, 'face.png')
const kitPath = join(dir, 'kit.jpg')
writeFileSync(facePath, Buffer.from('face-bytes'))
writeFileSync(kitPath, Buffer.from('kit-bytes'))

const PNG_B64 = Buffer.from('fake-png').toString('base64')

function okFetch(capture?: (url: string, init: RequestInit) => void) {
  return (async (url: string, init: RequestInit) => {
    capture?.(url, init)
    return { ok: true, status: 200, json: async () => ({ data: [{ b64_json: PNG_B64 }] }) } as unknown as Response
  }) as unknown as typeof fetch
}

describe('paramètres verrouillés', () => {
  it('modèle, qualité et taille sont ceux du run d\'origine', () => {
    expect(PORTRAIT_MODEL).toBe('gpt-image-1.5')
    expect(PORTRAIT_QUALITY).toBe('low')
    expect(PORTRAIT_SIZE).toBe('1024x1536')
  })

  it('le prompt fait 3048 caractères, comme la source', () => {
    expect(PORTRAIT_PROMPT).toHaveLength(3048)
  })

  it('le prompt nomme les deux références dans le bon ordre', () => {
    expect(PORTRAIT_PROMPT.indexOf('Reference Image 1 is the player face texture'))
      .toBeLessThan(PORTRAIT_PROMPT.indexOf('Reference Image 2 is the source country kit'))
  })

  it('le prompt porte les marqueurs de style de la bibliothèque', () => {
    for (const marker of ['Blue Lock and Vinland Saga', 'seamless white background', '4-pointed white sparkle']) {
      expect(PORTRAIT_PROMPT).toContain(marker)
    }
  })
})

describe('requête envoyée', () => {
  it('poste vers images/edits avec les bons champs et le visage AVANT le maillot', async () => {
    let seenUrl = ''
    let form: FormData | undefined
    const res = await generatePortrait({
      facePath, kitPath, apiKey: 'sk-test',
      fetchImpl: okFetch((u, i) => { seenUrl = u; form = i.body as FormData }),
    })
    expect(res.ok).toBe(true)
    expect(seenUrl).toBe(OPENAI_IMAGE_EDITS_URL)
    expect(form?.get('model')).toBe('gpt-image-1.5')
    expect(form?.get('quality')).toBe('low')
    expect(form?.get('size')).toBe('1024x1536')
    expect(form?.get('output_format')).toBe('png')
    expect(form?.get('prompt')).toBe(PORTRAIT_PROMPT)
    const images = form?.getAll('image[]') as File[]
    expect(images).toHaveLength(2)
    expect(images[0].name).toBe('face.png') // référence 1
    expect(images[1].name).toBe('kit.jpg')  // référence 2
  })

  it('décode le PNG renvoyé', async () => {
    const res = await generatePortrait({ facePath, kitPath, apiKey: 'sk-test', fetchImpl: okFetch() })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.png.toString()).toBe('fake-png')
  })
})

describe('pannes (jamais de throw)', () => {
  it('clé absente → no-api-key', async () => {
    const res = await generatePortrait({ facePath, kitPath, apiKey: '', fetchImpl: okFetch() })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toBe('no-api-key')
  })

  it('réseau KO → network', async () => {
    const boom = (async () => { throw new Error('ECONNRESET') }) as unknown as typeof fetch
    const res = await generatePortrait({ facePath, kitPath, apiKey: 'sk-test', fetchImpl: boom })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toBe('network')
  })

  it('HTTP 400 → http, avec le détail renvoyé', async () => {
    const bad = (async () => ({
      ok: false, status: 400, text: async () => 'invalid_request: bad image',
    }) as unknown as Response) as unknown as typeof fetch
    const res = await generatePortrait({ facePath, kitPath, apiKey: 'sk-test', fetchImpl: bad })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toBe('http')
    expect(res.message).toContain('invalid_request')
  })

  it('réponse sans image → invalid-response', async () => {
    const empty = (async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) }) as unknown as Response) as unknown as typeof fetch
    const res = await generatePortrait({ facePath, kitPath, apiKey: 'sk-test', fetchImpl: empty })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toBe('invalid-response')
  })
})
