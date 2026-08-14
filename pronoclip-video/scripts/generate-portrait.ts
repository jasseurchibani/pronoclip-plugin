// Génère UN portrait manquant, dans le style EXACT de la bibliothèque existante.
//
//   npm run portrait -- "Kylian Mbappe" France --faces="<dir>" --kits="<dir>"
//   ... --out=pronoclip-output/essai.png     (défaut : pronoclip-output/portrait_<slug>.png)
//
// ⚠️ APPEL PAYANT (OpenAI images/edits). Les chemins de sources sont des ARGUMENTS,
// jamais en dur. Le visage et le maillot sont les DEUX références obligatoires : sans
// elles, le rendu ne ressemblerait pas au reste du set.

import 'dotenv/config'
import { readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { generatePortrait, PORTRAIT_MODEL, PORTRAIT_QUALITY, PORTRAIT_SIZE } from '../adapters/portrait-generator'
import { OUTPUT_DIR, slugify } from './render-pipeline'

const argv = process.argv.slice(2)
const flag = (n: string) => argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=')
const positional = argv.filter(a => !a.startsWith('--'))
const [playerName, teamName] = positional

const facesDir = flag('faces')
const kitsDir = flag('kits')

if (!playerName || !teamName || !facesDir || !kitsDir) {
  console.log('Usage : npm run portrait -- "<Joueur>" <Équipe> --faces="<dir>" --kits="<dir>" [--out=<fichier>]')
  process.exit(2)
}

/** Accents et ponctuation retirés, espaces et tirets unifiés — pour apparier les noms de fichiers. */
const norm = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/['’]/g, '').replace(/[\s_-]+/g, ' ').trim()

/** Visage : fichiers nommés `Prenom_Nom(Poste).png` → on apparie sur la partie avant la parenthèse. */
function findFace(dir: string, player: string): string | null {
  if (!existsSync(dir)) return null
  const target = norm(player)
  for (const f of readdirSync(dir)) {
    const stem = f.replace(/\.[^.]+$/, '').replace(/\([^)]*\)\s*$/, '')
    if (norm(stem) === target) return join(dir, f)
  }
  return null
}

/** Maillot DOMICILE — même règle que le projet source : le fichier contient `-home-kit`. */
function findHomeKit(dir: string): string | null {
  if (!existsSync(dir)) return null
  const f = readdirSync(dir).find(x => x.toLowerCase().includes('-home-kit') && /\.(png|jpe?g|webp)$/i.test(x))
  return f ? join(dir, f) : null
}

const facePath = findFace(join(resolve(facesDir), teamName), playerName)
const kitPath = findHomeKit(join(resolve(kitsDir), teamName))

if (!facePath) {
  console.log(`\n⚠️  Visage de référence introuvable pour « ${playerName} » (${teamName}).`)
  console.log(`   Cherché dans : ${join(resolve(facesDir), teamName)}`)
  console.log('   Sans visage de référence, le portrait ne ressemblerait pas au reste du set.\n')
  process.exit(1)
}
if (!kitPath) {
  console.log(`\n⚠️  Maillot domicile introuvable pour ${teamName}.`)
  console.log(`   Cherché dans : ${join(resolve(kitsDir), teamName)}\n`)
  process.exit(1)
}

mkdirSync(OUTPUT_DIR, { recursive: true })
const outPath = flag('out') ?? join(OUTPUT_DIR, `portrait_${slugify(teamName)}_${slugify(playerName)}.png`)

console.log(`\nJoueur   : ${playerName} (${teamName})`)
console.log(`Visage   : ${facePath}`)
console.log(`Maillot  : ${kitPath}`)
console.log(`Modèle   : ${PORTRAIT_MODEL} | qualité ${PORTRAIT_QUALITY} | ${PORTRAIT_SIZE}`)
console.log('\n⚠️  Appel PAYANT en cours…')

const out = await generatePortrait({
  facePath, kitPath,
  model: flag('model'), quality: flag('quality'), size: flag('size'),
})
if (!out.ok) {
  console.log(`\n⚠️  Échec (${out.reason}) : ${out.message}\n`)
  process.exit(1)
}

writeFileSync(outPath, out.png)
console.log(`\n===== PORTRAIT GÉNÉRÉ =====`)
console.log(`${outPath}   (${(out.png.length / 1024).toFixed(0)} Ko)`)
