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
  Position,
  Prediction,
  PredictionInput,
  Player,
  Score,
  TeamSide,
} from './types'
import { makeRng, randomSeed, weightedPick } from './rng'

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

// Valeurs par défaut par poste (utilisées si le profil ne précise pas la stat).
const POS_AERIAL: Record<Position, number> = { GK: 0.1, DF: 0.75, MF: 0.4, WG: 0.15, FW: 0.7 }
const POS_LONGRANGE: Record<Position, number> = { GK: 0, DF: 0.25, MF: 0.6, WG: 0.5, FW: 0.45 }
const POS_VOLLEY: Record<Position, number> = { GK: 0, DF: 0.2, MF: 0.4, WG: 0.6, FW: 0.8 }
const POS_BICYCLE: Record<Position, number> = { GK: 0, DF: 0.05, MF: 0.15, WG: 0.35, FW: 0.6 }

/**
 * Pondération des types de but POUR CE JOUEUR (cf. MISSION correction §6).
 * `goal_normal` reste la base ; les autres sont modulés par le profil.
 * La tête est **quadratique** en aptitude aérienne (`aerial²`) : elle ne fait pas
 * qu'incliner le tirage, elle l'ÉCRASE. Un attaquant à heading bas (ailier,
 * finisseur de vitesse) ne sort quasiment jamais `goal_header` — ex. aerial 0.15
 * → poids ≈ 0.8 face à 50 pour `goal_normal` (< 1 %). Un pivot aérien (0.85) →
 * poids ≈ 24.6, franchement présent.
 * - penalty : réservé au tireur désigné (0 sinon) ;
 * - coup franc : proportionnel à `setPieces` (0 pour un non-tireur) ;
 * - frappe lointaine / volée / retourné : modulés par le poste.
 */
function goalTypeWeightsFor(player?: Player): ReadonlyArray<readonly [GoalType, number]> {
  const prof = player?.profile
  const pos = prof?.position
  const aerial = prof?.heading ?? (pos ? POS_AERIAL[pos] : 0.4)
  const longR = prof?.longRange ?? (pos ? POS_LONGRANGE[pos] : 0.35)
  const volley = pos ? POS_VOLLEY[pos] : 0.3
  const bicycle = pos ? POS_BICYCLE[pos] : 0.15
  const setPieces = prof?.setPieces ?? 0
  const penaltyTaker = prof?.isPenaltyTaker ?? false
  return [
    ['goal_normal', 50],
    ['goal_header', 34 * aerial * aerial],
    ['goal_volley', 10 * volley],
    ['goal_longrange', 16 * longR],
    ['goal_freekick', 16 * setPieces],
    ['goal_penalty', penaltyTaker ? 9 : 0],
    ['goal_bicycle', 5 * bicycle],
  ]
}

function goalTypeFor(rng: () => number, player?: Player): GoalType {
  return weightedPick(rng, goalTypeWeightsFor(player))
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

/**
 * Effectif trié pour la sélection AUTO des buteurs : joueurs clés d'abord, gardiens en
 * dernier (un GK ne marque quasiment jamais), sinon ordre stable de l'effectif.
 * NB : comparateur booléen-sûr (`Number(undefined)` = NaN casserait le tri — bug corrigé).
 */
function scorerOrder(players: Player[]): Player[] {
  const rank = (p: Player) => (p.isKeyPlayer ? 0 : 1) + (p.profile?.position === 'GK' ? 2 : 0)
  return [...players].sort((a, b) => rank(a) - rank(b))
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
  // Graine = paramètre d'entrée ; défaut ALÉATOIRE (jamais dérivée des noms).
  const seed = input.seed ?? randomSeed()
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

  // 3. L'effectif est une ENTRÉE, jamais une connaissance du modèle (cf. MISSION
  // correction §6). On refuse d'inventer des buteurs : si un but doit être attribué
  // automatiquement et que le camp concerné n'a pas d'effectif fourni → erreur.
  // Les non-joueurs (entraîneur, staff : `isPlayer === false`) ne sont JAMAIS choisis
  // automatiquement comme buteurs — ils sont exclus du vivier de sélection.
  const isFieldPlayer = (p: Player) => p.isPlayer !== false
  const homePlayers = scorerOrder(input.home.players.filter(isFieldPlayer))
  const awayPlayers = scorerOrder(input.away.players.filter(isFieldPlayer))
  const needsHomeScorer = slots.some(s => s.teamSide === 'home' && !s.playerName)
  const needsAwayScorer = slots.some(s => s.teamSide === 'away' && !s.playerName)
  if (needsHomeScorer && homePlayers.length === 0) {
    throw new Error(
      `Effectif domicile requis pour prédire les buteurs (${input.home.name}). ` +
      `Fournis l'effectif via ./pronoclip-data/ ou le paramètre home.players.`,
    )
  }
  if (needsAwayScorer && awayPlayers.length === 0) {
    throw new Error(
      `Effectif extérieur requis pour prédire les buteurs (${input.away.name}). ` +
      `Fournis l'effectif via ./pronoclip-data/ ou le paramètre away.players.`,
    )
  }

  // Index nom → joueur (pour retrouver le profil, buteur fourni comme prédit).
  const byName = new Map<string, Player>()
  for (const p of [...input.home.players, ...input.away.players]) byName.set(p.name, p)

  // 4. Remplir UNIQUEMENT ce qui manque (jamais par-dessus une valeur fournie).
  let homeGoalOrder = 0
  let awayGoalOrder = 0

  const goals: GoalPrediction[] = slots.map(slot => {
    const goalOrder = slot.teamSide === 'home' ? ++homeGoalOrder : ++awayGoalOrder
    let scorer: Player
    if (slot.playerName) {
      scorer = byName.get(slot.playerName) ?? { name: slot.playerName }
    } else {
      scorer = scorerFor(slot.teamSide === 'home' ? homePlayers : awayPlayers, goalOrder)
    }
    // Type fourni conservé ; sinon pondéré par le profil du buteur.
    const goalType = slot.goalType ?? goalTypeFor(rng, scorer)
    return {
      matchOrder: slot.matchOrder,
      teamSide: slot.teamSide,
      goalOrder,
      playerId: scorer.id,
      playerName: scorer.name,
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
