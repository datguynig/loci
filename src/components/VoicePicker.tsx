import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ElevenLabsVoice } from '../services/ttsService'

interface VoicePickerProps {
  voices: ElevenLabsVoice[]
  selectedVoiceId: string
  onSelect: (voiceId: string) => void
}

function groupByCategory(voices: ElevenLabsVoice[]): Map<string, ElevenLabsVoice[]> {
  const map = new Map<string, ElevenLabsVoice[]>()
  for (const voice of voices) {
    const key = voice.category ?? 'other'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(voice)
  }
  // Promote 'premade' to top
  if (map.has('premade')) {
    const premade = map.get('premade')!
    map.delete('premade')
    return new Map([['premade', premade], ...map])
  }
  return map
}

function PlayIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function StopSquareIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  )
}

export default function VoicePicker({ voices, selectedVoiceId, onSelect }: VoicePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedVoice = voices.find((v) => v.voice_id === selectedVoiceId)
  const displayName = selectedVoice?.name ?? 'Voice'
  const truncated = displayName.length > 14 ? displayName.slice(0, 13) + '…' : displayName

  const stopPreview = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current.src = ''
      previewAudioRef.current = null
    }
    setPreviewingId(null)
  }, [])

  const togglePreview = useCallback(
    (voice: ElevenLabsVoice, e: React.MouseEvent) => {
      e.stopPropagation()
      if (!voice.preview_url) return

      if (previewingId === voice.voice_id) {
        stopPreview()
        return
      }

      stopPreview()
      const audio = new Audio(voice.preview_url)
      audio.onended = () => {
        setPreviewingId(null)
        previewAudioRef.current = null
      }
      audio.play().catch(() => setPreviewingId(null))
      previewAudioRef.current = audio
      setPreviewingId(voice.voice_id)
    },
    [previewingId, stopPreview],
  )

  const handleSelect = useCallback(
    (voiceId: string) => {
      stopPreview()
      onSelect(voiceId)
      setIsOpen(false)
    },
    [onSelect, stopPreview],
  )

  // Click-outside to close
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        stopPreview()
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, stopPreview])

  // Stop preview when picker closes
  useEffect(() => {
    if (!isOpen) stopPreview()
  }, [isOpen, stopPreview])

  const grouped = groupByCategory(voices)

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Select voice"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: isOpen ? 'var(--accent-warm)' : 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          color: isOpen ? '#fff' : 'var(--text-secondary)',
          fontFamily: 'var(--font-ui)',
          fontSize: 11,
          padding: '2px 6px 2px 8px',
          cursor: 'pointer',
          transition: 'all 120ms ease',
          whiteSpace: 'nowrap',
        }}
      >
        {truncated}
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Popover panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              right: 0,
              width: 240,
              maxHeight: 260,
              overflowY: 'auto',
              background: 'rgba(var(--bg-surface-rgb), 0.97)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              zIndex: 50,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              padding: '6px 0',
            }}
          >
            {Array.from(grouped.entries()).map(([category, categoryVoices]) => (
              <div key={category}>
                <div
                  style={{
                    padding: '4px 12px 2px',
                    fontFamily: 'var(--font-ui)',
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  {category}
                </div>
                {categoryVoices.map((voice) => {
                  const isSelected = voice.voice_id === selectedVoiceId
                  const isPreviewing = previewingId === voice.voice_id
                  const genderLabel = voice.labels?.gender
                  const accentLabel = voice.labels?.accent

                  return (
                    <div
                      key={voice.voice_id}
                      onClick={() => handleSelect(voice.voice_id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 12px',
                        cursor: 'pointer',
                        background: isSelected ? 'var(--accent-warm)' : 'transparent',
                        transition: 'background 100ms ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary)'
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      {/* Name */}
                      <span
                        style={{
                          fontFamily: 'var(--font-ui)',
                          fontSize: 12,
                          fontWeight: 500,
                          color: isSelected ? '#fff' : 'var(--text-primary)',
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {voice.name}
                      </span>

                      {/* Label pills */}
                      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                        {[genderLabel, accentLabel]
                          .filter(Boolean)
                          .map((label) => (
                            <span
                              key={label}
                              style={{
                                fontFamily: 'var(--font-ui)',
                                fontSize: 9,
                                padding: '1px 4px',
                                borderRadius: 99,
                                background: isSelected
                                  ? 'rgba(255,255,255,0.25)'
                                  : 'var(--bg-secondary)',
                                color: isSelected ? '#fff' : 'var(--text-tertiary)',
                              }}
                            >
                              {label}
                            </span>
                          ))}
                      </div>

                      {/* Preview button */}
                      {voice.preview_url && (
                        <button
                          onClick={(e) => togglePreview(voice, e)}
                          aria-label={isPreviewing ? 'Stop preview' : 'Preview voice'}
                          style={{
                            flexShrink: 0,
                            width: 20,
                            height: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            border: 'none',
                            background: isPreviewing
                              ? isSelected ? 'rgba(255,255,255,0.3)' : 'var(--accent-warm)'
                              : isSelected ? 'rgba(255,255,255,0.2)' : 'var(--bg-secondary)',
                            color: isPreviewing || isSelected ? '#fff' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 120ms ease',
                          }}
                        >
                          {isPreviewing ? <StopSquareIcon /> : <PlayIcon />}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
