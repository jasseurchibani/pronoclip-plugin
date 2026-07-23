// Rendu local d'une composition HTML → MP4 muet (Chrome headless + ffmpeg-static).
// Partagé par scripts/render-video.ts et scripts/demo.ts (dédup). Local, gratuit,
// JAMAIS le MCP payant. I/O assumée (adapter).

import { writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import puppeteer from 'puppeteer-core'
import ffmpegPath from 'ffmpeg-static'

/** Localise Chrome (chemins standards Windows, puis CHROME_PATH). Lève si absent. */
export function findChrome(): string {
  const candidates = [
    process.env.CHROME_PATH || '',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ]
  const found = candidates.find(p => p && existsSync(p))
  if (!found) throw new Error('Chrome/Chromium introuvable. Installe Chrome ou définis CHROME_PATH.')
  return found
}

export interface RenderOptions {
  htmlPath: string
  outPath: string
  fps?: number
  width?: number
  height?: number
  log?: (m: string) => void
}

/**
 * Capture déterministe de la page (la composition expose `__DURATION` + `__renderAt(ms)`)
 * → frames JPEG → MP4 H.264 MUET (sans métadonnées ; l'audio et les métadonnées sont
 * ajoutés au mux). Renvoie le chemin du MP4 et sa durée en ms.
 */
export async function renderHtmlToSilentMp4(opts: RenderOptions): Promise<{ path: string; durationMs: number }> {
  const fps = opts.fps ?? 12
  const width = opts.width ?? 720
  const height = opts.height ?? 1280
  const log = opts.log ?? (() => {})
  const outDir = resolve(opts.outPath, '..')
  mkdirSync(outDir, { recursive: true })
  const framesDir = resolve(outDir, '.frames')
  rmSync(framesDir, { recursive: true, force: true })
  mkdirSync(framesDir, { recursive: true })

  let durationMs = 0
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox', '--force-color-profile=srgb'] })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width, height, deviceScaleFactor: 1 })
    await page.evaluateOnNewDocument(() => { (window as any).__CAPTURE__ = true })
    await page.goto('file://' + opts.htmlPath, { waitUntil: 'networkidle0' })
    durationMs = await page.evaluate(() => (window as any).__DURATION)
    const frames = Math.round((durationMs / 1000) * fps)
    log(`Durée ${durationMs} ms → ${frames} frames @ ${fps} fps`)
    for (let k = 0; k <= frames; k++) {
      const t = Math.min(durationMs, (k / fps) * 1000)
      await page.evaluate((ms: number) => (window as any).__renderAt(ms), t)
      await page.screenshot({ path: resolve(framesDir, `f_${String(k).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 82 })
    }
    log(`Frames capturées : ${readdirSync(framesDir).length}`)
  } finally {
    await browser.close()
  }

  const enc = spawnSync(ffmpegPath as unknown as string, [
    '-y', '-framerate', String(fps), '-i', resolve(framesDir, 'f_%04d.jpg'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', opts.outPath,
  ], { encoding: 'utf8' })
  rmSync(framesDir, { recursive: true, force: true })
  if (enc.status !== 0) throw new Error('ffmpeg (vidéo muette) a échoué : ' + (enc.stderr || '').slice(-600))
  return { path: opts.outPath, durationMs }
}

/** Écrit la page HTML autonome d'une composition (body déjà généré par core/composition). */
export function writeCompositionHtml(htmlPath: string, body: string, background: string): string {
  const html = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:${background};}</style></head>
<body>${body}</body></html>`
  mkdirSync(resolve(htmlPath, '..'), { recursive: true })
  writeFileSync(htmlPath, html, 'utf8')
  return htmlPath
}
