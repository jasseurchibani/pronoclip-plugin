// Transport B2 — édition d'image via OpenAI `images.edit` (APPEL DIRECT, PAS MCP).
// Le portrait de référence est passé en entrée ; le visage est préservé
// (`input_fidelity: 'high'`). OPENAI_API_KEY vient de l'environnement, jamais journalisée.
//
// Vit dans adapters/ : le cœur reste pur. B2 = variante DIRECTE de B1 (l'outil MCP
// `edit_image` du serveur RapidoCMS) : même mécanique (prompt + références → image),
// mais appelée sans passer par MCP. Utile pour tester la reprise du visage sans attendre
// la livraison de l'outil serveur. Cf. reference/specs/edit_image-mcp-rapidocms.md.

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import OpenAI, { toFile } from 'openai'

export interface EditImageOptions {
  /** OPENAI_API_KEY (environnement). Jamais journalisée. */
  apiKey: string
  /** Modèle d'édition. Défaut `gpt-image-1.5` (cf. spec). */
  model?: string
  /** Dimensions. Défaut portrait `1024x1536` (vertical, proche 9:16). */
  size?: '1024x1024' | '1024x1536' | '1536x1024'
  /** Qualité de sortie. Défaut `high`. */
  quality?: 'low' | 'medium' | 'high'
  /** Fidélité à la référence. `high` = préserve visage/silhouette. Défaut `high`. */
  inputFidelity?: 'low' | 'high'
  onLog?: (message: string) => void
}

export interface EditImageResult {
  pngBuffer: Buffer
  model: string
}

/**
 * Édite/compose une image à partir d'un prompt + 1..N portraits de référence.
 * Renvoie le PNG décodé (pas de base64 qui traîne). L'ordre des références est
 * significatif (1re = sujet principal), comme `edit_image`.
 */
export async function editImageWithReference(params: {
  prompt: string
  referencePaths: string[]
  opts: EditImageOptions
}): Promise<EditImageResult> {
  const { prompt, referencePaths, opts } = params
  if (referencePaths.length === 0) throw new Error('editImageWithReference : au moins une image de référence est requise.')

  const client = new OpenAI({ apiKey: opts.apiKey })
  const model = opts.model ?? 'gpt-image-1.5'
  const size = opts.size ?? '1024x1536'
  const quality = opts.quality ?? 'high'
  const inputFidelity = opts.inputFidelity ?? 'high'

  const files = await Promise.all(
    referencePaths.map(async p => toFile(readFileSync(p), basename(p), { type: 'image/png' })),
  )

  const request = {
    model,
    image: files.length === 1 ? files[0] : files,
    prompt,
    size,
    quality,
    input_fidelity: inputFidelity,
  }
  opts.onLog?.(`images.edit — ${model} · ${size} · quality ${quality} · input_fidelity ${inputFidelity} · ${files.length} réf.`)

  const res = await client.images.edit(request as Parameters<typeof client.images.edit>[0])
  // La signature renvoie un union (stream | réponse) ; on n'active pas le stream.
  const data = (res as { data?: Array<{ b64_json?: string }> }).data
  const b64 = data?.[0]?.b64_json
  if (!b64) throw new Error('OpenAI images.edit : aucune image (b64_json) dans la réponse.')
  return { pngBuffer: Buffer.from(b64, 'base64'), model }
}
