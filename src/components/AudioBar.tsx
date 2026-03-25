import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import BottomSheet from './BottomSheet'
import type { TTSProvider, ElevenLabsModel } from '../services/ttsService'
import type { ElevenLabsVoice } from '../services/ttsService'
import type { FontSize, LayoutMode } from '../hooks/useEpub'
import type { SubscriptionState } from '../hooks/useSubscription'
import VoicePicker from './VoicePicker'
import ReaderSettings from './ReaderSettings'
import { useWindowWidth } from '../hooks/useWindowWidth'

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
  fontSize: FontSize
  onFontSizeChange: (s: FontSize) => void
  layoutMode: LayoutMode
  onLayoutModeChange: (m: LayoutMode) => void
  highlightEnabled: boolean
  onHighlightChange: (v: boolean) => void
  autoscrollEnabled: boolean
  onAutoscrollChange: (v: boolean) => void
  settingsOpen: boolean
  onSettingsToggle: () => void
  subscription?: SubscriptionState
  onUpgrade?: () => void
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
  fontSize,
  onFontSizeChange,
  layoutMode,
  onLayoutModeChange,
  highlightEnabled,
  onHighlightChange,
  autoscrollEnabled,
  onAutoscrollChange,
  settingsOpen,
  onSettingsToggle,
  subscription,
  onUpgrade,
}: AudioBarProps) {
  const gearRef = useRef<HTMLButtonElement>(null)
  const isMobile = useWindowWidth() < 600
  const [ttsSheetOpen, setTtsSheetOpen] = useState(false)
  const currentSentence = sentences[currentSentenceIndex] ?? ''
  // When subscription is not provided (E2E / standalone mode), default to allowing narration
  const canNarrate = subscription?.canAccess('loci-narration') ?? true

  const handlePlayPause = () => {
    if (!canNarrate) {
      onUpgrade?.()
      return
    }
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
        position: 'relative',
        zIndex: 30,
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
            background: 'var(--accent-warm-highlight)',
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
          justifyContent: isMobile ? 'space-between' : 'space-between',
          padding: isMobile ? '0 8px' : '0 16px',
          gap: 8,
          paddingBottom: isMobile ? 'max(0px, env(safe-area-inset-bottom))' : undefined,
        }}
      >
        {/* Transport controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0 : 4, flex: isMobile ? 1 : undefined, justifyContent: isMobile ? 'space-evenly' : undefined }}>
          <ControlButton onClick={onSkipBack} label="Skip back" size={isMobile ? 'lg' : 'md'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
            </svg>
          </ControlButton>

          <ControlButton onClick={handlePlayPause} label={isPlaying && !isPaused ? 'Pause' : 'Play'} size="lg" active={isPlaying && !isPaused}>
            {isPlaying && !isPaused ? <PauseIcon /> : <PlayIcon />}
          </ControlButton>

          <ControlButton onClick={onSkipForward} label="Skip forward" size={isMobile ? 'lg' : 'md'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-.49-4.5" />
            </svg>
          </ControlButton>

          {!isMobile && isPlaying && (
            <ControlButton onClick={onStop} label="Stop">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
            </ControlButton>
          )}
        </div>

        {/* Right side: desktop shows full controls; mobile shows "…" */}
        {!isMobile && (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ReaderSettings
              isOpen={settingsOpen}
              onClose={onSettingsToggle}
              fontSize={fontSize}
              onFontSizeChange={onFontSizeChange}
              layoutMode={layoutMode}
              onLayoutModeChange={onLayoutModeChange}
              highlightEnabled={highlightEnabled}
              onHighlightChange={onHighlightChange}
              autoscrollEnabled={autoscrollEnabled}
              onAutoscrollChange={onAutoscrollChange}
              anchorRef={gearRef}
            />
            {provider === 'elevenlabs' && isPlaying && !isPaused && <Waveform />}

            {canNarrate && provider === 'elevenlabs' && (
              <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: 20, padding: 2, border: '1px solid var(--border)' }}>
                {(['eleven_turbo_v2_5', 'eleven_multilingual_v2'] as ElevenLabsModel[]).map((m) => (
                  <button key={m} onClick={() => setModel(m)} style={{ padding: '2px 8px', borderRadius: 16, border: 'none', background: selectedModel === m ? 'var(--accent-warm)' : 'transparent', color: selectedModel === m ? '#fff' : 'var(--text-tertiary)', fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 500, cursor: 'pointer', transition: 'all 120ms ease', whiteSpace: 'nowrap' }}>
                    {m === 'eleven_turbo_v2_5' ? 'Turbo' : 'Quality'}
                  </button>
                ))}
              </div>
            )}

            <select value={rate} onChange={(e) => setRate(Number(e.target.value))} aria-label="Playback speed" style={selectStyle}>
              {SPEED_OPTIONS.map((s) => <option key={s} value={s}>{s}×</option>)}
            </select>

            {canNarrate && provider === 'elevenlabs' && elevenLabsVoices.length > 0 ? (
              <VoicePicker voices={elevenLabsVoices} selectedVoiceId={selectedVoiceId} onSelect={setVoiceId} />
            ) : provider === 'browser' && browserVoices.length > 0 ? (
              <select value={selectedBrowserVoice?.name ?? ''} onChange={(e) => { const v = browserVoices.find((bv) => bv.name === e.target.value); if (v) setBrowserVoice(v) }} aria-label="Select voice" style={{ ...selectStyle, maxWidth: 120 }}>
                {browserVoices.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
              </select>
            ) : !canNarrate && (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-tertiary)' }}>Browser voice</span>
            )}

            <button
              ref={gearRef}
              onClick={onSettingsToggle}
              aria-label="Reader settings"
              aria-expanded={settingsOpen}
              style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: 'none', background: settingsOpen ? 'var(--bg-secondary)' : 'transparent', color: settingsOpen ? 'var(--text-primary)' : 'var(--text-tertiary)', cursor: 'pointer', transition: 'all 120ms ease', flexShrink: 0 }}
              onMouseEnter={(e) => { if (!settingsOpen) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-secondary)' } }}
              onMouseLeave={(e) => { if (!settingsOpen) { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent' } }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        )}

        {/* Mobile: "…" opens TTS settings sheet */}
        {isMobile && (
          <button
            onClick={() => setTtsSheetOpen(true)}
            aria-label="Narration settings"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px', borderRadius: 8, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>
        )}
      </div>

      {/* Mobile TTS settings sheet */}
      {isMobile && (
        <BottomSheet open={ttsSheetOpen} onClose={() => setTtsSheetOpen(false)} title="Narration">
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Speed */}
          <div style={{ padding: '12px 20px 4px' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>Speed</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SPEED_OPTIONS.map((s) => (
                <button key={s} onClick={() => setRate(s)} style={{ flex: '1 1 auto', padding: '10px 8px', borderRadius: 8, border: '1px solid var(--border)', background: rate === s ? 'var(--accent-warm)' : 'var(--bg-secondary)', color: rate === s ? '#fff' : 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                  {s}×
                </button>
              ))}
            </div>
          </div>

          {/* Voice — ElevenLabs: compact 2-column grid */}
          {canNarrate && provider === 'elevenlabs' && elevenLabsVoices.length > 0 && (
            <div style={{ padding: '16px 20px 4px' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>Voice</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {elevenLabsVoices.map((v) => {
                  const isSelected = selectedVoiceId === v.voice_id
                  // Strip " – descriptor" suffix for compact display
                  const shortName = v.name.split(' – ')[0].split(' - ')[0]
                  return (
                    <button
                      key={v.voice_id}
                      onClick={() => setVoiceId(v.voice_id)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: `1px solid ${isSelected ? 'rgba(196,168,130,0.5)' : 'var(--border)'}`,
                        background: isSelected ? 'rgba(196,168,130,0.12)' : 'transparent',
                        color: isSelected ? 'var(--accent-warm)' : 'var(--text-primary)',
                        fontFamily: 'var(--font-ui)',
                        fontSize: 13,
                        fontWeight: isSelected ? 600 : 400,
                        cursor: 'pointer',
                        textAlign: 'left',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {shortName}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Voice — browser */}
          {provider === 'browser' && browserVoices.length > 0 && (
            <div style={{ padding: '16px 20px 4px' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>Voice</div>
              <select value={selectedBrowserVoice?.name ?? ''} onChange={(e) => { const v = browserVoices.find((bv) => bv.name === e.target.value); if (v) setBrowserVoice(v) }} aria-label="Select voice" style={{ ...selectStyle, width: '100%', fontSize: 15, padding: '10px 12px' }}>
                {browserVoices.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
              </select>
            </div>
          )}

          {/* ElevenLabs model */}
          {canNarrate && provider === 'elevenlabs' && (
            <div style={{ padding: '16px 20px 4px' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>Quality</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['eleven_turbo_v2_5', 'eleven_multilingual_v2'] as ElevenLabsModel[]).map((m) => (
                  <button key={m} onClick={() => setModel(m)} style={{ flex: 1, padding: '10px 8px', borderRadius: 8, border: '1px solid var(--border)', background: selectedModel === m ? 'var(--accent-warm)' : 'var(--bg-secondary)', color: selectedModel === m ? '#fff' : 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                    {m === 'eleven_turbo_v2_5' ? 'Turbo' : 'Quality'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stop (if playing) */}
          {isPlaying && (
            <div style={{ padding: '16px 20px 4px' }}>
              <button onClick={() => { onStop(); setTtsSheetOpen(false) }} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', fontSize: 15, cursor: 'pointer' }}>
                Stop narration
              </button>
            </div>
          )}

          {/* Display settings */}
          <div style={{ padding: '16px 20px 0' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>Display</div>
            <div style={{ position: 'relative' }}>
              <ReaderSettings
                isOpen={settingsOpen}
                onClose={onSettingsToggle}
                fontSize={fontSize}
                onFontSizeChange={onFontSizeChange}
                layoutMode={layoutMode}
                onLayoutModeChange={onLayoutModeChange}
                highlightEnabled={highlightEnabled}
                onHighlightChange={onHighlightChange}
                autoscrollEnabled={autoscrollEnabled}
                onAutoscrollChange={onAutoscrollChange}
                anchorRef={gearRef}
              />
              <button
                ref={gearRef}
                onClick={onSettingsToggle}
                aria-label="Reader settings"
                aria-expanded={settingsOpen}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontSize: 15, cursor: 'pointer', textAlign: 'left' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--text-secondary)' }}>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Font, layout & highlights
              </button>
            </div>
          </div>
          </div>
        </BottomSheet>
      )}
    </motion.div>
  )
}
