// SEMIS DE MASSE — construit les `index.json` d'effectifs à partir d'un dossier de
// portraits déjà générés, organisé `<Équipe>/<Nom du joueur>.png`.
//
// Le chemin source est un ARGUMENT (jamais en dur : garde-fou « aucune donnée client
// dans le code »). Les PNG ne sont PAS copiés — `portrait` pointe en chemin ABSOLU vers
// le fichier source, ce que le schéma autorise explicitement (relatif, URL https, ou
// absolu). Aucun gigaoctet dupliqué, et le champ se remplacera par l'URL RapidoCMS
// publique une fois les portraits téléversés.
//
//   npx tsx scripts/seed-squads-from-folder.ts "<dossier>"            → semis (idempotent)
//   npx tsx scripts/seed-squads-from-folder.ts "<dossier>" --dry-run  → simulation
//   npx tsx scripts/seed-squads-from-folder.ts "<dossier>" --force    → réécrit l'existant
//
// Idempotence : une équipe déjà semée n'est jamais réécrite sans --force. France est
// curée à la main (postes + entraîneur) — elle est donc préservée par défaut.

import { readdirSync, statSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve, extname, basename } from 'node:path'
import type { Position } from '../core/types'
import { slugifyTeam, SQUAD_SCHEMA, DEFAULT_DATA_ROOT, type SquadFile, type SquadPlayerEntry } from '../adapters/squad-library'

const args = process.argv.slice(2)
const sourceDir = args.find(a => !a.startsWith('--'))
const dryRun = args.includes('--dry-run')
const force = args.includes('--force')
const namespace = args.find(a => a.startsWith('--namespace='))?.split('=')[1] ?? 'pronoclip'
// Dossiers à ignorer (copies de travail, brouillons) — passés en argument, jamais en dur.
const excluded = new Set(
  (args.find(a => a.startsWith('--exclude='))?.split('=').slice(1).join('=') ?? '')
    .split(',').map(s => s.trim()).filter(Boolean),
)

if (!sourceDir) {
  console.error('Usage : npx tsx scripts/seed-squads-from-folder.ts "<dossier>" [--dry-run] [--force] [--namespace=<marque>]')
  process.exit(2)
}
const root = resolve(sourceDir)
if (!existsSync(root)) {
  console.error(`Dossier introuvable : ${root}`)
  process.exit(2)
}

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp'])

/**
 * Poste par défaut quand la source ne le fournit pas. Le dossier de portraits ne porte
 * QUE des noms de fichiers — aucun poste, aucun profil. On écrit donc un poste neutre
 * plutôt que d'inventer : le moteur retombe sur ses pondérations par défaut. À enrichir
 * (postes réels, joueurs clés, entraîneurs) quand une source de données existera.
 */
const DEFAULT_POSITION = 'MF' as const

// ---------------------------------------------------------------------------
// Enrichissement optionnel : postes réels depuis des CSV d'effectifs
// ---------------------------------------------------------------------------

/** Dossier de CSV `<team_code>_squad.csv` (colonnes `Full Name`, `Position`). */
const squadsCsvDir = args.find(a => a.startsWith('--squads-csv='))?.split('=').slice(1).join('=')

/** Libellé de poste de la source → poste du moteur. `coach` n'est pas un poste. */
const POSITION_MAP: Record<string, Position> = {
  keepers: 'GK', keeper: 'GK', goalkeepers: 'GK', goalkeeper: 'GK',
  defenders: 'DF', defender: 'DF', defence: 'DF', defense: 'DF',
  midfielders: 'MF', midfielder: 'MF',
  attackers: 'FW', attacker: 'FW', forwards: 'FW', forward: 'FW',
}

/** Accents et ponctuation retirés — les PNG sont nommés sans accents, pas les CSV. */
function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/['’]/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
}

interface SourceEntry { position?: Position; isCoach: boolean }

/** Lit un CSV d'effectif → index `nom normalisé → poste`. Renvoie null si absent/illisible. */
function loadSquadCsv(teamCode: string): Map<string, SourceEntry> | null {
  if (!squadsCsvDir) return null
  const path = join(resolve(squadsCsvDir), `${teamCode}_squad.csv`)
  if (!existsSync(path)) return null
  const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return null
  const header = lines[0].split(',')
  const iName = header.indexOf('Full Name')
  const iPos = header.indexOf('Position')
  if (iName < 0 || iPos < 0) return null
  const out = new Map<string, SourceEntry>()
  for (const line of lines.slice(1)) {
    // CSV simple (pas de champ cité contenant une virgule dans ces colonnes).
    const cells = line.split(',')
    const name = cells[iName]?.trim()
    const raw = cells[iPos]?.trim().toLowerCase()
    if (!name) continue
    out.set(normalizeName(name), { position: POSITION_MAP[raw ?? ''], isCoach: raw === 'coach' })
  }
  return out
}

/** Marque déposée par ce script dans les fichiers qu'il produit. */
const GENERATOR = 'seed-squads-from-folder'

/**
 * Un effectif que CE script n'a pas écrit est réputé curé à la main et n'est JAMAIS
 * réécrit, même avec --force : la curation humaine prime toujours. La détection repose
 * sur la marque `generated_by` — se fier à la présence d'un profil produirait un faux
 * positif dès la seconde exécution, ce script en écrivant lui-même (tireurs désignés).
 */
function isHandCurated(file: string): boolean {
  try {
    const sq = JSON.parse(readFileSync(file, 'utf8')) as SquadFile & { generated_by?: string }
    return sq.generated_by !== GENERATOR
  } catch {
    return true // illisible → on ne détruit pas, on préserve
  }
}

const teams = readdirSync(root, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .sort()

console.log(`Source   : ${root}`)
console.log(`Namespace: ${namespace}`)
console.log(`Équipes  : ${teams.length}${dryRun ? '   [SIMULATION — rien n\'est écrit]' : ''}\n`)

let seeded = 0
let skipped = 0
let totalPlayers = 0

for (const team of teams) {
  if (excluded.has(team)) {
    console.log(`  ⊘  ${team.padEnd(22)} exclue (--exclude)`)
    continue
  }
  const teamCode = slugifyTeam(team)
  const outDir = join(DEFAULT_DATA_ROOT, 'squads', namespace, teamCode)
  const outFile = join(outDir, 'index.json')

  const files = readdirSync(join(root, team))
    .filter(f => IMAGE_EXT.has(extname(f).toLowerCase()))
    .filter(f => statSync(join(root, team, f)).isFile())
    .sort()

  if (files.length === 0) {
    console.log(`  —  ${team.padEnd(22)} aucun portrait, ignorée`)
    continue
  }

  if (existsSync(outFile) && !force) {
    console.log(`  ·  ${team.padEnd(22)} déjà semée (${files.length} portraits en source) — préservée`)
    skipped++
    continue
  }
  if (existsSync(outFile) && force && isHandCurated(outFile)) {
    console.log(`  ★  ${team.padEnd(22)} curée à la main — préservée malgré --force`)
    skipped++
    continue
  }

  const source = loadSquadCsv(teamCode)
  let matched = 0

  const players: SquadPlayerEntry[] = files.map(f => {
    const name = basename(f, extname(f))
    const entry = source?.get(normalizeName(name))
    if (entry) matched++
    // Entraîneur/staff : présent pour son portrait, JAMAIS choisi comme buteur.
    if (entry?.isCoach) {
      return { name, role: 'coach' as const, portrait: join(root, team, f) }
    }
    return {
      name,
      position: entry?.position ?? DEFAULT_POSITION,
      portrait: join(root, team, f), // chemin ABSOLU — remplacé par l'URL RapidoCMS après téléversement
    }
  })

  // Tireurs désignés. Sans eux, `16 × setPieces` et le penalty conditionnel valent 0 :
  // coup franc et penalty seraient IMPOSSIBLES pour toute l'équipe. La réalité veut
  // un seul tireur attitré par équipe — on en désigne donc un de chaque, de façon
  // déterministe (premier attaquant, premier milieu). Valeur provisoire, écrasée par
  // une curation manuelle ultérieure.
  if (source) {
    const penaltyTaker = players.find(p => p.position === 'FW') ?? players.find(p => p.position === 'MF')
    if (penaltyTaker) penaltyTaker.profile = { ...penaltyTaker.profile, isPenaltyTaker: true }
    const freeKickTaker = players.find(p => p.position === 'MF' && p !== penaltyTaker)
      ?? players.find(p => p.position === 'FW' && p !== penaltyTaker)
    if (freeKickTaker) freeKickTaker.profile = { ...freeKickTaker.profile, setPieces: 0.75 }
  }

  const squad: SquadFile & { generated_by: string } = {
    $schema: SQUAD_SCHEMA,
    namespace,
    team,
    team_code: teamCode,
    seeded_at: new Date().toISOString().slice(0, 10),
    generated_by: GENERATOR, // absent = curé à la main → jamais réécrit (voir isHandCurated)
    players,
  }

  if (!dryRun) {
    mkdirSync(outDir, { recursive: true })
    writeFileSync(outFile, JSON.stringify(squad, null, 2) + '\n', 'utf8')
  }
  const coaches = players.filter(p => p.role === 'coach').length
  const detail = source
    ? `postes ${matched}/${players.length}${coaches ? `, ${coaches} entraîneur(s)` : ''}`
    : 'sans postes (noms seuls)'
  console.log(`  ✓  ${team.padEnd(22)} ${String(players.length).padStart(3)} joueurs → ${teamCode.padEnd(20)} ${detail}`)
  seeded++
  totalPlayers += players.length
}

console.log(`\nSemées : ${seeded}   Préservées : ${skipped}   Joueurs écrits : ${totalPlayers}`)
if (dryRun) console.log('SIMULATION — relance sans --dry-run pour écrire.')
