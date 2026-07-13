// Tier animated (premium) — test d'UN SEUL plan (le plan 4, but de Mbappé).
// Dry-run : affiche l'image de référence, le video_prompt (verrou anti-morphing),
// le negative_prompt et le COÛT, puis tente la génération. Aucun modèle image→vidéo
// n'étant configuré, on refuse EXPLICITEMENT (pas de dégradation silencieuse).
// Lancer : `npm run animate -- --animated`

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMatchScript } from '../core/match-script'
import { buildMatchBible } from '../core/match-bible'
import { buildVideoPrompt } from '../core/video-prompt'
import { resolveRenderLevel } from '../core/render-guard'
import { makeClipGenerator } from '../adapters/mcp'
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
const costClip = config.render?.animated?.cost_per_clip_usd_estimate ?? 0.3

const { videoPrompt, negativePrompt } = buildVideoPrompt(bible, shot, { durationSeconds: dur })

console.log(`\n===== PLAN 4 — ${shot.sceneType} (${shot.playerName}) — requête image→vidéo =====`)
console.log('First frame :', firstFrame)
console.log('Modèle      :', model)
console.log('Durée       :', dur, 's')
console.log('\n--- video_prompt ---\n' + videoPrompt)
console.log('\n--- negative_prompt ---\n' + negativePrompt)
console.log('\n===== COÛT (estimation, AVANT génération) =====')
console.log(`1 clip ${dur}s ≈ $${costClip.toFixed(2)}   |   8 plans ≈ $${(costClip * 8).toFixed(2)}`)

const generateClip = makeClipGenerator({ /* invoke: <transport API image→vidéo à fournir> */ })
try {
  await generateClip({ firstFrame, videoPrompt, negativePrompt, durationSeconds: dur })
} catch (e) {
  console.log('\n[BLOQUÉ] ' + (e as Error).message)
  console.log('→ Fournis une clé/API image→vidéo (Kling/Runway/…) ou autorise un MCP vidéo pour générer réellement le clip du plan 4.')
}
