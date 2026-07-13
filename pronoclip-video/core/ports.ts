// Contrats (ports) implémentés par les adaptateurs (adapters/mcp.ts, adapters/rest.ts).
// Le core définit CE QU'IL FAUT faire ; le transport (MCP ou REST) est le
// problème des adaptateurs (cf. MISSION §10). Aucune I/O ici.

/** Génère / édite une image. `edit` prend des images de référence (Décision B1). */
export interface ImagePort {
  // TODO(Phase 4): generate(prompt, size) / edit(prompt, referenceImageUrls[], size).
  readonly _placeholder?: never
}

/** Synthétise la voix off d'un plan. */
export interface VoicePort {
  // TODO(Phase 4): synthesize(text, voiceId, model) -> audio.
  readonly _placeholder?: never
}

/** Publie la vidéo finale (RapidoCMS). */
export interface PublishPort {
  // TODO(Phase 6): publish(videoUrl, caption, disclosure).
  readonly _placeholder?: never
}
