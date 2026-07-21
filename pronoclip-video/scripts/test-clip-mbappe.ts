// Clip de TEST isolé (payant, opt-in) — pipeline B2 → Kling 3.0 → 5 frames.
// Objet du test : juger (a) la reprise du VISAGE du portrait dans le plan, (b) la tenue
// de l'ANIME sur 5 s par Kling 3.0, (c) la cohérence du MAILLOT. Le swoosh/écusson
// viennent de la référence et sont hors sujet ici.
//
// NE sème rien, NE génère pas les autres beats. Affiche le COÛT AVANT chaque étape
// payante (règle produit — cf. edit_image spec §9.4). Lancer : `npm run test-clip`.

import 'dotenv/config'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'
import { resolvePortrait } from '../adapters/squad-library'
import { editImageWithReference } from '../adapters/openai-image'
import { makeFalClipInvoke } from '../adapters/fal'
import { makeClipGenerator } from '../adapters/mcp'

const here = dirname(fileURLToPath(import.meta.url))
const config = JSON.parse(readFileSync(resolve(here, '../pronoclip.config.json'), 'utf8'))
const outDir = resolve(here, '../pronoclip-output')
mkdirSync(outDir, { recursive: true })

const PLAYER = 'Kylian Mbappé'
const TEAM = 'France'
const NAMESPACE = 'pronoclip'

// Plan « frappe » en style anime. On DEMANDE explicitement de reprendre le visage de la
// référence (test de reprise) — l'inverse du cadrage « visage désancré » de la prod.
const IMAGE_PROMPT = [
  'Premium 2D anime sports illustration in the style of a modern football anime:',
  'cel shading, bold clean linework, saturated cinematic palette, vertical 9:16 poster.',
  'Recreate the SAME athlete as the reference portrait — keep his exact face, hairstyle,',
  'skin tone, facial structure and build — restyled as a dynamic anime character.',
  'He is a striker at the peak of a powerful right-footed shot: body torqued, plant foot',
  'planted, striking leg following through, the ball rocketing off his boot with motion',
  'blur and impact lines. Full-body explosive action pose, low dramatic camera angle.',
  'Royal-blue football jersey and white shorts, solid colours.',
  'Night stadium under bright floodlights, shallow depth of field, rim lighting,',
  'kicked-up grass and speed lines conveying explosive motion.',
  'No text, no numbers, no letters, no names, no logos, no captions, no watermark.',
].join(' ')

const VIDEO_PROMPT = [
  'Anime football action, 5-second clip. The camera holds on the striker and follows his',
  'powerful strike: he completes the shot, the ball blasts forward with motion blur and',
  'impact lines, his jersey and hair ripple with the follow-through, floodlights flare',
  'behind. Cinematic slow-motion easing into real-time — dynamic but coherent.',
  'Keep the anime cel-shaded style, the SAME face and the royal-blue kit consistent',
  'across the whole clip.',
].join(' ')

const NEGATIVE_PROMPT = [
  'text, caption, watermark, logo, letters, numbers,',
  'distorted face, warped face, changing face, extra limbs, extra legs, morphing,',
  'flickering, style change, live action, photoreal skin, blurry, low quality',
].join(' ')

// --- Résolution du portrait de référence (chemin EXPLICITE depuis l'index) ---
const portrait = resolvePortrait(PLAYER, TEAM, NAMESPACE)
console.log('===== CLIP DE TEST — Kylian Mbappé (France), plan « frappe » anime =====')
console.log('Portrait de référence :', portrait)

const openaiKey = process.env.OPENAI_API_KEY
const falKey = process.env.FAL_KEY
if (!openaiKey) { console.error('[BLOQUÉ] OPENAI_API_KEY absente (.env).'); process.exit(1) }
if (!falKey) { console.error('[BLOQUÉ] FAL_KEY absente (.env).'); process.exit(1) }

const clipModel: string = config.render?.animated?.model ?? 'fal-ai/kling-video/v3/pro/image-to-video'
const clipCost: number = config.render?.animated?.cost_per_clip_usd_estimate ?? 0.56
const IMG_SIZE = '1024x1536' as const
const IMG_QUALITY = 'high' as const

// ===== ÉTAPE 1/3 — image fixe anime (B2 : OpenAI images.edit) =====
console.log('\n===== ÉTAPE 1/3 — image fixe anime (B2, OpenAI images.edit) =====')
console.log(`Modèle gpt-image-1.5 · ${IMG_SIZE} · quality ${IMG_QUALITY} · input_fidelity high · 1 référence`)
console.log('COÛT estimé AVANT génération : ≈ $0.17–0.25  (facturé aux tokens image — ordre de grandeur)')

const stillPath = resolve(outDir, 'test_mbappe_strike_anime.png')
async function edit(model?: string) {
  return editImageWithReference({
    prompt: IMAGE_PROMPT,
    referencePaths: [portrait],
    opts: { apiKey: openaiKey!, model, size: IMG_SIZE, quality: IMG_QUALITY, inputFidelity: 'high', onLog: m => console.log('  openai:', m) },
  })
}
let img: { pngBuffer: Buffer; model: string }
try {
  img = await edit() // gpt-image-1.5 par défaut
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e)
  console.log('  gpt-image-1.5 a échoué :', msg)
  if (/model|not.?found|does not exist|unsupported|invalid/i.test(msg)) {
    console.log('  → nouvelle tentative avec gpt-image-1')
    img = await edit('gpt-image-1')
  } else {
    throw e
  }
}
writeFileSync(stillPath, img.pngBuffer)
console.log(`Image fixe écrite (${img.model}) :`, stillPath)

// ===== ÉTAPE 2/3 — animation Kling 3.0 (image→vidéo, fal.ai) =====
console.log('\n===== ÉTAPE 2/3 — animation Kling 3.0 (image→vidéo, fal.ai) =====')
console.log(`Modèle ${clipModel} · 5 s · 9:16`)
console.log(`COÛT AVANT génération : ≈ $${clipCost.toFixed(2)}  (1 clip 5 s)`)

const invoke = makeFalClipInvoke({ model: clipModel, apiKey: falKey, onLog: m => console.log('  fal:', m) })
const generateClip = makeClipGenerator({ invoke, warn: m => console.log('  ' + m) })
const { video_url } = await generateClip({ firstFrame: stillPath, videoPrompt: VIDEO_PROMPT, negativePrompt: NEGATIVE_PROMPT, durationSeconds: 5 })
console.log('Clip généré :', video_url)

const mp4Path = resolve(outDir, 'test_mbappe_strike_kling.mp4')
const dl = await fetch(video_url)
if (!dl.ok) throw new Error('Téléchargement du clip échoué : ' + dl.status)
writeFileSync(mp4Path, Buffer.from(await dl.arrayBuffer()))
console.log('MP4 écrit :', mp4Path)

// ===== ÉTAPE 3/3 — extraction de 5 frames (local, gratuit) =====
console.log('\n===== ÉTAPE 3/3 — extraction de 5 frames (ffmpeg local) =====')
console.log('COÛT : $0 (extraction locale, aucune API)')

const stamps = [0.5, 1.5, 2.5, 3.5, 4.5]
const frames: string[] = []
stamps.forEach((t, i) => {
  const f = resolve(outDir, `test_mbappe_frame_${i + 1}.png`)
  const r = spawnSync(ffmpegPath as unknown as string, ['-y', '-ss', String(t), '-i', mp4Path, '-frames:v', '1', f], { stdio: 'ignore' })
  if (r.status === 0) { frames.push(f); console.log(`  frame ${i + 1} @ ${t}s →`, f) }
  else console.log(`  frame ${i + 1} @ ${t}s : échec ffmpeg (status ${r.status})`)
})

console.log('\n===== RÉCAP =====')
console.log('Portrait réf :', portrait)
console.log('Image fixe   :', stillPath)
console.log('Clip 5 s     :', mp4Path)
console.log(`Frames (${frames.length}/5) :`, outDir)
console.log('À juger : (a) visage repris ? (b) anime tenu sur 5 s ? (c) maillot cohérent ?')
