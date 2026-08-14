// Rendu vidéo LOCAL et GRATUIT (cf. MISSION §8) — chemin SAISIE MANUELLE, hors-ligne.
// Aucun réseau, aucun webhook : match de test France vs Espagne, effectif lu dans la
// bibliothèque semée. C'est le chemin de test rapide, il ne dépend jamais de n8n.
//
// La chaîne de rendu (composition → Chrome headless → voix + musique + whoosh → mux)
// vit dans scripts/render-pipeline.ts, partagée avec le mode « matchs du jour ».
// JAMAIS le MCP payant render_video. Le HOOK BLOQUANT (mention IA) s'exécute AVANT tout.
//
// Par défaut : panneaux générés (aucun asset, aucune config) ; --images = jeu B3 existant.
// Voix : GRATUITE par défaut (SAPI fr-FR local) ; --voice=elevenlabs = opt-in payant.

import 'dotenv/config' // charge .env (ELEVENLABS_API_KEY pour la voix premium opt-in)
import type { TtsProvider } from '../adapters/tts'
import { france, espagne, EXAMPLE_SEED } from './example-teams'
import { renderMatchVideo } from './render-pipeline'

const useImages = process.argv.includes('--images')
const images = useImages
  ? [
      'b3_plan1_team_reveal.jpg', 'b3_plan2_rival_reveal.jpg', 'b3_plan3_face_off.jpg',
      'b3_plan4_goal_mbappe.jpg', 'b3_plan5_goal_vinicius.jpg', 'b3_plan6_gk_save.jpg',
      'b3_plan7_celebration.jpg', 'b3_plan8_final_result.jpg',
    ]
  : undefined // undefined → panneaux générés pour chaque plan

const voiceArg = process.argv.find(a => a.startsWith('--voice='))
const voiceProvider = (voiceArg ? voiceArg.split('=')[1] : undefined) as TtsProvider | undefined

const { mp4, durationMs } = await renderMatchVideo({
  home: france,
  away: espagne,
  competition: 'Ligue des Nations',
  seed: EXAMPLE_SEED,
  outBase: 'pronoclip_france-vs-espagne',
  images,
  voiceProvider,
  log: m => console.log(m),
})

console.log(`\n===== MP4 FINAL (${Math.round(durationMs / 1000)} s) =====`)
console.log(mp4)
