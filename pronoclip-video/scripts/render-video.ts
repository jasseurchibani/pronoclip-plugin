// Rendu vidéo local (cf. MISSION §8). Cible de prod = CLI HyperFrames (HTML→MP4, gratuit,
// exige bun). Ici, comme bun/HyperFrames ne sont pas installés, on rend la MÊME page de
// composition en local via Chrome headless + ffmpeg-static — local, gratuit, JAMAIS le MCP
// payant render_video. Applique le HOOK BLOQUANT (mention IA) avant tout rendu.

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import puppeteer from 'puppeteer-core'
import ffmpegPath from 'ffmpeg-static'
import { buildMatchScript } from '../core/match-script'
import { buildComposition } from '../core/composition'
import { assertDisclosure, buildVideoMetadata } from '../core/render-guard'
import { realMadrid, barcelone, EXAMPLE_SEED } from './example-teams'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../pronoclip-output')
const config = JSON.parse(readFileSync(resolve(here, '../pronoclip.config.json'), 'utf8'))

// 1) HOOK BLOQUANT — refuse le rendu si la mention IA est absente/vide (§7).
assertDisclosure(config)
const metadata = buildVideoMetadata(config, config.image?.mode)
console.log('Mention IA OK. Métadonnées :', metadata)

// 2) Script + images (le 2-0 L0 déjà généré en B3, dans l'ordre des 8 plans).
const script = buildMatchScript({ home: realMadrid, away: barcelone, competition: 'LaLiga', seed: EXAMPLE_SEED })
const images = [
  'b3_plan1_team_reveal.jpg', 'b3_plan2_rival_reveal.jpg', 'b3_plan3_face_off.jpg',
  'b3_plan4_goal_mbappe.jpg', 'b3_plan5_goal_vinicius.jpg', 'b3_plan6_gk_save.jpg',
  'b3_plan7_celebration.jpg', 'b3_plan8_final_result.jpg',
]

// 3) Composition HTML (self-contained, images en chemins relatifs à la page).
const body = buildComposition({ script, images, config })
const html = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:${config.brand.colors.background};}</style></head>
<body>${body}</body></html>`
const htmlPath = resolve(out, 'preview.html')
mkdirSync(out, { recursive: true })
writeFileSync(htmlPath, html, 'utf8')
console.log('Composition écrite :', htmlPath)

// 4) Capture déterministe (Chrome headless) → frames → MP4 (ffmpeg-static).
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const FPS = 12
const W = 720, H = 1280
const framesDir = resolve(out, '.frames')
rmSync(framesDir, { recursive: true, force: true })
mkdirSync(framesDir, { recursive: true })

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--force-color-profile=srgb'] })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 })
  await page.evaluateOnNewDocument(() => { (window as any).__CAPTURE__ = true }) // fige l'autoplay
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0' })
  const total: number = await page.evaluate(() => (window as any).__DURATION)
  const frames = Math.round((total / 1000) * FPS)
  console.log(`Durée ${total} ms → ${frames} frames @ ${FPS} fps`)
  for (let k = 0; k <= frames; k++) {
    const t = Math.min(total, (k / FPS) * 1000)
    await page.evaluate((ms: number) => (window as any).__renderAt(ms), t)
    await page.screenshot({ path: resolve(framesDir, `f_${String(k).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 82 })
  }
  console.log('Frames capturées :', readdirSync(framesDir).length)
} finally {
  await browser.close()
}

// 5) Encodage MP4 (H.264, faststart) + métadonnées (mention IA + note B3).
const mp4Path = resolve(out, 'pronoclip_real-madrid-vs-barcelone_B3.mp4')
const args = [
  '-y', '-framerate', String(FPS), '-i', resolve(framesDir, 'f_%04d.jpg'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-metadata', `comment=${metadata}`, '-metadata', `description=${metadata}`,
  mp4Path,
]
const res = spawnSync(ffmpegPath as unknown as string, args, { encoding: 'utf8' })
if (res.status !== 0) { console.error(res.stderr?.slice(-1500)); throw new Error('ffmpeg a échoué') }
rmSync(framesDir, { recursive: true, force: true })
console.log('MP4 écrit :', mp4Path)
