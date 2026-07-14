// Transport image→vidéo via fal.ai (tier animated, premium). Vit dans adapters/ —
// le cœur reste pur. Le nom du modèle vient de la CONFIG (render.animated.model),
// pas d'une constante : basculer Kling → Runway/Pika = changer la config, pas ce code.
// La clé (FAL_KEY) vient de l'environnement ; elle n'est jamais journalisée.

import { readFileSync } from 'node:fs'
import { fal } from '@fal-ai/client'
import type { ClipInvoke, ClipRequest, ClipResult } from './mcp'

export interface FalClipOptions {
  /** Endpoint du modèle (render.animated.model), ex. fal-ai/kling-video/v2.1/standard/image-to-video */
  model: string
  /** FAL_KEY (environnement). Jamais loggée. */
  apiKey: string
  /** Journalisation de progression (facultative). */
  onLog?: (message: string) => void
}

/**
 * Mappe la requête générique vers le schéma d'entrée du modèle (les familles fal
 * diffèrent). Ajouter un modèle d'une famille connue = zéro changement ; une nouvelle
 * famille = une branche ici, jamais une réécriture. C'est ce qui garde `model` en config.
 */
export function buildFalInput(model: string, req: ClipRequest, imageUrl: string): Record<string, unknown> {
  const isKlingV3orO3 = /kling-video\/(v3|o3)/.test(model)
  const isKling = /kling-video/.test(model)
  const isSeedance = /seedance/.test(model)

  const input: Record<string, unknown> = {
    prompt: req.videoPrompt,
    duration: String(req.durationSeconds),
  }
  // Clé de l'image de départ : v3/o3 = start_image_url ; sinon image_url.
  if (isKlingV3orO3) input.start_image_url = imageUrl
  else input.image_url = imageUrl
  // Negative prompt : supporté par Kling & Seedance.
  if (isKling || isSeedance) input.negative_prompt = req.negativePrompt
  // Ratio explicite seulement pour Kling v2.x (v3 le déduit de l'image).
  if (/kling-video\/v2/.test(model)) input.aspect_ratio = '9:16'
  // Audio désactivé là où c'est un paramètre connu (sortie muette + moins cher).
  if (/kling-video\/(v3|o3|v2\.6)/.test(model)) input.generate_audio = false
  return input
}

/** Construit un ClipInvoke fal.ai : image fixe → première frame → clip i2v vertical 9:16. */
export function makeFalClipInvoke(opts: FalClipOptions): ClipInvoke {
  fal.config({ credentials: opts.apiKey })

  return async (req: ClipRequest): Promise<ClipResult> => {
    // 1) La première frame = l'image fixe du plan → upload → URL fal.
    const bytes = readFileSync(req.firstFrame)
    const type = req.firstFrame.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
    const imageUrl = await fal.storage.upload(new Blob([bytes], { type }))

    // 2) Soumission i2v (input mappé selon la famille du modèle).
    const result = await fal.subscribe(opts.model, {
      input: buildFalInput(opts.model, req, imageUrl),
      logs: true,
      onQueueUpdate: (u: { status: string; logs?: { message: string }[] }) => {
        if (opts.onLog && u.status === 'IN_PROGRESS') {
          for (const l of u.logs ?? []) if (l.message) opts.onLog(l.message)
        }
      },
    })

    const data = (result as { data?: { video?: { url?: string } }; video?: { url?: string } })
    const url = data.data?.video?.url ?? data.video?.url
    if (!url) throw new Error('fal.ai : aucune URL vidéo dans la réponse.')
    return { video_url: url }
  }
}
