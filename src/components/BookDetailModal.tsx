import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SupabaseClient } from '@supabase/supabase-js'
import { type Annotation, getAnnotationsFromSupabase } from '../services/annotationService'
import { exportAnnotationsAsMarkdown, exportAnnotationsAsJSON } from '../utils/exportAnnotations'
import { loadProgress } from '../services/progressService'
import { formatDuration } from '../utils/formatDuration'
import { type Flashcard, getFlashcards } from '../services/flashcardService'
import { getScratchpad } from '../services/scratchpadService'
import { getQuizSessions, getBestScore } from '../services/quizService'
import type { QuizSession } from '../services/quizService'
import {
  type Book,
  archiveBook,
  unarchiveBook,
  deleteBook,
  updateBookRating,
  updateBookReview,
} from '../services/bookService'

interface BookDetailModalProps {
  book: Book
  supabase: SupabaseClient
  onClose: () => void
  onRead: () => void
  onArchive: (book: Book) => void
  onUnarchive: (book: Book) => void
  onDelete: (book: Book) => void
  onStudy?: (opts: { panel?: 'scratchpad'; chapterHref?: string }) => void
}

export default function BookDetailModal({
  book,
  supabase,
  onClose,
  onRead,
  onArchive,
  onUnarchive,
  onDelete,
  onStudy,
}: BookDetailModalProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [totalReadingSeconds, setTotalReadingSeconds] = useState<number>(0)
  const [rating, setRating] = useState<number | null>(book.rating)
  const [review, setReview] = useState(book.review ?? '')
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [reviewFocused, setReviewFocused] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [scratchpadPreview, setScratchpadPreview] = useState('')
  const [quizSessions, setQuizSessions] = useState<QuizSession[]>([])
  const reviewRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    getAnnotationsFromSupabase(supabase, book.id)
      .then(setAnnotations)
      .finally(() => setLoadingNotes(false))
    loadProgress(supabase, book.id).then((p) => setTotalReadingSeconds(p?.totalReadingSeconds ?? 0)).catch(console.error)
    getFlashcards(supabase, book.id).then(setFlashcards).catch(console.error)
    getScratchpad(supabase, book.id)
      .then(text => setScratchpadPreview(text.slice(0, 200)))
      .catch(console.error)
    getQuizSessions(supabase, book.id).then(setQuizSessions).catch(console.error)
  }, [supabase, book.id])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleRating = async (value: number) => {
    const next = rating === value ? null : value
    setRating(next)
    await updateBookRating(supabase, book.id, next).catch(console.error)
  }

  const handleReviewBlur = async () => {
    setReviewFocused(false)
    await updateBookReview(supabase, book.id, review).catch(console.error)
  }

  const handleArchive = async () => {
    await archiveBook(supabase, book.id)
    onArchive({ ...book, status: 'archived' })
    onClose()
  }

  const handleUnarchive = async () => {
    await unarchiveBook(supabase, book.id)
    onUnarchive({ ...book, status: 'active' })
    onClose()
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteBook(supabase, book)
      onDelete(book)
      onClose()
    } catch (err) {
      console.error('Delete failed', err)
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handleExportMD = () => exportAnnotationsAsMarkdown(book.title, annotations)
  const handleExportJSON = () => exportAnnotationsAsJSON(book.title, annotations)

  const handleExportFlashcards = () => {
    const lines = flashcards.map(f => `Q: ${f.front}\nA: ${f.back}`).join('\n\n')
    const blob = new Blob([lines], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${book.title}-flashcards.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const groupedFlashcards = useMemo(() => {
    const map = new Map<string, Flashcard[]>()
    for (const f of flashcards) {
      if (!map.has(f.chapterHref)) map.set(f.chapterHref, [])
      map.get(f.chapterHref)!.push(f)
    }
    return [...map.entries()]
  }, [flashcards])

  const displayRating = hoverRating ?? rating

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.38)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 50,
        }}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ type: 'spring', damping: 32, stiffness: 340 }}
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 51,
          padding: '24px 16px',
          pointerEvents: 'none',
        }}
      >
        {/* Close button — outside the modal card, top-right */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 32,
            right: 32,
            background: 'rgba(255,255,255,0.18)',
            border: 'none',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.85)',
            zIndex: 2,
            pointerEvents: 'auto',
            transition: 'background 150ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.28)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 20,
            boxShadow: '0 32px 80px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.06)',
            width: '100%',
            maxWidth: 720,
            maxHeight: 'calc(100vh - 48px)',
            display: 'flex',
            flexDirection: 'row',
            overflow: 'hidden',
            pointerEvents: 'auto',
          }}
        >
          {/* Left: Warm panel with cover + Read CTA */}
          <div style={{
            width: 220,
            flexShrink: 0,
            background: '#F5F2EE',
            borderRight: '1px solid #EAE7E1',
            padding: '36px 24px 28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
          }}>
            {book.coverUrl ? (
              <img
                src={book.coverUrl}
                alt={book.title}
                style={{
                  width: 168,
                  aspectRatio: '2/3',
                  objectFit: 'cover',
                  borderRadius: 10,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.22), 3px 3px 0 rgba(0,0,0,0.06)',
                  display: 'block',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div style={{
                width: 168,
                aspectRatio: '2/3',
                borderRadius: 10,
                background: 'linear-gradient(145deg, #E8E4DC 0%, #D5D0C8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12), 3px 3px 0 rgba(0,0,0,0.04)',
                padding: 16,
                flexShrink: 0,
              }}>
                <span style={{
                  fontFamily: '"Lora", Georgia, serif',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#8A8680',
                  textAlign: 'center',
                  lineHeight: 1.4,
                }}>{book.title}</span>
              </div>
            )}

            <button
              onClick={onRead}
              style={{
                width: 168,
                background: '#1A1917',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 10,
                padding: '11px 0',
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '0.02em',
                flexShrink: 0,
              }}
            >
              Read
            </button>

            {(totalReadingSeconds > 0 || flashcards.length > 0 || annotations.length > 0 || quizSessions.length > 0) && (
              <div style={{
                width: 168,
                background: '#EAE7E1',
                borderRadius: 8,
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}>
                {totalReadingSeconds > 0 && (
                  <StatRow label="Reading time" value={formatDuration(totalReadingSeconds)} warm={false} />
                )}
                {totalReadingSeconds > 0 && (flashcards.length > 0 || annotations.length > 0 || quizSessions.length > 0) && (
                  <div style={{ height: 1, background: '#D8D4CC' }} />
                )}
                {flashcards.length > 0 && (
                  <StatRow label="Flashcards" value={String(flashcards.length)} warm={true} />
                )}
                {(() => {
                  const chapterNoteCount = annotations.filter(a => a.type === 'chapter_note').length
                  return chapterNoteCount > 0 ? (
                    <StatRow label="Chapter notes" value={String(chapterNoteCount)} warm={true} />
                  ) : null
                })()}
                {(() => {
                  const highlightCount = annotations.filter(a => a.type === 'note').length
                  return highlightCount > 0 ? (
                    <StatRow label="Highlights" value={String(highlightCount)} warm={false} />
                  ) : null
                })()}
                {(() => {
                  const best = getBestScore(quizSessions)
                  return best ? (
                    <StatRow label="Best quiz" value={`${best.score} / ${best.total}`} warm={true} />
                  ) : null
                })()}
              </div>
            )}

            {/* Book metadata */}
            {book.addedAt && (
              <p style={{
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 11,
                color: '#B0ADA8',
                margin: 0,
                textAlign: 'center',
                lineHeight: 1.4,
              }}>
                Added {new Date(book.addedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </div>

          {/* Right: Details */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 28px 28px' }}>
            {/* Title + Author */}
            <h2 style={{
              fontFamily: '"Lora", Georgia, serif',
              fontSize: 21,
              fontWeight: 700,
              color: '#1A1917',
              margin: '0 0 5px',
              lineHeight: 1.25,
            }}>{book.title}</h2>
            {book.author && (
              <p style={{
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 14,
                color: '#8A8680',
                margin: '0 0 28px',
                fontWeight: 400,
              }}>{book.author}</p>
            )}

            {/* Star rating */}
            <div style={{ marginBottom: 24 }}>
              <p style={labelStyle}>Your rating</p>
              <div
                style={{ display: 'flex', gap: 8 }}
                onMouseLeave={() => setHoverRating(null)}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: 24,
                      color: displayRating !== null && star <= displayRating ? '#C4A882' : '#D8D4CD',
                      transition: 'color 80ms ease',
                      lineHeight: 1,
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Review note */}
            <div style={{ marginBottom: 28 }}>
              <p style={labelStyle}>Review</p>
              <textarea
                ref={reviewRef}
                value={review}
                onChange={(e) => setReview(e.target.value)}
                onFocus={() => setReviewFocused(true)}
                onBlur={handleReviewBlur}
                placeholder="Add a note about this book…"
                rows={3}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  border: reviewFocused ? '1px solid rgba(196,168,130,0.6)' : '1px solid #E8E5E0',
                  borderRadius: 10,
                  padding: '11px 13px',
                  fontFamily: '"DM Sans", system-ui, sans-serif',
                  fontSize: 13,
                  color: '#1A1917',
                  background: '#FAFAF8',
                  outline: 'none',
                  lineHeight: 1.55,
                  transition: 'border-color 150ms ease',
                }}
              />
            </div>

            {/* Flashcards */}
            {flashcards.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <p style={{ ...labelStyle, margin: 0 }}>Flashcards ({flashcards.length})</p>
                  <button
                    onClick={handleExportFlashcards}
                    style={{
                      background: 'none',
                      border: '1px solid #D8D4CD',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontFamily: '"DM Sans", system-ui, sans-serif',
                      fontSize: 11,
                      color: '#8A8680',
                      cursor: 'pointer',
                    }}
                  >↗ Export</button>
                </div>
                {groupedFlashcards.map(([href, cards]) => (
                  <div key={href} style={{
                    background: '#FAFAF8',
                    borderRadius: 7,
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}>
                    <div>
                      <div style={{
                        fontFamily: '"DM Sans", system-ui, sans-serif',
                        fontSize: 10,
                        color: '#C4A882',
                        fontWeight: 600,
                        marginBottom: 2,
                      }}>
                        {href.replace(/\.xhtml?$/i, '').replace(/[-_]/g, ' ')}
                      </div>
                      <div style={{
                        fontFamily: '"DM Sans", system-ui, sans-serif',
                        fontSize: 9,
                        color: '#8A8780',
                      }}>
                        {cards.length} card{cards.length !== 1 ? 's' : ''}{cards.some(c => c.lastReviewedAt) ? ' · last reviewed ' + new Date(cards.find(c => c.lastReviewedAt)!.lastReviewedAt!).toLocaleDateString() : ' · not yet reviewed'}
                      </div>
                    </div>
                    {onStudy && (
                      <button
                        onClick={() => onStudy({ chapterHref: href })}
                        style={{
                          background: '#1A1917',
                          border: 'none',
                          borderRadius: 5,
                          padding: '4px 10px',
                          fontFamily: '"DM Sans", system-ui, sans-serif',
                          fontSize: 9,
                          color: '#fff',
                          cursor: 'pointer',
                        }}
                      >Review</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Scratchpad preview */}
            {scratchpadPreview && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <p style={{ ...labelStyle, margin: 0 }}>Scratchpad</p>
                </div>
                <div style={{
                  background: '#FEFDF9',
                  border: '1px solid #EAE7E1',
                  borderRadius: 8,
                  padding: '10px 12px',
                }}>
                  <p style={{
                    fontFamily: '"DM Sans", system-ui, sans-serif',
                    fontSize: 11,
                    color: '#6B6560',
                    margin: '0 0 6px',
                    lineHeight: 1.6,
                  }}>
                    {scratchpadPreview}{scratchpadPreview.length >= 200 ? '…' : ''}
                  </p>
                  {onStudy && (
                    <button
                      onClick={() => onStudy({ panel: 'scratchpad' })}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        fontFamily: '"DM Sans", system-ui, sans-serif',
                        fontSize: 10,
                        color: '#C4A882',
                        cursor: 'pointer',
                      }}
                    >Open in reader →</button>
                  )}
                </div>
              </div>
            )}

            {/* Annotations */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ ...labelStyle, margin: 0 }}>
                  Highlights & notes {annotations.length > 0 && `(${annotations.length})`}
                </p>
                {annotations.length > 0 && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={handleExportMD}
                      title="Export as Markdown"
                      style={{
                        background: 'none',
                        border: '1px solid #D8D4CD',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontFamily: '"DM Sans", system-ui, sans-serif',
                        fontSize: 11,
                        color: '#8A8680',
                        cursor: 'pointer',
                      }}
                    >↗ MD</button>
                    <button
                      onClick={handleExportJSON}
                      title="Export as JSON"
                      style={{
                        background: 'none',
                        border: '1px solid #D8D4CD',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontFamily: '"DM Sans", system-ui, sans-serif',
                        fontSize: 11,
                        color: '#8A8680',
                        cursor: 'pointer',
                      }}
                    >↗ JSON</button>
                  </div>
                )}
              </div>

              {loadingNotes ? (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 20 }}>
                  <div style={{
                    width: 18,
                    height: 18,
                    border: '2px solid #E8E5DF',
                    borderTop: '2px solid #C4A882',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                </div>
              ) : annotations.length === 0 ? (
                <p style={{
                  fontFamily: '"DM Sans", system-ui, sans-serif',
                  fontSize: 13,
                  color: '#B0ADA8',
                  margin: 0,
                  lineHeight: 1.5,
                }}>
                  No notes yet. Select text or tap + Note while reading.
                </p>
              ) : (
                <NotesList
                  annotations={annotations}
                  onNavigate={onStudy ? (href) => onStudy({ chapterHref: href }) : undefined}
                />
              )}
            </div>

            {/* Archive + Delete */}
            <div style={{ paddingTop: 4 }}>
              <AnimatePresence mode="wait">
                {confirmDelete ? (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    style={{
                      background: '#FEF2F2',
                      border: '1px solid #FECACA',
                      borderRadius: 10,
                      padding: '14px 16px',
                    }}
                  >
                    <p style={{
                      fontFamily: '"DM Sans", system-ui, sans-serif',
                      fontSize: 13,
                      color: '#7F1D1D',
                      margin: '0 0 12px',
                      lineHeight: 1.5,
                    }}>
                      This will permanently delete the book and all its data. This cannot be undone.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        style={{
                          background: '#DC2626',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: 8,
                          padding: '7px 16px',
                          fontFamily: '"DM Sans", system-ui, sans-serif',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: deleting ? 'not-allowed' : 'pointer',
                          opacity: deleting ? 0.6 : 1,
                        }}
                      >
                        {deleting ? 'Deleting…' : 'Delete permanently'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        style={{
                          background: 'none',
                          border: '1px solid #D8D4CD',
                          borderRadius: 8,
                          padding: '7px 16px',
                          fontFamily: '"DM Sans", system-ui, sans-serif',
                          fontSize: 13,
                          color: '#8A8680',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="actions"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ display: 'flex', gap: 10 }}
                  >
                    {book.status === 'active' ? (
                      <button onClick={handleArchive} style={chipButton('#8A8680', '#F5F3F0', '#D8D4CD')}>
                        Archive
                      </button>
                    ) : (
                      <button onClick={handleUnarchive} style={chipButton('#8A8680', '#F5F3F0', '#D8D4CD')}>
                        Move to library
                      </button>
                    )}
                    <button onClick={() => setConfirmDelete(true)} style={chipButton('#DC2626', '#FFF5F5', '#FECACA')}>
                      Delete
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  )
}

const labelStyle: React.CSSProperties = {
  fontFamily: '"DM Sans", system-ui, sans-serif',
  fontSize: 10,
  fontWeight: 700,
  color: '#B0ADA8',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  margin: '0 0 10px',
}

function chipButton(color: string, bg: string, border: string): React.CSSProperties {
  return {
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 8,
    padding: '7px 16px',
    fontFamily: '"DM Sans", system-ui, sans-serif',
    fontSize: 13,
    fontWeight: 500,
    color,
    cursor: 'pointer',
  }
}

function StatRow({ label, value, warm }: { label: string; value: string; warm: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{
        fontFamily: '"DM Sans", system-ui, sans-serif',
        fontSize: 9,
        color: '#8A8780',
      }}>{label}</span>
      <span style={{
        fontFamily: '"DM Sans", system-ui, sans-serif',
        fontSize: 9,
        fontWeight: 600,
        color: warm ? '#C4A882' : '#3a3733',
      }}>{value}</span>
    </div>
  )
}

function NotesList({
  annotations,
  onNavigate,
}: {
  annotations: Annotation[]
  onNavigate?: (href: string) => void
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const byChapter = new Map<string, Annotation[]>()
  for (const a of annotations) {
    const chapter = a.href.split('#')[0]
    if (!byChapter.has(chapter)) byChapter.set(chapter, [])
    byChapter.get(chapter)!.push(a)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {[...byChapter.entries()].map(([chapter, notes]) => (
        <div key={chapter}>
          <p style={{
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: 10,
            fontWeight: 700,
            color: '#C4A882',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            margin: '0 0 10px',
          }}>
            {chapter.replace(/\.xhtml?$/i, '').replace(/[-_]/g, ' ')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notes.map((note) => (
              <div
                key={note.id}
                onMouseEnter={() => setHoveredId(note.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  background: hoveredId === note.id ? '#F4F2EE' : '#FAFAF8',
                  borderRadius: 8,
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  transition: 'background 120ms ease',
                  position: 'relative',
                }}
              >
                {note.type !== 'chapter_note' && (
                  <p style={{
                    fontFamily: '"Lora", Georgia, serif',
                    fontSize: 13,
                    fontStyle: 'italic',
                    color: '#6B6863',
                    margin: 0,
                    lineHeight: 1.55,
                  }}>"{note.quote}"</p>
                )}
                {note.note && (
                  <p style={{
                    fontFamily: '"DM Sans", system-ui, sans-serif',
                    fontSize: 13,
                    color: '#1A1917',
                    margin: 0,
                    lineHeight: 1.5,
                  }}>{note.note}</p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                  <p style={{
                    fontFamily: '"DM Sans", system-ui, sans-serif',
                    fontSize: 11,
                    color: '#C4A882',
                    margin: 0,
                  }}>{new Date(note.createdAt).toLocaleDateString()}</p>
                  {onNavigate && hoveredId === note.id && (
                    <button
                      onClick={() => onNavigate(note.href)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        fontFamily: '"DM Sans", system-ui, sans-serif',
                        fontSize: 11,
                        color: '#8A7A6A',
                        letterSpacing: '0.02em',
                      }}
                    >
                      Read in context →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
