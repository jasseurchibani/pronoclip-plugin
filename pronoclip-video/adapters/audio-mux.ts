// Mixage & mux audio via ffmpeg-static (local, gratuit). Synthétise un lit musical et
// des whoosh de transition (musique GÉNÉRÉE — jamais de track commerciale, cf. garde-fous
// audio-narration), puis mux voix + lit + SFX dans la vidéo muette. I/O assumée (adapter).

import { spawnSync } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'

const FFMPEG = ffmpegPath as unknown as string

function run(args: string[], what: string): void {
  const r = spawnSync(FFMPEG, args, { encoding: 'utf8' })
  if (r.status !== 0) {
    throw new Error(`ffmpeg (${what}) a échoué : ${(r.stderr || '').slice(-600)}`)
  }
}

/** Lit musical GÉNÉRÉ : triade Do majeur adoucie (lowpass), fondu in/out. */
export function synthMusicBed(outPath: string, durationSec: number, log: (m: string) => void = () => {}): string {
  const d = Math.max(1, Math.round(durationSec))
  const fadeOut = Math.max(0, d - 3)
  run([
    '-y',
    '-f', 'lavfi', '-i', `sine=frequency=130.81:duration=${d}:sample_rate=44100`,
    '-f', 'lavfi', '-i', `sine=frequency=164.81:duration=${d}:sample_rate=44100`,
    '-f', 'lavfi', '-i', `sine=frequency=196.00:duration=${d}:sample_rate=44100`,
    '-filter_complex',
    `[0][1][2]amix=inputs=3:normalize=0,lowpass=f=900,volume=0.5,` +
    `afade=t=in:d=2,afade=t=out:st=${fadeOut}:d=3,` +
    `aformat=sample_rates=44100:channel_layouts=stereo[m]`,
    '-map', '[m]', outPath,
  ], 'music-bed')
  log(`Lit musical généré (${d}s) → ${outPath}`)
  return outPath
}

/** Whoosh de transition GÉNÉRÉ : rafale de bruit rose filtrée, stéréo. */
export function synthWhoosh(outPath: string, log: (m: string) => void = () => {}): string {
  run([
    '-y',
    '-f', 'lavfi', '-i', 'anoisesrc=r=44100:d=0.45:c=pink:a=0.6',
    '-filter_complex',
    `[0]highpass=f=500,lowpass=f=5000,afade=t=in:d=0.02,afade=t=out:st=0.1:d=0.35,` +
    `volume=1.1,aformat=sample_rates=44100:channel_layouts=stereo[w]`,
    '-map', '[w]', outPath,
  ], 'whoosh')
  log(`Whoosh généré → ${outPath}`)
  return outPath
}

/** Piste SFX : un whoosh placé à chaque coupe (cutTimesMs), sur toute la durée. */
export function buildSfxTrack(
  whooshPath: string,
  cutTimesMs: number[],
  durationSec: number,
  outPath: string,
  log: (m: string) => void = () => {},
): string {
  if (cutTimesMs.length === 0) {
    // Aucune coupe → piste silencieuse de la bonne durée.
    run(['-y', '-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo:d=${Math.round(durationSec)}`, outPath], 'sfx-silent')
    return outPath
  }
  const args: string[] = ['-y']
  for (const _ of cutTimesMs) args.push('-i', whooshPath)
  const parts = cutTimesMs.map((t, i) => `[${i}:a]adelay=${t}|${t}[d${i}]`)
  const mixIn = cutTimesMs.map((_, i) => `[d${i}]`).join('')
  const d = Math.round(durationSec)
  const filter =
    parts.join(';') + ';' +
    `${mixIn}amix=inputs=${cutTimesMs.length}:normalize=0,` +
    `apad=whole_dur=${d},aformat=sample_rates=44100:channel_layouts=stereo[s]`
  args.push('-filter_complex', filter, '-map', '[s]', outPath)
  run(args, 'sfx-track')
  log(`Piste SFX : ${cutTimesMs.length} whoosh aux coupes → ${outPath}`)
  return outPath
}

export interface MuxLevels {
  voice: number // ex. 1.0
  music: number // ex. 0.15 (≈ −16 dB, ducké sous la voix)
  sfx: number   // ex. 0.5
}

/**
 * Mux final : vidéo muette + (voix optionnelle) + lit musical + SFX → MP4 (H.264 copié, AAC).
 * `voice: null` → mux sans voix (lit musical + whoosh seuls) : dégradation propre quand la
 * TTS locale est indisponible (démo portable), sans jamais bloquer la production du MP4.
 */
export function muxAudio(params: {
  videoSilent: string
  voice: string | null
  music: string
  sfx: string
  out: string
  levels: MuxLevels
  metadata?: string
  log?: (m: string) => void
}): string {
  const { videoSilent, voice, music, sfx, out, levels, metadata } = params
  const log = params.log ?? (() => {})
  const af = 'aformat=sample_rates=44100:channel_layouts=stereo'
  const args = ['-y', '-i', videoSilent]
  let filter: string
  if (voice) {
    args.push('-i', voice, '-i', music, '-i', sfx)
    filter =
      `[1:a]${af},volume=${levels.voice}[vo];` +
      `[2:a]${af},volume=${levels.music}[bg];` +
      `[3:a]${af},volume=${levels.sfx}[fx];` +
      `[vo][bg][fx]amix=inputs=3:duration=longest:normalize=0[a]`
  } else {
    args.push('-i', music, '-i', sfx)
    filter =
      `[1:a]${af},volume=${levels.music}[bg];` +
      `[2:a]${af},volume=${levels.sfx}[fx];` +
      `[bg][fx]amix=inputs=2:duration=longest:normalize=0[a]`
  }
  args.push('-filter_complex', filter, '-map', '0:v', '-map', '[a]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest')
  if (metadata) args.push('-metadata', `comment=${metadata}`, '-metadata', `description=${metadata}`)
  args.push(out)
  run(args, 'mux')
  log(`Mux audio → ${out}${voice ? '' : ' (sans voix — dégradation propre)'}`)
  return out
}
