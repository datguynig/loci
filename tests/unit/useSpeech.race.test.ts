/**
 * Regression test: ElevenLabs double-play race condition
 *
 * When speakFromHint is called twice before the first network request returns,
 * two audio elements race to completion and both call play() — voices clash.
 *
 * Fix: a playback generation counter; each new speak/speakFromHint call increments
 * it. After `await streamSentence`, playElevenLabsSentence bails and pauses the
 * returned audio if the generation has moved on.
 */

import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// ── Mock ttsService before importing useSpeech ────────────────────────────
vi.mock('../../src/services/ttsService', () => ({
  streamSentence: vi.fn(),
  fetchElevenLabsVoices: vi.fn().mockResolvedValue([
    { voice_id: 'mock-voice-id', name: 'Adam' },
  ]),
}))

// Force ElevenLabs provider so playElevenLabsSentence is exercised
vi.mock('../../src/utils/tts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/tts')>()
  return {
    ...actual,
    hasElevenLabs: () => true,
    resolveTtsProvider: () => 'elevenlabs' as const,
  }
})

import { useSpeech } from '../../src/hooks/useSpeech'
import { streamSentence } from '../../src/services/ttsService'

// ── Helpers ────────────────────────────────────────────────────────────────

function makeAudio() {
  return {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    src: '' as string,
    playbackRate: 1,
    onended: null as (() => void) | null,
    onerror: null as (() => void) | null,
    addEventListener: vi.fn(),
  }
}

// Silence SpeechSynthesis calls in jsdom (not available in the test env)
const speechSynthesisMock = {
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn().mockReturnValue([]),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useSpeech — ElevenLabs race condition', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      value: speechSynthesisMock,
      writable: true,
      configurable: true,
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('pauses the first in-flight audio when speakFromHint is called again before it resolves', async () => {
    const streamMock = vi.mocked(streamSentence)

    const audio1 = makeAudio()
    const audio2 = makeAudio()

    // Two controlled promises, one per request
    let resolveStream1!: (v: { audio: typeof audio1; wordTimings: never[] }) => void
    let resolveStream2!: (v: { audio: typeof audio2; wordTimings: never[] }) => void

    // Each mock implementation simulates streamSentence calling audio.play()
    // internally before resolving (matching the real implementation)
    streamMock
      .mockImplementationOnce(() =>
        new Promise((res) => {
          resolveStream1 = (val) => {
            val.audio.play()   // mirrors the real streamSentence: plays before returning
            res(val)
          }
        })
      )
      .mockImplementationOnce(() =>
        new Promise((res) => {
          resolveStream2 = (val) => {
            val.audio.play()
            res(val)
          }
        })
      )

    const { result } = renderHook(() => useSpeech())

    // Let voices-loading effects settle (fetchElevenLabsVoices is async)
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    const text = 'The first sentence. The second sentence.'

    // First tap — triggers request 1, which hangs awaiting resolveStream1
    act(() => { result.current.speakFromHint(text, 'The first') })

    // Second tap before request 1 returns — increments generation, triggers request 2
    act(() => { result.current.speakFromHint(text, 'The first') })

    // Both requests return. Without the fix, both audios play and voices clash.
    await act(async () => {
      resolveStream1({ audio: audio1, wordTimings: [] })
      resolveStream2({ audio: audio2, wordTimings: [] })
      // Let microtask queue flush
      await new Promise((r) => setTimeout(r, 0))
    })

    // audio1 started playing inside the mock (simulating streamSentence's internal
    // audio.play()). The fix must detect the stale generation and pause it.
    expect(audio1.pause).toHaveBeenCalled()

    // audio2 belongs to the winning (latest) generation and must keep playing.
    expect(audio2.pause).not.toHaveBeenCalled()
  })
})
