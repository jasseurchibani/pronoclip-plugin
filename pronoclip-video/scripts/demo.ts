// DÉMO — MP4 de pronostic sur un match FICTIF, ZÉRO config client (pas de company ID,
// pas de clé API, pas d'effectif réel). Tier `motion` (gratuit) : Chrome + ffmpeg +
// panneaux générés + voix locale gratuite (dégrade proprement si absente). Aucune
// génération payante, aucun MCP. Pour quelqu'un qui n'a jamais vu le repo.
//
//   npm run demo                 → score PRÉDIT par le moteur (L0)
//   npm run demo -- --score 2-1  → score IMPOSÉ 2-1 (respecté à l'identique)

import { readFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Team } from '../core/types'
import { seedFromString } from '../core/rng'
import { buildMatchScript } from '../core/match-script'
import { buildComposition } from '../core/composition'
import { buildNarration } from '../core/narration'
import { assertDisclosure, buildVideoMetadata } from '../core/render-guard'
import { synthesizeVoice } from '../adapters/tts'
import { synthMusicBed, synthWhoosh, buildSfxTrack, muxAudio } from '../adapters/audio-mux'
import { renderHtmlToSilentMp4, writeCompositionHtml } from '../adapters/local-render'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../pronoclip-output')
mkdirSync(out, { recursive: true })
const config = JSON.parse(readFileSync(resolve(here, '../pronoclip.config.json'), 'utf8'))

// --- Effectifs 100 % FICTIFS (inventés ici, aucune bibliothèque, aucun joueur réel) ---
const rovers: Team = {
  name: 'Rovers', colors: { primary: 'blue' },
  players: [
    { name: 'Kian Alder', isKeyPlayer: true, profile: { position: 'FW', heading: 0.4, longRange: 0.6, isPenaltyTaker: true } },
    { name: 'Nilo Bast', isKeyPlayer: true, profile: { position: 'WG', heading: 0.15, longRange: 0.55 } },
    { name: 'Theo Marsh', profile: { position: 'MF', heading: 0.5, longRange: 0.6 } },
    { name: 'Ravi Okonkwo', profile: { position: 'DF', heading: 0.8 } },
    { name: 'Sami Vega', profile: { position: 'MF', setPieces: 0.7, longRange: 0.6 } },
    { name: 'Otis Kane', profile: { position: 'GK', heading: 0.1 } },
  ],
}
const comets: Team = {
  name: 'Comets', colors: { primary: 'red' },
  players: [
    { name: 'Milo Sereno', isKeyPlayer: true, profile: { position: 'FW', heading: 0.7, longRange: 0.4, isPenaltyTaker: true } },
    { name: 'Aron Feld', isKeyPlayer: true, profile: { position: 'WG', heading: 0.15, longRange: 0.6 } },
    { name: 'Dario Pax', profile: { position: 'MF', heading: 0.3, longRange: 0.55 } },
    { name: 'Enzo Rill', profile: { position: 'DF', heading: 0.75 } },
    { name: 'Luca Brandt', profile: { position: 'FW', heading: 0.5 } },
    { name: 'Piet Vos', profile: { position: 'GK', heading: 0.1 } },
  ],
}

// --- Score : --score H-A → imposé (L1) ; absent → prédit (L0) ---
const scoreArg = process.argv.find(a => a.startsWith('--score='))?.split('=')[1]
  ?? (process.argv.includes('--score') ? process.argv[process.argv.indexOf('--score') + 1] : undefined)
let score: { home: number; away: number } | undefined
if (scoreArg && /^\d+-\d+$/.test(scoreArg)) {
  const [h, a] = scoreArg.split('-').map(Number)
  score = { home: h, away: a }
}

// 1) HOOK BLOQUANT — mention IA obligatoire (§7).
assertDisclosure(config)
const metadata = buildVideoMetadata(config)

// 2) Prédiction + script (graine fixe → reproductible).
const script = buildMatchScript({
  home: rovers, away: comets, competition: 'Coupe Démo',
  score, seed: seedFromString('Rovers|Comets'),
})
console.log(`\n===== DÉMO PronoClip — match FICTIF, zéro config =====`)
console.log(`${script.match.home} ${script.prediction.score.home}-${script.prediction.score.away} ${script.match.away}` +
  `  (${score ? 'score imposé' : 'score PRÉDIT'})`)
for (const g of script.prediction.goals) console.log(`  but : ${g.playerName} (${g.goalType})`)

// 3) Composition (panneaux générés, aucun asset) → rendu local muet.
const body = buildComposition({ script, images: script.shots.map(() => ''), config })
const htmlPath = writeCompositionHtml(resolve(out, 'demo.html'), body, config.brand.colors.background)
const slug = `${script.prediction.score.home}-${script.prediction.score.away}`
const silentPath = resolve(out, `demo_rovers-vs-comets_silent.mp4`)
const { path: silent, durationMs: totalMs } = await renderHtmlToSilentMp4({ htmlPath, outPath: silentPath, log: m => console.log(m) })

// 4) Audio GRATUIT à dégradation propre : voix locale si dispo, sinon musique + whoosh seuls.
const shotMs = config.video.scene_length_seconds * 1000
const narration = buildNarration(script, { shotMs })
let voicePath: string | null = null
try {
  const vo = await synthesizeVoice({ text: narration.text, outPathBase: resolve(out, 'demo_vo'), log: m => console.log('  ' + m) })
  voicePath = vo.path
} catch {
  console.log('  Voix locale indisponible → MP4 avec lit musical + whoosh seuls (dégradation propre).')
}
const durationSec = totalMs / 1000
const music = synthMusicBed(resolve(out, 'demo_music.wav'), durationSec)
const whoosh = synthWhoosh(resolve(out, 'demo_whoosh.wav'))
const cuts = script.shots.slice(1).map((_, i) => (i + 1) * shotMs)
const sfx = buildSfxTrack(whoosh, cuts, durationSec, resolve(out, 'demo_sfx.wav'))

const mp4 = resolve(out, `demo_rovers-vs-comets_${slug}.mp4`)
try {
  muxAudio({ videoSilent: silent, voice: voicePath, music, sfx, out: mp4, levels: { voice: 1.0, music: 0.15, sfx: 0.5 }, metadata })
} catch {
  copyFileSync(silent, mp4) // repli ultime : au pire, la vidéo (muette) est quand même produite
  console.log('  Audio indisponible → MP4 muet produit (jamais de blocage).')
}

console.log('\n===== MP4 DÉMO =====')
console.log(mp4)
