import { useState, useRef, useCallback, useEffect } from 'react'
import {
  streamSentence,
  fetchElevenLabsVoices,
  type TTSProvider,
  type ElevenLabsModel,
  type ElevenLabsVoice,
} from '../services/ttsService'

const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined

export interface UseSpeechReturn {
  speak: (text: string) => void
  pause: () => void
  resume: () => void
  stop: () => void
  skipForward: () => void
  skipBack: () => void
  isPlaying: boolean
  isPaused: boolean
  provider: TTSProvider
  // ElevenLabs
  elevenLabsVoices: ElevenLabsVoice[]
  selectedVoiceId: string
  setVoiceId: (id: string) => void
  selectedModel: ElevenLabsModel
  setModel: (model: ElevenLabsModel) => void
  // Browser TTS
  browserVoices: SpeechSynthesisVoice[]
  selectedBrowserVoice: SpeechSynthesisVoice | null
  setBrowserVoice: (v: SpeechSynthesisVoice) => void
  // Shared
  rate: number
  setRate: (r: number) => void
  currentSentenceIndex: number
  sentences: string[]
}

const PREFERRED_BROWSER_VOICES = [
  'Google UK English Female',
  'Google US English',
  'Daniel',
  'Samantha',
  'Karen',
]

function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace
  const raw = text.split(/(?<=[.!?])\s+/)
  return raw
    .map((s) => s.trim())
    .filter((s) => s.length > 3)
}

function pickPreferredVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const name of PREFERRED_BROWSER_VOICES) {
    const found = voices.find((v) => v.name.includes(name))
    if (found) return found
  }
  // Prefer en-GB or en-US voices
  const english = voices.find((v) => v.lang.startsWith('en'))
  return english ?? voices[0] ?? null
}

export function useSpeech(): UseSpeechReturn {
  const hasElevenLabs = Boolean(ELEVENLABS_API_KEY)
  const [provider] = useState<TTSProvider>(hasElevenLabs ? 'elevenlabs' : 'browser')

  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [sentences, setSentences] = useState<string[]>([])
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0)

  // ElevenLabs state
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([])
  const [selectedVoiceId, setVoiceId] = useState<string>('')
  const [selectedModel, setModel] = useState<ElevenLabsModel>('eleven_turbo_v2_5')

  // Browser TTS state
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedBrowserVoice, setBrowserVoice] = useState<SpeechSynthesisVoice | null>(null)

  // Shared
  const [rate, setRate] = useState(1.0)

  // Refs for stable callbacks (avoid stale closures in async loops)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const sentencesRef = useRef<string[]>([])
  const indexRef = useRef(0)
  const isPlayingRef = useRef(false)
  const isPausedRef = useRef(false)
  const rateRef = useRef(1.0)
  const voiceIdRef = useRef('')
  const modelRef = useRef<ElevenLabsModel>('eleven_turbo_v2_5')
  const browserVoiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const chromeBugIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Keep refs in sync with state
  useEffect(() => { rateRef.current = rate }, [rate])
  useEffect(() => { voiceIdRef.current = selectedVoiceId }, [selectedVoiceId])
  useEffect(() => { modelRef.current = selectedModel }, [selectedModel])
  useEffect(() => { browserVoiceRef.current = selectedBrowserVoice }, [selectedBrowserVoice])

  // Load ElevenLabs voices on init
  useEffect(() => {
    if (!hasElevenLabs || !ELEVENLABS_API_KEY) return
    fetchElevenLabsVoices(ELEVENLABS_API_KEY)
      .then((voices) => {
        setElevenLabsVoices(voices)
        if (voices.length > 0 && !voiceIdRef.current) {
          // Prefer "Adam" or first voice
          const adam = voices.find((v) => v.name === 'Adam')
          const defaultVoice = adam ?? voices[0]
          setVoiceId(defaultVoice.voice_id)
          voiceIdRef.current = defaultVoice.voice_id
        }
      })
      .catch(() => {
        // Silently ignore — will fall back to browser TTS
      })
  }, [hasElevenLabs])

  // Load browser voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) {
        setBrowserVoices(voices)
        if (!browserVoiceRef.current) {
          const preferred = pickPreferredVoice(voices)
          setBrowserVoice(preferred)
          browserVoiceRef.current = preferred
        }
      }
    }

    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [])

  // Chrome SpeechSynthesis bug: stops after ~15s. Keep it alive.
  const startChromeBugFix = useCallback(() => {
    if (chromeBugIntervalRef.current) clearInterval(chromeBugIntervalRef.current)
    chromeBugIntervalRef.current = setInterval(() => {
      if (isPlayingRef.current && !isPausedRef.current && provider === 'browser') {
        window.speechSynthesis.pause()
        window.speechSynthesis.resume()
      }
    }, 10000)
  }, [provider])

  const stopChromeBugFix = useCallback(() => {
    if (chromeBugIntervalRef.current) {
      clearInterval(chromeBugIntervalRef.current)
      chromeBugIntervalRef.current = null
    }
  }, [])

  // ElevenLabs sentence playback loop
  const playElevenLabsSentence = useCallback(
    async (idx: number) => {
      if (!isPlayingRef.current || idx >= sentencesRef.current.length) {
        setIsPlaying(false)
        isPlayingRef.current = false
        return
      }

      setCurrentSentenceIndex(idx)
      indexRef.current = idx

      try {
        const audio = await streamSentence(
          sentencesRef.current[idx],
          {
            provider: 'elevenlabs',
            apiKey: ELEVENLABS_API_KEY,
            voiceId: voiceIdRef.current,
            model: modelRef.current,
            rate: rateRef.current,
          },
          () => {
            if (!isPlayingRef.current) return
            playElevenLabsSentence(idx + 1)
          }
        )
        currentAudioRef.current = audio
      } catch {
        // ElevenLabs failed — fall back to browser TTS for this sentence
        playBrowserSentence(idx)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // Browser TTS sentence playback loop
  const playBrowserSentence = useCallback(
    (idx: number) => {
      if (!isPlayingRef.current || idx >= sentencesRef.current.length) {
        setIsPlaying(false)
        isPlayingRef.current = false
        window.speechSynthesis.cancel()
        stopChromeBugFix()
        return
      }

      setCurrentSentenceIndex(idx)
      indexRef.current = idx

      const utterance = new SpeechSynthesisUtterance(sentencesRef.current[idx])
      utterance.rate = rateRef.current
      utterance.lang = 'en-GB'

      if (browserVoiceRef.current) {
        utterance.voice = browserVoiceRef.current
      }

      utterance.onend = () => {
        if (!isPlayingRef.current) return
        playBrowserSentence(idx + 1)
      }

      utterance.onerror = () => {
        if (!isPlayingRef.current) return
        playBrowserSentence(idx + 1)
      }

      window.speechSynthesis.speak(utterance)
    },
    [stopChromeBugFix]
  )

  const speak = useCallback(
    (text: string) => {
      // Stop any existing playback
      if (isPlayingRef.current) {
        isPlayingRef.current = false
        currentAudioRef.current?.pause()
        if (currentAudioRef.current) {
          currentAudioRef.current.src = ''
          currentAudioRef.current = null
        }
        window.speechSynthesis.cancel()
        stopChromeBugFix()
      }

      const parsed = splitSentences(text)
      if (parsed.length === 0) return

      sentencesRef.current = parsed
      indexRef.current = 0
      setSentences(parsed)
      setCurrentSentenceIndex(0)
      setIsPlaying(true)
      setIsPaused(false)
      isPlayingRef.current = true
      isPausedRef.current = false

      if (provider === 'elevenlabs' && voiceIdRef.current) {
        playElevenLabsSentence(0)
      } else {
        window.speechSynthesis.cancel()
        startChromeBugFix()
        playBrowserSentence(0)
      }
    },
    [provider, playElevenLabsSentence, playBrowserSentence, startChromeBugFix, stopChromeBugFix]
  )

  const pause = useCallback(() => {
    if (!isPlayingRef.current || isPausedRef.current) return
    isPausedRef.current = true
    setIsPaused(true)

    if (provider === 'elevenlabs') {
      currentAudioRef.current?.pause()
    } else {
      window.speechSynthesis.pause()
    }
  }, [provider])

  const resume = useCallback(() => {
    if (!isPausedRef.current) return
    isPausedRef.current = false
    setIsPaused(false)

    if (provider === 'elevenlabs') {
      currentAudioRef.current?.play()
    } else {
      window.speechSynthesis.resume()
    }
  }, [provider])

  const stop = useCallback(() => {
    isPlayingRef.current = false
    isPausedRef.current = false
    setIsPlaying(false)
    setIsPaused(false)
    setCurrentSentenceIndex(0)
    indexRef.current = 0

    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.src = ''
      currentAudioRef.current = null
    }
    window.speechSynthesis.cancel()
    stopChromeBugFix()
  }, [stopChromeBugFix])

  const skipForward = useCallback(() => {
    const newIdx = Math.min(indexRef.current + 3, sentencesRef.current.length - 1)

    if (provider === 'elevenlabs') {
      currentAudioRef.current?.pause()
      if (currentAudioRef.current) {
        currentAudioRef.current.src = ''
        currentAudioRef.current = null
      }
    } else {
      window.speechSynthesis.cancel()
    }

    if (isPlayingRef.current) {
      indexRef.current = newIdx
      setCurrentSentenceIndex(newIdx)
      if (provider === 'elevenlabs') {
        playElevenLabsSentence(newIdx)
      } else {
        playBrowserSentence(newIdx)
      }
    }
  }, [provider, playElevenLabsSentence, playBrowserSentence])

  const skipBack = useCallback(() => {
    const newIdx = Math.max(indexRef.current - 3, 0)

    if (provider === 'elevenlabs') {
      currentAudioRef.current?.pause()
      if (currentAudioRef.current) {
        currentAudioRef.current.src = ''
        currentAudioRef.current = null
      }
    } else {
      window.speechSynthesis.cancel()
    }

    if (isPlayingRef.current) {
      indexRef.current = newIdx
      setCurrentSentenceIndex(newIdx)
      if (provider === 'elevenlabs') {
        playElevenLabsSentence(newIdx)
      } else {
        playBrowserSentence(newIdx)
      }
    }
  }, [provider, playElevenLabsSentence, playBrowserSentence])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isPlayingRef.current = false
      currentAudioRef.current?.pause()
      window.speechSynthesis.cancel()
      stopChromeBugFix()
    }
  }, [stopChromeBugFix])

  return {
    speak,
    pause,
    resume,
    stop,
    skipForward,
    skipBack,
    isPlaying,
    isPaused,
    provider,
    elevenLabsVoices,
    selectedVoiceId,
    setVoiceId,
    selectedModel,
    setModel,
    browserVoices,
    selectedBrowserVoice,
    setBrowserVoice,
    rate,
    setRate,
    currentSentenceIndex,
    sentences,
  }
}
