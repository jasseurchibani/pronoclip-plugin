// GÉNÉRATION DE PORTRAIT — reprise EXACTE de la recette qui a produit la bibliothèque
// existante (1493 portraits). Toute divergence casserait la cohérence visuelle du set,
// donc le prompt, le modèle, la qualité et la taille sont repris mot pour mot et
// valeur pour valeur du projet source (`src/scripts/run_full_generation.py`).
//
// Ce n'est PAS du texte→image : c'est `images/edits` avec DEUX images de référence —
// le visage du joueur puis le maillot du pays. Un générateur texte seul (par ex.
// l'outil MCP `generate_image`) ne peut pas reproduire ce rendu.
//
// Appel HTTP direct à OpenAI (comme adapters/openai-image.ts, cf. MISSION §10) :
// aucun MCP n'est appelé depuis le code. OPENAI_API_KEY vient de l'environnement et
// n'est jamais journalisée.

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

export const OPENAI_IMAGE_EDITS_URL = 'https://api.openai.com/v1/images/edits'

/**
 * Paramètres du run d'origine — ne pas modifier sans régénérer toute la bibliothèque.
 *
 * Le modèle est `gpt-image-1.5`, établi par recoupement : les portraits existants datent
 * du 2026-06-02 21h22, juste après la dernière modification de `test_concurrent_20.py`
 * (20h50), qui utilise `gpt-image-1.5`. `run_full_generation.py` affiche `gpt-image-1`,
 * mais il a été édité 10 jours PLUS TARD — ce n'est pas lui qui a produit le set.
 * Les deux fichiers portent un prompt strictement identique (3048 caractères).
 * Vérifié empiriquement : `gpt-image-1` rend un écusson illisible et un trait grossier.
 */
export const PORTRAIT_MODEL = 'gpt-image-1.5'
export const PORTRAIT_QUALITY = 'low'
export const PORTRAIT_SIZE = '1024x1536'

/**
 * Prompt d'art direction, repris VERBATIM du projet source. L'ordre des références est
 * significatif : image 1 = visage, image 2 = maillot — le texte y fait explicitement
 * référence dès sa première phrase.
 */
export const PORTRAIT_PROMPT =
  'Reference Image 1 is the player face texture. ' +
  'Reference Image 2 is the source country kit jersey layout. ' +
  'A premium 2D digital sports illustration of a male football athlete in a sharp, ' +
  'semi-realistic anime style, matching the exact dark, intense match-scene aesthetic ' +
  'of Blue Lock and Vinland Saga. \n\n' +
  'STYLE RULES: Strict 2D hand-drawn digital painting with fine ink linework. ' +
  'Completely flat 2D graphic novel art style. No 3D rendering, no CGI elements, ' +
  'no glossy plastic shading, no chibi features. \n\n' +
  'REALISM & ANATOMY: Fully realistic human head-to-shoulder proportions. Sharp, narrow, ' +
  'intensely focused eyes of a realistic human size—not oversized cartoon eyes. Highly ' +
  'defined facial anatomy with visible cheekbones, a sharp masculine jawline, a realistic ' +
  'neck width, and broad athletic shoulders. Fully realistic hand anatomy with accurate ' +
  'proportions, visible knuckles, and natural finger joints.\n\n' +
  'FACE & HAIR: Exact skin tone, hair color, and haircut replicated from the reference photo. ' +
  'Hair is drawn with precise flowing ink lines and dynamic strand movement, finished with a ' +
  'sharp white anime hair highlight stripe. Face displays a confident, slight smile with teeth ' +
  'subtly visible. Precise ink strokes render a natural beard over the skin gradient.\n\n' +
  'SKIN SHADING: High-end 2D animated film technique using a smooth 5-tone digital painting ' +
  'gradient (bright specular highlight, light midtone, base skin, warm shadow, deep jaw shadow). ' +
  'Subsurface warmth details on ears and cheeks. A sharp white specular highlight dot on the ' +
  'nose tip and lower lip.\n\n' +
  'JERSEY & DETAILS: The football jersey is rendered with a smooth light-to-shadow gradient ' +
  'showcasing an athletic body shape. Fabric folds follow natural body contours as curved ink ' +
  'lines. The federation badge, collar, stripes, and sponsor logos are crisply defined and ' +
  'fully legible. \n\n' +
  'EXACT POSE & HANDS: The athlete stands proudly facing the camera, upper body turned at a ' +
  'subtle 3/4 angle. Both arms are symmetrically raised to chest height, bent 90 degrees at ' +
  'the elbows to frame the jersey badge.\n' +
  "- The player's right hand (on the viewer's left) has the index finger fully extended, " +
  'pointing directly at the federation badge on the chest. The remaining three fingers are ' +
  'loosely curled into a relaxed half-fist.\n' +
  "- The player's left hand (on the viewer's right) is held casually at chest level next to " +
  'the badge, with all fingers and thumb loosely curled into a soft, relaxed closed fist.\n\n' +
  'LIGHTING & BACKGROUND: High-contrast studio lighting baked onto the character. Primary key ' +
  'light from above-front illuminating the hair and shoulders, a warm orange-gold fill light on ' +
  'the side shadows, and a sharp cool blue rim light tracing the opposite silhouette. Isolated ' +
  'portrait character design on a perfectly clean, solid, seamless white background for easy ' +
  'alpha-channel extraction.\n\n' +
  'TECHNICAL SPECIFICATIONS: 4K resolution, flawless 2D digital anime concept art, 9:16 portrait ' +
  'format, ultra-fine ink outline weight, with a small 4-pointed white sparkle accent in the ' +
  'bottom right corner.'

export interface GeneratePortraitParams {
  /** Chemin local du visage de référence (image 1). */
  facePath: string
  /** Chemin local du maillot domicile (image 2). */
  kitPath: string
  /** Surcharge du prompt — par défaut, celui de la bibliothèque. */
  prompt?: string
  model?: string
  quality?: string
  size?: string
  apiKey?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export type GeneratePortraitOutcome =
  | { ok: true; png: Buffer; model: string; quality: string; size: string }
  | { ok: false; reason: 'no-api-key' | 'network' | 'http' | 'invalid-response'; message: string }

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
}

function blobFor(path: string): { blob: Blob; name: string } {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase()
  const bytes = readFileSync(path)
  return { blob: new Blob([bytes], { type: MIME[ext] ?? 'application/octet-stream' }), name: basename(path) }
}

/**
 * Génère UN portrait. Ne lève pas : renvoie un résultat typé, pour qu'un appelant
 * automatique puisse retomber proprement sur « effectif non semé » plutôt que crasher.
 * L'appel est PAYANT — l'appelant est responsable d'avoir obtenu un accord.
 */
export async function generatePortrait(params: GeneratePortraitParams): Promise<GeneratePortraitOutcome> {
  const apiKey = params.apiKey ?? process.env.OPENAI_API_KEY
  if (!apiKey) {
    return { ok: false, reason: 'no-api-key', message: 'OPENAI_API_KEY absente de l\'environnement (.env).' }
  }

  const model = params.model ?? PORTRAIT_MODEL
  const quality = params.quality ?? PORTRAIT_QUALITY
  const size = params.size ?? PORTRAIT_SIZE

  const form = new FormData()
  form.append('model', model)
  form.append('quality', quality)
  form.append('size', size)
  form.append('output_format', 'png')
  form.append('prompt', params.prompt ?? PORTRAIT_PROMPT)
  // L'ordre compte : visage d'abord (référence 1), maillot ensuite (référence 2).
  const face = blobFor(params.facePath)
  const kit = blobFor(params.kitPath)
  form.append('image[]', face.blob, face.name)
  form.append('image[]', kit.blob, kit.name)

  const doFetch = params.fetchImpl ?? globalThis.fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? 180_000)

  let res: Response
  try {
    res = await doFetch(OPENAI_IMAGE_EDITS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    })
  } catch (err) {
    return {
      ok: false,
      reason: 'network',
      message: controller.signal.aborted
        ? 'Délai dépassé pendant la génération du portrait.'
        : `Appel OpenAI impossible — ${err instanceof Error ? err.message : String(err)}.`,
    }
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    let detail = ''
    try { detail = ` — ${(await res.text()).slice(0, 300)}` } catch { /* corps illisible */ }
    return { ok: false, reason: 'http', message: `OpenAI a répondu HTTP ${res.status}${detail}` }
  }

  let body: { data?: Array<{ b64_json?: string }> }
  try {
    body = (await res.json()) as typeof body
  } catch {
    return { ok: false, reason: 'invalid-response', message: 'Réponse OpenAI illisible (JSON invalide).' }
  }

  const b64 = body?.data?.[0]?.b64_json
  if (!b64) {
    return { ok: false, reason: 'invalid-response', message: 'Réponse OpenAI sans image (`data[0].b64_json` absent).' }
  }
  return { ok: true, png: Buffer.from(b64, 'base64'), model, quality, size }
}
