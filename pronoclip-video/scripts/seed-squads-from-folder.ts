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

import { readdirSync, statSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve, extname, basename } from 'node:path'
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

  const players: SquadPlayerEntry[] = files.map(f => ({
    name: basename(f, extname(f)),
    position: DEFAULT_POSITION,
    portrait: join(root, team, f), // chemin ABSOLU — remplacé par l'URL RapidoCMS après téléversement
  }))

  const squad: SquadFile = {
    $schema: SQUAD_SCHEMA,
    namespace,
    team,
    team_code: teamCode,
    seeded_at: new Date().toISOString().slice(0, 10),
    players,
  }

  if (!dryRun) {
    mkdirSync(outDir, { recursive: true })
    writeFileSync(outFile, JSON.stringify(squad, null, 2) + '\n', 'utf8')
  }
  console.log(`  ✓  ${team.padEnd(22)} ${String(players.length).padStart(3)} joueurs → ${teamCode}`)
  seeded++
  totalPlayers += players.length
}

console.log(`\nSemées : ${seeded}   Préservées : ${skipped}   Joueurs écrits : ${totalPlayers}`)
if (dryRun) console.log('SIMULATION — relance sans --dry-run pour écrire.')
