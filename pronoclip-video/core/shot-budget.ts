// Budget de plans — allocation des 8 créneaux (cf. MISSION §5).
// 3 plans d'intro fixes (team_reveal, rival_reveal, face_off) + 4 créneaux libres
// + 1 outro fixe (final_result). Les buts suivent l'ordre chronologique (matchOrder).
// Pur : aucune I/O, déterministe.

import type { GoalPrediction, Score, Shot, TeamSide } from './types'
import { goalCaption, SCENE_CAPTIONS } from './labels'

export interface ShotBudgetInput {
  home: { name: string; keyPlayer?: string }
  away: { name: string; keyPlayer?: string }
  score: Score
  /** Buts déjà résolus, dans l'ordre chronologique. */
  goals: GoalPrediction[]
  knockout?: boolean
}

interface TopScorer {
  name: string
  side: TeamSide
  count: number
}

function mostFrequent(goals: GoalPrediction[]): TopScorer | null {
  let best: TopScorer | null = null
  const counts = new Map<string, TopScorer>()
  for (const g of goals) {
    const entry = counts.get(g.playerName) ?? { name: g.playerName, side: g.teamSide, count: 0 }
    entry.count += 1
    counts.set(g.playerName, entry)
    if (!best || entry.count > best.count) best = entry
  }
  return best
}

function goalShot(order: number, g: GoalPrediction): Shot {
  return {
    order,
    sceneType: g.goalType,
    teamSide: g.teamSide,
    playerName: g.playerName,
    caption: goalCaption(g.goalType, g.playerName),
    goalType: g.goalType,
  }
}

/** Répartit buts et plans de remplissage sur les 8 créneaux. Renvoie toujours 8 plans. */
export function allocateShots(input: ShotBudgetInput): Shot[] {
  const { home, away, score, goals } = input
  const homeGoals = goals.filter(g => g.teamSide === 'home')
  const awayGoals = goals.filter(g => g.teamSide === 'away')

  const homeHero = mostFrequent(homeGoals)?.name ?? home.keyPlayer ?? home.name
  const awayHero = mostFrequent(awayGoals)?.name ?? away.keyPlayer ?? away.name
  const overallTop = mostFrequent(goals)

  const winnerSide: TeamSide | null =
    score.home > score.away ? 'home' : score.away > score.home ? 'away' : null
  const winnerHero = winnerSide === 'home' ? homeHero : winnerSide === 'away' ? awayHero : null

  const chrono = [...goals].sort((a, b) => a.matchOrder - b.matchOrder)
  const G = chrono.length

  // --- Les 4 créneaux libres (index 4..7) --------------------------------
  let middle: Shot[] = []

  if (G === 0) {
    // Scénario 0-0 : occasion manquée, arrêts des deux côtés, détermination.
    middle = [
      { order: 0, sceneType: 'big_chance_missed', teamSide: 'home', playerName: homeHero, caption: SCENE_CAPTIONS.big_chance_missed! },
      { order: 0, sceneType: 'goalkeeper_save', teamSide: 'away', playerName: null, caption: SCENE_CAPTIONS.goalkeeper_save! },
      { order: 0, sceneType: 'determination', teamSide: 'home', playerName: homeHero, caption: SCENE_CAPTIONS.determination! },
      { order: 0, sceneType: 'goalkeeper_save', teamSide: 'home', playerName: null, caption: SCENE_CAPTIONS.goalkeeper_save! },
    ]
  } else if (G > 4) {
    // Plus de buts que de créneaux : 3 buts pleins + 1 montage qui absorbe le reste.
    const full = chrono.slice(0, 3).map(g => goalShot(0, g))
    const rest = chrono.slice(3)
    const names = rest.map(g => g.playerName).join(', ')
    const montage: Shot = {
      order: 0,
      sceneType: 'goal_montage',
      teamSide: 'both',
      playerName: null,
      caption: `BUTS : ${names}`,
      mergedScorers: rest.map(g => ({ playerName: g.playerName, goalType: g.goalType })),
    }
    middle = [...full, montage]
  } else {
    // 1 ≤ G ≤ 4 : G plans de but (chronologiques) + remplissage par priorité.
    const goalShots = chrono.map(g => goalShot(0, g))
    const spare = 4 - G
    const cleanSheet = score.home === 0 || score.away === 0
    const closedMatch = score.home + score.away <= 2
    const gkSaveSide: TeamSide =
      score.away === 0 ? 'home' : score.home === 0 ? 'away' : score.home <= score.away ? 'away' : 'home'

    // Priorité : celebration > power_up > goalkeeper_save > determination.
    const candidates: Shot[] = []
    if (winnerSide) {
      candidates.push({ order: 0, sceneType: 'celebration', teamSide: winnerSide, playerName: winnerHero, caption: SCENE_CAPTIONS.celebration! })
    }
    if (overallTop) {
      candidates.push({ order: 0, sceneType: 'power_up', teamSide: overallTop.side, playerName: overallTop.name, caption: SCENE_CAPTIONS.power_up! })
    }
    if (cleanSheet || closedMatch) {
      candidates.push({ order: 0, sceneType: 'goalkeeper_save', teamSide: gkSaveSide, playerName: null, caption: SCENE_CAPTIONS.goalkeeper_save! })
    }

    const fillers = candidates.slice(0, spare)
    while (fillers.length < spare) {
      fillers.push({ order: 0, sceneType: 'determination', teamSide: 'home', playerName: homeHero, caption: SCENE_CAPTIONS.determination! })
    }
    middle = [...goalShots, ...fillers]
  }

  // --- Assemblage : intro + middle + outro, renumérotés 1..8 ----------------
  const all: Shot[] = [
    { order: 0, sceneType: 'team_reveal', teamSide: 'home', playerName: homeHero, caption: home.name },
    { order: 0, sceneType: 'rival_reveal', teamSide: 'away', playerName: awayHero, caption: away.name },
    { order: 0, sceneType: 'face_off', teamSide: 'both', playerName: null, caption: `${home.name} vs ${away.name}` },
    ...middle,
    { order: 0, sceneType: 'final_result', teamSide: 'both', playerName: null, caption: SCENE_CAPTIONS.final_result! },
  ]

  return all.map((shot, i) => ({ ...shot, order: i + 1 }))
}
