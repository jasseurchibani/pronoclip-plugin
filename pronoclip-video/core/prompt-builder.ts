// Construction des prompts d'image (Phase 3, cf. MISSION §4).
// Gabarit : STYLE + WORLD + CAMERA + SUBJECT + ACTION + NEGATIVE.
// WORLD/CAMERA/SUBJECT viennent du Match Bible (identiques partout) ; ACTION vient
// du SCENE_FRAGMENT (action pure, aucun décor). JAMAIS de texte/score/nom/chiffre
// dans un prompt d'image (cf. MISSION §4, §13). Pur, sans I/O.
// Aucune logique implémentée à ce stade.

import type { MatchBible } from './types'

/** Assemble le prompt final d'un plan à partir du Match Bible et du plan. */
export function buildImagePrompt(_bible: MatchBible, _shot: unknown): string {
  throw new Error('Not implemented — Phase 3 (core/prompt-builder.ts)')
}
