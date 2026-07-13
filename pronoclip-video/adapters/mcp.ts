// Adaptateur MCP — images, voix, publication pilotés par un client IA (Claude Code).
// Un serveur MCP n'est JAMAIS appelé depuis du code applicatif (cf. MISSION §10) :
// le TRANSPORT réel (l'appel `generate_image`/`edit_image`) est INJECTÉ ; cet adaptateur
// ne porte que la logique de mode (B1/B3) et la dégradation bruyante.

import type { VoicePort, PublishPort } from '../core/ports'

// ---------------------------------------------------------------------------
// Génération d'images — interface générique + mode B1/B3 (cf. décision B révisée)
// ---------------------------------------------------------------------------

export type ImageMode = 'B1' | 'B3'

/** Avertissement émis à CHAQUE plan en mode dégradé (jamais silencieux). */
export const B3_WARNING = 'MODE DÉGRADÉ B3 — cohérence de visage non garantie'

/** Résultat minimal d'une génération d'image. */
export interface ImageResult {
  image_url: string
}

/**
 * Transport réel injecté : en Claude Code c'est l'appel MCP `generate_image`
 * (B3, `refs` ignorés) ou `edit_image` (B1, `refs` transmis) ; côté site ce serait
 * un appel REST. Le cœur/adaptateur n'appelle jamais le MCP directement.
 */
export type ImageInvoke = (prompt: string, size: string, refs: string[]) => Promise<ImageResult>

export interface ImageGeneratorOptions {
  mode: ImageMode
  invoke: ImageInvoke
  /** Journalisation (défaut : console.warn). Injectable pour les tests. */
  warn?: (message: string) => void
}

/**
 * Fabrique un `generateImage(prompt, refs[], size)` GÉNÉRIQUE (signature stable des
 * deux modes) :
 * - **B1** : `refs` (portraits de référence) transmis au transport → cohérence de visage.
 * - **B3** : `refs` **ignorés**, et un avertissement explicite est loggé **à chaque
 *   plan** (dégradation bruyante). Bascule B3→B1 sans réécriture du cœur.
 */
export function makeImageGenerator(opts: ImageGeneratorOptions) {
  const warn = opts.warn ?? ((m: string) => console.warn(m))
  return async function generateImage(prompt: string, refs: string[], size: string): Promise<ImageResult> {
    if (opts.mode === 'B3') {
      warn(B3_WARNING)
      return opts.invoke(prompt, size, []) // refs volontairement ignorés
    }
    return opts.invoke(prompt, size, refs) // B1 : portraits de référence transmis
  }
}

// ---------------------------------------------------------------------------
// Image→vidéo — tier `animated` (premium, cf. MISSION §8)
// ---------------------------------------------------------------------------

export interface ClipRequest {
  /** URL/chemin de l'image fixe utilisée comme PREMIÈRE frame. */
  firstFrame: string
  videoPrompt: string
  negativePrompt: string
  durationSeconds: number
}

export interface ClipResult {
  video_url: string
}

/** Transport réel injecté : API d'un modèle image→vidéo (Kling / Runway / …). */
export type ClipInvoke = (req: ClipRequest) => Promise<ClipResult>

/**
 * Génère un clip image→vidéo. PREMIUM : n'existe qu'en tier `animated`, jamais par
 * défaut, jamais en routine auto. Le transport est injecté ; s'il est absent, on
 * refuse explicitement (aucun modèle configuré) plutôt que de dégrader en silence.
 */
export function makeClipGenerator(opts: { invoke?: ClipInvoke; warn?: (m: string) => void }) {
  const warn = opts.warn ?? ((m: string) => console.warn(m))
  return async function generateClip(req: ClipRequest): Promise<ClipResult> {
    if (!opts.invoke) {
      throw new Error(
        'Tier animated : aucun modèle image→vidéo configuré (clé Kling/Runway/… absente). ' +
        'Fournir un transport ClipInvoke, ou rester en tier motion.',
      )
    }
    warn(`Tier ANIMATED (premium) — clip payant : ${req.durationSeconds}s`)
    return opts.invoke(req)
  }
}

// ---------------------------------------------------------------------------
// Voix off + publication (Phases 4/6) — stubs typés, aucune I/O ici.
// ---------------------------------------------------------------------------

export interface McpVoiceAdapter extends VoicePort {
  // TODO(Phase 4): voix off ElevenLabs.
  readonly _placeholder?: never
}

export interface McpPublishAdapter extends PublishPort {
  // TODO(Phase 6): publication RapidoCMS.
  readonly _placeholder?: never
}

// ---------------------------------------------------------------------------
// Bibliothèque de portraits (cf. ADR 2026-07-13). Reste au plan même en B3 :
// en B3 les portraits ne sont pas utilisés, mais l'architecture ne change pas —
// le jour où B1 arrive, tout se branche (mode "B1" → refs transmis ci-dessus).
// ---------------------------------------------------------------------------

export interface SquadSeeder {
  // TODO(Phase 4a): /pronoclip-squad — génère les portraits manquants (edit_image),
  // fait valider par un humain, gèle dans l'index. PAYANT : coût + accord explicite.
  readonly _placeholder?: never
}

export interface SquadIndexLoader {
  // TODO(Phase 4b/B1): charge les SquadIndex (local `<marque>/` + manifeste canonique
  // `pronoclip/` en HTTPS public) pour alimenter makePortraitResolver.
  readonly _placeholder?: never
}
