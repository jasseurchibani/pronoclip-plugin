// Prompts image→vidéo pour le tier `animated` (cf. MISSION §8).
// RÈGLE CENTRALE (plan de prod) : un clip = UN SEUL geste, fin nette. Jamais frappe +
// célébration dans le même clip (c'est ce qui faisait apparaître le poteau de corner
// fantôme). Les buts se découpent en deux beats : strike (fin sur le filet) et
// celebration (beat séparé). L'image fixe = première frame ; l'identité est verrouillée.
// Aucun texte/logo introduit (contrôle légal aussi sur les clips). Pur.

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

// Verrou anti-morphing.
const IDENTITY_LOCK =
  'CRITICAL: no morphing, keep the character\'s face, hair, skin tone, build and kit ' +
  'colour identical to the reference frame throughout, no face warping, no jersey ' +
  'colour change, no added text.'

// Beat STRIKE : une seule action, se termine sur le filet qui se tend.
const GOAL_STRIKE: Record<GoalType, string> = {
  goal_normal:
    'The striker swings through the ball; the ball travels to the bottom corner, motion-blurred; the net snaps violently taut.',
  goal_header:
    'The striker powers a downward header; the ball flies to the bottom corner, motion-blurred; the net snaps taut.',
  goal_volley:
    'The striker connects a first-time volley; the ball rockets to the top corner, motion-blurred; the net snaps taut.',
  goal_bicycle:
    'The striker completes an overhead bicycle kick; the ball loops over the keeper into the goal, motion-blurred; the net snaps taut.',
  goal_freekick:
    'The striker curls the free kick over the wall; the ball bends into the top corner, motion-blurred; the net snaps taut.',
  goal_penalty:
    'The striker strikes the penalty; the ball flashes into the corner as the keeper dives the wrong way; the net snaps taut.',
  goal_longrange:
    'The midfielder unleashes a long-range strike; the ball screams into the top corner, motion-blurred; the net snaps taut.',
}
const STRIKE_END = ' The ball stays visible until it hits the net. End on the bulging net.'

// Beat CELEBRATION : une seule action, se termine sur la glissade bras écartés.
const CELEBRATION_BEAT =
  'The striker runs a few strides and drops into a knee-slide, arms spread wide, roaring in ' +
  'celebration. One continuous celebration, no ball. End on the knee-slide with arms wide.'

// Caméras par beat.
const CAMERA_STRIKE = 'The camera tracks the ball from boot to net and ends on the net.'
const CAMERA_CELEBRATION = 'The camera stays on the celebrating striker.'
const CAMERA_GENERIC = 'Smooth cinematic camera move that keeps the subject in frame.'

// Negative commun à tous les beats — dérives i2v + LOGOS/marques (fix légal, cf.
// directives-legales.md : ni logo, ni écusson, ni sponsor).
const BASE_NEGATIVE =
  'morphing, face morph, identity change, warping, melting, extra limbs, jersey colour change, ' +
  'text, watermark, brand logo, nike, adidas, puma, swoosh, club crest, sponsor logo, badge, ' +
  'emblem, sponsor text, shirt number, aimless walking, idle player'
// Spécifique aux beats de frappe (le ballon et la cage doivent rester cohérents).
const STRIKE_NEGATIVE =
  ', ball disappears, ball missing, player enters the goal, player inside the net, empty goal, ' +
  'duplicate goalposts, two goals'

export function buildVideoPrompt(
  bible: MatchBible,
  shot: Shot,
  opts: VideoPromptOptions = {},
): VideoPromptResult {
  const durationSeconds = opts.durationSeconds ?? 5
  const isGoal = GOAL_TYPE_SET.has(shot.sceneType)
  const isCelebration = shot.sceneType === 'celebration'

  let beat: string
  let cameraLine: string
  let negativePrompt: string
  if (isGoal) {
    beat = `Single action: ${GOAL_STRIKE[shot.sceneType as GoalType]}${STRIKE_END}`
    cameraLine = CAMERA_STRIKE
    negativePrompt = BASE_NEGATIVE + STRIKE_NEGATIVE
  } else if (isCelebration) {
    beat = `Single action: ${CELEBRATION_BEAT}`
    cameraLine = CAMERA_CELEBRATION
    negativePrompt = BASE_NEGATIVE
  } else {
    beat = `Single action: ${SCENE_FRAGMENTS[shot.sceneType]}`
    cameraLine = CAMERA_GENERIC
    negativePrompt = BASE_NEGATIVE
  }

  const videoPrompt = [
    'Animate the provided still image as the exact first frame.',
    beat,
    'Preserve the art style, colour grade, lighting and composition of the reference frame.',
    `Vertical 9:16, ${durationSeconds} seconds, high-quality motion, consistent physics.`,
    cameraLine,
    IDENTITY_LOCK,
    'Do not add any new text, numbers, scoreboard, captions or watermark.',
  ].join('\n')

  return { videoPrompt, negativePrompt, durationSeconds }
}
