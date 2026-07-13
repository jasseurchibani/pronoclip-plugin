// Génère un match-script.json d'exemple (démo) — Real Madrid vs Barcelone, SANS
// score fourni (L0). Les effectifs ci-dessous sont des données d'exemple locales,
// pas des données client. Lancer : `npm run example`.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMatchScript, serializeMatchScript } from '../core/match-script'
import type { Team } from '../core/types'

const realMadrid: Team = {
  name: 'Real Madrid',
  players: [
    { name: 'Mbappé', isKeyPlayer: true },
    { name: 'Vinícius Jr', isKeyPlayer: true },
    { name: 'Bellingham' },
    { name: 'Rodrygo' },
    { name: 'Valverde' },
    { name: 'Güler' },
  ],
}

const barcelone: Team = {
  name: 'FC Barcelone',
  players: [
    { name: 'Lewandowski', isKeyPlayer: true },
    { name: 'Lamine Yamal', isKeyPlayer: true },
    { name: 'Raphinha' },
    { name: 'Pedri' },
    { name: 'Ferran Torres' },
    { name: 'Dani Olmo' },
  ],
}

const script = buildMatchScript({
  home: realMadrid,
  away: barcelone,
  competition: 'LaLiga',
  // Aucun score fourni → L0 : le moteur prédit score + buteurs + types.
})

const json = serializeMatchScript(script)

const here = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(here, '../examples/match-script.real-madrid-vs-barcelone.json')
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, json, 'utf8')

console.log(json)
console.error(`\n→ écrit : ${outPath}`)
