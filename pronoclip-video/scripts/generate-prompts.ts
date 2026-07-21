// Génère les 8 prompts d'image finaux (texte brut) — Real Madrid vs Barcelone, L0.
// AUCUNE image n'est générée : ce script ne fait qu'assembler le texte des prompts
// pour relecture avant la Phase 4. Lancer : `npm run prompts`.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMatchScript } from '../core/match-script'
import { buildMatchBible, worldSelectionFromConfig, type WorldConfig } from '../core/match-bible'
import { buildAllPrompts } from '../core/prompt-builder'
import type { CharacterLikeness } from '../core/types'
import { france, espagne, EXAMPLE_SEED } from './example-teams'

const here = dirname(fileURLToPath(import.meta.url))

// Câblage config → Match Bible / prompts : monde verrouillé de marque + politique de
// ressemblance, lus depuis pronoclip.config.json.
const config = JSON.parse(readFileSync(resolve(here, '../pronoclip.config.json'), 'utf8')) as {
  world?: WorldConfig
  characters?: { likeness?: CharacterLikeness }
}
const world = worldSelectionFromConfig(config.world)
const characterLikeness: CharacterLikeness = config.characters?.likeness ?? 'independent'

const script = buildMatchScript({
  home: france,
  away: espagne,
  competition: 'Ligue des Nations',
  seed: EXAMPLE_SEED,
})
const bible = buildMatchBible({ script, home: france, away: espagne, world })
const prompts = buildAllPrompts(bible, script.shots, { characterLikeness })

const lines: string[] = []
lines.push(`# 8 prompts d'image — ${script.match.home} ${script.prediction.score.home}-${script.prediction.score.away} ${script.match.away}`)
lines.push(`# Match Bible verrouillé — monde : ${bible.world.time_of_day} | grade : ${bible.world.grade} | seed : ${bible.seed}`)
lines.push('')
for (const p of prompts) {
  lines.push('═'.repeat(78))
  lines.push(`PLAN ${p.order}/8 — ${p.sceneType}${p.playerName ? ` — ${p.playerName}` : ''}`)
  lines.push('═'.repeat(78))
  lines.push(p.prompt)
  lines.push('')
}
const out = lines.join('\n')

const outPath = resolve(here, '../examples/prompts.france-vs-espagne.txt')
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, out + '\n', 'utf8')

console.log(out)
console.error(`\n→ écrit : ${outPath}`)
