// Adaptateur MCP — images, voix, publication pilotés par un client IA (Claude Code).
// Un serveur MCP n'est JAMAIS appelé depuis du code applicatif (cf. MISSION §10) :
// cet adaptateur décrit les opérations attendues ; leur exécution reste orchestrée
// par l'agent via les outils MCP (RapidoCMS, HyperFrames…).
// Implémente les ports de core/ports.ts. Aucune logique implémentée à ce stade.

import type { ImagePort, VoicePort, PublishPort } from '../core/ports'

export interface McpImageAdapter extends ImagePort {
  // TODO(Phase 4): generate_image / edit_image (Décision B1) via RapidoCMS.
  readonly _placeholder?: never
}

export interface McpVoiceAdapter extends VoicePort {
  // TODO(Phase 4): voix off ElevenLabs.
  readonly _placeholder?: never
}

export interface McpPublishAdapter extends PublishPort {
  // TODO(Phase 6): publication RapidoCMS.
  readonly _placeholder?: never
}
