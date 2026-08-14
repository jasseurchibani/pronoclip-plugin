// Adaptateur image→vidéo générique + assemblage des clips.
// Aucun appel réseau et aucune dépense : `fetch` est injecté, ffmpeg travaille en local.

import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import ffmpegPath from 'ffmpeg-static'
import {
  readPath, substitute, makeHttpClipInvoke, requireApiKey, MissingApiKeyError,
  type HttpProviderConfig, type Substitutions,
} from '../adapters/video-gen'
import { buildFirstFrame, normalizeClip, concatClips } from '../adapters/clip-assembly'

const FFMPEG = ffmpegPath as unknown as string
const FFPROBE = (createRequire(import.meta.url)('ffprobe-static') as { path: string }).path
const dir = mkdtempSync(join(tmpdir(), 'pronoclip-anim-'))

const SUBS: Substitutions = {
  PROMPT: 'un but', NEGATIVE_PROMPT: 'flou', DURATION: '5',
  IMAGE_DATA_URI: 'data:image/png;base64,AAA', IMAGE_B64: 'AAA',
  IMAGE_URL: 'https://exemple.test/a.png', MODEL: 'modele-x', API_KEY: 'secret',
}

describe('readPath', () => {
  it('lit un chemin imbriqué et un index de tableau', () => {
    expect(readPath({ a: { b: { c: 'ok' } } }, 'a.b.c')).toBe('ok')
    expect(readPath({ output: ['u1', 'u2'] }, 'output.1')).toBe('u2')
  })
  it('renvoie undefined sans lever quand le chemin ne mène nulle part', () => {
    expect(readPath({ a: 1 }, 'a.b.c')).toBeUndefined()
    expect(readPath(null, 'a')).toBeUndefined()
  })
})

describe('substitute', () => {
  it('remplace les jetons dans les chaînes imbriquées', () => {
    const out = substitute({ h: { Authorization: 'Bearer ${API_KEY}' }, p: ['${PROMPT}'] }, SUBS) as Record<string, unknown>
    expect((out.h as Record<string, string>).Authorization).toBe('Bearer secret')
    expect((out.p as string[])[0]).toBe('un but')
  })
  it('rend la durée en NOMBRE quand elle est seule (beaucoup d\'API refusent le texte)', () => {
    expect(substitute('${DURATION}', SUBS)).toBe(5)
    expect(substitute('durée ${DURATION}s', SUBS)).toBe('durée 5s')
  })
  it('laisse intact un jeton inconnu', () => {
    expect(substitute('${INCONNU}', SUBS)).toBe('${INCONNU}')
  })
})

describe('requireApiKey', () => {
  it('lit la clé sous le nom DÉCLARÉ', () => {
    expect(requireApiKey({ provider: 'fal', model: 'm', api_key_env: 'MA_CLE' }, { MA_CLE: 'k' })).toBe('k')
  })
  it('lève une erreur explicite si la clé manque — aucune dépense à l\'aveugle', () => {
    expect(() => requireApiKey({ provider: 'fal', model: 'm', api_key_env: 'ABSENTE' }, {}))
      .toThrow(MissingApiKeyError)
  })
})

const framePath = join(dir, 'frame.png')
spawnSync(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=64x96', '-frames:v', '1', framePath])

const baseCfg: HttpProviderConfig = {
  provider: 'http',
  api_key_env: 'X',
  submit_url: 'https://api.test/submit',
  headers: { Authorization: 'Bearer ${API_KEY}' },
  body: { prompt: '${PROMPT}', image: '${IMAGE_DATA_URI}', duration: '${DURATION}' },
  video_path: 'data.video.url',
}

function fetchOnce(payload: unknown, capture?: (init: RequestInit) => void) {
  return (async (_u: string, init: RequestInit) => {
    capture?.(init)
    return { ok: true, status: 200, json: async () => payload, text: async () => '' } as unknown as Response
  }) as unknown as typeof fetch
}

describe('makeHttpClipInvoke — réponse directe', () => {
  it('envoie prompt, image en data-uri et durée numérique, puis extrait l\'URL', async () => {
    let sent: RequestInit | undefined
    const invoke = makeHttpClipInvoke({
      config: baseCfg, apiKey: 'secret',
      fetchImpl: fetchOnce({ data: { video: { url: 'https://cdn.test/c.mp4' } } }, i => { sent = i }),
    })
    const res = await invoke({ firstFrame: framePath, videoPrompt: 'un but', negativePrompt: 'flou', durationSeconds: 5 })
    expect(res.video_url).toBe('https://cdn.test/c.mp4')
    const body = JSON.parse(String(sent?.body))
    expect(body.prompt).toBe('un but')
    expect(body.duration).toBe(5)
    expect(body.image).toMatch(/^data:image\/png;base64,/)
    expect((sent?.headers as Record<string, string>).Authorization).toBe('Bearer secret')
  })

  it('erreur claire si video_path ne mène à rien et qu\'aucun sondage n\'est prévu', async () => {
    const invoke = makeHttpClipInvoke({ config: baseCfg, apiKey: 'k', fetchImpl: fetchOnce({ autre: 1 }) })
    await expect(invoke({ firstFrame: framePath, videoPrompt: 'p', negativePrompt: 'n', durationSeconds: 5 }))
      .rejects.toThrow(/video_path/)
  })

  it('remonte le corps d\'erreur du fournisseur sur HTTP non-2xx', async () => {
    const bad = (async () => ({ ok: false, status: 402, text: async () => 'quota exceeded' }) as unknown as Response) as unknown as typeof fetch
    const invoke = makeHttpClipInvoke({ config: baseCfg, apiKey: 'k', fetchImpl: bad })
    await expect(invoke({ firstFrame: framePath, videoPrompt: 'p', negativePrompt: 'n', durationSeconds: 5 }))
      .rejects.toThrow(/402.*quota exceeded/)
  })
})

describe('makeHttpClipInvoke — sondage', () => {
  const pollCfg: HttpProviderConfig = {
    ...baseCfg,
    video_path: 'output',
    poll: { status_url: 'https://api.test/p/${ID}', id_path: 'id', status_path: 'status', interval_ms: 1 },
  }

  it('sonde jusqu\'à la vidéo', async () => {
    const pages = [
      { id: 'abc', status: 'starting' },
      { id: 'abc', status: 'processing' },
      { id: 'abc', status: 'succeeded', output: 'https://cdn.test/final.mp4' },
    ]
    let n = 0
    const f = (async () => ({ ok: true, status: 200, json: async () => pages[Math.min(n++, pages.length - 1)], text: async () => '' }) as unknown as Response) as unknown as typeof fetch
    const invoke = makeHttpClipInvoke({ config: pollCfg, apiKey: 'k', fetchImpl: f, sleep: async () => {} })
    const res = await invoke({ firstFrame: framePath, videoPrompt: 'p', negativePrompt: 'n', durationSeconds: 5 })
    expect(res.video_url).toBe('https://cdn.test/final.mp4')
  })

  it('échoue explicitement sur un statut d\'échec', async () => {
    const pages = [{ id: 'abc' }, { id: 'abc', status: 'failed' }]
    let n = 0
    const f = (async () => ({ ok: true, status: 200, json: async () => pages[Math.min(n++, pages.length - 1)], text: async () => '' }) as unknown as Response) as unknown as typeof fetch
    const invoke = makeHttpClipInvoke({ config: pollCfg, apiKey: 'k', fetchImpl: f, sleep: async () => {} })
    await expect(invoke({ firstFrame: framePath, videoPrompt: 'p', negativePrompt: 'n', durationSeconds: 5 }))
      .rejects.toThrow(/échec/)
  })
})

describe('assemblage', () => {
  // Durée lue par ffprobe. (Un `ffmpeg -f null` avec `-v error` masque les lignes
  // `time=` : la mesure y était systématiquement nulle.)
  const dur = (p: string) => {
    const r = spawnSync(FFPROBE, [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p,
    ], { encoding: 'utf8' })
    return Number((r.stdout || '').trim()) || 0
  }

  it('buildFirstFrame produit une image au cadre demandé, avec ou sans portrait', () => {
    const a = buildFirstFrame({ background: '#0A0A0A', width: 72, height: 128, outPath: join(dir, 'f1.png') })
    const b = buildFirstFrame({ portraitPath: framePath, background: '#0A0A0A', width: 72, height: 128, outPath: join(dir, 'f2.png') })
    expect(existsSync(a)).toBe(true)
    expect(existsSync(b)).toBe(true)
  })

  it('normalizeClip impose la durée EXACTE, même sur un clip trop court', () => {
    const short = join(dir, 'short.mp4')
    spawnSync(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=64x96:d=2',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', short])
    const out = normalizeClip({ inPath: short, outPath: join(dir, 'norm.mp4'), seconds: 5, width: 72, height: 128, fps: 12 })
    expect(dur(out)).toBeGreaterThan(4.5)
    expect(dur(out)).toBeLessThan(5.5)
  })

  it('concatClips additionne les durées', () => {
    const parts: string[] = []
    for (const c of ['red', 'green', 'blue']) {
      const p = join(dir, `p_${c}.mp4`)
      spawnSync(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${c}:s=72x128:d=2`,
        '-r', '12', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', p])
      parts.push(p)
    }
    // 3 × 2 s ≈ 6 s. Tolérance large : la concaténation sans réencodage laisse la
    // dernière image du dernier segment courir, d'où un léger dépassement.
    const out = concatClips(parts, join(dir, 'joined.mp4'), join(dir, 'work'))
    expect(dur(out)).toBeGreaterThan(5.5)
    expect(dur(out)).toBeLessThanOrEqual(7)
  })

  it('concatClips refuse une liste vide', () => {
    expect(() => concatClips([], join(dir, 'x.mp4'), join(dir, 'work'))).toThrow(/aucun clip/i)
  })
})
