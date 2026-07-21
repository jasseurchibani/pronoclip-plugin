// Transport voix off (TTS) — cascade ÉCONOMIQUE : GRATUIT par défaut, PAYANT en opt-in
// explicite. Jamais de bascule silencieuse vers le payant (cf. skill audio-narration).
// Providers :
//   - 'sapi'       : Windows SAPI (System.Speech), voix fr-FR locale — GRATUIT, sans clé.
//   - 'elevenlabs' : ElevenLabs REST (ELEVENLABS_API_KEY) — PAYANT au caractère (opt-in).
// (Kokoro via `hyperframes tts` = provider gratuit canonique des routines ; à brancher ici
//  en priorité quand le CLI HyperFrames est installé. Même contrat que ci-dessous.)

import { writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

export type TtsProvider = 'sapi' | 'elevenlabs'

export interface TtsResult {
  path: string
  provider: TtsProvider
  chars: number
  format: 'wav' | 'mp3'
}

export interface TtsOptions {
  text: string
  /** Chemin de sortie SANS extension (l'extension dépend du provider). */
  outPathBase: string
  /** Provider demandé. Absent → cascade : GRATUIT (sapi) par défaut. */
  provider?: TtsProvider
  voice?: { elevenlabs_voice_id?: string; elevenlabs_model?: string }
  log?: (m: string) => void
}

const DEFAULT_ELEVEN_VOICE = '21m00Tcm4TlvDq8ikWAM' // repli si non configuré

/**
 * Résout le provider effectif. Règle dure : jamais de payant sans opt-in explicite ET
 * sans clé. Un `elevenlabs` demandé sans clé retombe sur le gratuit (sapi).
 */
export function resolveTtsProvider(requested: TtsProvider | undefined): TtsProvider {
  if (requested === 'elevenlabs') {
    return process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : 'sapi'
  }
  return 'sapi' // défaut GRATUIT
}

export async function synthesizeVoice(opts: TtsOptions): Promise<TtsResult> {
  const provider = resolveTtsProvider(opts.provider)
  const log = opts.log ?? (() => {})
  return provider === 'elevenlabs' ? synthElevenLabs(opts, log) : synthSapi(opts, log)
}

async function synthElevenLabs(opts: TtsOptions, log: (m: string) => void): Promise<TtsResult> {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new Error('ElevenLabs : ELEVENLABS_API_KEY absente.')
  const voiceId = opts.voice?.elevenlabs_voice_id || DEFAULT_ELEVEN_VOICE
  const model = opts.voice?.elevenlabs_model || 'eleven_multilingual_v2'
  const path = `${opts.outPathBase}.mp3`
  log(`TTS ElevenLabs (PAYANT) — voix ${voiceId}, modèle ${model}, ${opts.text.length} caractères.`)
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: opts.text,
      model_id: model,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status} : ${(await res.text()).slice(0, 300)}`)
  writeFileSync(path, Buffer.from(await res.arrayBuffer()))
  return { path, provider: 'elevenlabs', chars: opts.text.length, format: 'mp3' }
}

function synthSapi(opts: TtsOptions, log: (m: string) => void): TtsResult {
  const path = `${opts.outPathBase}.wav`
  const txtFile = `${opts.outPathBase}.txt`
  writeFileSync(txtFile, opts.text, 'utf8') // texte via fichier → aucun souci d'accents/échappement
  log(`TTS SAPI (gratuit, local, fr-FR) — ${opts.text.length} caractères.`)
  const ps = [
    "$ErrorActionPreference='Stop'",
    'Add-Type -AssemblyName System.Speech',
    '$t=[IO.File]::ReadAllText($env:PC_TXT,[Text.Encoding]::UTF8)',
    '$s=New-Object System.Speech.Synthesis.SpeechSynthesizer',
    "try{$fr=$s.GetInstalledVoices()|Where-Object{$_.VoiceInfo.Culture.Name -like 'fr*'}|Select-Object -First 1; if($fr){$s.SelectVoice($fr.VoiceInfo.Name)}}catch{}",
    '$s.SetOutputToWaveFile($env:PC_WAV)',
    '$s.Speak($t)',
    '$s.Dispose()',
  ].join('; ')
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
    env: { ...process.env, PC_TXT: txtFile, PC_WAV: path },
    encoding: 'utf8',
  })
  if (r.status !== 0) throw new Error(`SAPI a échoué : ${r.stderr?.slice(-400) || 'code ' + r.status}`)
  return { path, provider: 'sapi', chars: opts.text.length, format: 'wav' }
}
