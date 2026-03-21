import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { useEpub, type FontSize, type Theme, type LayoutMode } from '../hooks/useEpub'
import { useSpeech } from '../hooks/useSpeech'
import { useAnnotations } from '../hooks/useAnnotations'
import Sidebar from './Sidebar'
import AudioBar from './AudioBar'
import ProgressBar from './ProgressBar'
import ThemeToggle from './ThemeToggle'
import Toast, { type ToastMessage } from './Toast'
import SelectionBubble from './SelectionBubble'

interface ReaderProps {
  file: File
  theme: Theme
  fontSize: FontSize
  layoutMode: LayoutMode
  highlightEnabled: boolean
  autoscrollEnabled: boolean
  onThemeToggle: () => void
  onFontSizeChange: (s: FontSize) => void
  onLayoutModeChange: (mode: LayoutMode) => void
  onHighlightChange: (v: boolean) => void
  onAutoscrollChange: (v: boolean) => void
}

const FONT_SIZE_ORDER: FontSize[] = ['sm', 'md', 'lg', 'xl']
const FONT_SIZE_LABELS: Record<FontSize, string> = { sm: 'S', md: 'M', lg: 'L', xl: 'XL' }
const CONTENT_TRANSITION = { duration: 0.2, ease: 'easeOut' as const }

export default function Reader({
  file,
  theme,
  fontSize,
  layoutMode,
  highlightEnabled,
  autoscrollEnabled,
  onThemeToggle,
  onFontSizeChange,
  onLayoutModeChange,
  onHighlightChange,
  onAutoscrollChange,
}: ReaderProps) {
  const epub = useEpub({ fontSize, theme, layoutMode, highlightEnabled, autoscrollEnabled })
  const speech = useSpeech()
  const annotations = useAnnotations(epub.book?.key() ?? null)

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [selection, setSelection] = useState<{
    quote: string
    href: string
    pos: { x: number; y: number }
  } | null>(null)

  // Mutually exclusive: close settings when a selection appears and vice versa
  const openSelection = (s: { quote: string; href: string; pos: { x: number; y: number } }) => {
    setSettingsOpen(false)
    setSelection(s)
  }
  const closeSelection = () => setSelection(null)
  const toggleSettings = () => {
    setSettingsOpen((o) => {
      if (!o) setSelection(null)
      return !o
    })
  }
  const [navigationScope, setNavigationScope] = useState<'page' | 'chapter'>(
    layoutMode === 'scroll' ? 'chapter' : 'page',
  )

  // BUG-17: toast counter in ref, not module scope
  const toastCounterRef = useRef(0)
  const makeToast = useCallback((text: string): ToastMessage => {
    toastCounterRef.current += 1
    return { id: String(toastCounterRef.current), text }
  }, [])

  const addToast = useCallback((text: string) => {
    setToasts((prev) => [...prev, makeToast(text)])
  }, [makeToast])

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

  // One-time hint: tell the user they can select text to annotate
  const hintShownRef = useRef(false)
  useEffect(() => {
    if (!epub.book || hintShownRef.current) return
    hintShownRef.current = true
    const timer = setTimeout(() => {
      addToast('Tip: select any text to add a note')
    }, 1800)
    return () => clearTimeout(timer)
  }, [epub.book, addToast])

  useEffect(() => {
    setNavigationScope(layoutMode === 'scroll' ? 'chapter' : 'page')
  }, [layoutMode])

  const { clearSentenceHighlight } = epub

  // BUG-08: stop TTS when user navigates to a new page
  const handleNextPage = useCallback(() => {
    speech.stop()
    clearSentenceHighlight()
    epub.nextPage()
  }, [speech, clearSentenceHighlight, epub.nextPage])

  const handlePrevPage = useCallback(() => {
    speech.stop()
    clearSentenceHighlight()
    epub.prevPage()
  }, [speech, clearSentenceHighlight, epub.prevPage])

  const handleNextChapter = useCallback(() => {
    speech.stop()
    clearSentenceHighlight()
    epub.nextChapter()
  }, [speech, clearSentenceHighlight, epub.nextChapter])

  const handlePrevChapter = useCallback(() => {
    speech.stop()
    clearSentenceHighlight()
    epub.prevChapter()
  }, [speech, clearSentenceHighlight, epub.prevChapter])

  // TTS reading highlight — glow the paragraph being spoken
  const { highlightSentence } = epub
  useEffect(() => {
    if (speech.isPlaying && !speech.isPaused) {
      const sentence = speech.sentences[speech.currentSentenceIndex]
      if (sentence) highlightSentence(sentence)
    } else {
      clearSentenceHighlight()
    }
  }, [speech.currentSentenceIndex, speech.isPlaying, speech.isPaused, highlightSentence, clearSentenceHighlight])

  // Re-apply annotation underlines whenever the chapter changes
  const { applyAnnotationHighlights, setOnTextSelected, currentHref } = epub
  const { annotationsForHref, addAnnotation, removeAnnotation } = annotations
  useEffect(() => {
    if (currentHref) applyAnnotationHighlights(annotationsForHref(currentHref))
  }, [currentHref, applyAnnotationHighlights, annotationsForHref])

  // Wire selection callback into epub hook
  useEffect(() => {
    setOnTextSelected((quote, href, pos) => openSelection({ quote, href, pos }))
    return () => setOnTextSelected(null)
  }, [setOnTextSelected])

  // Dismiss selection bubble on chapter navigation
  useEffect(() => {
    closeSelection()
  }, [currentHref])

  // BUG-05: destructure stable callbacks/values so the effect only re-runs when they change
  const { goToHref, toc, currentChapterIndex, getCurrentText } = epub

  const handleNextReadingStep = useCallback(() => {
    if (navigationScope === 'chapter') {
      handleNextChapter()
      return
    }

    handleNextPage()
  }, [handleNextChapter, handleNextPage, navigationScope])

  const handlePrevReadingStep = useCallback(() => {
    if (navigationScope === 'chapter') {
      handlePrevChapter()
      return
    }

    handlePrevPage()
  }, [handlePrevChapter, handlePrevPage, navigationScope])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return

      switch (e.key) {
        case 'ArrowRight':
          handleNextReadingStep()
          break
        case ' ':
          e.preventDefault()
          handleNextReadingStep()
          break
        case 'ArrowLeft':
          handlePrevReadingStep()
          break
        case '[': {
          const prevIdx = currentChapterIndex - 1
          if (prevIdx >= 0 && toc[prevIdx]) {
            speech.stop()
            goToHref(toc[prevIdx].href)
          }
          break
        }
        case ']': {
          const nextIdx = currentChapterIndex + 1
          if (toc[nextIdx]) {
            speech.stop()
            goToHref(toc[nextIdx].href)
          }
          break
        }
        case 'p':
        case 'P':
          if (speech.isPlaying && !speech.isPaused) speech.pause()
          else if (speech.isPaused) speech.resume()
          else speech.speak(getCurrentText())
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
  }, [
    // BUG-05: stable references only — effect re-registers only when these actually change
    handleNextReadingStep,
    handlePrevReadingStep,
    goToHref,
    toc,
    currentChapterIndex,
    getCurrentText,
    speech,
    fontSize,
    onThemeToggle,
    onFontSizeChange,
  ])

  const layoutOptions: Array<{ mode: LayoutMode; label: string; short: string }> = [
    { mode: 'scroll', label: 'Scroll layout', short: 'Scroll' },
    { mode: 'spread', label: 'Two page layout', short: '2 Page' },
  ]

  const readingStatus =
    navigationScope === 'chapter'
      ? (epub.totalChapters > 0 ? `Chapter ${epub.currentChapter} of ${epub.totalChapters}` : '')
      : (epub.totalPages > 0 ? `Page ${epub.currentPage} of ${epub.totalPages}` : '')

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
      <motion.header
        initial={{ y: -56, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
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
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-secondary)',
              borderRadius: 999,
              padding: 2,
              border: '1px solid var(--border)',
            }}
          >
            {layoutOptions.map((option) => (
              <button
                key={option.mode}
                onClick={() => onLayoutModeChange(option.mode)}
                aria-label={option.label}
                aria-pressed={layoutMode === option.mode}
                style={{
                  border: 'none',
                  background: layoutMode === option.mode ? 'var(--bg-primary)' : 'transparent',
                  color: layoutMode === option.mode ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: '5px 9px',
                  borderRadius: 999,
                  fontWeight: layoutMode === option.mode ? 600 : 500,
                }}
              >
                {option.short}
              </button>
            ))}
          </div>

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

      {/* Main content area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Sidebar */}
        <Sidebar
          toc={epub.toc}
          isOpen={sidebarOpen}
          currentHref={epub.currentHref}
          onNavigate={epub.goToHref}
          onClose={() => setSidebarOpen(false)}
          annotations={annotations.annotations}
          onDeleteAnnotation={(id) => {
            removeAnnotation(id)
            applyAnnotationHighlights(annotationsForHref(epub.currentHref))
          }}
        />

        {/* epub.js viewer */}
        <motion.div
          ref={epub.viewerRef}
          id="epub-viewer"
          role="document"
          aria-label="Book content"
          animate={{
            opacity: epub.hasRenderedContent ? 1 : 0.35,
            scale: epub.isLoading && epub.hasRenderedContent ? 0.995 : 1,
          }}
          transition={CONTENT_TRANSITION}
          style={{
            position: 'absolute',
            inset: 0,
            overflowY: layoutMode === 'scroll' ? 'auto' : 'hidden',
            overflowX: 'hidden',
          }}
        />

        {/* Selection bubble overlay — position:fixed so it's never clipped by overflow:hidden */}
        <div
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 60,
          }}
        >
          {selection && (
            <SelectionBubble
              quote={selection.quote}
              position={selection.pos}
              onSave={(note) => {
                addAnnotation(selection.href, selection.quote, note)
                closeSelection()
                // Re-apply highlights so the new underline appears immediately
                setTimeout(() => applyAnnotationHighlights(annotationsForHref(selection.href)), 50)
                addToast('Note saved')
              }}
              onDismiss={closeSelection}
            />
          )}
        </div>

        {/* Loading overlay */}
        {epub.isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={CONTENT_TRANSITION}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: epub.hasRenderedContent
                ? 'color-mix(in srgb, var(--bg-primary) 72%, transparent)'
                : 'var(--bg-primary)',
              backdropFilter: epub.hasRenderedContent ? 'blur(2px)' : 'none',
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
                {epub.hasRenderedContent ? 'Loading chapter…' : 'Loading book…'}
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* BUG-01: AudioBar is in normal flex flow — no spacer div needed */}
      <div
        style={{
          minHeight: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          gap: 12,
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={handlePrevReadingStep}
          aria-label={navigationScope === 'chapter' ? 'Previous chapter' : 'Previous page'}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-ui)',
            fontSize: 12,
            cursor: 'pointer',
            padding: '8px 10px',
            borderRadius: 8,
            minWidth: 110,
            textAlign: 'left',
          }}
        >
          {navigationScope === 'chapter' ? 'Previous chapter' : 'Previous page'}
        </button>

        <div
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 12,
            color: 'var(--text-tertiary)',
            textAlign: 'center',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          {layoutMode === 'spread' && (
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-secondary)',
                borderRadius: 999,
                padding: 2,
                border: '1px solid var(--border)',
              }}
            >
              {(['page', 'chapter'] as const).map((scope) => (
                <button
                  key={scope}
                  onClick={() => setNavigationScope(scope)}
                  aria-label={`Navigate by ${scope}`}
                  aria-pressed={navigationScope === scope}
                  style={{
                    border: 'none',
                    background: navigationScope === scope ? 'var(--bg-primary)' : 'transparent',
                    color: navigationScope === scope ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontFamily: 'var(--font-ui)',
                    fontSize: 11,
                    cursor: 'pointer',
                    padding: '5px 10px',
                    borderRadius: 999,
                    fontWeight: navigationScope === scope ? 600 : 500,
                    textTransform: 'capitalize',
                  }}
                >
                  {scope}
                </button>
              ))}
            </div>
          )}
          <span>{readingStatus}</span>
        </div>

        <button
          onClick={handleNextReadingStep}
          aria-label={navigationScope === 'chapter' ? 'Next chapter' : 'Next page'}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-ui)',
            fontSize: 12,
            cursor: 'pointer',
            padding: '8px 10px',
            borderRadius: 8,
            minWidth: 110,
            textAlign: 'right',
          }}
        >
          {navigationScope === 'chapter' ? 'Next chapter' : 'Next page'}
        </button>
      </div>

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
        onPlay={() => {
          const text = getCurrentText()
          if (!text) {
            addToast('No text found — try navigating to a different page')
            return
          }
          speech.speak(text)
        }}
        onPause={speech.pause}
        onResume={speech.resume}
        onStop={speech.stop}
        onSkipForward={speech.skipForward}
        onSkipBack={speech.skipBack}
        highlightEnabled={highlightEnabled}
        onHighlightChange={onHighlightChange}
        autoscrollEnabled={autoscrollEnabled}
        onAutoscrollChange={onAutoscrollChange}
        settingsOpen={settingsOpen}
        onSettingsToggle={toggleSettings}
      />

      {/* Toast notifications */}
      <Toast messages={toasts} onDismiss={dismissToast} />
    </motion.div>
  )
}
