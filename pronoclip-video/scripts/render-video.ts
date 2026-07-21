// Rendu vidéo LOCAL et GRATUIT (cf. MISSION §8). Assemblage complet :
//   composition HTML (overlays §8) → capture Chrome headless → vidéo muette →
//   narration → voix off (cascade TTS gratuite/opt-in) + lit musical + whoosh aux coupes →
//   mux → MP4 final (filigrane IA + carton + métadonnées).
// JAMAIS le MCP payant render_video. Le HOOK BLOQUANT (mention IA) s'exécute AVANT tout.
// Par défaut : panneaux générés (aucun asset, aucune config) ; --images = jeu B3 existant.
// Voix : GRATUITE par défaut (SAPI fr-FR local) ; --voice=elevenlabs = opt-in payant.

import 'dotenv/config' // charge .env (ELEVENLABS_API_KEY pour la voix premium opt-in)
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import puppeteer from 'puppeteer-core'
import ffmpegPath from 'ffmpeg-static'
import { buildMatchScript } from '../core/match-script'
import { buildComposition } from '../core/composition'
import { buildNarration } from '../core/narration'
import { assertDisclosure, buildVideoMetadata } from '../core/render-guard'
import { synthesizeVoice, type TtsProvider } from '../adapters/tts'
import { synthMusicBed, synthWhoosh, buildSfxTrack, muxAudio } from '../adapters/audio-mux'
import { france, espagne, EXAMPLE_SEED } from './example-teams'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../pronoclip-output')
const config = JSON.parse(readFileSync(resolve(here, '../pronoclip.config.json'), 'utf8'))
mkdirSync(out, { recursive: true })

// 1) HOOK BLOQUANT — refuse le rendu si la mention IA est absente/vide (§7).
assertDisclosure(config)
const metadata = buildVideoMetadata(config, config.image?.mode)
console.log('Mention IA OK. Métadonnées :', metadata)

// 2) Script France vs Espagne (source de vérité = bibliothèque).
const script = buildMatchScript({ home: france, away: espagne, competition: 'Ligue des Nations', seed: EXAMPLE_SEED })
console.log(`Match : ${script.match.home} ${script.prediction.score.home}-${script.prediction.score.away} ${script.match.away}`)

// 3) Images : par défaut panneaux générés (aucun asset) ; --images = jeu B3 existant.
const useImages = process.argv.includes('--images')
const images = useImages
  ? [
      'b3_plan1_team_reveal.jpg', 'b3_plan2_rival_reveal.jpg', 'b3_plan3_face_off.jpg',
      'b3_plan4_goal_mbappe.jpg', 'b3_plan5_goal_vinicius.jpg', 'b3_plan6_gk_save.jpg',
      'b3_plan7_celebration.jpg', 'b3_plan8_final_result.jpg',
    ]
  : script.shots.map(() => '') // '' → panneau généré

// 4) Composition HTML (self-contained).
const body = buildComposition({ script, images, config })
const html = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:${config.brand.colors.background};}</style></head>
<body>${body}</body></html>`
const htmlPath = resolve(out, 'preview.html')
writeFileSync(htmlPath, html, 'utf8')
console.log('Composition écrite :', htmlPath)

// 5) Capture déterministe (Chrome headless) → frames → vidéo MUETTE (ffmpeg-static).
function findChrome(): string {
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.CHROME_PATH || '',
  ]
  const found = candidates.find(p => p && existsSync(p))
  if (!found) throw new Error('Chrome introuvable. Installe Chrome ou définis CHROME_PATH.')
  return found
}
const FPS = 12
const W = 720, H = 1280
const framesDir = resolve(out, '.frames')
rmSync(framesDir, { recursive: true, force: true })
mkdirSync(framesDir, { recursive: true })

let totalMs = 0
const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox', '--force-color-profile=srgb'] })
try {
  const page = await browser.newPage()
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 })
  await page.evaluateOnNewDocument(() => { (window as any).__CAPTURE__ = true })
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0' })
  totalMs = await page.evaluate(() => (window as any).__DURATION)
  const frames = Math.round((totalMs / 1000) * FPS)
  console.log(`Durée ${totalMs} ms → ${frames} frames @ ${FPS} fps`)
  for (let k = 0; k <= frames; k++) {
    const t = Math.min(totalMs, (k / FPS) * 1000)
    await page.evaluate((ms: number) => (window as any).__renderAt(ms), t)
    await page.screenshot({ path: resolve(framesDir, `f_${String(k).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 82 })
  }
  console.log('Frames capturées :', readdirSync(framesDir).length)
} finally {
  await browser.close()
}

const silent = resolve(out, 'pronoclip_france-vs-espagne_silent.mp4')
const encRes = spawnSync(ffmpegPath as unknown as string, [
  '-y', '-framerate', String(FPS), '-i', resolve(framesDir, 'f_%04d.jpg'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', silent,
], { encoding: 'utf8' })
if (encRes.status !== 0) { console.error(encRes.stderr?.slice(-1500)); throw new Error('ffmpeg (vidéo muette) a échoué') }
rmSync(framesDir, { recursive: true, force: true })
console.log('Vidéo muette :', silent)

// 6) AUDIO — narration → voix (cascade) + lit musical + whoosh aux coupes.
const shotMs = config.video.scene_length_seconds * 1000
const narration = buildNarration(script, { shotMs })
console.log(`\nNarration (${narration.chars} car.) : "${narration.text}"`)

const voiceArg = process.argv.find(a => a.startsWith('--voice='))
const provider = (voiceArg ? voiceArg.split('=')[1] : config.voice?.tts_provider) as TtsProvider | undefined
const vo = await synthesizeVoice({
  text: narration.text,
  outPathBase: resolve(out, 'vo_pronoclip'),
  provider,
  voice: { elevenlabs_voice_id: config.voice?.elevenlabs_voice_id, elevenlabs_model: config.voice?.elevenlabs_model },
  log: m => console.log('  ' + m),
})
console.log(`Voix off : ${vo.provider} → ${vo.path}`)

const durationSec = totalMs / 1000
const music = synthMusicBed(resolve(out, 'bed_music.wav'), durationSec, m => console.log('  ' + m))
const whoosh = synthWhoosh(resolve(out, 'sfx_whoosh.wav'), m => console.log('  ' + m))
const cuts = script.shots.slice(1).map((_, i) => (i + 1) * shotMs) // coupes = frontières de plans
const sfx = buildSfxTrack(whoosh, cuts, durationSec, resolve(out, 'sfx_track.wav'), m => console.log('  ' + m))

// 7) Mux final (voix −0 dB, lit musical ducké ≈ −16 dB, whoosh moyen) + métadonnées.
// Nom suffixé par le provider effectif → MP4 gratuit (défaut) et premium coexistent.
const mp4 = resolve(out, `pronoclip_france-vs-espagne${vo.provider === 'elevenlabs' ? '_elevenlabs' : ''}.mp4`)
muxAudio({
  videoSilent: silent, voice: vo.path, music, sfx, out: mp4,
  levels: { voice: 1.0, music: 0.15, sfx: 0.5 },
  metadata,
  log: m => console.log('  ' + m),
})

console.log('\n===== MP4 FINAL =====')
console.log(mp4)
