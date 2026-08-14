// PLAN DE PUBLICATION RapidoCMS pour un match QUELCONQUE (cf. MISSION §6).
//
//   npm run publish-video -- Algeria Morocco
//   npm run publish-video -- Algeria Morocco --at="2026-08-20 18:00"   (planifié)
//   npm run publish-video -- Algeria Morocco --video=chemin/vers.mp4
//
// Ce script n'appelle JAMAIS le MCP : il compose le plan (légende avec mention IA §7,
// compte cible, planification) et imprime les arguments EXACTS des trois outils à
// appeler. C'est l'AGENT de la routine planifiée qui exécute ensuite
// upload_file_tool → create_draft_tool → schedule_draft_tool.
//
// Le compte cible vient de `.env` (RAPIDOCMS_ACCOUNT_ID) — aucun identifiant client
// n'est codé en dur.
//
// La prédiction est rejouée avec LA MÊME GRAINE que `npm run match` : la légende décrit
// donc exactement le score et les buteurs de la vidéo rendue, jamais un autre tirage.

import 'dotenv/config'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Player, Team } from '../core/types'
import { seedFromString } from '../core/rng'
import { buildMatchScript } from '../core/match-script'
import { loadRoster } from '../adapters/squad-library'
import { buildPublishPlan, makePublisher, makeLogTransport, type SocialType } from '../adapters/rapidocms'
import { OUTPUT_DIR, CONFIG_PATH, slugify, orderRosterForMatch } from './render-pipeline'

const argv = process.argv.slice(2)
const flag = (n: string) => {
  const eq = argv.find(a => a.startsWith(`--${n}=`))
  if (eq) return eq.split('=').slice(1).join('=')
  const i = argv.indexOf(`--${n}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const positional: string[] = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a.startsWith('--')) { if (!a.includes('=')) i++; continue }
  positional.push(a)
}
const [homeName, awayName] = positional

if (!homeName || !awayName) {
  console.log('Usage : npm run publish-video -- <domicile> <extérieur> [--at="YYYY-MM-DD HH:MM"] [--video=<mp4>]')
  console.log('        [--competition="…"] [--score=H-A] [--social=instagram|facebook|linkedin|tiktok] [--account=<id>]')
  process.exit(2)
}

const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
const namespace = flag('namespace') ?? config.brand?.namespace ?? 'pronoclip'

function rosterOrNull(team: string): Player[] | null {
  try { return loadRoster(team, namespace) } catch { return null }
}
const homePlayers = rosterOrNull(homeName)
const awayPlayers = rosterOrNull(awayName)
const missing = [...(homePlayers ? [] : [homeName]), ...(awayPlayers ? [] : [awayName])]
if (missing.length > 0) {
  console.log(`\n⚠️  Effectif non semé pour : ${missing.join(', ')} — impossible de décrire le match.\n`)
  process.exit(1)
}

const scoreArg = flag('score')
let score: { home: number; away: number } | undefined
if (scoreArg) {
  if (!/^\d+-\d+$/.test(scoreArg)) {
    console.log(`\n⚠️  Score « ${scoreArg} » mal formé (attendu H-A).\n`)
    process.exit(1)
  }
  const [h, a] = scoreArg.split('-').map(Number)
  score = { home: h, away: a }
}

// MÊME graine ET MÊME ordre d'effectif que le rendu (`orderRosterForMatch`, appliqué
// dans render-pipeline). Sans ce mélange identique, le moteur désignerait d'AUTRES
// buteurs : la légende annoncerait des noms absents de la vidéo. Désynchronisation
// effectivement observée avant correction.
const seed = seedFromString(`${homeName}|${awayName}`)
const home: Team = { name: homeName, players: orderRosterForMatch(homePlayers!, seed) }
const away: Team = { name: awayName, players: orderRosterForMatch(awayPlayers!, seed ^ 0x9e3779b9) }
const script = buildMatchScript({
  home, away,
  competition: flag('competition') ?? 'Match amical',
  seed,
  score,
  goalTypeWeights: config.prediction?.goal_type_weights,
})

// Vidéo : celle produite par `npm run match` pour cette affiche, sauf indication contraire.
const outBase = `pronoclip_${slugify(homeName)}-vs-${slugify(awayName)}`
const videoPath = resolve(flag('video') ?? resolve(OUTPUT_DIR, `${outBase}.mp4`))
if (!existsSync(videoPath)) {
  console.log(`\n⚠️  Vidéo introuvable : ${videoPath}`)
  console.log(`   Produis-la d'abord :  npm run match -- ${homeName} ${awayName}\n`)
  process.exit(1)
}

// Planification : "YYYY-MM-DD HH:MM" → date + heure H:i:s. Absente = brouillon non planifié.
const at = flag('at')
let schedule: { date: string; heure: string } | null = null
if (at) {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(at.trim())
  if (!m) {
    console.log(`\n⚠️  Date « ${at} » mal formée (attendu "YYYY-MM-DD HH:MM").\n`)
    process.exit(1)
  }
  // Heure au format H:i:s — le schéma MCP annonce « H-i-s » à tort, le serveur exige
  // les DEUX-POINTS (vérifié en réel en Phase 3).
  schedule = { date: m[1], heure: `${m[2]}:${m[3]}:${m[4] ?? '00'}` }
}

let plan
try {
  plan = buildPublishPlan({
    home: script.match.home,
    away: script.match.away,
    score: script.prediction.score,
    competition: script.match.competition,
    scorers: script.prediction.goals.map(g => g.playerName),
    aiDisclosure: config.ai_disclosure?.metadata ?? '',
    accountId: flag('account') ?? process.env.RAPIDOCMS_ACCOUNT_ID ?? '',
    socialType: (flag('social') as SocialType | undefined) ?? (process.env.RAPIDOCMS_SOCIAL_TYPE as SocialType | undefined),
    schedule,
  })
} catch (err) {
  console.log(`\n⚠️  ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
}

const fileName = `${outBase}.mp4`

console.log('\n===== PLAN DE PUBLICATION =====')
console.log('Match    :', `${script.match.home} ${script.prediction.score.home}-${script.prediction.score.away} ${script.match.away}`)
console.log('Compte   :', plan.socialType, plan.accountId)
console.log('Média    :', videoPath)
console.log('Planif   :', plan.schedule ? `${plan.schedule.date} ${plan.schedule.heure}` : 'brouillon non planifié')
console.log('Légende  :\n' + plan.caption)

console.log('\n----- Appels MCP à exécuter par l\'agent (DRY-RUN, rien n\'est appelé ici) -----')
const dryRun = makePublisher(makeLogTransport(m => console.log('  ' + m)), plan)
await dryRun('<URL_PUBLIQUE_DU_MP4>', fileName)

mkdirSync(OUTPUT_DIR, { recursive: true })
const planPath = resolve(OUTPUT_DIR, `publish-plan_${outBase}.json`)
writeFileSync(planPath, JSON.stringify({ plan, fileName, videoPath }, null, 2), 'utf8')
console.log('\nPlan écrit :', planPath)
console.log('→ `upload_file_tool` exige une URL PUBLIQUE : exposer le MP4 (scripts/tunnel.mjs)')
console.log('  ou le téléverser au préalable, puis enchaîner create_draft_tool et schedule_draft_tool.')
