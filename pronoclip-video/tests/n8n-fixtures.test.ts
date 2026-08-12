// Adaptateur n8n « matchs du jour ».
// Contrat vérifié ici : l'adaptateur NE LÈVE JAMAIS. Chaque panne devient un
// `{ ok: false, reason }` exploitable, pour que l'appelant retombe sur la saisie manuelle.

import { describe, it, expect } from 'vitest'
import {
  fetchTodayFixtures, normalizeFixture, normalizeLeagues, formatKickoff,
  formatFixtureList, formatLeagues,
} from '../adapters/n8n-fixtures'

/** Réponse RÉELLE du webhook, capturée le 2026-08-12 (compte API-Football suspendu). */
const REAL_EMPTY_RESPONSE = {
  date: '2026-08-12',
  timezone: 'Europe/Paris',
  apiErrors: { access: 'Your account is suspended, check on https://dashboard.api-football.com.' },
  leaguesFilter: [39, 140, 135, 78, 61, 2, 3],
  totalToday: 0,
  count: 0,
  returned: 0,
  availableLeagues: [],
  fixtures: [],
  next: 'API-Football refused the request. See apiErrors.',
}

const URL = 'https://n8n.example.invalid/webhook/fixtures-today'

/** `fetch` de test renvoyant un corps JSON donné. */
function jsonFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return (async () =>
    ({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      statusText: '',
      json: async () => body,
    }) as unknown as Response) as unknown as typeof fetch
}

describe('fetchTodayFixtures — pannes (jamais de throw)', () => {
  it('URL absente → not-configured, sans lever', async () => {
    const out = await fetchTodayFixtures({ url: '', fetchImpl: jsonFetch({}) })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.reason).toBe('not-configured')
    expect(out.message).toContain('N8N_FIXTURES_WEBHOOK')
  })

  it('réseau KO → network, sans lever', async () => {
    const boom = (async () => { throw new Error('ECONNREFUSED') }) as unknown as typeof fetch
    const out = await fetchTodayFixtures({ url: URL, fetchImpl: boom })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.reason).toBe('network')
    expect(out.message).toContain('ECONNREFUSED')
  })

  it('HTTP 500 → http, sans lever', async () => {
    const out = await fetchTodayFixtures({ url: URL, fetchImpl: jsonFetch({}, { ok: false, status: 500 }) })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.reason).toBe('http')
    expect(out.message).toContain('500')
  })

  it('JSON invalide → invalid-json, sans lever', async () => {
    const bad = (async () =>
      ({ ok: true, status: 200, statusText: '', json: async () => { throw new Error('Unexpected token') } }) as unknown as Response
    ) as unknown as typeof fetch
    const out = await fetchTodayFixtures({ url: URL, fetchImpl: bad })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.reason).toBe('invalid-json')
  })

  it('timeout dépassé → network avec message de délai', async () => {
    const hang = ((_u: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })) as unknown as typeof fetch
    const out = await fetchTodayFixtures({ url: URL, fetchImpl: hang, timeoutMs: 10 })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.reason).toBe('network')
    expect(out.message).toContain('délai')
  })
})

describe('fetchTodayFixtures — branche count: 0 (réponse réelle)', () => {
  it('relaie availableLeagues, leaguesFilter et apiErrors sans lever', async () => {
    const out = await fetchTodayFixtures({ url: URL, fetchImpl: jsonFetch(REAL_EMPTY_RESPONSE) })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.reason).toBe('no-fixtures')
    expect(out.availableLeagues).toEqual([])
    expect(out.leaguesFilter).toEqual([39, 140, 135, 78, 61, 2, 3])
    expect(out.apiErrors?.access).toContain('suspended')
    // Le message relaie `next` du workflow — l'utilisateur voit la cause réelle.
    expect(out.message).toContain('API-Football refused the request')
    expect(out.message).toContain('count: 0')
  })

  it('expose les ligues quand le webhook en propose', async () => {
    const body = {
      ...REAL_EMPTY_RESPONSE,
      apiErrors: undefined,
      next: undefined,
      availableLeagues: [{ id: 39, name: 'Premier League', country: 'England' }, 61, 'Serie A'],
    }
    const out = await fetchTodayFixtures({ url: URL, fetchImpl: jsonFetch(body) })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.availableLeagues).toEqual([
      { id: 39, name: 'Premier League', country: 'England' },
      { id: 61 },
      { name: 'Serie A' },
    ])
    expect(formatLeagues(out.availableLeagues)).toContain('Premier League')
  })

  it('fixtures absent du corps → no-fixtures (et non un crash)', async () => {
    const out = await fetchTodayFixtures({ url: URL, fetchImpl: jsonFetch({ date: '2026-08-12' }) })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.reason).toBe('no-fixtures')
  })
})

describe('fetchTodayFixtures — succès', () => {
  it('normalise une forme plate', async () => {
    const body = {
      date: '2026-08-12', timezone: 'UTC',
      count: 2,
      fixtures: [
        { fixtureId: 111, kickoff: '2026-08-12T19:00:00Z', competition: 'Ligue 1', home: 'Lyon', away: 'Monaco' },
        { fixtureId: 222, kickoff: '2026-08-12T21:00:00Z', competition: 'Ligue 1', home: 'Lille', away: 'Nice' },
      ],
    }
    const out = await fetchTodayFixtures({ url: URL, fetchImpl: jsonFetch(body) })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.fixtures).toHaveLength(2)
    expect(out.skipped).toBe(0)
    expect(out.fixtures[0]).toMatchObject({ fixtureId: '111', competition: 'Ligue 1', home: 'Lyon', away: 'Monaco', kickoff: '19:00' })
    expect(formatFixtureList(out.fixtures)).toContain('1. 19:00')
  })

  it('normalise une forme imbriquée façon API-Football', async () => {
    const body = {
      timezone: 'UTC',
      fixtures: [{
        fixture: { id: 999, date: '2026-08-12T18:30:00Z' },
        league: { name: 'Premier League' },
        teams: { home: { name: 'Brentford' }, away: { name: 'Fulham' } },
      }],
    }
    const out = await fetchTodayFixtures({ url: URL, fetchImpl: jsonFetch(body) })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.fixtures[0]).toMatchObject({
      fixtureId: '999', competition: 'Premier League', home: 'Brentford', away: 'Fulham', kickoff: '18:30',
    })
  })

  it('ignore les matchs inexploitables sans perdre les autres', async () => {
    const body = {
      fixtures: [
        { id: 1, home: 'A', away: 'B' },
        { id: 2, home: 'C' },        // pas d'équipe extérieure → ignoré
        { home: 'D', away: 'E' },    // pas d'identifiant → ignoré
        'pas un objet',
      ],
    }
    const out = await fetchTodayFixtures({ url: URL, fetchImpl: jsonFetch(body) })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.fixtures).toHaveLength(1)
    expect(out.skipped).toBe(3)
  })

  it('aucun match exploitable → unreadable-fixtures (jamais de match inventé)', async () => {
    const out = await fetchTodayFixtures({ url: URL, fetchImpl: jsonFetch({ fixtures: [{ foo: 'bar' }] }) })
    expect(out.ok).toBe(false)
    if (out.ok) return
    expect(out.reason).toBe('unreadable-fixtures')
  })

  it('envoie {} par défaut et {leagues} quand un filtre est demandé', async () => {
    const bodies: string[] = []
    const spy = (async (_u: string, init?: RequestInit) => {
      bodies.push(String(init?.body))
      return { ok: true, status: 200, statusText: '', json: async () => ({ fixtures: [] }) } as unknown as Response
    }) as unknown as typeof fetch
    await fetchTodayFixtures({ url: URL, fetchImpl: spy })
    await fetchTodayFixtures({ url: URL, fetchImpl: spy, leagues: [39, 140] })
    expect(bodies[0]).toBe('{}')
    expect(bodies[1]).toBe('{"leagues":[39,140]}')
  })
})

describe('normalisation unitaire', () => {
  it('refuse plutôt que d\'inventer', () => {
    expect(normalizeFixture(null)).toBeNull()
    expect(normalizeFixture({ home: 'A', away: 'B' })).toBeNull() // pas d'id
    expect(normalizeFixture({ id: 1, home: 'A' })).toBeNull()     // pas d'adversaire
  })

  it('compétition inconnue → libellé explicite, jamais de nom fabriqué', () => {
    expect(normalizeFixture({ id: 7, home: 'A', away: 'B' })?.competition).toBe('Compétition inconnue')
  })

  it('accepte un timestamp Unix en secondes', () => {
    const f = normalizeFixture({ id: 5, home: 'A', away: 'B', date: 1786567800 }, 'UTC')
    expect(f?.kickoffIso).toBe(new Date(1786567800_000).toISOString())
  })

  it('horaire absent ou illisible → chaîne vide (jamais une heure inventée)', () => {
    expect(formatKickoff(undefined)).toBe('')
    expect(formatKickoff('pas-une-date')).toBe('')
  })

  it('normalizeLeagues tolère les entrées non-tableau', () => {
    expect(normalizeLeagues(undefined)).toEqual([])
    expect(normalizeLeagues('nope')).toEqual([])
  })
})
