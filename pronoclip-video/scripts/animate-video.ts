// TIER ANIMATED (PREMIUM, PAYANT) — vidéo complète de 40 s en clips image→vidéo.
//
//   npm run animate-video -- Algeria Morocco --estimate      → coût seulement, rien n'est dépensé
//   npm run animate-video -- Algeria Morocco --yes           → génère réellement
//   npm run animate-video -- Algeria Morocco --yes --provider=runway
//
// Le fournisseur est DÉCRIT EN CONFIGURATION (`render.animated`), pas codé ici : fal, ou
// n'importe quelle API REST via `provider: "http"`. Sa clé est lue dans l'environnement
// sous le nom déclaré (`api_key_env`) et n'est jamais journalisée.
//
// Chaîne : portrait détouré → première frame par plan → clip chez le fournisseur →
// normalisation (durée/définition/cadence exactes) → concaténation → audio → MP4 40 s.
//
// GARDE-FOU : rien n'est dépensé sans `--yes`. Sans lui, le script estime et s'arrête.

import 'dotenv/config'
import { readFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Player, Team } from '../core/types'
import { seedFromString } from '../core/rng'
import { buildMatchScript } from '../core/match-script'
import { buildMatchBible } from '../core/match-bible'
import { buildVideoPrompt } from '../core/video-prompt'
import { buildNarration } from '../core/narration'
import { assertDisclosure, buildVideoMetadata } from '../core/render-guard'
import { loadRoster, resolvePortrait, slugifyTeam, DEFAULT_DATA_ROOT } from '../adapters/squad-library'
import { cutoutCached } from '../adapters/portrait-cutout'
import { makeFalClipInvoke } from '../adapters/fal'
import { makeHttpClipInvoke, requireApiKey, type ProviderConfig, type HttpProviderConfig } from '../adapters/video-gen'
import { buildFirstFrame, normalizeClip, concatClips, downloadClip } from '../adapters/clip-assembly'
import { synthesizeVoice } from '../adapters/tts'
import { synthMusicBed, synthWhoosh, buildSfxTrack, muxAudio } from '../adapters/audio-mux'
import { OUTPUT_DIR, CONFIG_PATH, slugify, orderRosterForMatch } from './render-pipeline'

const argv = process.argv.slice(2)
const flag = (n: string) => {
  const eq = argv.find(a => a.startsWith(`--${n}=`))
  if (eq) return eq.split('=').slice(1).join('=')
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && !argv[i + 1]?.startsWith('--') ? argv[i + 1] : undefined
}
const positional: string[] = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a.startsWith('--')) { if (!a.includes('=') && argv[i + 1] && !argv[i + 1].startsWith('--')) i++; continue }
  positional.push(a)
}
const [homeName, awayName] = positional
const confirmed = argv.includes('--yes')
const estimateOnly = argv.includes('--estimate') || !confirmed

if (!homeName || !awayName) {
  console.log('Usage : npm run animate-video -- <domicile> <extérieur> [--estimate] [--yes] [--provider=<nom>]')
  process.exit(2)
}

const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
assertDisclosure(config) // HOOK BLOQUANT — mention IA obligatoire avant toute dépense.
const metadata = buildVideoMetadata(config, config.image?.mode)

const namespace = config.brand?.namespace ?? 'pronoclip'
const width = 720
const height = 1280

// --- Effectifs (entrée, jamais inventés) + script, MÊME graine que le tier motion ---
function rosterOrNull(t: string): Player[] | null {
  try { return loadRoster(t, namespace) } catch { return null }
}
const homePlayers = rosterOrNull(homeName)
const awayPlayers = rosterOrNull(awayName)
const missing = [...(homePlayers ? [] : [homeName]), ...(awayPlayers ? [] : [awayName])]
if (missing.length > 0) {
  console.log(`\n⚠️  Effectif non semé : ${missing.join(', ')} — rien n'a été généré, rien n'a été dépensé.\n`)
  process.exit(1)
}
const seed = seedFromString(`${homeName}|${awayName}`)
const home: Team = { name: homeName, players: orderRosterForMatch(homePlayers!, seed) }
const away: Team = { name: awayName, players: orderRosterForMatch(awayPlayers!, seed ^ 0x9e3779b9) }
const script = buildMatchScript({
  home, away,
  competition: flag('competition') ?? 'Match amical',
  seed,
  goalTypeWeights: config.prediction?.goal_type_weights,
})

const bible = buildMatchBible({ script, home, away })
const shotSeconds = config.render?.animated?.duration_seconds ?? 5
const prompts = script.shots.map(s => buildVideoPrompt(bible, s, { durationSeconds: shotSeconds }))

// --- Fournisseur : décrit en configuration, choisi par --provider ou render.animated ---
const providerName = flag('provider')
const animatedCfg = config.render?.animated ?? {}
const providers: Record<string, ProviderConfig> = animatedCfg.providers ?? {}
const providerCfg: ProviderConfig = providerName
  ? providers[providerName]
  : (providers[animatedCfg.default_provider] ?? { provider: 'fal', model: animatedCfg.model, api_key_env: 'FAL_KEY' })

if (!providerCfg) {
  console.log(`\n⚠️  Fournisseur « ${providerName} » absent de render.animated.providers.\n`)
  process.exit(1)
}

const perClip = Number(animatedCfg.cost_per_clip_usd_estimate ?? 0)
const total = perClip * script.shots.length

console.log(`\n===== TIER ANIMATED (PAYANT) =====`)
console.log(`Match      : ${script.match.home} ${script.prediction.score.home}-${script.prediction.score.away} ${script.match.away}`)
console.log(`Fournisseur: ${providerCfg.provider}${'model' in providerCfg && providerCfg.model ? ` — ${providerCfg.model}` : ''}`)
console.log(`Clips      : ${script.shots.length} × ${shotSeconds}s = ${script.shots.length * shotSeconds}s`)
console.log(`Coût estimé: ${perClip ? `${total.toFixed(2)} $ (${perClip} $/clip)` : 'inconnu (cost_per_clip_usd_estimate absent)'}`)

if (estimateOnly) {
  console.log('\nEstimation seule — RIEN n\'a été dépensé.')
  console.log('Pour générer réellement, relance avec --yes\n')
  process.exit(0)
}

let apiKey: string
try {
  apiKey = requireApiKey(providerCfg)
} catch (err) {
  console.log(`\n⚠️  ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
}

const invoke = providerCfg.provider === 'fal'
  ? makeFalClipInvoke({ model: providerCfg.model, apiKey, onLog: m => console.log('    ' + m) })
  : makeHttpClipInvoke({ config: providerCfg as HttpProviderConfig, apiKey, onLog: m => console.log('    ' + m) })

// --- Génération plan par plan ---
const outBase = `pronoclip_${slugify(homeName)}-vs-${slugify(awayName)}_animated`
const work = resolve(OUTPUT_DIR, `${outBase}_work`)
mkdirSync(work, { recursive: true })

function portraitCutoutFor(playerName: string | null, side: string | null): string | null {
  if (!playerName || (side !== 'home' && side !== 'away')) return null
  const team = side === 'home' ? homeName : awayName
  try {
    const src = resolvePortrait(playerName, team, namespace)
    if (/^https?:\/\//i.test(src)) return null // URL distante : pas de détourage local
    const teamCode = slugifyTeam(team)
    return cutoutCached(src, resolve(DEFAULT_DATA_ROOT, '.portraits-cutout', teamCode, `${teamCode}_${slugify(playerName)}.png`))
  } catch {
    return null
  }
}

const normalized: string[] = []
for (const [i, shot] of script.shots.entries()) {
  const n = i + 1
  console.log(`\n[${n}/${script.shots.length}] ${shot.sceneType}${shot.playerName ? ` — ${shot.playerName}` : ''}`)

  const frame = buildFirstFrame({
    portraitPath: portraitCutoutFor(shot.playerName, shot.teamSide as string | null),
    background: config.brand.colors.background,
    width, height,
    outPath: resolve(work, `frame_${n}.png`),
  })

  let clipPath: string
  try {
    const res = await invoke({
      firstFrame: frame,
      videoPrompt: prompts[i].videoPrompt,
      negativePrompt: prompts[i].negativePrompt,
      durationSeconds: shotSeconds,
    })
    clipPath = await downloadClip(res.video_url, resolve(work, `clip_${n}.mp4`))
    console.log(`    clip reçu`)
  } catch (err) {
    // Un plan raté ne perd pas les précédents : on gèle sa première frame à la place.
    console.log(`    ⚠️  ${err instanceof Error ? err.message : String(err)}`)
    console.log(`    → repli : plan figé sur sa première frame (les clips déjà payés sont conservés)`)
    clipPath = resolve(work, `still_${n}.mp4`)
    const { spawnSync } = await import('node:child_process')
    const ffmpeg = (await import('ffmpeg-static')).default as unknown as string
    spawnSync(ffmpeg, ['-v', 'error', '-y', '-loop', '1', '-i', frame, '-t', String(shotSeconds),
      '-vf', `scale=${width}:${height}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', clipPath])
  }

  normalized.push(normalizeClip({
    inPath: clipPath,
    outPath: resolve(work, `norm_${n}.mp4`),
    seconds: shotSeconds, width, height,
  }))
}

// --- Concaténation puis audio (même chaîne que le tier motion) ---
const silent = concatClips(normalized, resolve(work, `${outBase}_silent.mp4`), work)
const totalMs = script.shots.length * shotSeconds * 1000
console.log(`\nMontage : ${script.shots.length} clips → ${totalMs / 1000}s`)

const narration = buildNarration(script, { shotMs: shotSeconds * 1000 })
let voicePath: string | null = null
let voiceProvider = 'aucune'
try {
  const vo = await synthesizeVoice({
    text: narration.text,
    outPathBase: resolve(work, 'vo'),
    provider: flag('voice') ?? config.voice?.tts_provider,
    voice: { elevenlabs_voice_id: config.voice?.elevenlabs_voice_id, elevenlabs_model: config.voice?.elevenlabs_model },
    log: m => console.log('  ' + m),
  })
  voicePath = vo.path
  voiceProvider = vo.provider
} catch {
  console.log('  Voix indisponible → musique + whoosh seuls.')
}

const durationSec = totalMs / 1000
const music = synthMusicBed(resolve(work, 'music.wav'), durationSec)
const whoosh = synthWhoosh(resolve(work, 'whoosh.wav'))
const cuts = script.shots.slice(1).map((_, i) => (i + 1) * shotSeconds * 1000)
const sfx = buildSfxTrack(whoosh, cuts, durationSec, resolve(work, 'sfx.wav'))

const mp4 = resolve(OUTPUT_DIR, `${outBase}.mp4`)
try {
  muxAudio({ videoSilent: silent, voice: voicePath, music, sfx, out: mp4,
    levels: { voice: 1.0, music: 0.15, sfx: 0.5 }, metadata })
} catch {
  copyFileSync(silent, mp4)
  console.log('  Audio indisponible → MP4 muet produit (jamais de blocage).')
}

console.log(`\n===== MP4 ANIMÉ (${durationSec}s, voix ${voiceProvider}) =====`)
console.log(mp4)
console.log(`Coût engagé : ~${total.toFixed(2)} $`)
if (existsSync(work)) console.log(`Intermédiaires : ${work}`)
