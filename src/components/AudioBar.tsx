import { motion } from 'framer-motion'
import type { TTSProvider, ElevenLabsModel } from '../services/ttsService'
import type { ElevenLabsVoice } from '../services/ttsService'

const HAS_ELEVENLABS = Boolean(import.meta.env.VITE_ELEVENLABS_API_KEY)

interface AudioBarProps {
  isPlaying: boolean
  isPaused: boolean
  provider: TTSProvider
  sentences: string[]
  currentSentenceIndex: number
  rate: number
  setRate: (r: number) => void
  // ElevenLabs
  elevenLabsVoices: ElevenLabsVoice[]
  selectedVoiceId: string
  setVoiceId: (id: string) => void
  selectedModel: ElevenLabsModel
  setModel: (m: ElevenLabsModel) => void
  // Browser
  browserVoices: SpeechSynthesisVoice[]
  selectedBrowserVoice: SpeechSynthesisVoice | null
  setBrowserVoice: (v: SpeechSynthesisVoice) => void
  // Actions
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onSkipForward: () => void
  onSkipBack: () => void
  onPrevPage: () => void
  onNextPage: () => void
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

function ControlButton({
  onClick,
  label,
  children,
  size = 'md',
  active = false,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  active?: boolean
}) {
  const sz = size === 'lg' ? 36 : size === 'sm' ? 24 : 30

  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        width: sz,
        height: sz,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        border: 'none',
        background: active ? 'var(--accent-warm)' : 'transparent',
        color: active ? '#fff' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 120ms ease',
        flexShrink: 0,
        fontSize: size === 'lg' ? 16 : 13,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'var(--text-primary)'
          e.currentTarget.style.background = 'var(--bg-secondary)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'var(--text-secondary)'
          e.currentTarget.style.background = 'transparent'
        }
      }}
    >
      {children}
    </button>
  )
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  )
}

function Waveform() {
  return (
    <div
      style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 16 }}
      aria-hidden="true"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="waveform-bar"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  )
}

export default function AudioBar({
  isPlaying,
  isPaused,
  provider,
  sentences,
  currentSentenceIndex,
  rate,
  setRate,
  elevenLabsVoices,
  selectedVoiceId,
  setVoiceId,
  selectedModel,
  setModel,
  browserVoices,
  selectedBrowserVoice,
  setBrowserVoice,
  onPlay,
  onPause,
  onResume,
  onStop,
  onSkipForward,
  onSkipBack,
  onPrevPage,
  onNextPage,
}: AudioBarProps) {
  const currentSentence = sentences[currentSentenceIndex] ?? ''

  const handlePlayPause = () => {
    if (isPlaying && !isPaused) onPause()
    else if (isPaused) onResume()
    else onPlay()
  }

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-ui)',
    fontSize: 11,
    padding: '2px 6px',
    cursor: 'pointer',
    outline: 'none',
  }

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        background: 'rgba(var(--bg-surface-rgb, 255,255,255), 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {/* Current sentence preview */}
      {currentSentence && isPlaying && (
        <div
          style={{
            padding: '6px 16px 0',
            fontFamily: 'var(--font-reading)',
            fontStyle: 'italic',
            fontSize: 12,
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              background: 'rgba(196,168,130,0.25)',
              padding: '1px 4px',
              borderRadius: 3,
            }}
          >
            {currentSentence}
          </span>
        </div>
      )}

      {/* Controls row */}
      <div
        style={{
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          gap: 8,
        }}
      >
        {/* Left: transport controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ControlButton onClick={onPrevPage} label="Previous page">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="19 20 9 12 19 4 19 20" />
              <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2" />
            </svg>
          </ControlButton>

          <ControlButton onClick={onSkipBack} label="Skip back">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
            </svg>
          </ControlButton>

          <ControlButton onClick={handlePlayPause} label={isPlaying && !isPaused ? 'Pause' : 'Play'} size="lg" active={isPlaying && !isPaused}>
            {isPlaying && !isPaused ? <PauseIcon /> : <PlayIcon />}
          </ControlButton>

          <ControlButton onClick={onSkipForward} label="Skip forward">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-.49-4.5" />
            </svg>
          </ControlButton>

          <ControlButton onClick={onNextPage} label="Next page">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 4 15 12 5 20 5 4" />
              <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" />
            </svg>
          </ControlButton>

          {isPlaying && (
            <ControlButton onClick={onStop} label="Stop">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
            </ControlButton>
          )}
        </div>

        {/* Right: voice/speed controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Waveform (ElevenLabs only) */}
          {provider === 'elevenlabs' && isPlaying && !isPaused && <Waveform />}

          {/* ElevenLabs model toggle */}
          {HAS_ELEVENLABS && provider === 'elevenlabs' && (
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-secondary)',
                borderRadius: 20,
                padding: 2,
                border: '1px solid var(--border)',
              }}
            >
              {(['eleven_turbo_v2_5', 'eleven_multilingual_v2'] as ElevenLabsModel[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setModel(m)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 16,
                    border: 'none',
                    background: selectedModel === m ? 'var(--accent-warm)' : 'transparent',
                    color: selectedModel === m ? '#fff' : 'var(--text-tertiary)',
                    fontFamily: 'var(--font-ui)',
                    fontSize: 10,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m === 'eleven_turbo_v2_5' ? 'Turbo' : 'Quality'}
                </button>
              ))}
            </div>
          )}

          {/* Speed selector */}
          <select
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            aria-label="Playback speed"
            style={selectStyle}
          >
            {SPEED_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>

          {/* Voice selector */}
          {HAS_ELEVENLABS && provider === 'elevenlabs' && elevenLabsVoices.length > 0 ? (
            <select
              value={selectedVoiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              aria-label="Select voice"
              style={{ ...selectStyle, maxWidth: 120 }}
            >
              {elevenLabsVoices.map((v) => (
                <option key={v.voice_id} value={v.voice_id}>
                  {v.name}
                </option>
              ))}
            </select>
          ) : provider === 'browser' && browserVoices.length > 0 ? (
            <select
              value={selectedBrowserVoice?.name ?? ''}
              onChange={(e) => {
                const v = browserVoices.find((bv) => bv.name === e.target.value)
                if (v) setBrowserVoice(v)
              }}
              aria-label="Select voice"
              style={{ ...selectStyle, maxWidth: 120 }}
            >
              {browserVoices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          ) : (
            !HAS_ELEVENLABS && (
              <span
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                }}
              >
                Upgrade voice
              </span>
            )
          )}
        </div>
      </div>
    </motion.div>
  )
}
