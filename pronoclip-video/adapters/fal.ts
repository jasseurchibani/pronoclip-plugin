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

/** Construit un ClipInvoke fal.ai : image fixe → première frame → clip i2v vertical 9:16. */
export function makeFalClipInvoke(opts: FalClipOptions): ClipInvoke {
  fal.config({ credentials: opts.apiKey })

  return async (req: ClipRequest): Promise<ClipResult> => {
    // 1) La première frame = l'image fixe du plan → upload → URL fal.
    const bytes = readFileSync(req.firstFrame)
    const type = req.firstFrame.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
    const imageUrl = await fal.storage.upload(new Blob([bytes], { type }))

    // 2) Soumission i2v. Schéma d'entrée Kling (fal) : image_url + prompt + negative + duration + aspect_ratio.
    const result = await fal.subscribe(opts.model, {
      input: {
        prompt: req.videoPrompt,
        negative_prompt: req.negativePrompt,
        image_url: imageUrl,
        duration: String(req.durationSeconds),
        aspect_ratio: '9:16',
      },
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
