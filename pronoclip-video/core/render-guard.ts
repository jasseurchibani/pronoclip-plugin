// Garde-fou de rendu (cf. MISSION §7/§13). La mention IA est OBLIGATOIRE : un rendu
// sans filigrane OU sans carton de fin est REFUSÉ (jamais supprimer la mention, même
// si un test échoue). Fournit aussi les métadonnées MP4 (mention IA + note B3).
// Pur : aucune I/O. À appeler AVANT tout rendu (script/skill), et adossable à un hook.

export interface DisclosureConfig {
  ai_disclosure?: { watermark?: string; end_card?: string[]; metadata?: string }
  image?: { mode?: string; b3_metadata_note?: string }
}

export type RenderLevel = 'motion' | 'animated'

/**
 * Résout le tier de rendu. `motion` reste le DÉFAUT ; `animated` (premium, payant)
 * n'est activé que par opt-in EXPLICITE (flag `--animated`) — jamais par défaut,
 * jamais dans une routine automatisée (cf. MISSION §8).
 */
export function resolveRenderLevel(configLevel: string | undefined, explicitAnimated?: boolean): RenderLevel {
  if (explicitAnimated) return 'animated'
  return configLevel === 'animated' ? 'animated' : 'motion'
}

export class MissingDisclosureError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MissingDisclosureError'
  }
}

/** Refuse le rendu si la mention IA (filigrane + carton de fin) est absente/vide. */
export function assertDisclosure(config: DisclosureConfig): void {
  const watermark = config.ai_disclosure?.watermark?.trim()
  if (!watermark) {
    throw new MissingDisclosureError(
      'Rendu refusé : filigrane IA vide (ai_disclosure.watermark). La mention IA est obligatoire (§7).',
    )
  }
  const endCard = config.ai_disclosure?.end_card
  if (!endCard || endCard.length === 0 || endCard.some(line => !line || !line.trim())) {
    throw new MissingDisclosureError(
      'Rendu refusé : carton de fin IA vide (ai_disclosure.end_card). La mention IA est obligatoire (§7).',
    )
  }
}

/**
 * Métadonnées du MP4 (champ comment/description) : mention IA, plus la note de mode
 * dégradé en B3 (« preview technique — cohérence de personnage non garantie »).
 */
export function buildVideoMetadata(config: DisclosureConfig, mode?: string): string {
  const base = config.ai_disclosure?.metadata?.trim() || config.ai_disclosure?.watermark?.trim() || ''
  const parts = [base]
  if (mode === 'B3' && config.image?.b3_metadata_note?.trim()) {
    parts.push(config.image.b3_metadata_note.trim())
  }
  return parts.filter(Boolean).join(' — ')
}
