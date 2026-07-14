// Tier animated (premium) — génère UN SEUL plan (le plan 4, but de Mbappé) en
// image→vidéo (fal.ai + modèle de config). Affiche le coût AVANT de générer.
// Lancer : `npm run animate -- --animated`

import 'dotenv/config'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMatchScript } from '../core/match-script'
import { buildMatchBible } from '../core/match-bible'
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
  console.log('Tier motion : rien à animer. Relance avec `--animated` pour le tier premium.')
  process.exit(0)
}

const script = buildMatchScript({ home: realMadrid, away: barcelone, competition: 'LaLiga', seed: EXAMPLE_SEED })
const bible = buildMatchBible({ script, home: realMadrid, away: barcelone })
const shot = script.shots[3] // plan 4 (index 3) — but de Mbappé
const firstFrame = resolve(here, '../pronoclip-output/b3_plan4_goal_mbappe.jpg')
const dur = config.render?.animated?.duration_seconds ?? 5
const model = config.render?.animated?.model ?? '(non défini)'
const provider = config.render?.animated?.provider ?? '(non défini)'
const costClip = config.render?.animated?.cost_per_clip_usd_estimate ?? 0.35

const { videoPrompt, negativePrompt } = buildVideoPrompt(bible, shot, { durationSeconds: dur })

console.log(`\n===== PLAN 4 — ${shot.sceneType} (${shot.playerName}) — image→vidéo =====`)
console.log('Provider    :', provider)
console.log('Modèle      :', model)
console.log('First frame :', firstFrame)
console.log('Durée       :', dur, 's · format 9:16')
console.log('\n--- video_prompt ---\n' + videoPrompt)
console.log('\n--- negative_prompt ---\n' + negativePrompt)
console.log('\n===== COÛT (AVANT génération) =====')
console.log(`1 clip ${dur}s ≈ $${costClip.toFixed(2)} (estimation ; facturé réellement par ${provider} au tarif Kling 2.1 std)`)
console.log(`Pour info, 8 plans ≈ $${(costClip * 8).toFixed(2)} — mais on NE génère qu'UN plan ici.`)

const falKey = process.env.FAL_KEY
if (!falKey) {
  console.log('\n[BLOQUÉ] FAL_KEY absente de l’environnement (.env). Impossible de générer.')
  process.exit(0)
}

const invoke = makeFalClipInvoke({ model, apiKey: falKey, onLog: m => console.log('  fal:', m) })
const generateClip = makeClipGenerator({ invoke, warn: m => console.log('  ' + m) })

console.log('\nGénération en cours (image→vidéo)…')
const { video_url } = await generateClip({ firstFrame, videoPrompt, negativePrompt, durationSeconds: dur })
console.log('Clip généré :', video_url)

const res = await fetch(video_url)
if (!res.ok) throw new Error('Téléchargement du clip échoué : ' + res.status)
const outPath = resolve(here, '../pronoclip-output/animated_plan4_mbappe_kling.mp4')
writeFileSync(outPath, Buffer.from(await res.arrayBuffer()))
console.log('MP4 écrit :', outPath)
