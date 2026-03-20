// TTS provider abstraction layer.
// All TTS calls go through this service — never directly to a provider.
// To add a backend proxy, change ELEVENLABS_BASE to your VPS endpoint URL.
// The rest of the app never changes.

export type TTSProvider = 'browser' | 'elevenlabs'
export type ElevenLabsModel = 'eleven_turbo_v2_5' | 'eleven_multilingual_v2'

export interface TTSConfig {
  provider: TTSProvider
  apiKey?: string
  voiceId?: string
  model?: ElevenLabsModel
  rate?: number // 0.5–2.0, default 1.0
}

export interface ElevenLabsVoice {
  voice_id: string
  name: string
  category?: string
}

// Phase 1/2: direct API call (dev + Vercel deploy, key in env var)
// Phase 3: change to 'https://api.yourdomain.com/tts' (VPS proxy, key on server)
const ELEVENLABS_BASE = 'https://api.elevenlabs.io'

/**
 * Stream a single sentence via the configured TTS provider.
 * - ElevenLabs: returns an HTMLAudioElement that auto-plays and calls onEnd when done.
 * - Browser TTS: returns null — the caller (useSpeech) handles browser utterances directly.
 */
export async function streamSentence(
  text: string,
  config: TTSConfig,
  onEnd: () => void
): Promise<HTMLAudioElement | null> {
  if (config.provider === 'elevenlabs' && config.apiKey && config.voiceId) {
    return streamElevenLabs(text, config, onEnd)
  }
  return null
}

async function streamElevenLabs(
  text: string,
  config: TTSConfig,
  onEnd: () => void
): Promise<HTMLAudioElement> {
  const url = `${ELEVENLABS_BASE}/v1/text-to-speech/${config.voiceId}/stream`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': config.apiKey!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: config.model ?? 'eleven_turbo_v2_5',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  })

  if (!response.ok) {
    let errMsg = `ElevenLabs error ${response.status}`
    try {
      const errData = await response.json()
      errMsg += `: ${JSON.stringify(errData)}`
    } catch {
      // ignore parse error
    }
    throw new Error(errMsg)
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const audio = new Audio(objectUrl)

  audio.playbackRate = config.rate ?? 1.0

  audio.onended = () => {
    URL.revokeObjectURL(objectUrl)
    onEnd()
  }

  audio.onerror = () => {
    URL.revokeObjectURL(objectUrl)
    onEnd()
  }

  await audio.play()
  return audio
}

/**
 * Fetch available voices from ElevenLabs.
 */
export async function fetchElevenLabsVoices(apiKey: string): Promise<ElevenLabsVoice[]> {
  const res = await fetch(`${ELEVENLABS_BASE}/v1/voices`, {
    headers: { 'xi-api-key': apiKey },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch ElevenLabs voices: ${res.status}`)
  }

  const data = await res.json()
  return data.voices as ElevenLabsVoice[]
}
