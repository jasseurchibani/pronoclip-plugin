// Assemblage des clips du tier `animated` : première frame par plan, normalisation de
// chaque clip renvoyé par le fournisseur, puis concaténation en une vidéo unique.
//
// Les fournisseurs image→vidéo rendent des durées, des définitions et des cadences
// variables. Sans normalisation, la concaténation produirait une vidéo au montage
// désynchronisé de l'audio. Chaque clip est donc ramené EXACTEMENT à la durée du plan,
// à la définition cible et à une cadence fixe avant d'être recollé.
//
// ffmpeg-static uniquement : aucune dépendance nouvelle.

import { spawnSync } from 'node:child_process'
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import ffmpegPath from 'ffmpeg-static'

const FFMPEG = ffmpegPath as unknown as string

function run(args: string[], what: string): void {
  const r = spawnSync(FFMPEG, args, { maxBuffer: 1 << 28 })
  if (r.status !== 0) {
    throw new Error(`ffmpeg (${what}) a échoué : ${(r.stderr?.toString() || '').slice(-500)}`)
  }
}

export interface FirstFrameOptions {
  /** Portrait détouré à incruster. Absent → fond seul. */
  portraitPath?: string | null
  /** Couleur de fond (charte de marque). */
  background: string
  width: number
  height: number
  outPath: string
}

/**
 * Première frame d'un plan : le portrait détouré posé sur le fond de marque, cadré en
 * 9:16. C'est l'image de RÉFÉRENCE envoyée au modèle image→vidéo — c'est elle qui porte
 * l'identité du joueur, donc la cohérence du personnage d'un plan à l'autre.
 */
export function buildFirstFrame(opts: FirstFrameOptions): string {
  mkdirSync(dirname(opts.outPath), { recursive: true })
  const { width: w, height: h } = opts
  if (!opts.portraitPath || !existsSync(opts.portraitPath)) {
    run(['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${opts.background}:s=${w}x${h}`,
      '-frames:v', '1', opts.outPath], 'première frame (fond seul)')
    return opts.outPath
  }
  // Le portrait est mis à l'échelle pour tenir dans le cadre, puis centré.
  run([
    '-v', 'error', '-y',
    '-f', 'lavfi', '-i', `color=c=${opts.background}:s=${w}x${h}`,
    '-i', opts.portraitPath,
    '-filter_complex',
    `[1]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}[fg];[0][fg]overlay=0:0`,
    '-frames:v', '1', opts.outPath,
  ], 'première frame (portrait sur fond)')
  return opts.outPath
}

export interface NormalizeOptions {
  inPath: string
  outPath: string
  /** Durée EXACTE attendue pour le plan. */
  seconds: number
  width: number
  height: number
  fps?: number
}

/**
 * Ramène un clip à la durée, la définition et la cadence cibles. Un clip trop court est
 * prolongé par gel de sa dernière image (`tpad`) plutôt que tronqué net : mieux vaut une
 * fin figée qu'un trou noir dans le montage.
 */
export function normalizeClip(opts: NormalizeOptions): string {
  mkdirSync(dirname(opts.outPath), { recursive: true })
  const fps = opts.fps ?? 24
  const { width: w, height: h } = opts
  run([
    '-v', 'error', '-y', '-i', opts.inPath,
    '-vf',
    `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=${fps},` +
    `tpad=stop_mode=clone:stop_duration=${opts.seconds}`,
    '-t', String(opts.seconds),
    '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast',
    opts.outPath,
  ], 'normalisation du clip')
  return opts.outPath
}

/**
 * Concatène les clips normalisés. Passe par le démultiplexeur `concat` (sans réencodage)
 * — légitime ici puisque tous les clips viennent d'être encodés avec les MÊMES paramètres.
 */
export function concatClips(clipPaths: string[], outPath: string, workDir: string): string {
  if (clipPaths.length === 0) throw new Error('Concaténation : aucun clip fourni.')
  mkdirSync(workDir, { recursive: true })
  mkdirSync(dirname(outPath), { recursive: true })
  const listPath = resolve(workDir, 'concat-list.txt')
  // Chemins échappés pour le format `concat` (apostrophes protégées).
  writeFileSync(
    listPath,
    clipPaths.map(p => `file '${resolve(p).replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n') + '\n',
    'utf8',
  )
  run(['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outPath], 'concaténation')
  return outPath
}

/** Télécharge le clip produit par le fournisseur. Ne lève pas sur contenu vide : le vérifie. */
export async function downloadClip(url: string, outPath: string): Promise<string> {
  mkdirSync(dirname(outPath), { recursive: true })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Téléchargement du clip : HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length === 0) throw new Error('Téléchargement du clip : fichier vide.')
  writeFileSync(outPath, buf)
  return outPath
}
