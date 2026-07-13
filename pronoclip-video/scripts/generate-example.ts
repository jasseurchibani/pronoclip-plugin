// Génère un match-script.json d'exemple (démo) — Real Madrid vs Barcelone, SANS
// score fourni (L0), avec effectif FOURNI EXPLICITEMENT (l'effectif est une
// entrée, jamais une connaissance du modèle — cf. MISSION correction §6).
// La graine est explicite ici pour rendre l'exemple reproductible ; en usage
// réel, l'absence de graine donne un résultat aléatoire. Lancer : `npm run example`.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMatchScript, serializeMatchScript } from '../core/match-script'
import { seedFromString } from '../core/rng'
import type { Team } from '../core/types'

const realMadrid: Team = {
  name: 'Real Madrid',
  players: [
    { name: 'Mbappé', isKeyPlayer: true, profile: { position: 'FW', heading: 0.4, longRange: 0.65, isPenaltyTaker: true } },
    { name: 'Vinícius Jr', isKeyPlayer: true, profile: { position: 'WG', heading: 0.1, longRange: 0.5 } },
    { name: 'Bellingham', profile: { position: 'MF', heading: 0.6, longRange: 0.6 } },
    { name: 'Rodrygo', profile: { position: 'WG', heading: 0.2, longRange: 0.55 } },
    { name: 'Valverde', profile: { position: 'MF', heading: 0.4, longRange: 0.85 } },
    { name: 'Güler', profile: { position: 'MF', setPieces: 0.85, longRange: 0.6 } },
  ],
}

const barcelone: Team = {
  name: 'FC Barcelone',
  players: [
    { name: 'Lewandowski', isKeyPlayer: true, profile: { position: 'FW', heading: 0.8, longRange: 0.4, isPenaltyTaker: true } },
    { name: 'Lamine Yamal', isKeyPlayer: true, profile: { position: 'WG', heading: 0.1, longRange: 0.55 } },
    { name: 'Raphinha', profile: { position: 'WG', heading: 0.25, longRange: 0.6, setPieces: 0.7 } },
    { name: 'Pedri', profile: { position: 'MF', heading: 0.3, longRange: 0.5 } },
    { name: 'Ferran Torres', profile: { position: 'FW', heading: 0.4 } },
    { name: 'Dani Olmo', profile: { position: 'MF', longRange: 0.65 } },
  ],
}

const script = buildMatchScript({
  home: realMadrid,
  away: barcelone,
  competition: 'LaLiga',
  // Graine explicite → exemple reproductible (voir en-tête). En prod : omise = aléatoire.
  seed: seedFromString('Real Madrid|FC Barcelone'),
  // Aucun score fourni → L0 : le moteur prédit score + buteurs + types.
})

const json = serializeMatchScript(script)

const here = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(here, '../examples/match-script.real-madrid-vs-barcelone.json')
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, json, 'utf8')

console.log(json)
console.error(`\n→ écrit : ${outPath}`)
