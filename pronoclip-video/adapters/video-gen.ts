// Adaptateur image→vidéo GÉNÉRIQUE — n'importe quel fournisseur, décrit par configuration.
//
// Le tier `animated` ne doit pas être marié à un vendeur. Ce module accepte donc une
// description déclarative (URL, en-têtes, forme du corps, chemin de la vidéo dans la
// réponse, sondage éventuel) et fabrique le `ClipInvoke` attendu par le cœur. Changer
// de fournisseur = changer la config, jamais ce fichier.
//
// La clé d'API vient de l'ENVIRONNEMENT via le nom déclaré (`api_key_env`) et n'est
// JAMAIS journalisée ni écrite dans un fichier de sortie.
//
// Deux familles couvertes :
//   - `fal`  : passe par le client officiel (upload d'image + file d'attente) ;
//   - `http` : REST quelconque, avec gabarits de substitution et sondage optionnel.

import { readFileSync } from 'node:fs'
import type { ClipInvoke, ClipRequest, ClipResult } from './mcp'

/** Description déclarative d'un fournisseur REST image→vidéo. */
export interface HttpProviderConfig {
  provider: 'http'
  /** Nom de la variable d'environnement portant la clé. Jamais la clé elle-même. */
  api_key_env: string
  /** Endpoint de soumission. */
  submit_url: string
  method?: 'POST' | 'PUT'
  /** En-têtes ; `${API_KEY}` y est substitué. */
  headers?: Record<string, string>
  /**
   * Corps de la requête. Substitutions disponibles :
   * `${PROMPT}`, `${NEGATIVE_PROMPT}`, `${DURATION}`, `${IMAGE_DATA_URI}`, `${IMAGE_B64}`,
   * `${IMAGE_URL}` (si `image_url` est fourni à l'appel), `${MODEL}`.
   */
  body: Record<string, unknown>
  model?: string
  /** Chemin de la vidéo dans la réponse, ex. `data.video.url` ou `output.0`. */
  video_path: string
  /** Sondage : si la soumission renvoie un identifiant au lieu de la vidéo. */
  poll?: {
    /** URL de statut ; `${ID}` y est substitué. */
    status_url: string
    /** Chemin de l'identifiant dans la réponse de soumission. */
    id_path: string
    /** Chemin du statut dans la réponse de sondage. */
    status_path?: string
    /** Valeurs de statut considérées comme terminées. */
    done_values?: string[]
    /** Valeurs de statut considérées comme en échec. */
    failed_values?: string[]
    interval_ms?: number
    timeout_ms?: number
  }
}

export interface FalProviderConfig {
  provider: 'fal'
  api_key_env?: string
  model: string
}

export type ProviderConfig = HttpProviderConfig | FalProviderConfig

// ---------------------------------------------------------------------------
// Utilitaires purs (testables sans réseau)
// ---------------------------------------------------------------------------

/** Lit `a.b.0.c` dans un objet. Renvoie `undefined` si le chemin ne mène nulle part. */
export function readPath(source: unknown, path: string): unknown {
  let cur: unknown = source
  for (const key of path.split('.')) {
    if (cur == null) return undefined
    if (Array.isArray(cur)) {
      const i = Number(key)
      if (!Number.isInteger(i)) return undefined
      cur = cur[i]
    } else if (typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }
  return cur
}

export interface Substitutions {
  PROMPT: string
  NEGATIVE_PROMPT: string
  DURATION: string
  IMAGE_DATA_URI: string
  IMAGE_B64: string
  IMAGE_URL: string
  MODEL: string
  API_KEY: string
}

/**
 * Substitue `${JETON}` dans une chaîne. Une chaîne réduite à un seul jeton NUMÉRIQUE
 * (`"${DURATION}"`) devient un nombre : beaucoup d'API refusent une durée en texte.
 */
export function substitute(value: unknown, subs: Substitutions): unknown {
  if (typeof value === 'string') {
    const solo = /^\$\{(\w+)\}$/.exec(value)
    if (solo && solo[1] === 'DURATION') return Number(subs.DURATION)
    return value.replace(/\$\{(\w+)\}/g, (m, k: string) => (k in subs ? String(subs[k as keyof Substitutions]) : m))
  }
  if (Array.isArray(value)) return value.map(v => substitute(v, subs))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = substitute(v, subs)
    return out
  }
  return value
}

/** Erreur explicite quand la clé déclarée est absente de l'environnement. */
export class MissingApiKeyError extends Error {
  constructor(envName: string) {
    super(`Clé absente : ${envName} n'est pas définie dans l'environnement (.env). ` +
          `Le tier animated est PAYANT — aucune génération sans clé.`)
    this.name = 'MissingApiKeyError'
  }
}

// ---------------------------------------------------------------------------
// Fournisseur REST générique
// ---------------------------------------------------------------------------

export interface HttpInvokeOptions {
  config: HttpProviderConfig
  apiKey: string
  /** URL publique de la première frame, si le fournisseur exige une URL plutôt qu'un base64. */
  imageUrlFor?: (localPath: string) => Promise<string>
  fetchImpl?: typeof fetch
  onLog?: (m: string) => void
  /** Attente entre deux sondages — injectable pour les tests. */
  sleep?: (ms: number) => Promise<void>
}

export function makeHttpClipInvoke(opts: HttpInvokeOptions): ClipInvoke {
  const cfg = opts.config
  const doFetch = opts.fetchImpl ?? globalThis.fetch
  const sleep = opts.sleep ?? ((ms: number) => new Promise(r => setTimeout(r, ms)))
  const log = opts.onLog ?? (() => {})

  return async (req: ClipRequest): Promise<ClipResult> => {
    const bytes = readFileSync(req.firstFrame)
    const b64 = bytes.toString('base64')
    const mime = req.firstFrame.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
    const imageUrl = opts.imageUrlFor ? await opts.imageUrlFor(req.firstFrame) : ''

    const subs: Substitutions = {
      PROMPT: req.videoPrompt,
      NEGATIVE_PROMPT: req.negativePrompt,
      DURATION: String(req.durationSeconds),
      IMAGE_DATA_URI: `data:${mime};base64,${b64}`,
      IMAGE_B64: b64,
      IMAGE_URL: imageUrl,
      MODEL: cfg.model ?? '',
      API_KEY: opts.apiKey,
    }

    const headers = substitute(cfg.headers ?? { 'content-type': 'application/json' }, subs) as Record<string, string>
    const body = substitute(cfg.body, subs)

    const res = await doFetch(cfg.submit_url, {
      method: cfg.method ?? 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Fournisseur vidéo : HTTP ${res.status} à la soumission — ${detail.slice(0, 300)}`)
    }
    const submitted = await res.json()

    // Réponse directe : la vidéo est déjà là.
    const direct = readPath(submitted, cfg.video_path)
    if (typeof direct === 'string' && direct) return { video_url: direct }

    if (!cfg.poll) {
      throw new Error(
        `Fournisseur vidéo : aucune vidéo à « ${cfg.video_path} » et aucun sondage configuré. ` +
        `Vérifie « video_path » dans la configuration du fournisseur.`,
      )
    }

    const id = readPath(submitted, cfg.poll.id_path)
    if (id == null) throw new Error(`Fournisseur vidéo : identifiant introuvable à « ${cfg.poll.id_path} ».`)

    const interval = cfg.poll.interval_ms ?? 5_000
    const timeout = cfg.poll.timeout_ms ?? 600_000
    const done = cfg.poll.done_values ?? ['succeeded', 'completed', 'COMPLETED', 'SUCCEEDED']
    const failed = cfg.poll.failed_values ?? ['failed', 'error', 'FAILED', 'ERROR', 'canceled']
    const statusUrl = cfg.poll.status_url.replace(/\$\{ID\}/g, String(id))

    for (let waited = 0; waited <= timeout; waited += interval) {
      await sleep(interval)
      const s = await doFetch(statusUrl, { headers })
      if (!s.ok) continue
      const payload = await s.json()

      const video = readPath(payload, cfg.video_path)
      if (typeof video === 'string' && video) return { video_url: video }

      const status = cfg.poll.status_path ? String(readPath(payload, cfg.poll.status_path) ?? '') : ''
      if (status) {
        log(`statut : ${status}`)
        if (failed.includes(status)) throw new Error(`Fournisseur vidéo : génération en échec (statut « ${status} »).`)
        if (done.includes(status)) {
          const late = readPath(payload, cfg.video_path)
          if (typeof late === 'string' && late) return { video_url: late }
          throw new Error(`Fournisseur vidéo : statut « ${status} » mais aucune vidéo à « ${cfg.video_path} ».`)
        }
      }
    }
    throw new Error(`Fournisseur vidéo : délai dépassé (${Math.round(timeout / 1000)} s) sans vidéo.`)
  }
}

/** Clé lue dans l'environnement selon le nom DÉCLARÉ. Lève si absente. */
export function requireApiKey(config: ProviderConfig, env: NodeJS.ProcessEnv = process.env): string {
  const name = config.api_key_env ?? (config.provider === 'fal' ? 'FAL_KEY' : '')
  if (!name) throw new Error('Configuration du fournisseur : « api_key_env » manquant.')
  const key = env[name]
  if (!key) throw new MissingApiKeyError(name)
  return key
}
