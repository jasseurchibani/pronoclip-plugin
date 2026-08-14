// Adaptateur publication RapidoCMS (cf. MISSION §6/§10). Le MCP n'est JAMAIS importé ni
// appelé ici : le TRANSPORT réel (upload_file / create_draft / schedule_draft) est INJECTÉ.
// En Claude Code, c'est l'AGENT qui remplit ce transport (il appelle les outils MCP) ;
// côté serveur ce serait un adaptateur REST. Le core/ ne change pas. Ici : le contrat du
// transport, la construction PURE du brouillon (légende avec mention IA obligatoire §7),
// et l'orchestration upload → brouillon → planification.

export type SocialType = 'facebook' | 'instagram' | 'linkedin' | 'tiktok'
export type PostType = 'media' | 'text' | 'mediatext'
export type MediaType = 'image' | 'video'

/** Où et comment publier (résolu en amont : compte connecté, réseau, planning). */
export interface PublishPlan {
  postName: string
  socialType: SocialType
  /** page_id / profile_id / open_id du compte connecté (jamais un ID en dur). */
  accountId: string
  postType: PostType
  mediaType: MediaType
  caption: string
  /** null = brouillon non planifié ; sinon date/heure de planification. */
  schedule: { date: string; heure: string } | null
}

/**
 * TRANSPORT injecté (implémenté par l'agent via MCP, ou par un adaptateur REST).
 * Chaque méthode reflète 1 outil RapidoCMS ; l'adaptateur ne connaît pas MCP.
 */
export interface PublishTransport {
  /** upload_file_tool : ingère une URL PUBLIQUE dans la bibliothèque → renvoie l'URL biblio. */
  uploadFileFromUrl(a: { type: MediaType | 'doc'; name: string; fileUrl: string }): Promise<{ mediaUrl: string; assetId?: string }>
  /** create_draft_tool : crée le brouillon (media_source toujours "biblio"). */
  createDraft(a: {
    postName: string; socialType: SocialType; accountId: string
    postType: PostType; mediaType: MediaType; mediaUrl: string; caption: string
  }): Promise<{ draftId: string }>
  /** schedule_draft_tool : planifie un brouillon. post_date=Y-m-d ; post_heure=H:i:s
   *  (le schéma MCP annonce « H-i-s » à tort — le serveur exige les DEUX-POINTS). */
  scheduleDraft(a: { draftId: string; postDate: string; postHeure: string }): Promise<unknown>
}

/**
 * Légende de post avec la mention IA OBLIGATOIRE (§7) : on garantit que la transparence
 * IA figure dans le texte publié, exactement comme le filigrane/carton la garantit à
 * l'écran. Si la base la contient déjà, on ne duplique pas.
 */
export function buildCaption(base: string, aiDisclosure: string): string {
  const disclosure = aiDisclosure.trim()
  if (!disclosure) throw new Error('Mention IA vide : refus de composer une légende sans transparence IA (§7).')
  const clean = base.trim()
  if (clean.includes(disclosure)) return clean
  return `${clean}\n\n${disclosure}`
}

/** Entrées nécessaires pour composer un plan de publication depuis un match rendu. */
export interface PublishPlanInput {
  home: string
  away: string
  score: { home: number; away: number }
  competition?: string
  /** Buteurs, dans l'ordre du match. Cités dans la légende. */
  scorers?: string[]
  /** Mention IA obligatoire (§7) — refus de composer sans elle. */
  aiDisclosure: string
  /** Compte connecté cible. Vient de l'environnement, JAMAIS codé en dur. */
  accountId: string
  socialType?: SocialType
  /** `null`/absent = brouillon non planifié. */
  schedule?: { date: string; heure: string } | null
  /** Suffixe libre pour distinguer un test d'une vraie publication. */
  postNameSuffix?: string
}

/**
 * Compose le plan de publication d'un match QUELCONQUE. Pur : aucune I/O, aucun MCP.
 * C'est la fonction que la routine planifiée alimente ; l'agent exécute ensuite les
 * trois appels MCP avec ces valeurs via `makePublisher`.
 */
export function buildPublishPlan(input: PublishPlanInput): PublishPlan {
  if (!input.accountId?.trim()) {
    throw new Error(
      'Compte de publication absent : renseigne RAPIDOCMS_ACCOUNT_ID dans .env ' +
      '(aucun identifiant client n\'est codé en dur — cf. garde-fous).',
    )
  }
  const title = `${input.home} ${input.score.home}-${input.score.away} ${input.away}`
  const base =
    `🔮 Pronostic PronoClip — ${title}` +
    (input.competition ? ` (${input.competition}).` : '.') +
    (input.scorers?.length ? ` Buts : ${input.scorers.join(', ')}.` : '')

  return {
    postName: `PronoClip — ${input.home} vs ${input.away}${input.postNameSuffix ? ` (${input.postNameSuffix})` : ''}`,
    socialType: input.socialType ?? 'instagram',
    accountId: input.accountId,
    postType: 'media',
    mediaType: 'video',
    caption: buildCaption(base, input.aiDisclosure),
    schedule: input.schedule ?? null,
  }
}

export interface PublishResult {
  upload: { mediaUrl: string; assetId?: string }
  draft: { draftId: string }
  scheduled: unknown | null
}

/**
 * Fabrique `publish(publicFileUrl, fileName)` : upload (URL publique → biblio) →
 * création du brouillon (référence l'URL biblio) → planification (si demandée).
 * Le transport est injecté ; aucune I/O ni MCP ici.
 */
export function makePublisher(transport: PublishTransport, plan: PublishPlan) {
  return async function publish(publicFileUrl: string, fileName: string): Promise<PublishResult> {
    const upload = await transport.uploadFileFromUrl({ type: plan.mediaType, name: fileName, fileUrl: publicFileUrl })
    const draft = await transport.createDraft({
      postName: plan.postName,
      socialType: plan.socialType,
      accountId: plan.accountId,
      postType: plan.postType,
      mediaType: plan.mediaType,
      mediaUrl: upload.mediaUrl,
      caption: plan.caption,
    })
    let scheduled: unknown | null = null
    if (plan.schedule) {
      scheduled = await transport.scheduleDraft({ draftId: draft.draftId, postDate: plan.schedule.date, postHeure: plan.schedule.heure })
    }
    return { upload, draft, scheduled }
  }
}

/**
 * Transport de DÉMONSTRATION (dry-run) : journalise chaque appel prévu au lieu de
 * l'exécuter. Sert à valider l'orchestration hors ligne et à imprimer, pour l'agent, les
 * arguments EXACTS des outils MCP à appeler. N'appelle jamais MCP.
 */
export function makeLogTransport(log: (m: string) => void): PublishTransport {
  return {
    async uploadFileFromUrl(a) {
      log(`MCP upload_file_tool ⇐ type=${a.type} name="${a.name}" file_url=${a.fileUrl}`)
      return { mediaUrl: '(URL biblio renvoyée par upload_file_tool)', assetId: '(asset_id)' }
    },
    async createDraft(a) {
      log(`MCP create_draft_tool ⇐ post_name="${a.postName}" social_type=${a.socialType} account_id=${a.accountId} post_type=${a.postType} media_type=${a.mediaType} media_source=biblio media_url=${a.mediaUrl}`)
      log(`   media_caption=${JSON.stringify(a.caption)}`)
      return { draftId: '(draft_id renvoyé par create_draft_tool)' }
    },
    async scheduleDraft(a) {
      log(`MCP schedule_draft_tool ⇐ draft_id=${a.draftId} post_date=${a.postDate} post_heure=${a.postHeure}`)
      return { ok: true }
    },
  }
}
