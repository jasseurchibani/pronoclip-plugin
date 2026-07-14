// Prompts image→vidéo pour le tier `animated` (cf. MISSION §8).
// Chaque plan : son image fixe = FIRST FRAME + un video_prompt (mouvement) + un
// negative_prompt. Le mode d'échec classique de l'image→vidéo est le morphing du
// visage / maillot → le prompt VERROUILLE l'identité sur l'image de référence.
// Aucun texte n'est introduit (le texte reste overlay HTML au montage). Pur.

import type { GoalType, MatchBible, Shot } from './types'
import { GOAL_TYPES } from './types'
import { SCENE_FRAGMENTS } from './scene-fragments'

export interface VideoPromptOptions {
  durationSeconds?: number
}

export interface VideoPromptResult {
  videoPrompt: string
  negativePrompt: string
  durationSeconds: number
}

const GOAL_TYPE_SET = new Set<string>(GOAL_TYPES)

// Verrou anti-morphing — la ligne qui empêche le visage/maillot de dériver.
const IDENTITY_LOCK =
  'CRITICAL: no morphing, keep the character\'s face, hair, skin tone, build and kit ' +
  'colour identical to the reference frame throughout, no face warping, no jersey ' +
  'colour change, no added text.'

// Caméra qui SUIT le ballon (cf. correction §3 révisée) — plus de locked camera : il
// enfermait le joueur et l'obligeait à meubler les secondes vides.
const CAMERA_TRACK =
  'The camera tracks the ball from boot to net, then whips back to the striker.'

// CHORÉGRAPHIE HORODATÉE des buts (cf. correction §2) — remplit les 5 s (durée min de
// Kling) : frappe → vol du ballon → filet → célébration. Le ballon reste visible
// jusqu'au filet ; le joueur n'entre jamais dans la cage.
const CELEBRATION_TAIL =
  '3-5s: the striker wheels away toward the corner flag, arms wide, roaring. ' +
  'The ball is visible in every frame until it hits the net. The striker never enters the goal.'
const GOAL_CHOREOGRAPHY: Record<GoalType, string> = {
  goal_normal:
    '0-1s: the striker plants his standing foot and swings his kicking leg through the ball. ' +
    '1-2s: the ball leaves his boot and travels toward the bottom-right corner, motion-blurred. ' +
    '2-3s: the ball hits the net, the netting snaps violently taut, the keeper lands short. ' + CELEBRATION_TAIL,
  goal_header:
    '0-1s: the striker rises and meets the cross with a powerful downward header. ' +
    '1-2s: the ball flies off his forehead toward the bottom corner, motion-blurred. ' +
    '2-3s: the ball hits the net, the netting snaps violently taut, the keeper lands short. ' + CELEBRATION_TAIL,
  goal_volley:
    '0-1s: the striker swings through a first-time volley on the dropping ball. ' +
    '1-2s: the ball rockets toward the top corner, motion-blurred. ' +
    '2-3s: the ball hits the net, the netting snaps violently taut, the keeper beaten. ' + CELEBRATION_TAIL,
  goal_bicycle:
    '0-1s: the striker completes an overhead bicycle kick, boot meeting the ball high. ' +
    '1-2s: the ball loops over the keeper toward goal, motion-blurred. ' +
    '2-3s: the ball hits the net, the netting snaps violently taut. ' + CELEBRATION_TAIL,
  goal_freekick:
    '0-1s: the striker strikes the free kick, bending it up and over the wall. ' +
    '1-2s: the ball curls toward the top corner, motion-blurred. ' +
    '2-3s: the ball hits the net, the netting snaps violently taut, the keeper stranded. ' + CELEBRATION_TAIL,
  goal_penalty:
    '0-1s: the striker strikes the penalty low and hard. ' +
    '1-2s: the ball travels toward the corner as the keeper dives the other way, motion-blurred. ' +
    '2-3s: the ball hits the net, the netting snaps violently taut. ' + CELEBRATION_TAIL,
  goal_longrange:
    '0-1s: the midfielder plants and unleashes a long-range strike. ' +
    '1-2s: the ball screams toward the top corner from distance, motion-blurred. ' +
    '2-3s: the ball hits the net, the netting snaps violently taut, the keeper beaten. ' + CELEBRATION_TAIL,
}

// Negative dédié image→vidéo : dérives i2v + dérives de "vide" (cf. diagnostic v2)
// + logos/écussons hallucinés par le modèle en mouvement (fix légal, cf. Kling v3).
const VIDEO_NEGATIVE =
  'morphing, face morph, identity change, warping, melting, extra limbs, ' +
  'jersey colour change, text, watermark, ' +
  'club crest, team badge, competition logo, sponsor logo, brand logo, chest emblem, shirt number, ' +
  'ball disappears, ball missing, player enters the goal, player inside the net, ' +
  'duplicate goalposts, two goals, aimless walking, idle player'

/** Construit le couple (video_prompt, negative_prompt) d'un plan pour l'image→vidéo. */
export function buildVideoPrompt(
  bible: MatchBible,
  shot: Shot,
  opts: VideoPromptOptions = {},
): VideoPromptResult {
  const durationSeconds = opts.durationSeconds ?? 5
  const isGoal = GOAL_TYPE_SET.has(shot.sceneType)
  // Buts : chorégraphie horodatée qui remplit toute la durée (pas d'action + vide).
  const beat = isGoal
    ? `Choreography (${durationSeconds} seconds): ${GOAL_CHOREOGRAPHY[shot.sceneType as GoalType]}`
    : `Motion: ${SCENE_FRAGMENTS[shot.sceneType]}`
  const cameraLine = isGoal ? CAMERA_TRACK : 'Smooth cinematic camera move that keeps the subject in frame.'

  const videoPrompt = [
    'Animate the provided still image as the exact first frame.',
    beat,
    'Preserve the art style, colour grade, lighting and composition of the reference frame.',
    `Vertical 9:16, ${durationSeconds} seconds, high-quality motion, consistent physics.`,
    cameraLine,
    IDENTITY_LOCK,
    'Do not add any new text, numbers, scoreboard, captions or watermark.',
  ].join('\n')

  return { videoPrompt, negativePrompt: VIDEO_NEGATIVE, durationSeconds }
}
