// Adaptateur REST — même logique core/, transport HTTP direct (pour le site, plus tard).
// Le cerveau (pronostic, Match Bible, prompts) est dans core/ ; seul le transport
// change ici (cf. MISSION §10). Implémente les ports de core/ports.ts.
// Aucune logique implémentée à ce stade.

import type { ImagePort, VoicePort, PublishPort } from '../core/ports'

export interface RestImageAdapter extends ImagePort {
  // TODO(post-plugin): génération/édition d'image via API REST.
  readonly _placeholder?: never
}

export interface RestVoiceAdapter extends VoicePort {
  // TODO(post-plugin): voix off via API REST.
  readonly _placeholder?: never
}

export interface RestPublishAdapter extends PublishPort {
  // TODO(post-plugin): publication via API REST.
  readonly _placeholder?: never
}
