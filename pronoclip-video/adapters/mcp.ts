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

// Bibliothèque de portraits (cf. ADR 2026-07-13). Le SEMIS écrit (génère + gèle) ;
// la LECTURE charge les index (fichier local + manifeste canonique HTTP public).
// Le core reste pur (core/portrait-index.ts) : il ne fait que résoudre.

export interface SquadSeeder {
  // TODO(Phase 4a): /pronoclip-squad — génère les portraits manquants (edit_image),
  // fait valider par un humain, gèle dans l'index ./pronoclip-data/squads/<ns>/<équipe>.json.
  // PAYANT : coût affiché + accord explicite avant toute génération.
  readonly _placeholder?: never
}

export interface SquadIndexLoader {
  // TODO(Phase 4b): charge les SquadIndex (local `<marque>/` + manifeste canonique
  // `pronoclip/` en HTTPS public) pour alimenter makePortraitResolver (lecture seule,
  // aucun compte RapidoCMS requis pour lire le canonique).
  readonly _placeholder?: never
}
