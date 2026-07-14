// Tier animated (premium) — UN SEUL plan (plan 4, but de Mbappé), image→vidéo.
// Deux étapes : (1) FIRST FRAME = setup 3D « instant avant » (generate_image, piloté
// par l'agent), (2) clip i2v caméra verrouillée (fal.ai). Affiche les coûts AVANT.
// Lancer : `npm run animate -- --animated`

import 'dotenv/config'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMatchScript } from '../core/match-script'
import { buildMatchBible } from '../core/match-bible'
import { buildImagePrompt } from '../core/prompt-builder'
import { buildVideoPrompt } from '../core/video-prompt'
import { resolveRenderLevel } from '../core/render-guard'
import { makeClipGenerator } from '../adapters/mcp'
import { makeFalClipInvoke } from '../adapters/fal'
import { realMadrid, barcelone, EXAMPLE_SEED } from './example-teams'

const here = dirname(fileURLToPath(import.meta.url))
const config = JSON.parse(readFileSync(resolve(here, '../pronoclip.config.json'), 'utf8'))

const explicitAnimated = process.argv.includes('--animated')
const level = resolveRenderLevel(config.render?.level, explicitAnimated)
console.log('Tier de rendu résolu :', level, explicitAnimated ? '(opt-in --animated)' : '(défaut config)')
if (level !== 'animated') {
  console.log('Tier motion : rien à animer. Relance avec `--animated`.')
  process.exit(0)
}

const script = buildMatchScript({ home: realMadrid, away: barcelone, competition: 'LaLiga', seed: EXAMPLE_SEED })
const bible = buildMatchBible({ script, home: realMadrid, away: barcelone })

// Beat ciblé : --shot=N (1-based). Défaut 4 (but de Mbappé). Chaque beat = 1 geste.
const shotArg = process.argv.find(a => a.startsWith('--shot='))
const shotNo = shotArg ? Math.max(1, Math.min(script.shots.length, parseInt(shotArg.split('=')[1], 10))) : 4
const shot = script.shots[shotNo - 1]
const slug = `beat${shotNo}_${shot.sceneType}`
const dur = config.render?.animated?.duration_seconds ?? 5
const model = config.render?.animated?.model ?? '(non défini)'
const provider = config.render?.animated?.provider ?? '(non défini)'
const costClip = config.render?.animated?.cost_per_clip_usd_estimate ?? 0.56
const firstFrame = resolve(here, `../pronoclip-output/animated_${slug}_firstframe.jpg`)

// FIRST FRAME (setup 3D « instant avant ») + motion du clip.
const imagePrompt = buildImagePrompt(bible, shot, { renderLevel: 'animated' })
const { videoPrompt, negativePrompt } = buildVideoPrompt(bible, shot, { durationSeconds: dur })

console.log(`\n===== BEAT ${shotNo} — ${shot.sceneType} (${shot.playerName ?? '—'}) — tier animated =====`)
console.log('Provider :', provider, '· Modèle :', model, '· Durée :', dur, 's · 9:16')
console.log('\n########## FIRST FRAME — prompt generate_image (setup 3D, instant AVANT) ##########')
console.log(imagePrompt)
console.log('\n########## CLIP — video_prompt (caméra verrouillée, payoff) ##########')
console.log(videoPrompt)
console.log('\n--- negative_prompt (clip) ---\n' + negativePrompt)
console.log('\n===== COÛT (AVANT génération) =====')
console.log(`First frame (generate_image hd) ≈ $0.08  +  1 clip ${dur}s (${provider}) ≈ $${costClip.toFixed(2)}  =  ~$${(0.08 + costClip).toFixed(2)}`)

if (!existsSync(firstFrame)) {
  console.log(`\n[ÉTAPE 1] First frame absente. Génère l'image ci-dessus via generate_image et sauvegarde-la ici :\n  ${firstFrame}\nPuis relance ce script pour l'étape 2 (clip).`)
  process.exit(0)
}
console.log('\n[ÉTAPE 2] First frame trouvée →', firstFrame)

const falKey = process.env.FAL_KEY
if (!falKey) { console.log('\n[BLOQUÉ] FAL_KEY absente.'); process.exit(0) }

const invoke = makeFalClipInvoke({ model, apiKey: falKey, onLog: m => console.log('  fal:', m) })
const generateClip = makeClipGenerator({ invoke, warn: m => console.log('  ' + m) })

console.log('\nGénération du clip (image→vidéo)…')
const { video_url } = await generateClip({ firstFrame, videoPrompt, negativePrompt, durationSeconds: dur })
console.log('Clip généré :', video_url)
const res = await fetch(video_url)
if (!res.ok) throw new Error('Téléchargement échoué : ' + res.status)
const outPath = resolve(here, `../pronoclip-output/animated_${slug}_kling.mp4`)
writeFileSync(outPath, Buffer.from(await res.arrayBuffer()))
console.log('MP4 écrit :', outPath)
