import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  splitSentences,
  pickPreferredVoice,
  getElevenLabsProxyUrl,
  hasElevenLabsProxy,
  resolveTtsProvider,
} from '../../src/utils/tts'

describe('splitSentences', () => {
  it('splits prose into trimmed sentences', () => {
    expect(splitSentences('First sentence. Second sentence! Third sentence?')).toEqual([
      'First sentence.',
      'Second sentence!',
      'Third sentence?',
    ])
  })

  it('drops fragments that are too short to speak cleanly', () => {
    expect(splitSentences('Ok. This one stays. No.')).toEqual(['This one stays.'])
  })
})

describe('pickPreferredVoice', () => {
  it('prefers the configured named voices first', () => {
    const voices = [
      { name: 'Microsoft Hazel', lang: 'en-GB' },
      { name: 'Google UK English Female', lang: 'en-GB' },
    ]

    expect(pickPreferredVoice(voices)).toEqual(voices[1])
  })

  it('falls back to any English voice, then the first voice', () => {
    expect(
      pickPreferredVoice([
        { name: 'Deutsch', lang: 'de-DE' },
        { name: 'English Backup', lang: 'en-US' },
      ]),
    ).toEqual({ name: 'English Backup', lang: 'en-US' })

    expect(
      pickPreferredVoice([
        { name: 'Deutsch', lang: 'de-DE' },
        { name: 'Francais', lang: 'fr-FR' },
      ]),
    ).toEqual({ name: 'Deutsch', lang: 'de-DE' })
  })
})

describe('ElevenLabs proxy config', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('normalizes configured proxy URLs', () => {
    vi.stubEnv('VITE_ELEVENLABS_PROXY_URL', 'https://tts.example.com///')

    expect(getElevenLabsProxyUrl()).toBe('https://tts.example.com')
    expect(hasElevenLabsProxy()).toBe(true)
    expect(resolveTtsProvider()).toBe('elevenlabs')
  })

  it('falls back to browser TTS when no proxy is configured', () => {
    vi.stubEnv('VITE_ELEVENLABS_PROXY_URL', '')

    expect(getElevenLabsProxyUrl()).toBeNull()
    expect(hasElevenLabsProxy()).toBe(false)
    expect(resolveTtsProvider()).toBe('browser')
  })
})
