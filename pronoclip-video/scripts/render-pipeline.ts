// Pipeline de rendu 40 s, PARTAGÉ par les points d'entrée (saisie manuelle et
// mode « matchs du jour »). Extrait de render-video.ts pour qu'il n'existe qu'UNE
// seule chaîne de rendu : composition → capture Chrome → voix + musique + whoosh → mux.
//
// Tier `motion` (gratuit) uniquement : Chrome headless + ffmpeg. JAMAIS le MCP payant
// `render_video`. Le HOOK BLOQUANT (mention IA) s'exécute AVANT toute écriture.

import { readFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { MatchScript, Score, Team } from '../core/types'
import { makeRng, randomSeed } from '../core/rng'
import { buildMatchScript } from '../core/match-script'
import { buildComposition } from '../core/composition'
import { buildNarration } from '../core/narration'
import { assertDisclosure, buildVideoMetadata } from '../core/render-guard'
import { synthesizeVoice, type TtsProvider } from '../adapters/tts'
import { synthMusicBed, synthWhoosh, buildSfxTrack, muxAudio } from '../adapters/audio-mux'
import { renderHtmlToSilentMp4, writeCompositionHtml } from '../adapters/local-render'

const here = dirname(fileURLToPath(import.meta.url))

export const OUTPUT_DIR = resolve(here, '../pronoclip-output')
export const CONFIG_PATH = resolve(here, '../pronoclip.config.json')

export interface RenderMatchRequest {
  home: Team
  away: Team
  competition: string
  /** Graine → rendu reproductible. Absente = tirage aléatoire. */
  seed?: number
  /** Score imposé (L1+). Absent → le moteur LOCAL prédit (L0). */
  score?: Score
  knockout?: boolean
  /** Base du nom de fichier, ex. `pronoclip_lyon-vs-monaco`. */
  outBase: string
  /** Images par plan ; `''` = panneau généré (défaut : tout généré, aucun asset). */
  images?: string[]
  voiceProvider?: TtsProvider
  log?: (message: string) => void
}

export interface RenderMatchResult {
  mp4: string
  script: MatchScript
  durationMs: number
  voiceProvider: string
}

/** Slug de fichier sûr : minuscules, accents retirés, non-alphanumériques → `-`. */
export function slugify(value: string): string {
  return value
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'match'
}

/**
 * Effectif NON CURÉ (aucun `isKeyPlayer`) → ordre mélangé de façon déterministe par la
 * graine du match. Sans ça, `scorerFor` prend toujours les premiers de la liste, c'est-à-dire
 * l'ordre alphabétique des fichiers : le même buteur dans toutes les vidéos d'une équipe.
 * Un effectif CURÉ (joueurs clés marqués à la main, comme France) est laissé INTACT —
 * la curation prime. On ne fabrique aucun joueur : on ne fait que réordonner l'entrée.
 */
export function orderRosterForMatch(players: Team['players'], seed: number): Team['players'] {
  if (players.some(p => p.isKeyPlayer)) return players
  const rng = makeRng(seed)
  const shuffled = [...players]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Produit le MP4 de bout en bout. La prédiction est LOCALE (core/prediction.ts via
 * buildMatchScript) : aucune source externe n'impose jamais le score ni les buteurs.
 */
export async function renderMatchVideo(req: RenderMatchRequest): Promise<RenderMatchResult> {
  const log = req.log ?? (() => {})
  mkdirSync(OUTPUT_DIR, { recursive: true })
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))

  // 1) HOOK BLOQUANT — refuse le rendu si la mention IA est absente/vide (§7).
  assertDisclosure(config)
  const metadata = buildVideoMetadata(config, config.image?.mode)
  log(`Mention IA OK. Métadonnées : ${JSON.stringify(metadata)}`)

  // 2) Prédiction locale + script.
  const seed = req.seed ?? randomSeed()
  const script = buildMatchScript({
    home: { ...req.home, players: orderRosterForMatch(req.home.players, seed) },
    away: { ...req.away, players: orderRosterForMatch(req.away.players, seed ^ 0x9e3779b9) },
    competition: req.competition,
    seed, score: req.score, knockout: req.knockout,
  })
  log(`Match : ${script.match.home} ${script.prediction.score.home}-${script.prediction.score.away} ${script.match.away}`)
  for (const g of script.prediction.goals) log(`  but : ${g.playerName} (${g.goalType})`)

  // 3) Composition HTML → MP4 muet (Chrome + ffmpeg).
  const images = req.images ?? script.shots.map(() => '')
  const body = buildComposition({ script, images, config })
  const htmlPath = writeCompositionHtml(resolve(OUTPUT_DIR, `${req.outBase}.html`), body, config.brand.colors.background)
  const { path: silent, durationMs } = await renderHtmlToSilentMp4({
    htmlPath,
    outPath: resolve(OUTPUT_DIR, `${req.outBase}_silent.mp4`),
    log,
  })

  // 4) Audio — narration → voix (cascade gratuite) + lit musical + whoosh aux coupes.
  const shotMs = config.video.scene_length_seconds * 1000
  const narration = buildNarration(script, { shotMs })
  log(`Narration (${narration.chars} car.) : "${narration.text}"`)
  // Voix à dégradation propre : si le TTS local est absent, on garde musique + whoosh
  // plutôt que d'échouer — le MP4 sort toujours (garde-fou « jamais de blocage »).
  let vo: { path: string | null; provider: string }
  try {
    vo = await synthesizeVoice({
      text: narration.text,
      outPathBase: resolve(OUTPUT_DIR, `${req.outBase}_vo`),
      provider: req.voiceProvider ?? config.voice?.tts_provider,
      voice: { elevenlabs_voice_id: config.voice?.elevenlabs_voice_id, elevenlabs_model: config.voice?.elevenlabs_model },
      log: m => log('  ' + m),
    })
  } catch {
    log('  Voix indisponible → MP4 avec lit musical + whoosh seuls (dégradation propre).')
    vo = { path: null, provider: 'aucune' }
  }

  const durationSec = durationMs / 1000
  const music = synthMusicBed(resolve(OUTPUT_DIR, `${req.outBase}_music.wav`), durationSec, m => log('  ' + m))
  const whoosh = synthWhoosh(resolve(OUTPUT_DIR, `${req.outBase}_whoosh.wav`), m => log('  ' + m))
  const cuts = script.shots.slice(1).map((_, i) => (i + 1) * shotMs)
  const sfx = buildSfxTrack(whoosh, cuts, durationSec, resolve(OUTPUT_DIR, `${req.outBase}_sfx.wav`), m => log('  ' + m))

  const mp4 = resolve(OUTPUT_DIR, `${req.outBase}${vo.provider === 'elevenlabs' ? '_elevenlabs' : ''}.mp4`)
  try {
    muxAudio({
      videoSilent: silent, voice: vo.path, music, sfx, out: mp4,
      levels: { voice: 1.0, music: 0.15, sfx: 0.5 },
      metadata,
      log: m => log('  ' + m),
    })
  } catch {
    copyFileSync(silent, mp4) // repli ultime : au pire le MP4 sort muet, jamais d'échec sec
    log('  Audio indisponible → MP4 muet produit (jamais de blocage).')
  }

  return { mp4, script, durationMs, voiceProvider: vo.provider }
}
