// Génère un match-script.json d'exemple (démo) — France vs Espagne, SANS
// score fourni (L0), avec effectif FOURNI EXPLICITEMENT. Lancer : `npm run example`.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMatchScript, serializeMatchScript } from '../core/match-script'
import { france, espagne, EXAMPLE_SEED } from './example-teams'

const script = buildMatchScript({
  home: france,
  away: espagne,
  competition: 'Ligue des Nations',
  seed: EXAMPLE_SEED,
  // Aucun score fourni → L0 : le moteur prédit score + buteurs + types.
})

const json = serializeMatchScript(script)

const here = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(here, '../examples/match-script.france-vs-espagne.json')
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, json, 'utf8')

console.log(json)
console.error(`\n→ écrit : ${outPath}`)
