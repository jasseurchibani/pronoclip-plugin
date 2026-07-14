// Prompts image→vidéo pour le tier `animated` (cf. MISSION §8).
// Chaque plan : son image fixe = FIRST FRAME + un video_prompt (mouvement) + un
// negative_prompt. Le mode d'échec classique de l'image→vidéo est le morphing du
// visage / maillot → le prompt VERROUILLE l'identité sur l'image de référence.
// Aucun texte n'est introduit (le texte reste overlay HTML au montage). Pur.

import type { MatchBible, Shot } from './types'
import { SCENE_FRAGMENTS } from './scene-fragments'

export interface VideoPromptOptions {
  durationSeconds?: number
}

export interface VideoPromptResult {
  videoPrompt: string
  negativePrompt: string
  durationSeconds: number
}

// Verrou anti-morphing — la ligne qui empêche le visage/maillot de dériver.
const IDENTITY_LOCK =
  'CRITICAL: no morphing, keep the character\'s face, hair, skin tone, build and kit ' +
  'colour identical to the reference frame throughout, no face warping, no jersey ' +
  'colour change, no added text.'

// Caméra verrouillée (cf. correction §3) — empêche le travelling qui quitte l'action.
const CAMERA_LOCK =
  'Locked camera, no camera movement. The subject remains centered in frame for the entire duration.'

// Negative dédié image→vidéo (dérives typiques du i2v) + dérives de caméra.
const VIDEO_NEGATIVE =
  'morphing, face morph, identity change, warping, melting, extra limbs, ' +
  'jersey colour change, text, watermark, ' +
  'camera pans away, camera flies through the net, subject exits frame, empty goal, no subject'

/** Construit le couple (video_prompt, negative_prompt) d'un plan pour l'image→vidéo. */
export function buildVideoPrompt(
  bible: MatchBible,
  shot: Shot,
  opts: VideoPromptOptions = {},
): VideoPromptResult {
  const durationSeconds = opts.durationSeconds ?? 5
  const action = SCENE_FRAGMENTS[shot.sceneType]

  const videoPrompt = [
    'Animate the provided still image as the exact first frame.',
    `Motion: ${action}`,
    'Preserve the art style, colour grade, lighting and composition of the reference frame.',
    `Vertical 9:16, ${durationSeconds} seconds, smooth high-quality motion, consistent physics.`,
    CAMERA_LOCK,
    IDENTITY_LOCK,
    'Do not add any new text, numbers, scoreboard, captions or watermark.',
  ].join('\n')

  return { videoPrompt, negativePrompt: VIDEO_NEGATIVE, durationSeconds }
}
