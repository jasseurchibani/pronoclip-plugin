// Prépare la publication RapidoCMS (BROUILLON + planification) — cf. MISSION §6.
// Ce script est PUR côté transport : il construit le plan (légende avec mention IA §7,
// compte cible, planning) et démontre l'orchestration en DRY-RUN (transport journalisé).
// Il n'appelle JAMAIS le MCP : en Claude Code, l'agent exécute les appels MCP réels
// (upload_file_tool → create_draft_tool → schedule_draft_tool) avec le plan écrit ici.
// Lancer : `npm run publish`.

import 'dotenv/config'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMatchScript } from '../core/match-script'
import { buildCaption, makePublisher, makeLogTransport, type PublishPlan } from '../adapters/rapidocms'
import { france, espagne, EXAMPLE_SEED } from './example-teams'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../pronoclip-output')
mkdirSync(out, { recursive: true })
const config = JSON.parse(readFileSync(resolve(here, '../pronoclip.config.json'), 'utf8'))

const script = buildMatchScript({ home: france, away: espagne, competition: 'Ligue des Nations', seed: EXAMPLE_SEED })
const scorers = script.prediction.goals.map(g => g.playerName).join(', ')
const base =
  `🔮 Pronostic PronoClip — ${script.match.home} ${script.prediction.score.home}-${script.prediction.score.away} ` +
  `${script.match.away} (${script.match.competition}).` + (scorers ? ` Buts : ${scorers}.` : '')
// Mention IA OBLIGATOIRE dans la légende (§7) — garantie par buildCaption.
const caption = buildCaption(base, config.ai_disclosure?.metadata ?? '')

// Compte cible : Instagram BraindCode (9:16 naturel). NB : TikTok BraindCode est EXPIRÉ
// (le réseau naturel du 9:16), à reconnecter ; on publie donc en brouillon sur Instagram.
const plan: PublishPlan = {
  postName: 'PronoClip — France vs Espagne (test pipeline)',
  socialType: 'instagram',
  accountId: '17841401924902629', // BraindCode Instagram (compte connecté, actif)
  postType: 'media',
  mediaType: 'video',
  caption,
  // Semaine du 27 juillet 2026 (lundi 18h). Format heure = H:i:s (le schéma MCP annonce
  // H-i-s à tort ; le serveur REFUSE les tirets et exige les deux-points — vérifié en réel).
  schedule: { date: '2026-07-27', heure: '18:00:00' },
}

const fileName = 'pronoclip_france-vs-espagne_elevenlabs.mp4'

console.log('===== PLAN DE PUBLICATION (BROUILLON + planification) =====')
console.log('Compte   :', plan.socialType, plan.accountId, '(BraindCode)')
console.log('Média    :', fileName, `(${plan.mediaType})`)
console.log('Planif   :', plan.schedule?.date, plan.schedule?.heure)
console.log('Légende  :\n' + caption)
console.log('\n----- Orchestration (DRY-RUN — aucun MCP appelé ici) -----')
const dryRun = makePublisher(makeLogTransport(m => console.log('  ' + m)), plan)
await dryRun('<URL_PUBLIQUE>/' + fileName, fileName)

writeFileSync(resolve(out, 'publish-plan.json'), JSON.stringify({ plan, fileName }, null, 2), 'utf8')
console.log('\nPlan écrit : pronoclip-output/publish-plan.json')
console.log('→ L\'agent exécute ensuite les 3 appels MCP réels avec ces valeurs (transport injecté).')
