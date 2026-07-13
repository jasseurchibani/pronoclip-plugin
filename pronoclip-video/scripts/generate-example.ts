// Génère un match-script.json d'exemple (démo) — Real Madrid vs Barcelone, SANS
// score fourni (L0), avec effectif FOURNI EXPLICITEMENT. Lancer : `npm run example`.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMatchScript, serializeMatchScript } from '../core/match-script'
import { realMadrid, barcelone, EXAMPLE_SEED } from './example-teams'

const script = buildMatchScript({
  home: realMadrid,
  away: barcelone,
  competition: 'LaLiga',
  seed: EXAMPLE_SEED,
  // Aucun score fourni → L0 : le moteur prédit score + buteurs + types.
})

const json = serializeMatchScript(script)

const here = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(here, '../examples/match-script.real-madrid-vs-barcelone.json')
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, json, 'utf8')

console.log(json)
console.error(`\n→ écrit : ${outPath}`)
