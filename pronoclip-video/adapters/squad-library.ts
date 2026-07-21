// Adaptateur : lecture de la bibliothèque de portraits semée sur disque
// (cf. ADR 2026-07-13 + reference/specs/pronoclip-squad-index.md).
//
// Frontière I/O : le cœur (core/) reste pur et ne connaît pas le disque. C'est ici
// qu'on lit les `index.json` d'effectifs, qu'on résout un portrait avec repli de
// namespace (marque → canonique), et qu'on projette l'effectif vers le domaine core.
//
// Règle dure (cf. ADR §3.2/§3.4) : les vidéos LISENT la bibliothèque, elles ne la
// SÈMENT jamais. Portrait absent → erreur explicite, JAMAIS de génération silencieuse.

import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve, join, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CANONICAL_NAMESPACE, NotSeededError, namespaceOrder } from '../core/portrait-index'
import type { Player, PlayerProfile, Position } from '../core/types'

/** Version du schéma d'`index.json`. Un changement cassant l'incrémente. */
export const SQUAD_SCHEMA = 'pronoclip.squad/v1'

/** Racine par défaut de la donnée client (gitignorée), sibling de `pronoclip-output/`. */
const here = dirname(fileURLToPath(import.meta.url))
export const DEFAULT_DATA_ROOT = resolve(here, '../pronoclip-data')

// ---------------------------------------------------------------------------
// Schéma du fichier (source de vérité unique de l'effectif)
// ---------------------------------------------------------------------------

/** Profil football d'un joueur DANS LE FICHIER (position stockée à part — cf. spec §3.1). */
export interface SquadProfile {
  heading?: number
  longRange?: number
  setPieces?: number
  isPenaltyTaker?: boolean
}

/** Rôle dans l'effectif. `coach`/`staff` = présent pour son portrait, jamais buteur. */
export type SquadRole = 'player' | 'coach' | 'staff'

/** Une entrée joueur de l'`index.json`. `portrait` est relatif au dossier de l'équipe. */
export interface SquadPlayerEntry {
  name: string
  /** Requise pour un joueur ; omise pour un non-joueur (`role` coach/staff). */
  position?: Position
  /** Défaut `player`. `coach`/`staff` → exclu du vivier de buteurs (cf. `loadRoster`). */
  role?: SquadRole
  isKeyPlayer?: boolean
  profile?: SquadProfile
  /** Chemin relatif (`portraits/x.png`), URL `https://…`, chemin absolu, ou `null` si non généré. */
  portrait: string | null
}

/** Un non-joueur (entraîneur/staff) n'est jamais choisi comme buteur par le moteur. */
export function isFieldPlayer(entry: SquadPlayerEntry): boolean {
  return entry.role == null || entry.role === 'player'
}

/** Le fichier `index.json` complet d'un effectif semé. */
export interface SquadFile {
  $schema: string
  namespace: string
  team: string
  team_code: string
  seeded_at: string | null
  players: SquadPlayerEntry[]
}

/** Options communes : racine de données et namespace canonique (surchargées en test). */
export interface SquadLibraryOptions {
  dataRoot?: string
  canonicalNamespace?: string
}

// ---------------------------------------------------------------------------
// Erreurs explicites (jamais de génération silencieuse — cf. ADR §3.4)
// ---------------------------------------------------------------------------

// `NotSeededError` (joueur absent de TOUS les namespaces) est réutilisée depuis le
// cœur pour n'avoir qu'un seul type d'erreur « non semé » dans tout le pipeline.
export { NotSeededError }

/**
 * Le joueur EST dans l'effectif, mais son portrait n'a pas encore été généré
 * (`portrait: null`). Distinct de `NotSeededError` : ici l'effectif est semé, seul le
 * PNG manque. On lève plutôt que de retourner `null` pour ne rien laisser passer en silence.
 */
export class PortraitPendingError extends Error {
  constructor(
    public readonly team: string,
    public readonly player: string,
    public readonly namespace: string,
  ) {
    super(
      `Portrait non généré : « ${player} » (${team}) est bien dans l'effectif « ${namespace} » ` +
      `mais son portrait n'a pas encore été produit. Lance « /pronoclip-squad ${team} » pour ` +
      `générer et geler les portraits.`,
    )
    this.name = 'PortraitPendingError'
  }
}

// ---------------------------------------------------------------------------
// Chemins & chargement
// ---------------------------------------------------------------------------

/** Slug ASCII d'une équipe → segment `<team_code>` du chemin. « France » → `france`. */
export function slugifyTeam(team: string): string {
  return team
    .normalize('NFD').replace(/\p{Diacritic}/gu, '') // enlève les accents (marques combinantes)
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** Chemin absolu de l'`index.json` pour un namespace + une équipe. */
export function squadFilePath(root: string, namespace: string, teamCode: string): string {
  return join(root, 'squads', namespace, teamCode, 'index.json')
}

/** Valide l'intégrité minimale d'un fichier chargé (source de vérité : pas de doublon). */
function validateSquadFile(sq: unknown, path: string): asserts sq is SquadFile {
  const bad = (why: string): never => {
    throw new Error(`index.json invalide (${path}) : ${why}.`)
  }
  if (!sq || typeof sq !== 'object') bad('racine JSON absente ou non-objet')
  const s = sq as Record<string, unknown>
  if (typeof s.namespace !== 'string' || !s.namespace) bad('champ « namespace » manquant')
  if (typeof s.team_code !== 'string' || !s.team_code) bad('champ « team_code » manquant')
  if (!Array.isArray(s.players)) bad('champ « players » absent ou non-tableau')
  const seen = new Set<string>()
  for (const [i, p] of (s.players as unknown[]).entries()) {
    if (!p || typeof p !== 'object') bad(`joueur #${i} non-objet`)
    const pl = p as Record<string, unknown>
    const name = pl.name
    if (typeof name !== 'string' || !name) throw new Error(`index.json invalide (${path}) : joueur #${i} sans « name ».`)
    if (seen.has(name)) bad(`joueur « ${name} » en double (un effectif = une seule vérité)`)
    seen.add(name)
    const role = pl.role
    if (role != null && role !== 'player' && role !== 'coach' && role !== 'staff') bad(`joueur « ${name} » : « role » inconnu (${String(role)})`)
    // La position n'est requise que pour un vrai joueur (un entraîneur n'en a pas).
    if ((role == null || role === 'player') && typeof pl.position !== 'string') bad(`joueur « ${name} » sans « position »`)
    if (pl.portrait != null && typeof pl.portrait !== 'string') bad(`joueur « ${name} » : « portrait » doit être string ou null`)
    if (pl.profile != null && typeof pl.profile !== 'object') bad(`joueur « ${name} » : « profile » doit être un objet`)
  }
}

/**
 * Charge l'`index.json` d'un namespace + équipe, ou `null` si le fichier n'existe pas
 * (non semé pour ce namespace). Lève si le fichier existe mais est malformé.
 */
export function loadSquadFile(
  namespace: string,
  team: string,
  opts: SquadLibraryOptions = {},
): SquadFile | null {
  const root = opts.dataRoot ?? DEFAULT_DATA_ROOT
  const teamCode = slugifyTeam(team)
  const path = squadFilePath(root, namespace, teamCode)
  if (!existsSync(path)) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    throw new Error(`index.json illisible (${path}) : ${(e as Error).message}`)
  }
  validateSquadFile(parsed, path)
  return parsed
}

// ---------------------------------------------------------------------------
// Résolution (marque d'abord, puis canonique — cf. ADR §7.1)
// ---------------------------------------------------------------------------

/** Un joueur résolu : dans quel namespace il a été trouvé, et son entrée brute. */
export interface ResolvedPlayer {
  namespace: string
  team: string
  teamCode: string
  entry: SquadPlayerEntry
}

/**
 * Résout un joueur dans l'ordre `[marque, pronoclip]`, ou lève `NotSeededError`.
 * Un revendeur hérite donc de `pronoclip/` et peut surcharger par joueur.
 */
export function resolvePlayer(
  playerName: string,
  team: string,
  brandNamespace: string,
  opts: SquadLibraryOptions = {},
): ResolvedPlayer {
  const order = namespaceOrder(brandNamespace, opts.canonicalNamespace ?? CANONICAL_NAMESPACE)
  const teamCode = slugifyTeam(team)
  for (const ns of order) {
    const squad = loadSquadFile(ns, team, opts)
    const entry = squad?.players.find(p => p.name === playerName)
    if (squad && entry) return { namespace: ns, team: squad.team, teamCode, entry }
  }
  throw new NotSeededError(team, playerName)
}

/**
 * Résout le CHEMIN du portrait d'un joueur, ou lève :
 * - `NotSeededError` s'il est absent de tous les namespaces ;
 * - `PortraitPendingError` s'il est semé mais `portrait: null`.
 * Un `portrait` relatif est résolu contre le dossier de l'équipe ; une URL `https://`
 * ou un chemin absolu est renvoyé tel quel.
 */
export function resolvePortrait(
  playerName: string,
  team: string,
  brandNamespace: string,
  opts: SquadLibraryOptions = {},
): string {
  const root = opts.dataRoot ?? DEFAULT_DATA_ROOT
  const { entry, namespace, teamCode } = resolvePlayer(playerName, team, brandNamespace, opts)
  if (entry.portrait == null) {
    throw new PortraitPendingError(team, playerName, namespace)
  }
  if (/^https?:\/\//i.test(entry.portrait) || isAbsolute(entry.portrait)) return entry.portrait
  return join(root, 'squads', namespace, teamCode, entry.portrait)
}

// ---------------------------------------------------------------------------
// Projection vers le domaine core (une seule source de vérité pour l'effectif)
// ---------------------------------------------------------------------------

/**
 * Fusionne `position` + `profile` du fichier en un `Player` core (pour `prediction.ts`).
 * Un non-joueur (entraîneur/staff) est marqué `isPlayer: false` et n'a pas de `profile`.
 */
export function toPlayer(entry: SquadPlayerEntry): Player {
  if (isFieldPlayer(entry)) {
    const profile: PlayerProfile = { position: entry.position ?? 'MF', ...entry.profile }
    return { name: entry.name, isKeyPlayer: entry.isKeyPlayer, profile }
  }
  return { name: entry.name, isPlayer: false }
}

/**
 * Effectif d'une équipe projeté vers `Player[]` core, fusion marque → canonique
 * (la marque surcharge par nom ; l'union des deux est renvoyée). C'est CE MÊME fichier
 * `index.json` qui nourrit le pronostic — pas de seconde liste de joueurs ailleurs.
 * Les non-joueurs (entraîneur/staff) sont EXCLUS : l'effectif rendu ne contient que des
 * buteurs potentiels. Lève si aucun namespace n'a semé l'équipe.
 */
export function loadRoster(
  team: string,
  brandNamespace: string,
  opts: SquadLibraryOptions = {},
): Player[] {
  const order = namespaceOrder(brandNamespace, opts.canonicalNamespace ?? CANONICAL_NAMESPACE)
  // On empile du canonique vers la marque : la marque (tête de l'ordre) écrase en dernier.
  const byName = new Map<string, Player>()
  let found = false
  for (const ns of [...order].reverse()) {
    const squad = loadSquadFile(ns, team, opts)
    if (!squad) continue
    found = true
    for (const entry of squad.players) {
      if (isFieldPlayer(entry)) byName.set(entry.name, toPlayer(entry))
      else byName.delete(entry.name) // un override marque peut retirer un joueur (le passer non-joueur)
    }
  }
  if (!found) {
    throw new Error(
      `Effectif non semé : aucun joueur pour « ${team} » (namespaces essayés : ${order.join(', ')}). ` +
      `Lance « /pronoclip-squad ${team} » pour semer l'effectif.`,
    )
  }
  return [...byName.values()]
}
