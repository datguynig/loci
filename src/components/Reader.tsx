import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEpub, type FontSize, type Theme } from '../hooks/useEpub'
import { useSpeech } from '../hooks/useSpeech'
import Sidebar from './Sidebar'
import AudioBar from './AudioBar'
import ProgressBar from './ProgressBar'
import ThemeToggle from './ThemeToggle'
import Toast, { type ToastMessage } from './Toast'

interface ReaderProps {
  file: File
  theme: Theme
  fontSize: FontSize
  onThemeToggle: () => void
  onFontSizeChange: (s: FontSize) => void
}

const FONT_SIZE_ORDER: FontSize[] = ['sm', 'md', 'lg', 'xl']
const FONT_SIZE_LABELS: Record<FontSize, string> = { sm: 'S', md: 'M', lg: 'L', xl: 'XL' }

let toastCounter = 0
function makeToast(text: string): ToastMessage {
  return { id: String(++toastCounter), text }
}

export default function Reader({
  file,
  theme,
  fontSize,
  onThemeToggle,
  onFontSizeChange,
}: ReaderProps) {
  const epub = useEpub({ fontSize, theme })
  const speech = useSpeech()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(true)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const headerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const addToast = useCallback((text: string) => {
    setToasts((prev) => [...prev, makeToast(text)])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Load book on mount
  useEffect(() => {
    epub.loadBook(file)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  // Show EPUB errors as toasts
  useEffect(() => {
    if (epub.error) addToast(epub.error)
  }, [epub.error, addToast])

  // Auto-hide header on page navigation (as proxy for scroll in paginated mode)
  useEffect(() => {
    if (!epub.currentLocation) return
    setHeaderVisible(false)
    if (headerTimeoutRef.current) clearTimeout(headerTimeoutRef.current)
    headerTimeoutRef.current = setTimeout(() => setHeaderVisible(true), 2000)
  }, [epub.currentLocation])

  // Always show header when sidebar opens
  useEffect(() => {
    if (sidebarOpen) setHeaderVisible(true)
  }, [sidebarOpen])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return

      switch (e.key) {
        case 'ArrowRight':
          epub.nextPage()
          break
        case ' ':
          e.preventDefault()
          epub.nextPage()
          break
        case 'ArrowLeft':
          epub.prevPage()
          break
        case '[': {
          const prevIdx = epub.currentChapterIndex - 1
          if (prevIdx >= 0 && epub.toc[prevIdx]) {
            epub.goToHref(epub.toc[prevIdx].href)
          }
          break
        }
        case ']': {
          const nextIdx = epub.currentChapterIndex + 1
          if (epub.toc[nextIdx]) {
            epub.goToHref(epub.toc[nextIdx].href)
          }
          break
        }
        case 'p':
        case 'P':
          if (speech.isPlaying && !speech.isPaused) speech.pause()
          else if (speech.isPaused) speech.resume()
          else speech.speak(epub.getCurrentText())
          break
        case 's':
        case 'S':
          speech.stop()
          break
        case 't':
        case 'T':
          setSidebarOpen((o) => !o)
          break
        case 'd':
        case 'D':
          onThemeToggle()
          break
        case '+':
        case '=': {
          const idx = FONT_SIZE_ORDER.indexOf(fontSize)
          if (idx < FONT_SIZE_ORDER.length - 1) onFontSizeChange(FONT_SIZE_ORDER[idx + 1])
          break
        }
        case '-': {
          const idx = FONT_SIZE_ORDER.indexOf(fontSize)
          if (idx > 0) onFontSizeChange(FONT_SIZE_ORDER[idx - 1])
          break
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [epub, speech, fontSize, onThemeToggle, onFontSizeChange])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary)',
        overflow: 'hidden',
      }}
    >
      {/* Top progress bar */}
      <ProgressBar progress={epub.progress} />

      {/* Header */}
      <AnimatePresence>
        {headerVisible && (
          <motion.header
            initial={{ y: -56, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -56, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{
              height: 52,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              flexShrink: 0,
              gap: 8,
            }}
          >
            {/* Left: hamburger + title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
              <button
                onClick={() => setSidebarOpen((o) => !o)}
                aria-label="Toggle table of contents"
                aria-expanded={sidebarOpen}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  color: 'var(--text-secondary)',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <span
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {epub.title || 'Loading…'}
              </span>
            </div>

            {/* Centre: page info */}
            <div
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 12,
                color: 'var(--text-tertiary)',
                flexShrink: 0,
              }}
            >
              {epub.totalPages > 0 && `${epub.currentPage} / ${epub.totalPages}`}
            </div>

            {/* Right: font controls + theme toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                flex: 1,
                justifyContent: 'flex-end',
              }}
            >
              {/* Font size buttons */}
              <div style={{ display: 'flex', gap: 1 }}>
                {FONT_SIZE_ORDER.map((s) => (
                  <button
                    key={s}
                    onClick={() => onFontSizeChange(s)}
                    aria-label={`Font size ${s}`}
                    aria-pressed={fontSize === s}
                    style={{
                      width: 26,
                      height: 26,
                      border: 'none',
                      background: fontSize === s ? 'var(--bg-secondary)' : 'transparent',
                      color: fontSize === s ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      fontFamily: 'var(--font-ui)',
                      fontSize: 11,
                      fontWeight: fontSize === s ? 600 : 400,
                      cursor: 'pointer',
                      borderRadius: 4,
                      transition: 'all 120ms ease',
                    }}
                  >
                    {FONT_SIZE_LABELS[s]}
                  </button>
                ))}
              </div>

              <ThemeToggle theme={theme} onToggle={onThemeToggle} />
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Main content area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Sidebar */}
        <Sidebar
          toc={epub.toc}
          isOpen={sidebarOpen}
          currentChapterIndex={epub.currentChapterIndex}
          onNavigate={epub.goToHref}
          onClose={() => setSidebarOpen(false)}
        />

        {/* epub.js viewer */}
        <div
          ref={epub.viewerRef}
          id="epub-viewer"
          role="document"
          aria-label="Book content"
          style={{
            width: '100%',
            height: '100%',
          }}
        />

        {/* Loading overlay */}
        {epub.isLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-primary)',
              zIndex: 10,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: '2px solid var(--border)',
                  borderTop: '2px solid var(--accent-warm)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <p
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: 13,
                  color: 'var(--text-tertiary)',
                  margin: 0,
                }}
              >
                Loading book…
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Audio bar — always visible at bottom */}
      <div style={{ flexShrink: 0, height: speech.sentences.length > 0 && speech.isPlaying ? 80 : 60 }} />
      <AudioBar
        isPlaying={speech.isPlaying}
        isPaused={speech.isPaused}
        provider={speech.provider}
        sentences={speech.sentences}
        currentSentenceIndex={speech.currentSentenceIndex}
        rate={speech.rate}
        setRate={speech.setRate}
        elevenLabsVoices={speech.elevenLabsVoices}
        selectedVoiceId={speech.selectedVoiceId}
        setVoiceId={speech.setVoiceId}
        selectedModel={speech.selectedModel}
        setModel={speech.setModel}
        browserVoices={speech.browserVoices}
        selectedBrowserVoice={speech.selectedBrowserVoice}
        setBrowserVoice={speech.setBrowserVoice}
        onPlay={() => speech.speak(epub.getCurrentText())}
        onPause={speech.pause}
        onResume={speech.resume}
        onStop={speech.stop}
        onSkipForward={speech.skipForward}
        onSkipBack={speech.skipBack}
        onPrevPage={epub.prevPage}
        onNextPage={epub.nextPage}
      />

      {/* Toast notifications */}
      <Toast messages={toasts} onDismiss={dismissToast} />
    </motion.div>
  )
}
