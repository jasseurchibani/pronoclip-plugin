// MODE OPTIONNEL « matchs du jour » — récupère les matchs RÉELS via le webhook n8n,
// les affiche numérotés, puis rend la vidéo du match choisi.
//
// Deux temps (jamais de choix à ta place) :
//   npm run today                      → liste les matchs du jour, puis s'arrête
//   npm run today -- --pick 3          → rend le match n° 3 de cette liste
//   npm run today -- --fixture 12345   → idem par fixtureId (stable si la liste bouge)
//
// Options : --leagues 39,140  --score 2-1  --voice=elevenlabs (opt-in payant)
//
// Ce mode est OPTIONNEL et ADDITIF : le chemin hors-ligne
// (`npm run render`, `/pronoclip-match France Espagne`) ne dépend ni du réseau ni de n8n.
// En cas d'échec (URL absente, réseau, compte API suspendu, count: 0), on affiche un
// message clair et on renvoie vers la saisie manuelle. Jamais de crash.
//
// La prédiction reste LOCALE : n8n fournit le match, jamais le score ni les buteurs.

import 'dotenv/config' // charge .env (N8N_FIXTURES_WEBHOOK)
import type { Player, Team } from '../core/types'
import { seedFromString } from '../core/rng'
import { loadRoster } from '../adapters/squad-library'
import {
  fetchTodayFixtures, formatFixtureList, formatLeagues,
  type FixturesFailure, type N8nFixture,
} from '../adapters/n8n-fixtures'
import { renderMatchVideo, slugify } from './render-pipeline'

const argv = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const eq = argv.find(a => a.startsWith(`--${name}=`))
  if (eq) return eq.split('=').slice(1).join('=')
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}

const MANUAL_HINT =
  'Repli — mode saisie manuelle (hors-ligne, sans n8n) :\n' +
  '  npm run render                       → France vs Espagne (démo semée)\n' +
  '  npm run demo                         → match fictif, zéro config\n' +
  '  /pronoclip-match <domicile> <extérieur> [score] [compétition]'

/** Message d'échec lisible + repli explicite. Aucun stack trace, aucun blocage. */
function reportFailure(outcome: FixturesFailure): void {
  console.log(`\n⚠️  Matchs du jour indisponibles — ${outcome.reason}`)
  console.log(`   ${outcome.message}`)

  if (outcome.reason === 'not-configured') {
    console.log('\n   Pour l\'activer : renseigne N8N_FIXTURES_WEBHOOK dans .env (voir .env.example).')
  }
  if (outcome.reason === 'no-fixtures') {
    if (outcome.leaguesFilter?.length) {
      console.log(`\n   Filtre de ligues appliqué : ${outcome.leaguesFilter.join(', ')}`)
    }
    console.log('\n   Ligues disponibles :')
    console.log(formatLeagues(outcome.availableLeagues))
    console.log('\n   Relancer avec d\'autres ligues :  npm run today -- --leagues 39,140')
    if (outcome.apiErrors && Object.keys(outcome.apiErrors).length > 0) {
      console.log('\n   ⚠️  Le workflow signale une erreur en amont — changer de ligues n\'y changera rien :')
      for (const [k, v] of Object.entries(outcome.apiErrors)) console.log(`      ${k}: ${v}`)
    }
  }
  console.log(`\n${MANUAL_HINT}\n`)
}

/**
 * Effectif d'une équipe depuis la bibliothèque semée. L'effectif est une ENTRÉE :
 * on ne fabrique jamais de joueurs pour une équipe inconnue (cf. MISSION §6).
 */
function rosterOrNull(team: string): Player[] | null {
  try {
    return loadRoster(team, 'pronoclip')
  } catch {
    return null
  }
}

async function main(): Promise<number> {
  const leagues = flag('leagues')?.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n))
  const outcome = await fetchTodayFixtures({ leagues })

  if (!outcome.ok) {
    reportFailure(outcome)
    return 1
  }

  console.log(`\n===== Matchs du jour — ${outcome.date ?? '?'} (${outcome.timezone ?? 'fuseau inconnu'}) =====`)
  console.log(formatFixtureList(outcome.fixtures))
  if (outcome.skipped > 0) {
    console.log(`\n  (${outcome.skipped} match(s) ignoré(s) : forme de réponse inattendue)`)
  }

  const pickArg = flag('pick')
  const fixtureArg = flag('fixture')
  if (!pickArg && !fixtureArg) {
    console.log('\nChoisis un match, puis relance :')
    console.log('  npm run today -- --pick <numéro>')
    console.log('  npm run today -- --fixture <fixtureId>\n')
    return 0
  }

  let chosen: N8nFixture | undefined
  if (fixtureArg) {
    chosen = outcome.fixtures.find(f => f.fixtureId === fixtureArg)
    if (!chosen) {
      console.log(`\n⚠️  fixtureId « ${fixtureArg} » absent de la liste ci-dessus. Rien n'a été généré.\n`)
      return 1
    }
  } else {
    const n = Number(pickArg)
    if (!Number.isInteger(n) || n < 1 || n > outcome.fixtures.length) {
      console.log(`\n⚠️  Numéro invalide : « ${pickArg} ». Attendu entre 1 et ${outcome.fixtures.length}. Rien n'a été généré.\n`)
      return 1
    }
    chosen = outcome.fixtures[n - 1]
  }

  console.log(`\n===== Match choisi =====`)
  console.log(`${chosen.kickoff || '--:--'}  ${chosen.competition}  —  ${chosen.home} vs ${chosen.away}  [${chosen.fixtureId}]`)

  // Effectifs : requis pour attribuer les buteurs. Absents → repli explicite, pas d'invention.
  const homePlayers = rosterOrNull(chosen.home)
  const awayPlayers = rosterOrNull(chosen.away)
  const missing = [
    ...(homePlayers ? [] : [chosen.home]),
    ...(awayPlayers ? [] : [chosen.away]),
  ]
  if (missing.length > 0) {
    console.log(`\n⚠️  Effectif non semé pour : ${missing.join(', ')}`)
    console.log('   Les buteurs sont une ENTRÉE du moteur, jamais une invention du modèle.')
    console.log(`\n   Semer l'effectif :  ${missing.map(t => `/pronoclip-squad ${t}`).join('\n                       ')}`)
    console.log(`\n${MANUAL_HINT}\n`)
    return 1
  }

  const scoreArg = flag('score')
  let score: { home: number; away: number } | undefined
  if (scoreArg) {
    if (!/^\d+-\d+$/.test(scoreArg)) {
      console.log(`\n⚠️  Score « ${scoreArg} » mal formé (attendu H-A, ex. 2-1). Rien n'a été généré.\n`)
      return 1
    }
    const [h, a] = scoreArg.split('-').map(Number)
    score = { home: h, away: a }
  }

  const home: Team = { name: chosen.home, players: homePlayers!, colors: { primary: 'royal blue', secondary: 'white' } }
  const away: Team = { name: chosen.away, players: awayPlayers!, colors: { primary: 'crimson', secondary: 'white' } }
  const outBase = `pronoclip_${slugify(chosen.home)}-vs-${slugify(chosen.away)}`

  const voiceArg = argv.find(a => a.startsWith('--voice='))?.split('=')[1]
  const { mp4, script, durationMs } = await renderMatchVideo({
    home, away, competition: chosen.competition,
    seed: seedFromString(`${chosen.fixtureId}|${chosen.home}|${chosen.away}`),
    score, outBase,
    voiceProvider: voiceArg as never,
    log: m => console.log(m),
  })

  console.log(`\n===== MP4 FINAL (${Math.round(durationMs / 1000)} s, tier motion gratuit) =====`)
  console.log(`${script.match.home} ${script.prediction.score.home}-${script.prediction.score.away} ${script.match.away}` +
    `  — score ${script.prediction.autoGenerated.score ? 'PRÉDIT' : 'imposé'} par le moteur LOCAL`)
  console.log(mp4)
  return 0
}

// Aucune exception ne remonte : on préfère un message clair et un code de sortie.
main()
  .then(code => { process.exitCode = code })
  .catch((err: unknown) => {
    console.log(`\n⚠️  Échec inattendu : ${err instanceof Error ? err.message : String(err)}`)
    console.log(`\n${MANUAL_HINT}\n`)
    process.exitCode = 1
  })
