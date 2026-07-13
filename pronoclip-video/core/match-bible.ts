// Génération + verrouillage du « monde » (cf. MISSION §4).
// Le Match Bible est produit UNE fois par vidéo, avec la même graine que le
// match-script (regénérer un seul plan reste raccord avec les sept autres).
// Les presets de monde sont COHÉRENTS en bloc : impossible d'obtenir nuit + coucher
// de soleil dans la même vidéo. L'aura vient de teams[side].aura (bug power_up réglé).
// Athlètes fictifs (Décision A2) : fiches personnage inventées mais verrouillées.
// Pur : aucune I/O.

import type { MatchBible, MatchScript, PlayerBible, Team, TeamSide, WorldBible } from './types'
import { makeRng, seedFromString } from './rng'

export interface MatchBibleInput {
  script: MatchScript
  home: Team
  away: Team
}

// Presets de monde cohérents (chaque bloc se tient : heure ⇄ ciel ⇄ éclairage ⇄ grade).
const WORLD_PRESETS: readonly WorldBible[] = [
  {
    time_of_day: 'deep night',
    sky: 'deep indigo night sky, clear, no clouds',
    weather: 'cold, dry, still air',
    stadium: 'colossal four-tier bowl stadium, packed to the roof',
    floodlights: 'eight banks of hard white floodlights, top-front key light',
    crowd: 'dense silhouetted crowd wall with scattered phone-flash specks',
    grade: 'crushed blacks, cool blue shadows, warm gold highlights',
  },
  {
    time_of_day: 'golden-hour dusk',
    sky: 'burnt-amber dusk sky fading to deep blue, thin high clouds',
    weather: 'warm, calm, still air',
    stadium: 'colossal four-tier bowl stadium, packed to the roof',
    floodlights: 'floodlights just switched on, warm-to-cool mixed key light',
    crowd: 'dense silhouetted crowd wall catching low amber light',
    grade: 'warm amber midtones, long shadows, teal shadow tones',
  },
  {
    time_of_day: 'overcast afternoon',
    sky: 'flat pale-grey overcast sky',
    weather: 'damp, heavy, windless air',
    stadium: 'colossal four-tier bowl stadium, packed to the roof',
    floodlights: 'floodlights off, soft diffused daylight',
    crowd: 'dense crowd wall under flat even light',
    grade: 'muted desaturated tones, soft contrast, cool neutral balance',
  },
]

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

  const world = WORLD_PRESETS[Math.floor(rng() * WORLD_PRESETS.length) % WORLD_PRESETS.length]

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
    // rng propre à chaque joueur → fiche stable quel que soit l'ordre d'itération.
    const pr = makeRng(seed ^ seedFromString(name))
    players[name] = {
      side: sideOf(name),
      build: pick(pr, BUILDS),
      hair: pick(pr, HAIR),
      skin: pick(pr, SKIN),
      number: 1 + (Math.floor(pr() * 29) % 29),
      boots: pick(pr, BOOTS),
      reference_image_url: null, // rempli en Phase 4 (visage héros figé, Décision B1).
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
