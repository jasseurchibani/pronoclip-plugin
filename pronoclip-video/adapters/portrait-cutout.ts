// DÉTOURAGE DE PORTRAIT — fond blanc → transparent, pour incruster un joueur sur les
// panneaux sombres de la composition sans rectangle blanc autour.
//
// Méthode : REMPLISSAGE PAR DIFFUSION depuis les bords, jamais un seuillage global.
// Un seuillage global ferait des trous dans tout ce qui est blanc DANS l'image — le
// maillot blanc de l'Algérie, un col blanc, les dents, les reflets. La diffusion ne
// retire que le blanc connecté au bord, donc le fond, et rien d'autre.
//
// Le prompt de la bibliothèque commande justement « a perfectly clean, solid, seamless
// white background for easy alpha-channel extraction » : le fond s'y prête.
//
// ffmpeg ne sert que de codec (PNG → RGBA brut → PNG) ; toute la logique est ici.
// Aucune dépendance nouvelle : ffmpeg-static et ffprobe-static sont déjà présents.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import { createRequire } from 'node:module'
import ffmpegPath from 'ffmpeg-static'

const FFMPEG = ffmpegPath as unknown as string
// `ffprobe-static` n'expose pas de typage ; on le charge en CommonJS pour rester typé ici.
const FFPROBE = (createRequire(import.meta.url)('ffprobe-static') as { path: string }).path

export interface CutoutOptions {
  /**
   * Tolérance de blanc, 0..255. Un pixel est « fond » si ses trois canaux dépassent
   * `255 - tolerance`.
   *
   * Défaut 12, calibré sur le pire cas de la bibliothèque — le maillot BLANC de
   * l'Algérie. Comparatif à 6 / 12 / 20 : à 6 il subsiste un halo clair sur la
   * silhouette ; à 20 le remplissage FUIT du fond vers le maillot par les pixels
   * anti-aliasés et creuse des trous noirs dans le tissu ; 12 détoure proprement sans
   * entamer le maillot. Le fond est du blanc pur, le maillot est du blanc ombré —
   * c'est cet écart que la tolérance doit trancher.
   */
  tolerance?: number
  /** Adoucit la frange blanche résiduelle sur le contour. Défaut true. */
  feather?: boolean
}

function probeSize(path: string): { width: number; height: number } | null {
  const r = spawnSync(FFPROBE, [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', path,
  ], { encoding: 'utf8' })
  const m = /^(\d+)x(\d+)/.exec((r.stdout || '').trim())
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null
}

/**
 * Rend le fond transparent. Renvoie `false` si l'opération n'a pas pu aboutir —
 * l'appelant retombe alors sur l'image d'origine plutôt que d'échouer.
 */
export function removeWhiteBackground(inputPath: string, outputPath: string, opts: CutoutOptions = {}): boolean {
  const tolerance = opts.tolerance ?? 12
  const feather = opts.feather ?? true

  const size = probeSize(inputPath)
  if (!size) return false
  const { width: w, height: h } = size

  // 1) Décodage en RGBA brut.
  const dec = spawnSync(FFMPEG, [
    '-v', 'error', '-i', inputPath, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-',
  ], { maxBuffer: 1 << 30 })
  if (dec.status !== 0 || !dec.stdout || dec.stdout.length !== w * h * 4) return false
  const px = Buffer.from(dec.stdout)

  // 2) Diffusion depuis les bords sur les pixels « quasi blancs ».
  const floor = 255 - tolerance
  const isWhite = (i: number) => px[i] >= floor && px[i + 1] >= floor && px[i + 2] >= floor

  const bg = new Uint8Array(w * h) // 1 = fond
  const queue = new Int32Array(w * h)
  let qh = 0
  let qt = 0

  const push = (x: number, y: number) => {
    const p = y * w + x
    if (bg[p]) return
    if (!isWhite(p * 4)) return
    bg[p] = 1
    queue[qt++] = p
  }

  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1) }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y) }

  while (qh < qt) {
    const p = queue[qh++]
    const x = p % w
    const y = (p / w) | 0
    if (x > 0) push(x - 1, y)
    if (x < w - 1) push(x + 1, y)
    if (y > 0) push(x, y - 1)
    if (y < h - 1) push(x, y + 1)
  }

  // 3) Application de l'alpha. Le sujet garde son alpha d'origine : seul le fond tombe.
  for (let p = 0; p < w * h; p++) if (bg[p]) px[p * 4 + 3] = 0

  // 4) Contour : un pixel opaque très clair touchant le fond porte la frange blanche du
  //    fond. On baisse son alpha proportionnellement à sa clarté — bord net sans halo.
  if (feather) {
    const touchesBg = (x: number, y: number) =>
      (x > 0 && bg[y * w + x - 1]) || (x < w - 1 && bg[y * w + x + 1]) ||
      (y > 0 && bg[(y - 1) * w + x]) || (y < h - 1 && bg[(y + 1) * w + x])
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x
        if (bg[p] || !touchesBg(x, y)) continue
        const i = p * 4
        const lum = (px[i] + px[i + 1] + px[i + 2]) / 3
        if (lum <= floor) continue
        // lum ∈ ]floor, 255] → alpha ∈ [0, 255[ : plus c'est blanc, plus c'est effacé.
        px[i + 3] = Math.round(255 * (1 - (lum - floor) / Math.max(1, 255 - floor)))
      }
    }
  }

  // 5) Ré-encodage PNG (avec canal alpha).
  mkdirSync(dirname(outputPath), { recursive: true })
  const enc = spawnSync(FFMPEG, [
    '-v', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-i', 'pipe:0',
    '-frames:v', '1', '-pix_fmt', 'rgba', outputPath,
  ], { input: px, maxBuffer: 1 << 30 })
  return enc.status === 0 && existsSync(outputPath)
}

/**
 * Version mise en cache : ne détoure qu'une fois par portrait. Le cache est invalidé si
 * la source est plus récente. Renvoie le chemin détouré, ou `null` en cas d'échec (à
 * l'appelant de retomber sur l'original).
 */
export function cutoutCached(inputPath: string, cachePath: string, opts: CutoutOptions = {}): string | null {
  try {
    if (existsSync(cachePath) && statSync(cachePath).mtimeMs >= statSync(inputPath).mtimeMs) {
      return cachePath
    }
  } catch {
    // Source illisible → on laisse removeWhiteBackground trancher.
  }
  return removeWhiteBackground(inputPath, cachePath, opts) ? cachePath : null
}

/** Un PNG détouré porte-t-il vraiment de la transparence ? (contrôle de non-régression) */
export function hasTransparency(pngPath: string): boolean {
  const size = probeSize(pngPath)
  if (!size) return false
  const dec = spawnSync(FFMPEG, ['-v', 'error', '-i', pngPath, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { maxBuffer: 1 << 30 })
  if (dec.status !== 0 || !dec.stdout) return false
  const px = dec.stdout
  for (let i = 3; i < px.length; i += 4) if (px[i] === 0) return true
  return false
}

/** Taille du fichier, pour les journaux d'exécution. */
export function fileSizeKo(path: string): number {
  try { return Math.round(readFileSync(path).length / 1024) } catch { return 0 }
}
