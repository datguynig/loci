import { useRef } from 'react'
import { motion } from 'framer-motion'
import type { TTSProvider, ElevenLabsModel } from '../services/ttsService'
import type { ElevenLabsVoice } from '../services/ttsService'
import { hasElevenLabs } from '../utils/tts'
import VoicePicker from './VoicePicker'
import ReaderSettings from './ReaderSettings'

const HAS_ELEVENLABS = hasElevenLabs()

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
  // Settings
  highlightEnabled: boolean
  onHighlightChange: (v: boolean) => void
  autoscrollEnabled: boolean
  onAutoscrollChange: (v: boolean) => void
  settingsOpen: boolean
  onSettingsToggle: () => void
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
  highlightEnabled,
  onHighlightChange,
  autoscrollEnabled,
  onAutoscrollChange,
  settingsOpen,
  onSettingsToggle,
}: AudioBarProps) {
  const gearRef = useRef<HTMLButtonElement>(null)
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
        background: 'rgba(var(--bg-surface-rgb), 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {/* Current sentence preview — fixed height to prevent epub viewer from resizing on play */}
      <div
        style={{
          height: 24,
          padding: '4px 16px 0',
          fontFamily: 'var(--font-reading)',
          fontStyle: 'italic',
          fontSize: 12,
          color: 'var(--text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          opacity: currentSentence && isPlaying ? 1 : 0,
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

          {isPlaying && (
            <ControlButton onClick={onStop} label="Stop">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
            </ControlButton>
          )}
        </div>

        {/* Right: voice/speed controls */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ReaderSettings
            isOpen={settingsOpen}
            onClose={onSettingsToggle}
            highlightEnabled={highlightEnabled}
            onHighlightChange={onHighlightChange}
            autoscrollEnabled={autoscrollEnabled}
            onAutoscrollChange={onAutoscrollChange}
            anchorRef={gearRef}
          />
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
            <VoicePicker
              voices={elevenLabsVoices}
              selectedVoiceId={selectedVoiceId}
              onSelect={setVoiceId}
            />
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
                Browser voice
              </span>
            )
          )}

          {/* Settings gear button */}
          <button
            ref={gearRef}
            onClick={onSettingsToggle}
            aria-label="Reader settings"
            aria-expanded={settingsOpen}
            style={{
              width: 26,
              height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              border: 'none',
              background: settingsOpen ? 'var(--bg-secondary)' : 'transparent',
              color: settingsOpen ? 'var(--text-primary)' : 'var(--text-tertiary)',
              cursor: 'pointer',
              transition: 'all 120ms ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!settingsOpen) {
                e.currentTarget.style.color = 'var(--text-primary)'
                e.currentTarget.style.background = 'var(--bg-secondary)'
              }
            }}
            onMouseLeave={(e) => {
              if (!settingsOpen) {
                e.currentTarget.style.color = 'var(--text-tertiary)'
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>
    </motion.div>
  )
}
