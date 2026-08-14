// SEMIS AUTOMATIQUE DES PORTRAITS MANQUANTS — pour une équipe, complète les joueurs
// présents dans l'effectif source mais sans portrait, dans le style EXACT de la
// bibliothèque (même prompt, même modèle, mêmes références visage + maillot).
//
//   npm run seed-missing -- Algeria --max=1
//   npm run seed-missing -- Algeria --dry-run
//
// ⚠️ CHAQUE portrait généré est un appel PAYANT. `--max` borne la dépense (défaut 1) :
// une faute de frappe ne peut pas déclencher cinquante générations.
//
// Le visage vient du cache local s'il existe, sinon il est téléchargé depuis l'URL CDN
// portée par le CSV d'effectif. Le portrait produit est écrit au même endroit et sous le
// même nom que les autres (`<Équipe>/<Nom complet>.png`), puis ajouté à l'index.
//
// Chemins des sources : ARGUMENTS ou variables d'env — jamais en dur.

import 'dotenv/config'
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Position } from '../core/types'
import { slugifyTeam, squadFilePath, DEFAULT_DATA_ROOT, type SquadFile, type SquadPlayerEntry } from '../adapters/squad-library'
import { generatePortrait, PORTRAIT_MODEL, PORTRAIT_QUALITY, PORTRAIT_SIZE } from '../adapters/portrait-generator'

const argv = process.argv.slice(2)
const flag = (n: string) => argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=')
const teamName = argv.find(a => !a.startsWith('--'))
const dryRun = argv.includes('--dry-run')
const max = Number(flag('max') ?? 1)

const portraitsDir = flag('portraits') ?? process.env.PRONOCLIP_PORTRAITS_DIR
const facesDir = flag('faces') ?? process.env.PRONOCLIP_FACES_DIR
const kitsDir = flag('kits') ?? process.env.PRONOCLIP_KITS_DIR
const csvDir = flag('squads-csv') ?? process.env.PRONOCLIP_SQUADS_CSV_DIR

if (!teamName || !portraitsDir || !kitsDir || !csvDir) {
  console.log('Usage : npm run seed-missing -- <Équipe> [--max=N] [--dry-run]')
  console.log('  Sources via arguments ou .env : PRONOCLIP_PORTRAITS_DIR, PRONOCLIP_FACES_DIR,')
  console.log('  PRONOCLIP_KITS_DIR, PRONOCLIP_SQUADS_CSV_DIR')
  process.exit(2)
}

const POSITION_MAP: Record<string, Position> = {
  keepers: 'GK', defenders: 'DF', midfielders: 'MF', attackers: 'FW',
}

const norm = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/['’]/g, '').replace(/[\s_-]+/g, ' ').trim()

interface CsvRow { name: string; position?: Position; isCoach: boolean; faceUrl?: string }

function readSquadCsv(teamCode: string): CsvRow[] {
  const path = join(resolve(csvDir!), `${teamCode}_squad.csv`)
  if (!existsSync(path)) return []
  const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean)
  const head = lines[0].split(',')
  const iName = head.indexOf('Full Name')
  const iPos = head.indexOf('Position')
  const iImg = head.indexOf('Image CDN URL')
  if (iName < 0) return []
  return lines.slice(1).map(l => {
    const c = l.split(',')
    const raw = (c[iPos] ?? '').trim().toLowerCase()
    return {
      name: (c[iName] ?? '').trim(),
      position: POSITION_MAP[raw],
      isCoach: raw === 'coach',
      faceUrl: iImg >= 0 ? (c[iImg] ?? '').trim() : undefined,
    }
  }).filter(r => r.name)
}

/** Visage : cache local d'abord (`Nom_Complet(Poste).png`), sinon téléchargement CDN. */
async function resolveFace(team: string, player: string, faceUrl?: string): Promise<string | null> {
  if (facesDir) {
    const dir = join(resolve(facesDir), team)
    if (existsSync(dir)) {
      const target = norm(player)
      for (const f of readdirSync(dir)) {
        const stem = f.replace(/\.[^.]+$/, '').replace(/\([^)]*\)\s*$/, '')
        if (norm(stem) === target) return join(dir, f)
      }
    }
  }
  if (!faceUrl) return null
  try {
    const res = await fetch(faceUrl)
    if (!res.ok) return null
    const cacheDir = join(DEFAULT_DATA_ROOT, '.face-cache', slugifyTeam(team))
    mkdirSync(cacheDir, { recursive: true })
    const out = join(cacheDir, `${slugifyTeam(player)}.png`)
    writeFileSync(out, Buffer.from(await res.arrayBuffer()))
    return out
  } catch {
    return null
  }
}

function findHomeKit(team: string): string | null {
  const dir = join(resolve(kitsDir!), team)
  if (!existsSync(dir)) return null
  const f = readdirSync(dir).find(x => x.toLowerCase().includes('-home-kit') && /\.(png|jpe?g|webp)$/i.test(x))
  return f ? join(dir, f) : null
}

// ---------------------------------------------------------------------------

const teamCode = slugifyTeam(teamName)
const indexPath = squadFilePath(DEFAULT_DATA_ROOT, 'pronoclip', teamCode)
if (!existsSync(indexPath)) {
  console.log(`\n⚠️  Équipe non semée : ${teamName}. Lance d'abord « npm run seed-squads ».\n`)
  process.exit(1)
}
const squad = JSON.parse(readFileSync(indexPath, 'utf8')) as SquadFile
const known = new Set(squad.players.map(p => norm(p.name)))

const rows = readSquadCsv(teamCode)
if (rows.length === 0) {
  console.log(`\n⚠️  Aucun effectif source pour ${teamName} (CSV introuvable ou vide).\n`)
  process.exit(1)
}

const missing = rows.filter(r => !r.isCoach && !known.has(norm(r.name)))
console.log(`\n${teamName} — ${squad.players.length} portraits présents, ${missing.length} manquant(s).`)
if (missing.length === 0) {
  console.log('Rien à générer.\n')
  process.exit(0)
}
for (const m of missing) console.log(`  · ${m.name} (${m.position ?? '?'})`)

const todo = missing.slice(0, max)
if (todo.length < missing.length) {
  console.log(`\nPlafond --max=${max} : ${todo.length} sur ${missing.length} traité(s) cette fois.`)
}
if (dryRun) {
  console.log('\nSIMULATION — aucun appel payant, aucune écriture.\n')
  process.exit(0)
}

const kitPath = findHomeKit(teamName)
if (!kitPath) {
  console.log(`\n⚠️  Maillot domicile introuvable pour ${teamName} — génération impossible.\n`)
  process.exit(1)
}

const outTeamDir = join(resolve(portraitsDir!), teamName)
mkdirSync(outTeamDir, { recursive: true })

let done = 0
for (const row of todo) {
  console.log(`\n→ ${row.name}`)
  const facePath = await resolveFace(teamName, row.name, row.faceUrl)
  if (!facePath) {
    console.log('   ⚠️  Visage de référence indisponible (ni cache, ni CDN) — ignoré, jamais inventé.')
    continue
  }
  console.log(`   visage  : ${facePath}`)
  console.log(`   modèle  : ${PORTRAIT_MODEL} | ${PORTRAIT_QUALITY} | ${PORTRAIT_SIZE}   ⚠️ appel PAYANT`)

  const res = await generatePortrait({ facePath, kitPath })
  if (!res.ok) {
    console.log(`   ⚠️  Échec (${res.reason}) : ${res.message}`)
    continue
  }

  // Même emplacement et même nom que le reste du set.
  const pngPath = join(outTeamDir, `${row.name}.png`)
  writeFileSync(pngPath, res.png)

  const entry: SquadPlayerEntry = {
    name: row.name,
    position: row.position ?? 'MF',
    portrait: pngPath,
  }
  squad.players.push(entry)
  writeFileSync(indexPath, JSON.stringify(squad, null, 2) + '\n', 'utf8')
  console.log(`   ✓ ${pngPath}  (${(res.png.length / 1024).toFixed(0)} Ko) — ajouté à l'index`)
  done++
}

console.log(`\nGénérés : ${done}/${todo.length}   Restants pour ${teamName} : ${missing.length - done}\n`)
