// Rendu vidéo LOCAL et GRATUIT (cf. MISSION §8). Assemblage complet :
//   composition HTML (overlays §8) → capture Chrome headless → vidéo muette →
//   narration → voix off (cascade TTS gratuite/opt-in) + lit musical + whoosh aux coupes →
//   mux → MP4 final (filigrane IA + carton + métadonnées).
// JAMAIS le MCP payant render_video. Le HOOK BLOQUANT (mention IA) s'exécute AVANT tout.
// Par défaut : panneaux générés (aucun asset, aucune config) ; --images = jeu B3 existant.
// Voix : GRATUITE par défaut (SAPI fr-FR local) ; --voice=elevenlabs = opt-in payant.

import 'dotenv/config' // charge .env (ELEVENLABS_API_KEY pour la voix premium opt-in)
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMatchScript } from '../core/match-script'
import { buildComposition } from '../core/composition'
import { buildNarration } from '../core/narration'
import { assertDisclosure, buildVideoMetadata } from '../core/render-guard'
import { synthesizeVoice, type TtsProvider } from '../adapters/tts'
import { synthMusicBed, synthWhoosh, buildSfxTrack, muxAudio } from '../adapters/audio-mux'
import { renderHtmlToSilentMp4, writeCompositionHtml } from '../adapters/local-render'
import { france, espagne, EXAMPLE_SEED } from './example-teams'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../pronoclip-output')
const config = JSON.parse(readFileSync(resolve(here, '../pronoclip.config.json'), 'utf8'))
mkdirSync(out, { recursive: true })

// 1) HOOK BLOQUANT — refuse le rendu si la mention IA est absente/vide (§7).
assertDisclosure(config)
const metadata = buildVideoMetadata(config, config.image?.mode)
console.log('Mention IA OK. Métadonnées :', metadata)

// 2) Script France vs Espagne (source de vérité = bibliothèque).
const script = buildMatchScript({ home: france, away: espagne, competition: 'Ligue des Nations', seed: EXAMPLE_SEED })
console.log(`Match : ${script.match.home} ${script.prediction.score.home}-${script.prediction.score.away} ${script.match.away}`)

// 3) Images : par défaut panneaux générés (aucun asset) ; --images = jeu B3 existant.
const useImages = process.argv.includes('--images')
const images = useImages
  ? [
      'b3_plan1_team_reveal.jpg', 'b3_plan2_rival_reveal.jpg', 'b3_plan3_face_off.jpg',
      'b3_plan4_goal_mbappe.jpg', 'b3_plan5_goal_vinicius.jpg', 'b3_plan6_gk_save.jpg',
      'b3_plan7_celebration.jpg', 'b3_plan8_final_result.jpg',
    ]
  : script.shots.map(() => '') // '' → panneau généré

// 4) Composition HTML + rendu local → MP4 muet (Chrome + ffmpeg, adaptateur partagé).
const body = buildComposition({ script, images, config })
const htmlPath = writeCompositionHtml(resolve(out, 'preview.html'), body, config.brand.colors.background)
console.log('Composition écrite :', htmlPath)
const { path: silent, durationMs: totalMs } = await renderHtmlToSilentMp4({
  htmlPath,
  outPath: resolve(out, 'pronoclip_france-vs-espagne_silent.mp4'),
  log: m => console.log(m),
})
console.log('Vidéo muette :', silent)

// 6) AUDIO — narration → voix (cascade) + lit musical + whoosh aux coupes.
const shotMs = config.video.scene_length_seconds * 1000
const narration = buildNarration(script, { shotMs })
console.log(`\nNarration (${narration.chars} car.) : "${narration.text}"`)

const voiceArg = process.argv.find(a => a.startsWith('--voice='))
const provider = (voiceArg ? voiceArg.split('=')[1] : config.voice?.tts_provider) as TtsProvider | undefined
const vo = await synthesizeVoice({
  text: narration.text,
  outPathBase: resolve(out, 'vo_pronoclip'),
  provider,
  voice: { elevenlabs_voice_id: config.voice?.elevenlabs_voice_id, elevenlabs_model: config.voice?.elevenlabs_model },
  log: m => console.log('  ' + m),
})
console.log(`Voix off : ${vo.provider} → ${vo.path}`)

const durationSec = totalMs / 1000
const music = synthMusicBed(resolve(out, 'bed_music.wav'), durationSec, m => console.log('  ' + m))
const whoosh = synthWhoosh(resolve(out, 'sfx_whoosh.wav'), m => console.log('  ' + m))
const cuts = script.shots.slice(1).map((_, i) => (i + 1) * shotMs) // coupes = frontières de plans
const sfx = buildSfxTrack(whoosh, cuts, durationSec, resolve(out, 'sfx_track.wav'), m => console.log('  ' + m))

// 7) Mux final (voix −0 dB, lit musical ducké ≈ −16 dB, whoosh moyen) + métadonnées.
// Nom suffixé par le provider effectif → MP4 gratuit (défaut) et premium coexistent.
const mp4 = resolve(out, `pronoclip_france-vs-espagne${vo.provider === 'elevenlabs' ? '_elevenlabs' : ''}.mp4`)
muxAudio({
  videoSilent: silent, voice: vo.path, music, sfx, out: mp4,
  levels: { voice: 1.0, music: 0.15, sfx: 0.5 },
  metadata,
  log: m => console.log('  ' + m),
})

console.log('\n===== MP4 FINAL =====')
console.log(mp4)
