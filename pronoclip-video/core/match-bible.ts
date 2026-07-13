// Génération + verrouillage du « monde » (cf. MISSION §4).
// Le Match Bible est produit UNE fois par vidéo, avec la même graine que le
// match-script (regénérer un seul plan reste raccord avec les sept autres).
// Les presets de monde sont COHÉRENTS en bloc : impossible d'obtenir nuit + coucher
// de soleil dans la même vidéo. L'aura vient de teams[side].aura (bug power_up réglé).
// Athlètes fictifs (Décision A2) : fiches personnage inventées mais verrouillées.
// Pur : aucune I/O.

import type {
  MatchBible, MatchScript, PlayerBible, PortraitAsset, Team, TeamSide, WorldBible,
  WorldPresetKey, WorldSelection,
} from './types'
import { makeRng, seedFromString } from './rng'

export interface MatchBibleInput {
  script: MatchScript
  home: Team
  away: Team
  /**
   * Sélection du monde. Défaut : preset de marque VERROUILLÉ → cohérence entre
   * les 60 épisodes d'une chaîne. Passer `{ mode:'vary' }` pour une variation
   * explicite par match. Voir aussi `worldSelectionFromConfig`.
   */
  world?: WorldSelection
  /**
   * Résolveur de portraits semés (cf. ADR bibliothèque). SI FOURNI (chemin vidéo,
   * Phase 4b) : les fiches viennent de la bibliothèque gelée et une absence lève
   * « non semé ». SI ABSENT (aperçu de prompts / tests) : fiches inventées,
   * `reference_image_url` = null, AUCUNE image n'est jamais générée.
   */
  portraitFor?: (playerName: string, side: TeamSide) => PortraitAsset
}

// Presets de monde cohérents (chaque bloc se tient : heure ⇄ ciel ⇄ éclairage ⇄ grade).
// Indexés par clé pour permettre un verrouillage de marque via pronoclip.config.json.
export const WORLD_PRESETS: Record<WorldPresetKey, WorldBible> = {
  night: {
    time_of_day: 'deep night',
    sky: 'deep indigo night sky, clear, no clouds',
    weather: 'cold, dry, still air',
    stadium: 'colossal four-tier bowl stadium, packed to the roof',
    floodlights: 'eight banks of hard white floodlights, top-front key light',
    crowd: 'dense silhouetted crowd wall with scattered phone-flash specks',
    grade: 'crushed blacks, cool blue shadows, warm gold highlights',
  },
  dusk: {
    time_of_day: 'golden-hour dusk',
    sky: 'burnt-amber dusk sky fading to deep blue, thin high clouds',
    weather: 'warm, calm, still air',
    stadium: 'colossal four-tier bowl stadium, packed to the roof',
    floodlights: 'floodlights just switched on, warm-to-cool mixed key light',
    crowd: 'dense silhouetted crowd wall catching low amber light',
    grade: 'warm amber midtones, long shadows, teal shadow tones',
  },
  overcast: {
    time_of_day: 'overcast afternoon',
    sky: 'flat pale-grey overcast sky',
    weather: 'damp, heavy, windless air',
    stadium: 'colossal four-tier bowl stadium, packed to the roof',
    floodlights: 'floodlights off, soft diffused daylight',
    crowd: 'dense crowd wall under flat even light',
    grade: 'muted desaturated tones, soft contrast, cool neutral balance',
  },
}

/** Preset de marque par défaut — verrouillé, identique pour toute une chaîne. */
export const DEFAULT_WORLD_PRESET: WorldPresetKey = 'night'

/** Bloc `world` tel qu'il vit dans pronoclip.config.json. */
export interface WorldConfig {
  vary_per_match?: boolean
  preset?: WorldPresetKey
  custom?: WorldBible
}

/** Traduit le bloc `world` de la config en sélection (câblage config → Match Bible). */
export function worldSelectionFromConfig(cfg?: WorldConfig): WorldSelection {
  if (cfg?.custom) return { mode: 'custom', world: cfg.custom }
  if (cfg?.vary_per_match) return { mode: 'vary' }
  return { mode: 'preset', preset: cfg?.preset ?? DEFAULT_WORLD_PRESET }
}

/** Résout le monde effectif. Défaut = preset de marque verrouillé (cohérence chaîne). */
function resolveWorld(selection: WorldSelection | undefined, rng: () => number): WorldBible {
  const sel = selection ?? { mode: 'preset', preset: DEFAULT_WORLD_PRESET }
  if (sel.mode === 'custom') return sel.world
  if (sel.mode === 'preset') return WORLD_PRESETS[sel.preset]
  // mode 'vary' : tirage explicite par graine (cohérent dans la vidéo).
  const keys = Object.keys(WORLD_PRESETS) as WorldPresetKey[]
  return WORLD_PRESETS[keys[Math.floor(rng() * keys.length) % keys.length]]
}

const BUILDS = ['lean and wiry', 'tall and powerful', 'compact and muscular', 'broad-shouldered and athletic', 'slight and explosive']
const HAIR = ['short cropped dark hair', 'a shaved head', 'curly black hair', 'tied-back long hair', 'short blond hair', 'a buzz cut with a headband']
const SKIN = ['light', 'tan', 'brown', 'dark', 'olive']
const BOOTS = ['bright orange boots', 'white boots', 'black-and-gold boots', 'neon-green boots', 'crimson boots']

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length]
}

function kitFor(team: Team, fallbackPrimary: string): { kit: string; shorts: string; socks: string } {
  const primary = team.colors?.primary ?? fallbackPrimary
  const secondary = team.colors?.secondary
  const trim = secondary ? ` with ${secondary} trim` : ''
  return {
    kit: `solid ${primary} jersey${trim}, flat colour, no crest, no sponsor, no number`,
    shorts: `matching ${primary} shorts`,
    socks: `matching ${primary} socks`,
  }
}

export function buildMatchBible(input: MatchBibleInput): MatchBible {
  const { script, home, away } = input
  const seed = script.seed
  const rng = makeRng(seed)

  // Monde : preset de marque verrouillé par défaut ; variation seulement si demandée.
  const world = resolveWorld(input.world, rng)

  const homeKit = kitFor(home, 'deep royal blue')
  const awayKit = kitFor(away, 'crimson red')

  // Joueurs qui apparaissent réellement dans les 8 plans (buteurs + héros de reveal).
  const names = new Set<string>()
  for (const s of script.shots) if (s.playerName) names.add(s.playerName)

  const sideOf = (name: string): TeamSide =>
    home.players.some(p => p.name === name) ? 'home'
      : away.players.some(p => p.name === name) ? 'away'
      : 'home'

  const players: Record<string, PlayerBible> = {}
  for (const name of names) {
    const side = sideOf(name)
    if (input.portraitFor) {
      // Chemin vidéo : fiche LUE dans la bibliothèque semée (lève « non semé » si absent).
      const asset = input.portraitFor(name, side)
      players[name] = {
        side,
        build: asset.descriptor.build,
        hair: asset.descriptor.hair,
        skin: asset.descriptor.skin,
        number: asset.descriptor.number,
        boots: asset.descriptor.boots,
        reference_image_url: asset.portrait_url,
      }
    } else {
      // Aperçu : fiche inventée, stable par graine, sans image de référence.
      const pr = makeRng(seed ^ seedFromString(name))
      players[name] = {
        side,
        build: pick(pr, BUILDS),
        hair: pick(pr, HAIR),
        skin: pick(pr, SKIN),
        number: 1 + (Math.floor(pr() * 29) % 29),
        boots: pick(pr, BOOTS),
        reference_image_url: null,
      }
    }
  }

  return {
    world,
    camera: {
      format: 'vertical 9:16 portrait',
      reveals: '24mm low-angle hero framing',
      duels: '50mm eye-level framing',
      closeups: '85mm shallow depth of field',
      goals: '35mm dynamic framing with motion arcs',
    },
    teams: {
      home: { ...homeKit, aura: 'warm white-gold energy aura' },
      away: { ...awayKit, aura: 'cold electric-blue energy aura' },
    },
    players,
    seed,
  }
}
