// Adaptateur n8n — MATCHS DU JOUR (mode optionnel `--today`).
//
// Rôle strictement limité au TRANSPORT : récupérer la liste des matchs réels du
// jour depuis un webhook n8n, puis la normaliser. Aucune prédiction ici — le score
// et les buteurs restent produits par core/prediction.ts (moteur LOCAL). n8n ne
// fournit QUE le match ; il n'est jamais une source de pronostic.
//
// Contrat de robustesse (garde-fou) : ce module ne LÈVE JAMAIS. Toute panne
// (URL absente, réseau, HTTP, JSON illisible, compte API suspendu, `count: 0`)
// devient un résultat typé `{ ok: false, reason }`, pour que l'appelant affiche un
// message clair et retombe sur le mode saisie manuelle. Jamais de crash, jamais de
// blocage — le chemin hors-ligne doit rester utilisable en toutes circonstances.
//
// L'URL n'est JAMAIS en dur : elle vient de `N8N_FIXTURES_WEBHOOK` (.env).

/** Une ligue exposée par le webhook (forme tolérante : le webhook peut ne rendre que l'id). */
export interface N8nLeague {
  id?: number
  name?: string
  country?: string
}

/** Réponse brute du webhook, telle qu'observée en production le 2026-08-12. */
export interface N8nFixturesResponse {
  date?: string
  timezone?: string
  /** Présent quand API-Football refuse la requête (ex. `{ access: "…suspended…" }`). */
  apiErrors?: Record<string, string>
  /** IDs de ligues appliqués en filtre par le workflow. */
  leaguesFilter?: number[]
  totalToday?: number
  count?: number
  returned?: number
  availableLeagues?: Array<N8nLeague | number | string>
  fixtures?: unknown[]
  /** Message d'orientation renvoyé par le workflow lui-même. */
  next?: string
}

/** Un match du jour, normalisé pour l'affichage et la sélection. */
export interface N8nFixture {
  /** Identifiant stable renvoyé par le webhook (sert au choix par fixtureId). */
  fixtureId: string
  /** Coup d'envoi ISO si disponible. */
  kickoffIso?: string
  /** Heure locale `HH:MM` — chaîne vide si le webhook n'a pas fourni d'horaire. */
  kickoff: string
  competition: string
  home: string
  away: string
  /** Objet d'origine conservé tel quel (aucune perte d'information). */
  raw: unknown
}

export type FixturesFailureReason =
  /** `N8N_FIXTURES_WEBHOOK` absent du .env → mode optionnel simplement non configuré. */
  | 'not-configured'
  /** Connecteur injoignable, DNS, TLS, timeout. */
  | 'network'
  /** Réponse HTTP non-2xx. */
  | 'http'
  /** Corps illisible ou non-JSON. */
  | 'invalid-json'
  /** Webhook OK mais zéro match (compte API-Football suspendu, jour sans match, filtre trop étroit). */
  | 'no-fixtures'
  /** Des matchs sont renvoyés mais aucun n'expose équipes + identifiant exploitables. */
  | 'unreadable-fixtures'

export interface FixturesSuccess {
  ok: true
  fixtures: N8nFixture[]
  date?: string
  timezone?: string
  /** Matchs reçus mais inexploitables (shape inattendue) — signalés sans bloquer. */
  skipped: number
  raw: N8nFixturesResponse
}

export interface FixturesFailure {
  ok: false
  reason: FixturesFailureReason
  /** Message prêt à afficher, en français, sans jargon de stack. */
  message: string
  /** Ligues proposées par le webhook — à montrer pour relancer avec un autre filtre. */
  availableLeagues: N8nLeague[]
  leaguesFilter?: number[]
  apiErrors?: Record<string, string>
  raw?: N8nFixturesResponse
}

export type FixturesOutcome = FixturesSuccess | FixturesFailure

export interface FetchFixturesOptions {
  /** Défaut : `process.env.N8N_FIXTURES_WEBHOOK`. */
  url?: string
  /** Filtre de ligues (IDs API-Football). Omis → le workflow applique son filtre par défaut. */
  leagues?: number[]
  /** Défaut 30 s. Au-delà → `reason: 'network'`. */
  timeoutMs?: number
  /** Injection pour les tests. */
  fetchImpl?: typeof fetch
}

export const DEFAULT_TIMEOUT_MS = 30_000

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined
}

/** Première valeur non vide parmi une liste de chemins `a.b.c`. */
function pick(source: Record<string, unknown>, paths: string[]): unknown {
  for (const path of paths) {
    let cur: unknown = source
    for (const key of path.split('.')) {
      const rec = asRecord(cur)
      if (!rec) { cur = undefined; break }
      cur = rec[key]
    }
    if (cur !== undefined && cur !== null && cur !== '') return cur
  }
  return undefined
}

function asName(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim()
  const rec = asRecord(v)
  if (rec && typeof rec.name === 'string' && rec.name.trim()) return rec.name.trim()
  return undefined
}

/** `HH:MM` dans le fuseau demandé, ou chaîne vide si l'horaire est absent/illisible. */
export function formatKickoff(iso: string | undefined, timezone?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit', minute: '2-digit', hour12: false,
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(d)
  } catch {
    // Fuseau refusé par l'environnement → on n'invente pas, on rend l'heure UTC.
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }).format(d)
  }
}

/**
 * Projette un élément brut vers `N8nFixture`.
 *
 * ATTENTION — la forme exacte d'un match n'a pas pu être observée en production :
 * le webhook a toujours répondu `fixtures: []` (compte API-Football suspendu). Cette
 * normalisation est donc DÉFENSIVE : elle accepte les shapes usuelles (plate, ou
 * imbriquée façon API-Football `teams.home.name` / `fixture.id`). Un élément dont on
 * ne peut pas tirer au minimum un identifiant et les deux équipes est REFUSÉ plutôt
 * qu'inventé — l'appelant le signalera comme ignoré.
 */
export function normalizeFixture(item: unknown, timezone?: string): N8nFixture | null {
  const rec = asRecord(item)
  if (!rec) return null

  const rawId = pick(rec, ['fixtureId', 'fixture_id', 'id', 'fixture.id'])
  const home = asName(pick(rec, ['home', 'homeTeam', 'home_team', 'teams.home', 'teams.home.name']))
  const away = asName(pick(rec, ['away', 'awayTeam', 'away_team', 'teams.away', 'teams.away.name']))
  if (home === undefined || away === undefined) return null

  const fixtureId = rawId === undefined ? '' : String(rawId)
  if (!fixtureId) return null

  const competition =
    asName(pick(rec, ['competition', 'league', 'leagueName', 'league_name', 'league.name'])) ?? 'Compétition inconnue'

  const rawDate = pick(rec, ['kickoff', 'kickoffIso', 'date', 'utcDate', 'fixture.date', 'datetime'])
  let kickoffIso: string | undefined
  if (typeof rawDate === 'string') kickoffIso = rawDate
  else if (typeof rawDate === 'number') kickoffIso = new Date(rawDate * (rawDate < 1e12 ? 1000 : 1)).toISOString()

  return { fixtureId, kickoffIso, kickoff: formatKickoff(kickoffIso, timezone), competition, home, away, raw: item }
}

/** Ligues renvoyées sous forme d'objets, d'IDs bruts ou de noms → forme unique. */
export function normalizeLeagues(input: unknown): N8nLeague[] {
  if (!Array.isArray(input)) return []
  const out: N8nLeague[] = []
  for (const entry of input) {
    if (typeof entry === 'number') out.push({ id: entry })
    else if (typeof entry === 'string') out.push({ name: entry })
    else {
      const rec = asRecord(entry)
      if (!rec) continue
      const id = typeof rec.id === 'number' ? rec.id : undefined
      const name = typeof rec.name === 'string' ? rec.name : undefined
      const country = typeof rec.country === 'string' ? rec.country : asName(rec.country)
      if (id !== undefined || name !== undefined) out.push({ id, name, country })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Appel
// ---------------------------------------------------------------------------

/**
 * Récupère les matchs du jour. Ne lève jamais : voir le contrat en tête de fichier.
 * Le corps envoyé est `{}` (ou `{ leagues: [...] }` si un filtre est demandé).
 */
export async function fetchTodayFixtures(opts: FetchFixturesOptions = {}): Promise<FixturesOutcome> {
  const url = opts.url ?? process.env.N8N_FIXTURES_WEBHOOK
  if (!url) {
    return {
      ok: false,
      reason: 'not-configured',
      message:
        'N8N_FIXTURES_WEBHOOK absent du .env — le mode « matchs du jour » n\'est pas configuré.',
      availableLeagues: [],
    }
  }

  const doFetch = opts.fetchImpl ?? globalThis.fetch
  const controller = new AbortController()
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await doFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(opts.leagues?.length ? { leagues: opts.leagues } : {}),
      signal: controller.signal,
    })
  } catch (err) {
    const aborted = controller.signal.aborted
    return {
      ok: false,
      reason: 'network',
      message: aborted
        ? `Webhook n8n injoignable — délai de ${Math.round(timeoutMs / 1000)} s dépassé.`
        : `Webhook n8n injoignable — ${err instanceof Error ? err.message : String(err)}.`,
      availableLeagues: [],
    }
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    return {
      ok: false,
      reason: 'http',
      message: `Webhook n8n en erreur — HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}.`,
      availableLeagues: [],
    }
  }

  let body: N8nFixturesResponse
  try {
    body = (await res.json()) as N8nFixturesResponse
  } catch {
    return {
      ok: false,
      reason: 'invalid-json',
      message: 'Réponse du webhook n8n illisible (JSON invalide).',
      availableLeagues: [],
    }
  }

  const availableLeagues = normalizeLeagues(body?.availableLeagues)
  const items = Array.isArray(body?.fixtures) ? body.fixtures : []

  if (items.length === 0) {
    // Cas nominal d'échec « propre » : le workflow tourne, mais n'a rien à donner.
    // `next` / `apiErrors` viennent du workflow lui-même — on les relaie tels quels.
    const upstream = body?.next ?? Object.values(body?.apiErrors ?? {})[0]
    return {
      ok: false,
      reason: 'no-fixtures',
      message: `Aucun match renvoyé pour le ${body?.date ?? 'jour'} (count: ${body?.count ?? 0})` +
        (upstream ? ` — ${upstream}` : '.'),
      availableLeagues,
      leaguesFilter: body?.leaguesFilter,
      apiErrors: body?.apiErrors,
      raw: body,
    }
  }

  const fixtures: N8nFixture[] = []
  for (const item of items) {
    const f = normalizeFixture(item, body?.timezone)
    if (f) fixtures.push(f)
  }
  const skipped = items.length - fixtures.length

  if (fixtures.length === 0) {
    return {
      ok: false,
      reason: 'unreadable-fixtures',
      message:
        `${items.length} match(s) reçu(s) mais aucun exploitable : identifiant ou équipes absents ` +
        `de la réponse. La forme renvoyée par le workflow a probablement changé.`,
      availableLeagues,
      leaguesFilter: body?.leaguesFilter,
      apiErrors: body?.apiErrors,
      raw: body,
    }
  }

  return { ok: true, fixtures, date: body?.date, timezone: body?.timezone, skipped, raw: body }
}

// ---------------------------------------------------------------------------
// Affichage
// ---------------------------------------------------------------------------

/** Liste numérotée : `  3. 21:00  Ligue 1                Lyon vs Monaco  [fixtureId]`. */
export function formatFixtureList(fixtures: N8nFixture[]): string {
  const width = Math.max(0, ...fixtures.map(f => f.competition.length))
  return fixtures
    .map((f, i) => {
      const num = String(i + 1).padStart(2, ' ')
      const time = (f.kickoff || '--:--').padEnd(5, ' ')
      return `  ${num}. ${time}  ${f.competition.padEnd(width)}  ${f.home} vs ${f.away}   [${f.fixtureId}]`
    })
    .join('\n')
}

/** Ligues disponibles, prêtes à afficher quand il n'y a aucun match. */
export function formatLeagues(leagues: N8nLeague[]): string {
  if (leagues.length === 0) return '  (aucune ligue proposée par le webhook)'
  return leagues
    .map(l => `  - ${l.name ?? '(sans nom)'}${l.id !== undefined ? ` [id ${l.id}]` : ''}${l.country ? ` — ${l.country}` : ''}`)
    .join('\n')
}
