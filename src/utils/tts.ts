import type { TTSProvider } from '../services/ttsService'

const MIN_SENTENCE_LENGTH = 4
const PREFERRED_BROWSER_VOICES = [
  'Google UK English Female',
  'Google US English',
  'Daniel',
  'Samantha',
  'Karen',
] as const

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= MIN_SENTENCE_LENGTH)
}

export function pickPreferredVoice<T extends { name: string; lang: string }>(
  voices: T[],
): T | null {
  for (const preferredName of PREFERRED_BROWSER_VOICES) {
    const match = voices.find((voice) => voice.name.includes(preferredName))
    if (match) return match
  }

  const englishVoice = voices.find((voice) => voice.lang.startsWith('en'))
  return englishVoice ?? voices[0] ?? null
}

function normalizeProxyUrl(url: string | undefined): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null
  return trimmed.replace(/\/+$/, '')
}

export function getElevenLabsProxyUrl(): string | null {
  return normalizeProxyUrl(import.meta.env.VITE_ELEVENLABS_PROXY_URL)
}

export function hasElevenLabsProxy(): boolean {
  return getElevenLabsProxyUrl() !== null
}

export function resolveTtsProvider(): TTSProvider {
  return hasElevenLabsProxy() ? 'elevenlabs' : 'browser'
}
