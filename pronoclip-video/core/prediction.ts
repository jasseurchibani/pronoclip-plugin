// Moteur de pronostic (cf. MISSION §6).
// Portage de auto-prediction.ts + prediction-validator.ts du site, adapté au
// contexte football (pas de ticket) : le score se déduit du contexte, les
// contraintes de marché restent des entrées OPTIONNELLES.
//
// Règle dure : on ne prédit JAMAIS par-dessus une valeur fournie (L0 → L3).
// Pur : aucune I/O, entièrement déterministe pour une graine donnée.

import type {
  GoalPrediction,
  GoalType,
  InputLevel,
  MarketConstraints,
  Prediction,
  PredictionInput,
  Player,
  Score,
  TeamSide,
} from './types'
import { makeRng, seedFromString, weightedPick } from './rng'

// ---------------------------------------------------------------------------
// Plafonds de réalisme (repris de prediction-validator.ts — MISSION §5/§6)
// ---------------------------------------------------------------------------

export const MAX_GOALS_PER_TEAM = 5
export const MAX_GOALS_TOTAL = 7

/** Valide un score fourni par l'utilisateur. Lève une erreur explicite si irréaliste. */
export function validateScore(score: Score, knockout = false): void {
  const { home, away } = score
  for (const [side, n] of [['home', home], ['away', away]] as const) {
    if (!Number.isInteger(n) || n < 0) {
      throw new Error(`Score invalide : ${side} doit être un entier ≥ 0 (reçu ${n}).`)
    }
  }
  if (home > MAX_GOALS_PER_TEAM || away > MAX_GOALS_PER_TEAM) {
    throw new Error(`Score irréaliste — maximum ${MAX_GOALS_PER_TEAM} buts par équipe.`)
  }
  if (home + away > MAX_GOALS_TOTAL) {
    throw new Error(`Score irréaliste — maximum ${MAX_GOALS_TOTAL} buts au total.`)
  }
  if (knockout && home === away) {
    throw new Error('Match à élimination directe : un score nul (égalité) est interdit.')
  }
}

// ---------------------------------------------------------------------------
// Sélection du score
// ---------------------------------------------------------------------------

/** Un score satisfait-il les contraintes de marché fournies ? */
function satisfies(h: number, a: number, m: MarketConstraints): boolean {
  if (m.result === 'home' && !(h > a)) return false
  if (m.result === 'draw' && h !== a) return false
  if (m.result === 'away' && !(a > h)) return false
  if (m.ou25 === 'over' && h + a < 3) return false
  if (m.ou25 === 'under' && h + a > 2) return false
  if (m.btts === 'yes' && !(h >= 1 && a >= 1)) return false
  if (m.btts === 'no' && !(h === 0 || a === 0)) return false
  return true
}

/** Table plafonnée à 2 buts/équipe (mode auto), pondérée par réalisme. Domicile avantagé. */
const CAPPED_CANDIDATES: ReadonlyArray<readonly [Score, number]> = [
  [{ home: 1, away: 1 }, 16],
  [{ home: 2, away: 1 }, 15],
  [{ home: 1, away: 0 }, 14],
  [{ home: 2, away: 0 }, 10],
  [{ home: 1, away: 2 }, 9],
  [{ home: 0, away: 1 }, 8],
  [{ home: 2, away: 2 }, 8],
  [{ home: 0, away: 0 }, 7],
  [{ home: 0, away: 2 }, 5],
]

/** Table non plafonnée (repli quand une contrainte de marché est impossible à 2/équipe). */
const UNCAPPED_CANDIDATES: ReadonlyArray<Score> = [
  { home: 1, away: 0 }, { home: 0, away: 1 }, { home: 1, away: 1 },
  { home: 2, away: 1 }, { home: 1, away: 2 }, { home: 2, away: 0 },
  { home: 0, away: 2 }, { home: 2, away: 2 }, { home: 3, away: 1 },
  { home: 1, away: 3 }, { home: 3, away: 0 }, { home: 0, away: 3 },
  { home: 3, away: 2 }, { home: 2, away: 3 }, { home: 0, away: 0 },
  { home: 3, away: 3 },
]

/**
 * Choisit un score réaliste en mode auto (plafond 2/équipe).
 * - contraintes de marché → filtre la table (repli non plafonné si impossible) ;
 * - sinon → tirage pondéré par réalisme, avec avantage domicile et biais de force.
 */
function autoScore(
  rng: () => number,
  market: MarketConstraints | undefined,
  knockout: boolean,
  homeStrength?: number,
  awayStrength?: number,
): Score {
  const isDraw = (s: Score) => s.home === s.away
  const isWinPick = market?.result === 'home' || market?.result === 'away'

  // Biais de force : incline les scorelines vers l'équipe la plus forte.
  const tilt = (s: Score, base: number): number => {
    if (homeStrength == null || awayStrength == null) return base
    const factor = 1 + 0.5 * (s.home - s.away) * (homeStrength - awayStrength)
    return Math.max(0.05, base * factor)
  }

  let pool = CAPPED_CANDIDATES.filter(([s]) => {
    if (knockout && isDraw(s)) return false
    if (isWinPick && s.home === 0 && s.away === 0) return false
    if (market && !satisfies(s.home, s.away, market)) return false
    return true
  })

  if (pool.length === 0) {
    // Aucune scoreline plafonnée ne satisfait le marché (ex. over + clean sheet).
    const fallback = UNCAPPED_CANDIDATES.find(
      s => (!knockout || !isDraw(s)) && (!market || satisfies(s.home, s.away, market)),
    )
    if (fallback) return fallback
    // Repli ultime cohérent.
    return knockout ? { home: 1, away: 0 } : { home: 1, away: 1 }
  }

  const weighted = pool.map(([s, w]) => [s, tilt(s, w)] as const)
  return weightedPick(rng, weighted)
}

// ---------------------------------------------------------------------------
// Buteurs + types de but
// ---------------------------------------------------------------------------

/** Pondération réaliste des types de but (cf. MISSION §6). */
const GOAL_TYPE_WEIGHTS: ReadonlyArray<readonly [GoalType, number]> = [
  ['goal_normal', 0.5],
  ['goal_header', 0.15],
  ['goal_volley', 0.1],
  ['goal_longrange', 0.1],
  ['goal_freekick', 0.08],
  ['goal_penalty', 0.05],
  ['goal_bicycle', 0.02],
]

function randomGoalType(rng: () => number): GoalType {
  return weightedPick(rng, GOAL_TYPE_WEIGHTS)
}

/** Séquence chronologique des buts, en commençant par le domicile (2-1 → H, A, H). */
function interleave(homeGoals: number, awayGoals: number): TeamSide[] {
  const seq: TeamSide[] = []
  let h = homeGoals
  let a = awayGoals
  let turn: TeamSide = 'home'
  while (h + a > 0) {
    if (turn === 'home' && h > 0) { seq.push('home'); h--; turn = 'away' }
    else if (turn === 'away' && a > 0) { seq.push('away'); a--; turn = 'home' }
    else if (h > 0) { seq.push('home'); h-- }
    else { seq.push('away'); a-- }
  }
  return seq
}

/** Effectif trié : joueur clé d'abord, puis ordre stable. */
function keyFirst(players: Player[]): Player[] {
  return [...players].sort((a, b) => Number(b.isKeyPlayer) - Number(a.isKeyPlayer))
}

/**
 * nᵉ but (1-based) d'une équipe → buteur. Répartition la plus égale possible
 * (jamais 3× le même tant que l'effectif le permet — cf. MISSION §6).
 */
function scorerFor(players: Player[], goalOrder: number): Player {
  if (players.length === 0) return { name: 'Joueur' }
  const idx = (goalOrder - 1) % players.length
  return players[idx]
}

// ---------------------------------------------------------------------------
// Détection du niveau d'entrée
// ---------------------------------------------------------------------------

export function detectInputLevel(input: PredictionInput): InputLevel {
  if (!input.score) return 'L0'
  const goals = input.goals ?? []
  if (goals.length === 0) return 'L1'
  const allScorers = goals.every(g => !!g.playerName)
  const allTypes = goals.every(g => !!g.goalType)
  if (allScorers && allTypes) return 'L3'
  if (allScorers) return 'L2'
  return 'L1'
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

export function predictMatch(input: PredictionInput): Prediction {
  const knockout = input.knockout ?? false
  const seed = input.seed ?? seedFromString(`${input.home.name}|${input.away.name}`)
  const rng = makeRng(seed)
  const level = detectInputLevel(input)

  // 1. Score : fourni (validé) OU auto (plafonné 2/équipe).
  let score: Score
  if (input.score) {
    validateScore(input.score, knockout)
    if (input.market && !satisfies(input.score.home, input.score.away, input.market)) {
      throw new Error('Le score fourni est incompatible avec les contraintes de marché.')
    }
    score = { ...input.score }
  } else {
    score = autoScore(rng, input.market, knockout, input.home.strength, input.away.strength)
  }

  // 2. Squelette des buts : buts fournis (respectés) OU interleave chronologique.
  const providedGoals = input.goals ?? []
  let slots: { teamSide: TeamSide; matchOrder: number; playerName?: string; goalType?: GoalType }[]

  if (providedGoals.length > 0) {
    const homeCount = providedGoals.filter(g => g.teamSide === 'home').length
    const awayCount = providedGoals.filter(g => g.teamSide === 'away').length
    if (homeCount !== score.home || awayCount !== score.away) {
      throw new Error(
        `Incohérence : ${providedGoals.length} but(s) fourni(s) (${homeCount}-${awayCount}) ` +
        `ne correspondent pas au score ${score.home}-${score.away}.`,
      )
    }
    slots = providedGoals.map((g, i) => ({
      teamSide: g.teamSide,
      matchOrder: g.matchOrder ?? i + 1,
      playerName: g.playerName,
      goalType: g.goalType,
    }))
    slots.sort((a, b) => a.matchOrder - b.matchOrder)
  } else {
    slots = interleave(score.home, score.away).map((teamSide, i) => ({
      teamSide,
      matchOrder: i + 1,
    }))
  }

  // 3. Remplir UNIQUEMENT ce qui manque (jamais par-dessus une valeur fournie).
  const homePlayers = keyFirst(input.home.players)
  const awayPlayers = keyFirst(input.away.players)
  let homeGoalOrder = 0
  let awayGoalOrder = 0

  const goals: GoalPrediction[] = slots.map(slot => {
    const goalOrder = slot.teamSide === 'home' ? ++homeGoalOrder : ++awayGoalOrder
    let playerName = slot.playerName
    let playerId: string | undefined
    if (!playerName) {
      const scorer = scorerFor(slot.teamSide === 'home' ? homePlayers : awayPlayers, goalOrder)
      playerName = scorer.name
      playerId = scorer.id
    }
    const goalType = slot.goalType ?? randomGoalType(rng)
    return {
      matchOrder: slot.matchOrder,
      teamSide: slot.teamSide,
      goalOrder,
      playerId,
      playerName,
      goalType,
    }
  })

  return {
    inputLevel: level,
    score,
    goals,
    autoGenerated: {
      score: level === 'L0',
      scorers: level === 'L0' || level === 'L1',
      goalTypes: level !== 'L3',
    },
  }
}
