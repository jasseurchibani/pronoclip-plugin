// Construction des prompts d'image (cf. MISSION §4).
// Gabarit : STYLE + WORLD + CAMERA + SUBJECT + ACTION + NEGATIVE.
// WORLD est identique mot pour mot dans les 8 plans (verrou du Match Bible).
// L'aura vient de teams[side].aura, jamais du fragment. Aucun texte/chiffre/nom
// n'est demandé dans l'image. Pur : aucune I/O.

import type { CharacterLikeness, GoalType, MatchBible, RenderLevel, SceneType, Shot } from './types'
import { GOAL_TYPES } from './types'
import { STYLE_BLOCK, NEGATIVE_BLOCK, STYLE_BLOCK_ANIMATED, NEGATIVE_BLOCK_ANIMATED } from './scene-style'
import { SCENE_FRAGMENTS, GOAL_FIRST_FRAME } from './scene-fragments'

const GOAL_TYPE_SET = new Set<string>(GOAL_TYPES)

export interface PromptOptions {
  /** Défaut `independent` : cadrage « visage non-ancre » (cf. décision A2, Option 5). */
  characterLikeness?: CharacterLikeness
  /**
   * Tier de rendu (cf. corrections §1/§2) — pilote style, negative ET la variante des
   * fragments de but : `motion` = anime 2D + but marqué (still) ; `animated` = 3D
   * cinématique + instant AVANT le but (first frame que le modèle i2v anime).
   */
  renderLevel?: RenderLevel
}

// Directive « visage non-ancre » (appliquée à TOUS les plans quand likeness=independent).
// Aucun headshot net nulle part : le visage tombe dans l'ombre, l'identité passe par le
// kit, le gabarit, la silhouette et la posture. Le nom/numéro arrivent en overlay HTML.
const FACE_NOT_ANCHOR =
  'strong backlight (contre-jour), the face falls into shadow and is never the focal ' +
  'point — identity reads from kit colour, build, silhouette and stance, never a clean readable face'

/** Réglage caméra applicable à un type de plan. */
function cameraFor(bible: MatchBible, sceneType: SceneType): string {
  switch (sceneType) {
    case 'team_reveal':
    case 'rival_reveal':
    case 'final_result':
      return bible.camera.reveals
    case 'face_off':
      return bible.camera.duels
    case 'determination':
    case 'big_chance_missed':
      return bible.camera.closeups
    default:
      return bible.camera.goals // goal_*, goal_montage, goalkeeper_save, celebration, power_up
  }
}

/** Bloc WORLD — identique dans les 8 plans (verrou anti-incohérence). */
function worldBlock(bible: MatchBible): string {
  const w = bible.world
  return (
    `World (identical in every shot): ${w.time_of_day}; ${w.sky}; ${w.weather}; ` +
    `${w.stadium}; ${w.floodlights}; ${w.crowd}. Colour grade: ${w.grade}.`
  )
}

/** Bloc SUBJECT — fiche personnage verrouillée + maillot + aura de l'équipe. */
function subjectBlock(bible: MatchBible, shot: Shot): string {
  const { home, away } = bible.teams

  if (shot.playerName && bible.players[shot.playerName]) {
    const p = bible.players[shot.playerName]
    const kit = bible.teams[p.side]
    return (
      `Subject: a ${p.build} athlete with ${p.hair}, ${p.skin} skin, wearing a ${kit.kit}, ` +
      `${kit.shorts}, ${kit.socks}, and ${p.boots}; a ${kit.aura} wraps the athlete.`
    )
  }

  switch (shot.sceneType) {
    case 'face_off':
      return (
        `Subject: two rival athletes face to face — one wearing a ${home.kit} with a ${home.aura}, ` +
        `the other a ${away.kit} with a ${away.aura}; the two auras clash between them.`
      )
    case 'goalkeeper_save': {
      const attacking = shot.teamSide === 'away' ? away : home
      const defending = attacking === home ? away : home
      return (
        `Subject: a goalkeeper wearing a ${defending.kit} diving full-stretch to deny ` +
        `an attacker wearing a ${attacking.kit}.`
      )
    }
    case 'goal_montage':
      return (
        `Subject: three different strikers, some in a ${home.kit}, some in a ${away.kit}, ` +
        `each completing a finish.`
      )
    case 'final_result': {
      // Kit du vainqueur forcé (cf. fix winner-kit) ; générique seulement en cas de nul.
      if (shot.teamSide === 'home' || shot.teamSide === 'away') {
        const kit = bible.teams[shot.teamSide]
        return `Subject: a single victorious athlete wearing a ${kit.kit}, arms raised in triumph.`
      }
      return `Subject: a single victorious athlete, arms raised, in bold flat team colours, no crest, no number.`
    }
    default:
      return `Subject: an athlete in bold flat team colours, no crest, no number.`
  }
}

/** Assemble le prompt final d'un plan. */
export function buildImagePrompt(bible: MatchBible, shot: Shot, opts: PromptOptions = {}): string {
  const likeness: CharacterLikeness = opts.characterLikeness ?? 'independent'
  const faceNotAnchor = likeness === 'independent'
  const animated = (opts.renderLevel ?? 'motion') === 'animated'

  // Style / negative / fragment conditionnels au tier (cf. corrections §1/§2).
  const styleBlock = animated ? STYLE_BLOCK_ANIMATED : STYLE_BLOCK
  const negBlock = animated ? NEGATIVE_BLOCK_ANIMATED : NEGATIVE_BLOCK
  const isGoal = GOAL_TYPE_SET.has(shot.sceneType)
  // Tier animated + but → variante « instant avant » (first frame que l'i2v anime).
  const action = animated && isGoal ? GOAL_FIRST_FRAME[shot.sceneType as GoalType] : SCENE_FRAGMENTS[shot.sceneType]

  const cameraLine = faceNotAnchor
    ? `Camera: ${bible.camera.format}, ${cameraFor(bible, shot.sceneType)}; ${FACE_NOT_ANCHOR}.`
    : `Camera: ${bible.camera.format}, ${cameraFor(bible, shot.sceneType)}.`

  const subject = subjectBlock(bible, shot)
  const subjectLine = faceNotAnchor
    ? `${subject} The face is kept in shadow — not the focal point.`
    : subject

  return [
    styleBlock,
    worldBlock(bible),
    cameraLine,
    subjectLine,
    `Action: ${action}`,
    `Negative: ${negBlock}.`,
  ].join('\n\n')
}

export interface BuiltPrompt {
  order: number
  sceneType: SceneType
  playerName: string | null
  prompt: string
}

/** Construit les prompts des 8 plans. */
export function buildAllPrompts(bible: MatchBible, shots: Shot[], opts: PromptOptions = {}): BuiltPrompt[] {
  return shots.map(shot => ({
    order: shot.order,
    sceneType: shot.sceneType,
    playerName: shot.playerName,
    prompt: buildImagePrompt(bible, shot, opts),
  }))
}
