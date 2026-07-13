// Fragments d'action réécrits (cf. MISSION §4).
// RÈGLE : action + pose + mouvement de caméra UNIQUEMENT. Aucun décor (ciel, heure,
// météo, stade, foule, éclairage) — tout ça vit dans le Match Bible (world), verrouillé
// une fois et identique partout. Aucune COULEUR d'aura ici : la couleur vient toujours
// de teams[side].aura. Aucun texte/chiffre/nom. Chaque goal_* montre le ballon franchir
// la ligne ou le filet se tendre (correction du bug goal_penalty qui s'arrêtait à l'élan).

import type { SceneType } from './types'

export const SCENE_FRAGMENTS: Record<SceneType, string> = {
  team_reveal:
    'A lone athlete plants into a full-body hero stance, chin slowly rising, fists ' +
    'clenching, muscles taut and shoulders squared; a slow push-in on a low three-quarter angle.',

  rival_reveal:
    'A lone athlete turns to face the lens in a full-body hero stance, shoulders squared, ' +
    'a cold hard stare, weight shifting forward; a slow push-in on a low three-quarter angle.',

  face_off:
    'Two rival athletes stand nose to nose in profile, foreheads almost touching, jaws ' +
    'clenched, crackling tension arcing between them; a slow whip-pan snaps from one ' +
    'profile and settles between the two faces.',

  power_up:
    'The athlete rises from a low crouch, head bowing then snapping up, muscles tensing as ' +
    'an energy aura ignites and crackles off the shoulders and lifts the hair; a slow ' +
    'push-in with a subtle low-frequency shake.',

  celebration:
    'The athlete wheels away in a full sprint, arms flung wide, head thrown back mid-roar, ' +
    'teammates rushing into frame behind; the camera tracks the run then whips to a low hero angle.',

  determination:
    'Tight on the athlete’s face and shoulders, jaw set, eyes burning, chest heaving ' +
    'with heavy breath, a bead of sweat tracing the temple; an almost imperceptible slow push-in.',

  goalkeeper_save:
    'The goalkeeper explodes full-stretch through the air, body parallel to the ground, both ' +
    'arms thrown out, fingertips punching the ball clear as it screams toward frame; frozen at ' +
    'the instant of contact with slight motion blur on the hands.',

  big_chance_missed:
    'The attacker lunges full-stretch to stab at the ball, toe just grazing it as it skids a ' +
    'hair wide of the far upright; the athlete crumples, hands flying to the head in anguish; ' +
    'a quick push-in on the reaction.',

  goal_montage:
    'A single frame split into three vertical sub-panels, each a different striker completing a ' +
    'finish at the same instant — one driven side-foot, one downward header, one long strike ' +
    '— the ball crossing the line and the net snapping taut in every panel; hard cuts, high ' +
    'energy, motion arcs in each panel.',

  goal_normal:
    'The striker drives a low first-time finish, planting and sweeping through the ball; it ' +
    'rifles past the diving keeper and rips into the side netting, the net snapping violently ' +
    'taut; a dynamic follow of the ball into the goal.',

  goal_header:
    'The striker climbs above the defenders and snaps the neck through a powerful downward ' +
    'header; the ball thuds off the turf and cannons into the roof of the net, the netting ' +
    'bulging hard; the camera arcs with the leap.',

  goal_volley:
    'The striker swings through a first-time volley, body leaning back, laces meeting the ' +
    'dropping ball; it flashes over the keeper into the top corner and ripples the net; the ' +
    'camera whips to follow the strike.',

  goal_bicycle:
    'The striker throws into an acrobatic overhead bicycle kick, fully inverted in mid-air, ' +
    'boot scything through the ball; it loops over the stranded keeper and snaps into the net; ' +
    'slow-motion at the peak, then a hard cut on the bulging net.',

  goal_freekick:
    'The striker curls a dipping free kick up and over the leaping defensive wall, the keeper ' +
    'scrambling too late; the ball bends into the top corner and bulges the net; the camera ' +
    'drifts along the ball’s curving arc.',

  goal_penalty:
    'The striker steps up and strikes the penalty crisply, sending the keeper diving the wrong ' +
    'way; the ball flashes low inside the post and snaps the net taut clearly behind the goal ' +
    'line; a punch-in as the ball crosses the line, then the wheel-away.',

  goal_longrange:
    'The midfielder plants and unleashes a thunderous strike from distance, follow-through fully ' +
    'extended; the ball screams through the air and arrows into the top corner, the net snapping; ' +
    'the camera tracks the ball’s flight all the way in.',

  final_result:
    'The victorious athlete stands tall at center frame, arms spread wide and raised, chest ' +
    'heaving, eyes closed in a long exhale of triumph; a slow majestic pull-back with a slight crane up.',
}
