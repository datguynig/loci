// TTS provider abstraction layer.
// Browser clients only talk to a proxy endpoint; provider secrets stay server-side.

import { getElevenLabsProxyUrl, getElevenLabsApiKey } from '../utils/tts'

export type TTSProvider = 'browser' | 'elevenlabs'
export type ElevenLabsModel = 'eleven_turbo_v2_5' | 'eleven_multilingual_v2'

export interface TTSConfig {
  provider: TTSProvider
  voiceId?: string
  model?: ElevenLabsModel
  rate?: number
}

export interface ElevenLabsVoice {
  voice_id: string
  name: string
  category?: string
  preview_url?: string
  labels?: Record<string, string>
}

/**
 * Stream a single sentence via the configured TTS provider.
 * - ElevenLabs: returns an HTMLAudioElement that auto-plays and calls onEnd when done.
 * - Browser TTS: returns null; the caller (useSpeech) handles browser utterances directly.
 */
export async function streamSentence(
  text: string,
  config: TTSConfig,
  onEnd: () => void,
): Promise<HTMLAudioElement | null> {
  if (config.provider === 'elevenlabs' && config.voiceId) {
    return streamElevenLabs(text, config, onEnd)
  }

  return null
}

async function streamElevenLabs(
  text: string,
  config: TTSConfig,
  onEnd: () => void,
): Promise<HTMLAudioElement> {
  const proxyUrl = getElevenLabsProxyUrl()
  const apiKey = getElevenLabsApiKey()

  // Proxy takes precedence; fall back to direct API key for local dev.
  const baseUrl = proxyUrl ?? 'https://api.elevenlabs.io'
  if (!proxyUrl && !apiKey) {
    throw new Error('ElevenLabs is not configured — set VITE_ELEVENLABS_API_KEY or VITE_ELEVENLABS_PROXY_URL')
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!proxyUrl && apiKey) headers['xi-api-key'] = apiKey

  const response = await fetch(`${baseUrl}/v1/text-to-speech/${config.voiceId}/stream`, {
    method: 'POST',
    headers,
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
    let errorMessage = `ElevenLabs error ${response.status}`
    try {
      const errorData = await response.json()
      errorMessage += `: ${JSON.stringify(errorData)}`
    } catch {
      // Ignore malformed proxy error bodies.
    }
    throw new Error(errorMessage)
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const audio = new Audio(objectUrl)

  audio.playbackRate = config.rate ?? 1
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

export async function fetchElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  const proxyUrl = getElevenLabsProxyUrl()
  const apiKey = getElevenLabsApiKey()

  const baseUrl = proxyUrl ?? 'https://api.elevenlabs.io'
  if (!proxyUrl && !apiKey) {
    throw new Error('ElevenLabs is not configured — set VITE_ELEVENLABS_API_KEY or VITE_ELEVENLABS_PROXY_URL')
  }

  const headers: Record<string, string> = {}
  if (!proxyUrl && apiKey) headers['xi-api-key'] = apiKey

  const response = await fetch(`${baseUrl}/v1/voices`, { headers })
  if (!response.ok) {
    throw new Error(`Failed to fetch ElevenLabs voices: ${response.status}`)
  }

  const data = (await response.json()) as { voices?: ElevenLabsVoice[] }
  return data.voices ?? []
}
