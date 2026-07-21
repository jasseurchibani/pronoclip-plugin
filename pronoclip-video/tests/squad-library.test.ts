import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  slugifyTeam,
  loadSquadFile,
  resolvePlayer,
  resolvePortrait,
  loadRoster,
  toPlayer,
  NotSeededError,
  PortraitPendingError,
  DEFAULT_DATA_ROOT,
  type SquadFile,
  type SquadPlayerEntry,
} from '../adapters/squad-library'

// ---------------------------------------------------------------------------
// Fixtures : un arbre pronoclip-data/ temporaire (marque `acme` + canonique `pronoclip`).
// ---------------------------------------------------------------------------

let root: string

const entry = (name: string, portrait: string | null, extra: Partial<SquadPlayerEntry> = {}): SquadPlayerEntry => ({
  name, position: 'FW', profile: {}, portrait, ...extra,
})

function writeSquad(dataRoot: string, sq: SquadFile): void {
  const dir = join(dataRoot, 'squads', sq.namespace, sq.team_code)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.json'), JSON.stringify(sq, null, 2))
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'pronoclip-squad-'))
  // Canonique : Mbappé (portrait), Vinícius (null → pending), Modrić (URL CDN).
  writeSquad(root, {
    $schema: 'pronoclip.squad/v1',
    namespace: 'pronoclip', team: 'Real Madrid', team_code: 'real_madrid', seeded_at: null,
    players: [
      entry('Mbappé', 'portraits/mbappe.png', { isKeyPlayer: true, profile: { isPenaltyTaker: true } }),
      entry('Vinícius Jr', null),
      entry('Modrić', 'https://cdn.pronoclip.app/portraits/pronoclip/real_madrid/modric.png', { position: 'MF' }),
    ],
  })
  // Marque `acme` : surcharge seulement Mbappé.
  writeSquad(root, {
    $schema: 'pronoclip.squad/v1',
    namespace: 'acme', team: 'Real Madrid', team_code: 'real_madrid', seeded_at: null,
    players: [entry('Mbappé', 'portraits/mbappe-acme.png', { isKeyPlayer: true })],
  })
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------

describe('slugifyTeam', () => {
  it('minuscule, accents supprimés, espaces → underscore', () => {
    expect(slugifyTeam('France')).toBe('france')
    expect(slugifyTeam('Real Madrid')).toBe('real_madrid')
    expect(slugifyTeam('Zaïre-Emery')).toBe('zaire_emery')
  })
  it('nettoie les underscores de bord', () => {
    expect(slugifyTeam('  Côte d’Ivoire  ')).toBe('cote_d_ivoire')
  })
})

describe('resolvePlayer (repli marque → canonique)', () => {
  it('la marque surcharge le canonique', () => {
    const r = resolvePlayer('Mbappé', 'Real Madrid', 'acme', { dataRoot: root })
    expect(r.namespace).toBe('acme')
    expect(r.entry.portrait).toBe('portraits/mbappe-acme.png')
  })
  it('retombe sur le canonique quand la marque n’a pas ce joueur', () => {
    const r = resolvePlayer('Vinícius Jr', 'Real Madrid', 'acme', { dataRoot: root })
    expect(r.namespace).toBe('pronoclip')
  })
  it('lève NotSeededError (message actionnable) si absent partout', () => {
    expect(() => resolvePlayer('Bellingham', 'Real Madrid', 'acme', { dataRoot: root }))
      .toThrow(NotSeededError)
    try {
      resolvePlayer('Bellingham', 'Real Madrid', 'acme', { dataRoot: root })
    } catch (e) {
      expect((e as Error).message).toContain('non semé')
      expect((e as Error).message).toContain('/pronoclip-squad Real Madrid')
    }
  })
})

describe('resolvePortrait', () => {
  it('marque : chemin absolu résolu contre le dossier de l’équipe', () => {
    const p = resolvePortrait('Mbappé', 'Real Madrid', 'acme', { dataRoot: root })
    expect(p).toBe(join(root, 'squads', 'acme', 'real_madrid', 'portraits', 'mbappe-acme.png'))
  })
  it('canonique en repli : chemin absolu sous pronoclip/', () => {
    const p = resolvePortrait('Mbappé', 'Real Madrid', 'pronoclip', { dataRoot: root })
    expect(p).toBe(join(root, 'squads', 'pronoclip', 'real_madrid', 'portraits', 'mbappe.png'))
  })
  it('une URL https:// est renvoyée telle quelle (CDN canonique)', () => {
    const p = resolvePortrait('Modrić', 'Real Madrid', 'acme', { dataRoot: root })
    expect(p).toBe('https://cdn.pronoclip.app/portraits/pronoclip/real_madrid/modric.png')
  })
  it('semé mais portrait null → PortraitPendingError (jamais silencieux)', () => {
    expect(() => resolvePortrait('Vinícius Jr', 'Real Madrid', 'acme', { dataRoot: root }))
      .toThrow(PortraitPendingError)
    try {
      resolvePortrait('Vinícius Jr', 'Real Madrid', 'acme', { dataRoot: root })
    } catch (e) {
      expect((e as Error).message).toContain('Portrait non généré')
    }
  })
  it('absent partout → NotSeededError', () => {
    expect(() => resolvePortrait('Bellingham', 'Real Madrid', 'acme', { dataRoot: root }))
      .toThrow(NotSeededError)
  })
})

describe('loadRoster (source de vérité unique → Player[] core)', () => {
  it('union marque ∪ canonique, la marque gagne, position fusionnée dans le profil', () => {
    const roster = loadRoster('Real Madrid', 'acme', { dataRoot: root })
    // Union : Mbappé (surchargé), Vinícius, Modrić = 3 joueurs.
    expect(roster.map(p => p.name).sort()).toEqual(['Mbappé', 'Modrić', 'Vinícius Jr'])
    const mbappe = roster.find(p => p.name === 'Mbappé')!
    expect(mbappe.profile?.position).toBe('FW')
    const modric = roster.find(p => p.name === 'Modrić')!
    expect(modric.profile?.position).toBe('MF')
  })
  it('lève si aucun namespace n’a semé l’équipe', () => {
    expect(() => loadRoster('Inconnue', 'acme', { dataRoot: root }))
      .toThrow(/non semé/)
  })
})

describe('toPlayer', () => {
  it('projette position + profile → PlayerProfile core', () => {
    const p = toPlayer(entry('X', null, { position: 'WG', profile: { longRange: 0.7 } }))
    expect(p.profile).toEqual({ position: 'WG', longRange: 0.7 })
  })
  it('un non-joueur (coach) → isPlayer:false, sans profil', () => {
    const p = toPlayer({ name: 'Sélectionneur', role: 'coach', profile: {}, portrait: null })
    expect(p.isPlayer).toBe(false)
    expect(p.profile).toBeUndefined()
  })
})

describe('non-joueurs (entraîneur / staff)', () => {
  it('loadRoster les exclut, mais resolvePortrait résout quand même leur portrait', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pronoclip-coach-'))
    try {
      writeSquad(dir, {
        $schema: 'pronoclip.squad/v1', namespace: 'pronoclip', team: 'Bleus', team_code: 'bleus', seeded_at: null,
        players: [
          entry('Buteur', 'portraits/buteur.png', { profile: { isPenaltyTaker: true } }),
          { name: 'Le Coach', role: 'coach', profile: {}, portrait: 'portraits/coach.png' },
        ],
      })
      const roster = loadRoster('Bleus', 'pronoclip', { dataRoot: dir })
      expect(roster.map(p => p.name)).toEqual(['Buteur']) // coach exclu du vivier de buteurs
      const coachPortrait = resolvePortrait('Le Coach', 'Bleus', 'pronoclip', { dataRoot: dir }).replace(/\\/g, '/')
      expect(coachPortrait).toContain('portraits/coach.png')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('validateSquadFile (intégrité au chargement)', () => {
  it('rejette un doublon de nom (un effectif = une seule vérité)', () => {
    const bad = mkdtempSync(join(tmpdir(), 'pronoclip-bad-'))
    try {
      writeSquad(bad, {
        $schema: 'pronoclip.squad/v1',
        namespace: 'pronoclip', team: 'Dup', team_code: 'dup', seeded_at: null,
        players: [entry('Doe', null), entry('Doe', null)],
      })
      expect(() => loadSquadFile('pronoclip', 'Dup', { dataRoot: bad }))
        .toThrow(/en double/)
    } finally {
      rmSync(bad, { recursive: true, force: true })
    }
  })
  it('retourne null si l’équipe n’existe pas dans ce namespace', () => {
    expect(loadSquadFile('pronoclip', 'Nope', { dataRoot: root })).toBeNull()
  })
  it('rejette un JOUEUR sans position, mais accepte un COACH sans position', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pronoclip-pos-'))
    try {
      writeSquad(dir, {
        $schema: 'pronoclip.squad/v1', namespace: 'pronoclip', team: 'NoPos', team_code: 'nopos', seeded_at: null,
        players: [{ name: 'Sans Poste', profile: {}, portrait: null }], // role player par défaut
      })
      expect(() => loadSquadFile('pronoclip', 'NoPos', { dataRoot: dir })).toThrow(/sans « position »/)
      writeSquad(dir, {
        $schema: 'pronoclip.squad/v1', namespace: 'pronoclip', team: 'CoachOk', team_code: 'coachok', seeded_at: null,
        players: [{ name: 'Le Coach', role: 'coach', profile: {}, portrait: null }],
      })
      expect(loadSquadFile('pronoclip', 'CoachOk', { dataRoot: dir })).not.toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

// ---------------------------------------------------------------------------
// Bout-en-bout : le vrai fichier France livré (pronoclip-data/…/france/index.json).
// ---------------------------------------------------------------------------

describe('effectif France livré (fichier réel)', () => {
  it('se charge et expose 27 fiches, toutes avec un portrait explicite', () => {
    const fr = loadSquadFile('pronoclip', 'France')
    expect(fr).not.toBeNull()
    expect(fr!.team_code).toBe('france')
    expect(fr!.players).toHaveLength(27)
    expect(fr!.players.every(p => typeof p.portrait === 'string' && p.portrait!.startsWith('portraits/'))).toBe(true)
  })
  it('exactement un tireur de penalty désigné (Mbappé)', () => {
    const fr = loadSquadFile('pronoclip', 'France')!
    const takers = fr.players.filter(p => p.profile?.isPenaltyTaker)
    expect(takers.map(p => p.name)).toEqual(['Kylian Mbappé'])
  })
  it('Deschamps est un non-joueur (role coach) EXCLU de l’effectif de pronostic', () => {
    const fr = loadSquadFile('pronoclip', 'France')!
    const dd = fr.players.find(p => p.name === 'Didier Deschamps')!
    expect(dd.role).toBe('coach')
    const roster = loadRoster('France', 'pronoclip')
    expect(roster).toHaveLength(26) // 27 fiches − 1 entraîneur
    expect(roster.find(p => p.name === 'Didier Deschamps')).toBeUndefined()
  })
  it('loadRoster projette Mbappé avec son profil complet', () => {
    const mbappe = loadRoster('France', 'pronoclip').find(p => p.name === 'Kylian Mbappé')!
    expect(mbappe.isKeyPlayer).toBe(true)
    expect(mbappe.profile).toMatchObject({ position: 'FW', isPenaltyTaker: true })
  })
  it('resolvePortrait renvoie le chemin EXPLICITE (accent/prénom du fichier respectés)', () => {
    const p = resolvePortrait('Kylian Mbappé', 'France', 'pronoclip').replace(/\\/g, '/')
    expect(p).toContain('squads/pronoclip/france/portraits/Kylian Mbappe.png')
  })
  it('resolvePortrait fonctionne aussi pour un non-joueur (portrait du coach)', () => {
    const p = resolvePortrait('Didier Deschamps', 'France', 'pronoclip').replace(/\\/g, '/')
    expect(p).toContain('portraits/Didier Deschamps.png')
  })
  it('DEFAULT_DATA_ROOT pointe dans pronoclip-data/', () => {
    expect(DEFAULT_DATA_ROOT.replace(/\\/g, '/')).toContain('pronoclip-data')
  })
})
