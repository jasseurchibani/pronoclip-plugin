// Narration (voix off) — texte du commentateur dérivé du MatchScript. Pur : aucune I/O,
// aucun TTS ici (le transport vit dans adapters/tts.ts). La voix, comme les overlays, ne
// peint JAMAIS de texte dans une image. Transparence IA obligatoire : un tag oral de fin
// s'ajoute au visuel déjà obligatoire (filigrane + carton). Calibré ~2,5 mots/s.

import type { MatchScript } from './types'
import { GOAL_TYPE_LABELS } from './labels'

export interface NarrationSegment {
  /** Beat logique : hook | annonce | faceoff | but | final | ia. */
  beat: string
  text: string
  /** Position indicative sur la timeline (ms) — pour un futur placement per-beat. */
  atMs: number
}

export interface Narration {
  segments: NarrationSegment[]
  /** Script complet (segments joints) — un seul fichier VO. */
  text: string
  /** Nombre de caractères (à LOGGER pour un provider payant au caractère). */
  chars: number
}

/** Tag de transparence IA — TOUJOURS présent (oral), en plus du visuel obligatoire. */
export const IA_TAG = 'Pronostic généré par intelligence artificielle.'

/**
 * Construit la narration à partir du script prédit : hook → annonce → face-à-face →
 * un but par ligne (ordre chronologique) → score final → tag IA.
 */
export function buildNarration(script: MatchScript, opts: { shotMs?: number } = {}): Narration {
  const shotMs = opts.shotMs ?? 5000
  const { home, away, competition } = script.match
  const { score, goals } = script.prediction
  const segments: NarrationSegment[] = []

  segments.push({ beat: 'hook', text: 'Pronostic PronoClip !', atMs: 0 })
  segments.push({
    beat: 'annonce',
    text: competition ? `${home} affronte ${away}. ${competition}.` : `${home} affronte ${away} !`,
    atMs: shotMs,
  })
  segments.push({ beat: 'faceoff', text: 'Le face-à-face est lancé.', atMs: 2 * shotMs })

  const chrono = [...goals].sort((a, b) => a.matchOrder - b.matchOrder)
  chrono.forEach((g, i) => {
    const label = GOAL_TYPE_LABELS[g.goalType]
    segments.push({ beat: 'but', text: `${label} de ${g.playerName} !`, atMs: (3 + i) * shotMs })
  })

  segments.push({
    beat: 'final',
    text: `Score final pronostiqué : ${home} ${score.home}, ${away} ${score.away}.`,
    atMs: Math.max(0, (script.shots.length - 1)) * shotMs,
  })
  segments.push({ beat: 'ia', text: IA_TAG, atMs: script.shots.length * shotMs })

  const text = segments.map(s => s.text).join(' ')
  return { segments, text, chars: text.length }
}
