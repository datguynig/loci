import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SupabaseClient } from '@supabase/supabase-js'
import { UserButton } from '@clerk/clerk-react'
import { useLibrary } from '../hooks/useLibrary'
import { getBookFile, markLastRead, type Book } from '../services/bookService'
import { loadProgress } from '../services/progressService'
import { formatDuration } from '../utils/formatDuration'
import BookDetailModal from './BookDetailModal'
import ThemeToggle from './ThemeToggle'

interface LibraryProps {
  supabase: SupabaseClient
  onOpenBook: (file: File, bookId?: string, studyOptions?: { panel?: 'scratchpad'; chapterHref?: string }) => void
  theme: 'light' | 'dark'
  onThemeToggle: () => void
}

export default function Library({ supabase, onOpenBook, theme, onThemeToggle }: LibraryProps) {
  const { books, loading, uploadState, uploadError, upload, refresh } = useLibrary(supabase)
  const [detailBook, setDetailBook] = useState<Book | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [archivedOpen, setArchivedOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isUploading = uploadState === 'uploading'

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return
      const file = files[0]
      if (!file.name.toLowerCase().endsWith('.epub')) return
      const book = await upload(file)
      if (book) onOpenBook(file, book.id)
    },
    [upload, onOpenBook],
  )

  const handleOpenBook = useCallback(
    async (book: Book) => {
      setOpeningId(book.id)
      setDetailBook(null)
      try {
        const file = await getBookFile(supabase, book)
        await markLastRead(supabase, book.id)
        onOpenBook(file, book.id)
      } catch (err) {
        console.error('Failed to open book', err)
        setOpeningId(null)
      }
    },
    [supabase, onOpenBook],
  )

  const handleStudyBook = useCallback(
    async (book: Book, opts: { panel?: 'scratchpad'; chapterHref?: string }) => {
      setOpeningId(book.id)
      setDetailBook(null)
      try {
        const file = await getBookFile(supabase, book)
        await markLastRead(supabase, book.id)
        onOpenBook(file, book.id, opts)
      } catch (err) {
        console.error('Failed to open book for study', err)
        setOpeningId(null)
      }
    },
    [supabase, onOpenBook],
  )

  const dragProps = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) },
    onDragLeave: () => setIsDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      handleFiles(e.dataTransfer.files)
    },
  }

  const activeBooks = books.filter((b) => b.status === 'active')
  const archivedBooks = books.filter((b) => b.status === 'archived')
  const continueBook = activeBooks.find((b) => b.lastReadAt) ?? null

  const [continueBookSeconds, setContinueBookSeconds] = useState<number>(0)
  useEffect(() => {
    if (!continueBook?.id) {
      setContinueBookSeconds(0)
      return
    }
    loadProgress(supabase, continueBook.id).then((data) => {
      setContinueBookSeconds(data?.totalReadingSeconds ?? 0)
    }).catch(() => setContinueBookSeconds(0))
  }, [continueBook?.id, supabase])

  const handleArchive = (updated: Book) => {
    refresh()
    if (detailBook?.id === updated.id) setDetailBook(null)
  }

  const handleUnarchive = () => refresh()

  const handleDelete = () => {
    refresh()
    setDetailBook(null)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Nav */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        height: 60,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <span style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 20,
          fontWeight: 700,
          color: '#1A1917',
          letterSpacing: '-0.3px',
        }}>Loci</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              background: isUploading ? 'rgba(26,25,23,0.04)' : 'transparent',
              color: '#1A1917',
              border: '1.5px solid rgba(26,25,23,0.22)',
              borderRadius: 8,
              padding: '7px 14px',
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              opacity: isUploading ? 0.5 : 1,
              transition: 'background 140ms ease, border-color 140ms ease, opacity 140ms ease',
            }}
            onMouseEnter={(e) => {
              if (!isUploading) {
                e.currentTarget.style.background = 'rgba(26,25,23,0.05)'
                e.currentTarget.style.borderColor = 'rgba(26,25,23,0.4)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'rgba(26,25,23,0.22)'
            }}
          >
            {isUploading ? (
              'Uploading…'
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add book
              </>
            )}
          </button>
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
          <UserButton />
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".epub"
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px' }}>
        {uploadError && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 20,
            fontFamily: '"DM Sans", sans-serif',
            fontSize: 13,
            color: '#DC2626',
          }}>
            {uploadError}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <div style={{
              width: 28,
              height: 28,
              border: '2px solid #E8E5DF',
              borderTop: '2px solid #C4A882',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : books.length === 0 ? (
          <EmptyState
            dragProps={dragProps}
            isDragging={isDragging}
            isUploading={isUploading}
            onBrowse={() => fileInputRef.current?.click()}
          />
        ) : (
          <>
            {continueBook && (
              <ContinueBanner
                book={continueBook}
                opening={openingId === continueBook.id}
                onOpen={() => handleOpenBook(continueBook)}
                onDetail={() => setDetailBook(continueBook)}
                readingSeconds={continueBookSeconds}
              />
            )}

            <BookGrid
              books={activeBooks}
              openingId={openingId}
              onOpen={handleOpenBook}
              onDetail={setDetailBook}
            />

            {archivedBooks.length > 0 && (
              <div style={{ marginTop: 48 }}>
                <button
                  onClick={() => setArchivedOpen((o) => !o)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    marginBottom: archivedOpen ? 14 : 0,
                  }}
                >
                  <span style={{
                    fontFamily: '"DM Sans", system-ui, sans-serif',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#8A8680',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}>
                    Archived ({archivedBooks.length})
                  </span>
                  <span style={{
                    fontSize: 10,
                    color: '#8A8680',
                    transform: archivedOpen ? 'rotate(90deg)' : 'none',
                    transition: 'transform 180ms ease',
                    display: 'inline-block',
                  }}>›</span>
                </button>

                <AnimatePresence>
                  {archivedOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      <BookGrid
                        books={archivedBooks}
                        openingId={openingId}
                        onOpen={handleOpenBook}
                        onDetail={setDetailBook}
                        muted
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </main>

      <AnimatePresence>
        {detailBook && (
          <BookDetailModal
            key={detailBook.id}
            book={detailBook}
            supabase={supabase}
            onClose={() => setDetailBook(null)}
            onRead={() => handleOpenBook(detailBook)}
            onStudy={(opts) => handleStudyBook(detailBook, opts)}
            onArchive={handleArchive}
            onUnarchive={handleUnarchive}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function EmptyState({
  dragProps,
  isDragging,
  isUploading,
  onBrowse,
}: {
  dragProps: React.HTMLAttributes<HTMLDivElement>
  isDragging: boolean
  isUploading: boolean
  onBrowse: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80, gap: 28 }}>
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
        <rect x="10" y="6" width="28" height="40" rx="3" stroke="#C4A882" strokeWidth="1.5" />
        <rect x="14" y="6" width="28" height="40" rx="3" fill="#FFFFFF" stroke="#C4A882" strokeWidth="1.5" />
        <line x1="20" y1="18" x2="36" y2="18" stroke="#C4A882" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="20" y1="24" x2="36" y2="24" stroke="#C4A882" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="20" y1="30" x2="30" y2="30" stroke="#C4A882" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 22,
          fontWeight: 600,
          color: '#1A1917',
          margin: '0 0 6px',
        }}>Your library is empty</h2>
        <p style={{
          fontFamily: '"DM Sans", system-ui, sans-serif',
          fontSize: 14,
          color: '#8A8680',
          margin: 0,
        }}>Upload an EPUB to start reading</p>
      </div>
      <div
        {...dragProps}
        onClick={isUploading ? undefined : onBrowse}
        style={{
          border: `2px dashed ${isDragging ? '#C4A882' : '#D8D4CD'}`,
          borderRadius: 12,
          padding: '28px 52px',
          textAlign: 'center',
          cursor: isUploading ? 'default' : 'pointer',
          background: isDragging ? 'rgba(196,168,130,0.06)' : 'transparent',
          transition: 'all 180ms ease',
        }}
      >
        <p style={{
          fontFamily: '"DM Sans", system-ui, sans-serif',
          fontSize: 13,
          color: '#8A8680',
          margin: 0,
        }}>
          {isUploading ? 'Uploading…' : 'Drop an EPUB here, or click to browse'}
        </p>
      </div>
    </div>
  )
}

function ContinueBanner({
  book,
  opening,
  onOpen,
  onDetail,
  readingSeconds,
}: {
  book: Book
  opening: boolean
  onOpen: () => void
  onDetail: () => void
  readingSeconds: number
}) {
  const [hovered, setHovered] = useState(false)
  const [detailHovered, setDetailHovered] = useState(false)

  return (
    <div style={{ marginBottom: 44 }}>
      <p style={{
        fontFamily: '"DM Sans", system-ui, sans-serif',
        fontSize: 11,
        fontWeight: 600,
        color: '#8A8680',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        margin: '0 0 12px',
      }}>Continue reading</p>

      <div
        style={{
          position: 'relative',
          display: 'inline-flex',
          maxWidth: 500,
          width: '100%',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false) }}
      >
        {/* Primary action — open the book */}
        <button
          type="button"
          disabled={opening}
          onClick={onOpen}
          aria-label={`Resume reading ${book.title}`}
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
          padding: '18px 48px 18px 18px',
          borderRadius: 12,
          border: hovered && !opening
            ? '1px solid rgba(196,168,130,0.45)'
            : '1px solid rgba(26,25,23,0.08)',
          background: 'var(--bg-surface)',
          cursor: opening ? 'default' : 'pointer',
          textAlign: 'left',
          font: 'inherit',
          color: 'inherit',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(26,25,23,0.05)',
          transform: 'none',
          transition: 'border-color 200ms ease, box-shadow 200ms ease',
          }}
        >
          {/* Cover */}
          <div style={{
            flexShrink: 0,
            borderRadius: 5,
            overflow: 'hidden',
            boxShadow: '0 3px 10px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)',
          }}>
            {book.coverUrl ? (
              <img
                src={book.coverUrl}
                alt=""
                style={{ width: 48, height: 72, objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div style={{
                width: 48,
                height: 72,
                background: 'linear-gradient(160deg, #E8E4DC, #D8D4CD)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ fontSize: 20, opacity: 0.4 }} aria-hidden>📖</span>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontFamily: '"Lora", Georgia, serif',
              fontSize: 15,
              fontWeight: 600,
              color: '#1A1917',
              lineHeight: 1.35,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              marginBottom: 5,
            }}>{book.title}</div>
            {book.author && (
              <div style={{
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 12,
                fontWeight: 500,
                color: '#6B6560',
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>{book.author}</div>
            )}
            {readingSeconds > 0 && (
              <div style={{
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 11,
                color: '#B0ADA8',
                marginTop: 6,
                letterSpacing: '0.02em',
              }}>
                {formatDuration(readingSeconds)} read
              </div>
            )}
          </div>

        </button>

        {/* Details button — positioned absolutely so it doesn't affect card layout */}
        {!opening && (
          <button
            type="button"
            onClick={() => onDetail()}
            onMouseEnter={() => setDetailHovered(true)}
            onMouseLeave={() => setDetailHovered(false)}
            aria-label="Book details"
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 7,
              background: detailHovered ? 'rgba(26,25,23,0.07)' : 'rgba(26,25,23,0.04)',
              border: '1px solid rgba(26,25,23,0.08)',
              cursor: 'pointer',
              color: detailHovered ? '#1A1917' : '#8A8680',
              transition: 'background 140ms ease, color 140ms ease',
              opacity: hovered || detailHovered ? 1 : 0.55,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

function BookGrid({
  books,
  openingId,
  onOpen,
  onDetail,
  muted = false,
}: {
  books: Book[]
  openingId: string | null
  onOpen: (book: Book) => void
  onDetail: (book: Book) => void
  muted?: boolean
}) {
  return (
    <div>
      {!muted && (
        <p style={{
          fontFamily: '"DM Sans", system-ui, sans-serif',
          fontSize: 11,
          fontWeight: 600,
          color: '#8A8680',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          margin: '0 0 14px',
        }}>All books</p>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
        gap: '32px 22px',
      }}>
        {books.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            opening={openingId === book.id}
            onOpen={() => onOpen(book)}
            onDetail={() => onDetail(book)}
          />
        ))}
      </div>
    </div>
  )
}

function BookCard({
  book,
  opening,
  onOpen,
  onDetail,
}: {
  book: Book
  opening: boolean
  onOpen: () => void
  onDetail: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  return (
    <div
      style={{ position: 'relative', cursor: opening ? 'default' : 'pointer' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
    >
      <div
        onClick={opening ? undefined : onOpen}
        onMouseDown={() => { if (!opening) setPressed(true) }}
        onMouseUp={() => setPressed(false)}
        style={{
          aspectRatio: '2/3',
          borderRadius: 8,
          overflow: 'hidden',
          background: '#EAE7E1',
          position: 'relative',
          boxShadow: hovered
            ? '0 6px 22px rgba(0,0,0,0.16), 0 1px 4px rgba(0,0,0,0.06)'
            : '0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
          transform: pressed ? 'scale(0.97)' : 'none',
          transition: pressed
            ? 'transform 80ms ease, box-shadow 80ms ease'
            : 'transform 160ms ease, box-shadow 240ms ease',
        }}
      >
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #EAE7E1 0%, #D8D4CD 100%)',
            padding: 10,
          }}>
            <span style={{
              fontFamily: '"Lora", Georgia, serif',
              fontSize: 11,
              fontWeight: 600,
              color: '#8A8680',
              textAlign: 'center',
              lineHeight: 1.3,
            }}>{book.title}</span>
          </div>
        )}

        {/* Overlay: always rendered, fades in on hover */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 52%)',
          display: 'flex',
          alignItems: 'flex-end',
          padding: 10,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 180ms ease',
          pointerEvents: 'none',
        }}>
          <span style={{
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: 11,
            fontWeight: 600,
            color: '#FFFFFF',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            {opening ? 'Opening…' : 'Read'}
          </span>
        </div>

        {/* Details button: always rendered, fades in on hover */}
        <button
          onClick={(e) => { e.stopPropagation(); onDetail() }}
          aria-label="Book details"
          style={{
            position: 'absolute',
            top: 7,
            right: 7,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.88)',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            color: '#1A1917',
            opacity: hovered ? 1 : 0,
            pointerEvents: hovered ? 'auto' : 'none',
            transition: 'opacity 180ms ease, background 120ms ease',
            backdropFilter: 'blur(4px)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.88)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{
          fontFamily: '"Lora", Georgia, serif',
          fontSize: 13,
          fontWeight: 600,
          color: '#1A1917',
          lineHeight: 1.35,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{book.title}</div>
        {book.author && (
          <div style={{
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: 11,
            fontWeight: 500,
            color: '#8A8680',
            marginTop: 4,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}>{book.author}</div>
        )}
      </div>
    </div>
  )
}
