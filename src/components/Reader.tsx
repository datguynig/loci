import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useUser } from '@clerk/clerk-react'
import { useEpub, type FontSize, type Theme, type LayoutMode } from '../hooks/useEpub'
import { useSpeech } from '../hooks/useSpeech'
import { useAnnotations } from '../hooks/useAnnotations'
import { useBookmarks } from '../hooks/useBookmarks'
import { useReadingProgress } from '../hooks/useReadingProgress'
import { useFlashcards } from '../hooks/useFlashcards'
import { useScratchpad } from '../hooks/useScratchpad'
import {
  saveAnnotationToSupabase,
  deleteAnnotationFromSupabase,
} from '../services/annotationService'
import { exportAnnotationsAsMarkdown, exportAnnotationsAsJSON } from '../utils/exportAnnotations'
import Sidebar from './Sidebar'
import SearchPanel from './SearchPanel'
import AudioBar from './AudioBar'
import BottomSheet from './BottomSheet'
import ProgressBar from './ProgressBar'
import ThemeToggle from './ThemeToggle'
import Toast, { type ToastMessage } from './Toast'
import SelectionBubble from './SelectionBubble'
import StudyPanel from './StudyPanel'
import Scratchpad from './Scratchpad'
import ReaderTour from './ReaderTour'
import { useWindowWidth } from '../hooks/useWindowWidth'
import type { StudyContext } from '../services/aiStudyService'
import type { SubscriptionState } from '../hooks/useSubscription'


interface ReaderProps {
  file: File
  bookId?: string | null
  supabase?: SupabaseClient | null
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
  onClose?: () => void
  studyOptions?: { panel?: 'scratchpad'; chapterHref?: string }
  subscription?: SubscriptionState
  onUpgrade?: () => void
}

const FONT_SIZE_ORDER: FontSize[] = ['sm', 'md', 'lg', 'xl']
const CONTENT_TRANSITION = { duration: 0.2, ease: 'easeOut' as const }

export default function Reader({
  file,
  bookId = null,
  supabase = null,
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
  onClose,
  studyOptions,
  subscription,
  onUpgrade,
}: ReaderProps) {
  const { user } = useUser()
  const userId = user?.id ?? ''
  const windowWidth = useWindowWidth()
  const isMobile = windowWidth < 600
  // Chrome visibility (mobile tap-to-hide)
  const [chromeVisible, setChromeVisible] = useState(true)
  const handleContentClick = useCallback(() => {
    if (isMobile) setChromeVisible((v) => !v)
  }, [isMobile])

  // Deferred — speech not yet initialised; wired below via ref to avoid ordering issue
  const onParagraphClickRef = useRef<((text: string) => void) | undefined>(undefined)
  const handleParagraphClick = useCallback((text: string) => {
    onParagraphClickRef.current?.(text)
  }, [])

  const epub = useEpub({
    fontSize,
    theme,
    layoutMode,
    highlightEnabled,
    autoscrollEnabled,
    onContentClick: handleContentClick,
    onParagraphClick: handleParagraphClick,
  })

  // Cross-chapter TTS: when a chapter ends naturally, advance and resume
  const autoAdvancePendingRef = useRef(false)
  const handleTTSEnded = useCallback(() => {
    autoAdvancePendingRef.current = true
    epub.nextChapter()
  }, [epub.nextChapter])

  // Stable ref so the onWordChange callback passed to useSpeech never becomes stale
  const highlightWordRef = useRef(epub.highlightWord)
  highlightWordRef.current = epub.highlightWord

  const speech = useSpeech({
    onEnded: handleTTSEnded,
    onWordChange: useCallback((idx: number) => highlightWordRef.current(idx), []),
  })

  // Wire paragraph-click → speakFromHint (after speech is available)
  const { speakFromHint } = speech
  useEffect(() => {
    onParagraphClickRef.current = (text: string) => {
      const fullText = epub.getCurrentText()
      if (!fullText) return
      speakFromHint(fullText, text)
    }
  }, [epub.getCurrentText, speakFromHint])

  const annotations = useAnnotations(epub.book?.key() ?? null)
  const bookmarks = useBookmarks(supabase, userId || null, bookId ?? null)
  const flashcards = useFlashcards(supabase as SupabaseClient, userId, bookId ?? '')
  const scratchpad = useScratchpad(supabase as SupabaseClient, userId, bookId ?? '')

  // Mobile overflow sheet (header "..." menu)
  const [overflowOpen, setOverflowOpen] = useState(false)

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [studyPanelOpen, setStudyPanelOpen] = useState(false)
  const [scratchpadOpen, setScratchpadOpen] = useState(false)
  const [chapterNoteOpen, setChapterNoteOpen] = useState(false)
  const [chapterNoteText, setChapterNoteText] = useState('')
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [showTour, setShowTour] = useState(
    () => import.meta.env.VITE_E2E_TEST !== 'true' && localStorage.getItem('loci_reader_tour_seen') !== 'true'
  )
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

  // Panel exclusivity handlers
  const openStudyPanel = () => {
    setStudyPanelOpen(true)
    setScratchpadOpen(false)
    setNotesOpen(false)
  }
  const openScratchpad = () => {
    if (subscription && !subscription.canAccess('scratchpad')) {
      onUpgrade?.()
      return
    }
    setScratchpadOpen(true)
    setStudyPanelOpen(false)
    setNotesOpen(false)
  }

  // Handle studyOptions deep-link on mount
  useEffect(() => {
    if (studyOptions?.chapterHref) {
      setStudyPanelOpen(true)
    } else if (studyOptions?.panel === 'scratchpad') {
      if (!subscription || subscription.canAccess('scratchpad')) {
        setScratchpadOpen(true)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [navigationScope, setNavigationScope] = useState<'page' | 'chapter'>(
    layoutMode === 'scroll' ? 'chapter' : 'page',
  )

  // Reading progress autosave + restore
  useReadingProgress(
    supabase,
    bookId ?? null,
    epub.currentHref,
    epub.progress,
    epub.goToHref,
    studyOptions?.chapterHref,
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

  const handleTourDismiss = useCallback(() => {
    localStorage.setItem('loci_reader_tour_seen', 'true')
    setShowTour(false)
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

  // Auto-show chrome when TTS starts or a panel opens (mobile)
  const anyPanelOpen = notesOpen || studyPanelOpen || scratchpadOpen || searchOpen || sidebarOpen
  useEffect(() => {
    if (speech.isPlaying || anyPanelOpen) setChromeVisible(true)
  }, [speech.isPlaying, anyPanelOpen])

  const { clearSentenceHighlight } = epub
  const { stop: stopSpeech, speak: speakSpeech, pause: pauseSpeech, resume: resumeSpeech,
          isPlaying: speechIsPlaying, isPaused: speechIsPaused,
          sentences: speechSentences, currentSentenceIndex: speechCurrentSentenceIndex,
          skipForward: skipForwardSpeech, skipBack: skipBackSpeech,
          provider: speechProvider } = speech

  const handleNextPage = useCallback(() => {
    stopSpeech()
    clearSentenceHighlight()
    epub.nextPage()
  }, [stopSpeech, clearSentenceHighlight, epub.nextPage])

  const handlePrevPage = useCallback(() => {
    stopSpeech()
    clearSentenceHighlight()
    epub.prevPage()
  }, [stopSpeech, clearSentenceHighlight, epub.prevPage])

  const handleNextChapter = useCallback(() => {
    stopSpeech()
    clearSentenceHighlight()
    epub.nextChapter()
  }, [stopSpeech, clearSentenceHighlight, epub.nextChapter])

  const handlePrevChapter = useCallback(() => {
    stopSpeech()
    clearSentenceHighlight()
    epub.prevChapter()
  }, [stopSpeech, clearSentenceHighlight, epub.prevChapter])

  const handleNavigate = useCallback((href: string) => {
    stopSpeech()
    clearSentenceHighlight()
    epub.goToHref(href)
  }, [stopSpeech, clearSentenceHighlight, epub.goToHref])

  // Cross-chapter TTS auto-advance: speak new chapter once it finishes rendering
  useEffect(() => {
    if (!autoAdvancePendingRef.current || !epub.hasRenderedContent) return
    autoAdvancePendingRef.current = false
    const text = epub.getCurrentText()
    if (text) speakSpeech(text)
  }, [epub.hasRenderedContent, epub.currentHref, epub.getCurrentText, speakSpeech])

  // TTS sentence tracking:
  // - ElevenLabs: find the block element only (no visual mark — word highlight handles it)
  // - Browser TTS: full sentence-level visual highlight
  const { highlightSentence } = epub
  useEffect(() => {
    if (speechIsPlaying && !speechIsPaused) {
      const sentence = speechSentences[speechCurrentSentenceIndex]
      if (sentence) {
        if (speechProvider === 'elevenlabs') {
          epub.findSentenceBlock(sentence)
        } else {
          highlightSentence(sentence)
        }
      }
    } else {
      clearSentenceHighlight()
    }
  }, [speechCurrentSentenceIndex, speechSentences, speechIsPlaying, speechIsPaused,
      speechProvider, epub.findSentenceBlock, highlightSentence, clearSentenceHighlight])

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

  // Human-readable chapter title for UI panels
  const chapterTitle = useMemo(() => {
    const norm = epub.currentHref.split('#')[0]
    const entry = epub.toc.find((item) => {
      const th = item.href.split('#')[0]
      return th === norm || th.endsWith('/' + norm) || norm.endsWith('/' + th)
    })
    return entry?.label?.trim() ?? ''
  }, [epub.currentHref, epub.toc])

  // Bookmark toggle for current chapter
  const isCurrentPageBookmarked = bookmarks.bookmarks.some(
    (b) => b.href.split('#')[0] === epub.currentHref.split('#')[0],
  )

  const handleToggleBookmark = useCallback(() => {
    const norm = epub.currentHref.split('#')[0]
    const existing = bookmarks.bookmarks.find((b) => b.href.split('#')[0] === norm)
    if (existing) {
      bookmarks.removeBookmark(existing.id)
    } else {
      const tocItem = epub.toc.find((item) => {
        const itemNorm = item.href.split('#')[0]
        return itemNorm === norm || itemNorm.endsWith('/' + norm) || norm.endsWith('/' + itemNorm)
      })
      const label = tocItem?.label?.trim() ?? `Chapter ${epub.currentChapter}`
      bookmarks.addBookmark(epub.currentHref, label)
    }
  }, [bookmarks, epub.currentHref, epub.toc, epub.currentChapter])

  const { toc, currentChapterIndex, getCurrentText } = epub

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
            handleNavigate(toc[prevIdx].href)
          }
          break
        }
        case ']': {
          const nextIdx = currentChapterIndex + 1
          if (toc[nextIdx]) {
            handleNavigate(toc[nextIdx].href)
          }
          break
        }
        case 'p':
        case 'P':
          if (speechIsPlaying && !speechIsPaused) pauseSpeech()
          else if (speechIsPaused) resumeSpeech()
          else speakSpeech(getCurrentText())
          break
        case 's':
        case 'S':
          stopSpeech()
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
    handleNextReadingStep,
    handlePrevReadingStep,
    handleNavigate,
    toc,
    currentChapterIndex,
    getCurrentText,
    stopSpeech,
    speakSpeech,
    pauseSpeech,
    resumeSpeech,
    speechIsPlaying,
    speechIsPaused,
    fontSize,
    onThemeToggle,
    onFontSizeChange,
  ])

  const readingStatus =
    navigationScope === 'chapter'
      ? (epub.totalChapters > 0 ? `Chapter ${epub.currentChapter} of ${epub.totalChapters}` : '')
      : (epub.totalPages > 0 ? `Page ${epub.currentPage} of ${epub.totalPages}` : '')

  const studyContext = useMemo<StudyContext>(() => ({
    chapterText: epub.getFullChapterText(),
    chapterNotes: annotations.annotations
      .filter(a => {
        const base = (currentHref ?? '').split('#')[0]
        return a.href.split('#')[0] === base && a.type === 'chapter_note'
      })
      .map(a => a.note ?? ''),
    scratchpad: scratchpad.content,
    annotations: annotations.annotations
      .filter(a => a.type === 'note' && a.note)
      .map(a => ({ quote: a.quote, note: a.note ?? '' })),
    flashcards: flashcards.flashcards.map(f => ({ front: f.front, back: f.back })),
    selectedText: selection?.quote ?? null,
  }), [annotations.annotations, currentHref, scratchpad.content, flashcards.flashcards, selection, epub.getFullChapterText])

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
          // Chrome-hide transition on mobile
          opacity: isMobile && !chromeVisible ? 0 : 1,
          transform: isMobile && !chromeVisible ? 'translateY(-100%)' : 'none',
          transition: 'opacity 200ms ease, transform 200ms ease',
          pointerEvents: isMobile && !chromeVisible ? 'none' : 'auto',
        }}
      >
        {/* Left: back + hamburger + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Back to library"
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
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
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

        {/* Right: action buttons — desktop shows all; mobile shows overflow "…" */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flex: 1,
            justifyContent: 'flex-end',
          }}
        >
          {!isMobile && (
            <>
              {/* Search button */}
              <button
                onClick={() => setSearchOpen((o) => !o)}
                aria-label="Search in book"
                aria-pressed={searchOpen}
                style={{
                  background: searchOpen ? 'rgba(196,168,130,0.15)' : 'transparent',
                  border: searchOpen ? '1px solid rgba(196,168,130,0.4)' : '1px solid transparent',
                  borderRadius: 6,
                  cursor: 'pointer',
                  padding: '5px 7px',
                  color: searchOpen ? '#C4A882' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 150ms ease',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>

              {/* Bookmark button */}
              <button
                onClick={handleToggleBookmark}
                aria-label={isCurrentPageBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
                aria-pressed={isCurrentPageBookmarked}
                style={{
                  background: isCurrentPageBookmarked ? 'rgba(196,168,130,0.15)' : 'transparent',
                  border: isCurrentPageBookmarked ? '1px solid rgba(196,168,130,0.4)' : '1px solid transparent',
                  borderRadius: 6,
                  cursor: 'pointer',
                  padding: '5px 7px',
                  color: isCurrentPageBookmarked ? '#C4A882' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 150ms ease',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={isCurrentPageBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              </button>

              <button
                onClick={() => {
                  const opening = !notesOpen
                  setNotesOpen(opening)
                  if (opening) { setStudyPanelOpen(false); setScratchpadOpen(false) }
                }}
                aria-label="Toggle notes pane"
                aria-pressed={notesOpen}
                style={{
                  background: notesOpen ? 'rgba(196,168,130,0.15)' : 'transparent',
                  border: notesOpen ? '1px solid rgba(196,168,130,0.4)' : '1px solid transparent',
                  borderRadius: 6, cursor: 'pointer', padding: '5px 6px',
                  color: notesOpen ? '#C4A882' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 150ms ease',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>

              <button
                onClick={openScratchpad}
                aria-label="Scratchpad"
                style={{
                  background: scratchpadOpen ? 'rgba(196,168,130,0.15)' : 'transparent',
                  border: scratchpadOpen ? '1px solid rgba(196,168,130,0.4)' : '1px solid transparent',
                  borderRadius: 6, cursor: 'pointer', padding: '5px 7px',
                  color: scratchpadOpen ? '#C4A882' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 150ms ease',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                </svg>
              </button>

              <button
                onClick={openStudyPanel}
                aria-label="Study assistant"
                style={{
                  background: studyPanelOpen ? '#1A1917' : 'transparent',
                  border: studyPanelOpen ? '1px solid #1A1917' : '1px solid transparent',
                  borderRadius: 6, cursor: 'pointer', padding: '5px 7px',
                  color: studyPanelOpen ? 'var(--accent-warm)' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 150ms ease', fontSize: 14, fontWeight: 600,
                }}
              >
                ✦
              </button>

              <ThemeToggle theme={theme} onToggle={onThemeToggle} />
            </>
          )}

          {/* Mobile overflow button */}
          {isMobile && (
            <button
              onClick={() => setOverflowOpen(true)}
              aria-label="More options"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px 8px', borderRadius: 6,
                color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>
          )}
        </div>
      </motion.header>

      {/* Mobile overflow sheet */}
      {isMobile && (
        <BottomSheet open={overflowOpen} onClose={() => setOverflowOpen(false)}>
          {(
            [
              {
                label: 'Search',
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
                active: searchOpen,
                onPress: () => { setSearchOpen((o) => !o); setOverflowOpen(false) },
              },
              {
                label: isCurrentPageBookmarked ? 'Remove bookmark' : 'Bookmark',
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill={isCurrentPageBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
                active: isCurrentPageBookmarked,
                onPress: () => { handleToggleBookmark(); setOverflowOpen(false) },
              },
              {
                label: 'Notes',
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
                active: notesOpen,
                onPress: () => { const o = !notesOpen; setNotesOpen(o); if (o) { setStudyPanelOpen(false); setScratchpadOpen(false) } setOverflowOpen(false) },
              },
              {
                label: 'Scratchpad',
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
                active: scratchpadOpen,
                onPress: () => { openScratchpad(); setOverflowOpen(false) },
              },
              {
                label: 'Study',
                icon: <span style={{ fontSize: 18, lineHeight: 1 }}>✦</span>,
                active: studyPanelOpen,
                onPress: () => { openStudyPanel(); setOverflowOpen(false) },
              },
            ] as { label: string; icon: React.ReactNode; active: boolean; onPress: () => void }[]
          ).map(({ label, icon, active, onPress }) => (
            <button
              key={label}
              onClick={onPress}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                width: '100%', background: 'none',
                border: 'none', cursor: 'pointer',
                padding: '14px 20px',
                fontFamily: 'var(--font-ui)', fontSize: 16,
                color: active ? 'var(--accent-warm)' : 'var(--text-primary)',
                textAlign: 'left',
              }}
            >
              <span style={{ color: active ? 'var(--accent-warm)' : 'var(--text-secondary)', flexShrink: 0 }}>{icon}</span>
              {label}
            </button>
          ))}
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 20px' }} />
          <button
            onClick={() => { onThemeToggle(); setOverflowOpen(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              width: '100%', background: 'none',
              border: 'none', cursor: 'pointer',
              padding: '14px 20px',
              fontFamily: 'var(--font-ui)', fontSize: 16,
              color: 'var(--text-primary)', textAlign: 'left',
            }}
          >
            <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
              {theme === 'dark'
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              }
            </span>
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </BottomSheet>
      )}

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Sidebar */}
        <Sidebar
          toc={epub.toc}
          isOpen={sidebarOpen}
          currentHref={epub.currentHref}
          onNavigate={handleNavigate}
          onClose={() => setSidebarOpen(false)}
          annotations={annotations.annotations}
          onDeleteAnnotation={(id) => {
            removeAnnotation(id)
            applyAnnotationHighlights(annotationsForHref(epub.currentHref))
            if (supabase) deleteAnnotationFromSupabase(supabase, id).catch(console.error)
          }}
          bookmarks={bookmarks.bookmarks}
          onDeleteBookmark={bookmarks.removeBookmark}
        />

        {/* Search panel — overlays the epub viewer from the top */}
        <AnimatePresence>
          {searchOpen && (
            <SearchPanel
              onSearch={epub.searchBook}
              onNavigate={handleNavigate}
              onClose={() => setSearchOpen(false)}
              toc={epub.toc}
            />
          )}
        </AnimatePresence>

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
                const saved = addAnnotation(selection.href, selection.quote, note)
                closeSelection()
                // Re-apply highlights so the new underline appears immediately
                setTimeout(() => applyAnnotationHighlights(annotationsForHref(selection.href)), 50)
                addToast('Note saved')
                // Sync to Supabase in background
                if (supabase && bookId && user) {
                  saveAnnotationToSupabase(supabase, user.id, bookId, saved).catch(console.error)
                }
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

        {/* Inline notes pane */}
        <AnimatePresence>
          {notesOpen && (
            <motion.div
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: 320,
                background: 'var(--bg-surface)',
                borderLeft: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 20,
              }}
            >
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                fontFamily: 'var(--font-ui)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
              }}>
                <span>Notes ({annotations.annotations.length})</span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {annotations.annotations.length > 0 && (
                    <>
                      <button
                        onClick={() => exportAnnotationsAsMarkdown(epub.title ?? 'Notes', annotations.annotations)}
                        title="Export as Markdown"
                        style={{
                          background: 'none',
                          border: '1px solid var(--border)',
                          borderRadius: 5,
                          padding: '3px 8px',
                          fontFamily: 'var(--font-ui)',
                          fontSize: 11,
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                      >↗ MD</button>
                      <button
                        onClick={() => exportAnnotationsAsJSON(epub.title ?? 'Notes', annotations.annotations)}
                        title="Export as JSON"
                        style={{
                          background: 'none',
                          border: '1px solid var(--border)',
                          borderRadius: 5,
                          padding: '3px 8px',
                          fontFamily: 'var(--font-ui)',
                          fontSize: 11,
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                      >↗ JSON</button>
                    </>
                  )}
                  <button
                    onClick={() => setNotesOpen(false)}
                    aria-label="Close notes"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '4px 6px',
                      borderRadius: 4,
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                      fontSize: 16,
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >✕</button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                {annotations.annotations.length === 0 ? (
                  <p style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: 13,
                    color: 'var(--text-tertiary)',
                    textAlign: 'center',
                    marginTop: 40,
                    lineHeight: 1.5,
                  }}>
                    No notes yet.<br />Select text to add one.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {annotations.annotations.map((a) => (
                      <div
                        key={a.id}
                        style={{
                          borderLeft: `2px solid ${a.href === epub.currentHref ? '#C4A882' : 'var(--border)'}`,
                          background: a.href === epub.currentHref ? 'rgba(196,168,130,0.06)' : 'transparent',
                          paddingLeft: 10,
                          paddingTop: 4,
                          paddingBottom: 4,
                          borderRadius: '0 4px 4px 0',
                          transition: 'all 200ms ease',
                        }}
                      >
                        <p style={{
                          fontFamily: 'var(--font-serif)',
                          fontSize: 12,
                          fontStyle: 'italic',
                          color: 'var(--text-secondary)',
                          margin: '0 0 4px',
                          lineHeight: 1.5,
                        }}>"{a.quote}"</p>
                        {a.note && (
                          <p style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: 12,
                            color: 'var(--text-primary)',
                            margin: '0 0 4px',
                            lineHeight: 1.4,
                          }}>{a.note}</p>
                        )}
                        <p style={{
                          fontFamily: 'var(--font-ui)',
                          fontSize: 11,
                          color: 'var(--text-tertiary)',
                          margin: 0,
                        }}>{new Date(a.createdAt).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* StudyPanel */}
        <AnimatePresence>
          {studyPanelOpen && supabase && userId && (
            <StudyPanel
              isOpen={studyPanelOpen}
              onClose={() => setStudyPanelOpen(false)}
              userId={userId}
              bookId={bookId ?? ''}
              context={studyContext}
              supabase={supabase}
              chapterHref={currentHref ?? ''}
              chapterTitle={chapterTitle}
              onFlashcardsGenerated={(cards, href) => flashcards.addFlashcards(href, cards)}
              reviewMode={studyOptions?.chapterHref ? { chapterHref: studyOptions.chapterHref } : undefined}
              reviewFlashcards={
                studyOptions?.chapterHref
                  ? flashcards.flashcards.filter(f => f.chapterHref === studyOptions.chapterHref)
                  : undefined
              }
              onMarkReviewed={flashcards.markReviewed}
              subscription={subscription}
              onUpgrade={onUpgrade}
            />
          )}
        </AnimatePresence>

        {/* Scratchpad */}
        <AnimatePresence>
          {scratchpadOpen && (
            <Scratchpad
              isOpen={scratchpadOpen}
              onClose={() => setScratchpadOpen(false)}
              content={scratchpad.content}
              onChange={scratchpad.setContent}
              saving={scratchpad.saving}
            />
          )}
        </AnimatePresence>

        {/* Chapter note floating action button */}
        <button
          onClick={() => setChapterNoteOpen(true)}
          aria-label="Add chapter note"
          style={{
            position: 'absolute',
            bottom: 60,
            right: 16,
            zIndex: 10,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '6px 14px',
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: 12,
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            boxShadow: '0 2px 8px var(--shadow)',
          }}
        >
          + Note
        </button>

        {/* Chapter note inline editor */}
        {chapterNoteOpen && (
          <div style={{
            position: 'absolute',
            bottom: 100,
            right: 16,
            zIndex: 20,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 12,
            width: 260,
            boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          }}>
            <textarea
              autoFocus
              value={chapterNoteText}
              onChange={e => setChapterNoteText(e.target.value)}
              placeholder="Add a note for this chapter…"
              rows={4}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '8px 10px',
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 13,
                color: 'var(--text-primary)',
                background: 'var(--bg-secondary)',
                outline: 'none',
                resize: 'none',
                lineHeight: 1.55,
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setChapterNoteOpen(false); setChapterNoteText('') }}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}
              >Cancel</button>
              <button
                onClick={() => {
                  if (chapterNoteText.trim()) {
                    const saved = addAnnotation(currentHref ?? '', '', chapterNoteText.trim(), 'chapter_note')
                    if (supabase && bookId && user) {
                      saveAnnotationToSupabase(supabase, user.id, bookId, saved).catch(console.error)
                    }
                  }
                  setChapterNoteOpen(false)
                  setChapterNoteText('')
                }}
                style={{ background: '#1A1917', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: '#fff', fontWeight: 600 }}
              >Save</button>
            </div>
          </div>
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
          paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
          // Chrome-hide transition on mobile
          opacity: isMobile && !chromeVisible ? 0 : 1,
          transform: isMobile && !chromeVisible ? 'translateY(100%)' : 'none',
          transition: 'opacity 200ms ease, transform 200ms ease',
          pointerEvents: isMobile && !chromeVisible ? 'none' : 'auto',
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

      <div style={{
        opacity: isMobile && !chromeVisible ? 0 : 1,
        transform: isMobile && !chromeVisible ? 'translateY(100%)' : 'none',
        transition: 'opacity 200ms ease, transform 200ms ease',
        pointerEvents: isMobile && !chromeVisible ? 'none' : 'auto',
        flexShrink: 0,
      }}>
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
          speakSpeech(text)
        }}
        onPause={pauseSpeech}
        onResume={resumeSpeech}
        onStop={stopSpeech}
        onSkipForward={skipForwardSpeech}
        onSkipBack={skipBackSpeech}
        fontSize={fontSize}
        onFontSizeChange={onFontSizeChange}
        layoutMode={layoutMode}
        onLayoutModeChange={onLayoutModeChange}
        highlightEnabled={highlightEnabled}
        onHighlightChange={onHighlightChange}
        autoscrollEnabled={autoscrollEnabled}
        onAutoscrollChange={onAutoscrollChange}
        settingsOpen={settingsOpen}
        onSettingsToggle={toggleSettings}
        subscription={subscription}
        onUpgrade={onUpgrade}
      />
      </div>

      {/* Toast notifications */}
      <Toast messages={toasts} onDismiss={dismissToast} />

      {showTour && <ReaderTour onDismiss={handleTourDismiss} />}
    </motion.div>
  )
}
