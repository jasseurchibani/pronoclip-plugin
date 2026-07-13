// Résolveur de portraits de la bibliothèque canonique et partagée (cf. ADR 2026-07-13).
// Pur : aucune I/O. L'adaptateur charge les index (fichiers / manifeste HTTP) et les
// passe ici ; le core ne fait que résoudre. Résolution : namespace de marque d'abord,
// puis namespace canonique (`pronoclip`). Si rien : erreur DURE « non semé » — jamais
// de génération silencieuse (les vidéos lisent, elles ne sèment pas).

import type { PortraitAsset, SquadIndex, TeamSide } from './types'

export const CANONICAL_NAMESPACE = 'pronoclip'

/** Erreur explicite quand un joueur requis n'est pas dans la bibliothèque semée. */
export class NotSeededError extends Error {
  constructor(public readonly team: string, public readonly player: string) {
    super(
      `Effectif non semé : « ${player} » (${team}) n'est pas dans la bibliothèque de ` +
      `portraits. Lance « /pronoclip-squad ${team} » pour le semer avant de générer la vidéo.`,
    )
    this.name = 'NotSeededError'
  }
}

/** Ordre de résolution : marque d'abord, puis canonique (dédupliqué). */
export function namespaceOrder(brandNamespace: string, canonical = CANONICAL_NAMESPACE): string[] {
  return brandNamespace === canonical ? [canonical] : [brandNamespace, canonical]
}

export interface ResolvePortraitParams {
  squads: SquadIndex[]
  namespaceOrder: string[]
  team: string
  teamCode: string
  playerName: string
}

/** Résout un portrait ou lève `NotSeededError`. */
export function resolvePortrait(params: ResolvePortraitParams): PortraitAsset {
  const { squads, namespaceOrder: order, team, teamCode, playerName } = params
  for (const ns of order) {
    const idx = squads.find(s => s.namespace === ns && s.team_code === teamCode)
    const asset = idx?.players[playerName]
    if (asset) return asset
  }
  throw new NotSeededError(team, playerName)
}

/**
 * Construit un résolveur `(name, side) → PortraitAsset` prêt pour `buildMatchBible`.
 * Un revendeur hérite de `pronoclip/` par défaut et peut surcharger via son namespace.
 */
export function makePortraitResolver(params: {
  squads: SquadIndex[]
  brandNamespace: string
  canonicalNamespace?: string
  home: { name: string; teamCode: string }
  away: { name: string; teamCode: string }
}): (playerName: string, side: TeamSide) => PortraitAsset {
  const order = namespaceOrder(params.brandNamespace, params.canonicalNamespace ?? CANONICAL_NAMESPACE)
  return (playerName, side) => {
    const t = side === 'home' ? params.home : params.away
    return resolvePortrait({
      squads: params.squads,
      namespaceOrder: order,
      team: t.name,
      teamCode: t.teamCode,
      playerName,
    })
  }
}
