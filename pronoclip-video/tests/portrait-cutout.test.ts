// Détourage de portrait — le fond blanc devient transparent, le blanc DU SUJET survit.
//
// Le cas piège est réel : le maillot de l'Algérie est blanc. Un seuillage global le
// troue. On vérifie donc sur une image synthétique qu'un blanc enclavé dans le sujet
// reste opaque, et qu'une tolérance trop large finit par faire fuir le remplissage.

import { describe, it, expect, beforeAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import ffmpegPath from 'ffmpeg-static'
import { removeWhiteBackground, cutoutCached, hasTransparency } from '../adapters/portrait-cutout'

const FFMPEG = ffmpegPath as unknown as string
const FFPROBE = (createRequire(import.meta.url)('ffprobe-static') as { path: string }).path
const dir = mkdtempSync(join(tmpdir(), 'pronoclip-cutout-'))
const source = join(dir, 'sujet.png')

/** Pixel RGBA à (x, y) d'un PNG. */
function pixel(path: string, x: number, y: number): [number, number, number, number] {
  const r = spawnSync(FFMPEG, [
    '-v', 'error', '-i', path, '-vf', `crop=1:1:${x}:${y}`, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-',
  ], { maxBuffer: 1 << 20 })
  const b = r.stdout
  return [b[0], b[1], b[2], b[3]]
}

beforeAll(() => {
  // Fond BLANC PUR ; sujet rouge au centre ; carré BLANC enclavé dans le sujet
  // (l'équivalent du maillot blanc), non connecté au bord.
  const r = spawnSync(FFMPEG, [
    '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=white:s=200x200',
    '-vf', 'drawbox=x=50:y=50:w=100:h=100:color=red@1:t=fill,'
         + 'drawbox=x=85:y=85:w=30:h=30:color=white@1:t=fill',
    '-frames:v', '1', source,
  ])
  expect(r.status).toBe(0)
})

describe('removeWhiteBackground', () => {
  it('rend le fond transparent', () => {
    const out = join(dir, 'a.png')
    expect(removeWhiteBackground(source, out)).toBe(true)
    expect(pixel(out, 5, 5)[3]).toBe(0) // coin = fond
    expect(hasTransparency(out)).toBe(true)
  })

  it('laisse le sujet opaque', () => {
    const out = join(dir, 'b.png')
    removeWhiteBackground(source, out)
    const [r, g, b, a] = pixel(out, 60, 60)
    expect(a).toBe(255)
    expect(r).toBeGreaterThan(200)
    expect(g).toBeLessThan(80)
    expect(b).toBeLessThan(80)
  })

  it('PRÉSERVE le blanc enclavé dans le sujet (cas du maillot blanc)', () => {
    const out = join(dir, 'c.png')
    removeWhiteBackground(source, out)
    const [r, g, b, a] = pixel(out, 100, 100) // centre du carré blanc interne
    expect(a).toBe(255)
    expect(r).toBeGreaterThan(240)
    expect(g).toBeGreaterThan(240)
    expect(b).toBeGreaterThan(240)
  })

  it('reste correct même à tolérance très large (le blanc interne n\'est pas relié au bord)', () => {
    const out = join(dir, 'd.png')
    removeWhiteBackground(source, out, { tolerance: 200 })
    expect(pixel(out, 5, 5)[3]).toBe(0)     // fond retiré
    expect(pixel(out, 100, 100)[3]).toBe(255) // blanc interne conservé
  })

  it('source introuvable → false, sans lever', () => {
    expect(removeWhiteBackground(join(dir, 'absent.png'), join(dir, 'e.png'))).toBe(false)
  })
})

describe('cutoutCached', () => {
  it('produit le fichier puis le réutilise', () => {
    const cache = join(dir, 'cache', 'x.png')
    const first = cutoutCached(source, cache)
    expect(first).toBe(cache)
    expect(existsSync(cache)).toBe(true)
    expect(cutoutCached(source, cache)).toBe(cache) // second appel : cache réutilisé
  })

  it('source introuvable → null (l\'appelant retombe sur le panneau généré)', () => {
    expect(cutoutCached(join(dir, 'nope.png'), join(dir, 'cache', 'y.png'))).toBeNull()
  })
})

describe('outils', () => {
  it('hasTransparency est faux sur une image opaque', () => {
    expect(hasTransparency(source)).toBe(false)
    expect(FFPROBE).toBeTruthy()
  })
})
