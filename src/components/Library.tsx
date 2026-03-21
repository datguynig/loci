import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SupabaseClient } from '@supabase/supabase-js'
import { UserButton } from '@clerk/clerk-react'
import { useLibrary } from '../hooks/useLibrary'
import { getBookFile, markLastRead, type Book } from '../services/bookService'
import { loadProgress } from '../services/progressService'
import { formatDuration } from '../utils/formatDuration'
import BookDetailModal from './BookDetailModal'

interface LibraryProps {
  supabase: SupabaseClient
  onOpenBook: (file: File, bookId?: string) => void
}

export default function Library({ supabase, onOpenBook }: LibraryProps) {
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
      style={{ minHeight: '100vh', background: '#F8F7F4' }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Nav */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        height: 60,
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        background: '#FFFFFF',
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
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            style={{
              background: '#1A1917',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: 13,
              fontWeight: 500,
              cursor: isUploading ? 'not-allowed' : 'pointer',
              opacity: isUploading ? 0.6 : 1,
            }}
          >
            {isUploading ? 'Uploading…' : '+ Add book'}
          </button>
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
  return (
    <div style={{ marginBottom: 40 }}>
      <p style={{
        fontFamily: '"DM Sans", system-ui, sans-serif',
        fontSize: 11,
        fontWeight: 600,
        color: '#8A8680',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        margin: '0 0 10px',
      }}>Continue reading</p>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          background: '#FFFFFF',
          border: '1px solid #EAE7E1',
          borderRadius: 10,
          padding: '14px 18px',
          maxWidth: 480,
          boxShadow: hovered ? '0 2px 16px rgba(0,0,0,0.08)' : 'none',
          transition: 'box-shadow 180ms ease',
        }}
      >
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            style={{ width: 40, height: 60, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: 40,
            height: 60,
            borderRadius: 3,
            flexShrink: 0,
            background: '#EAE7E1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ fontSize: 18 }}>📖</span>
          </div>
        )}
        <div
          onClick={opening ? undefined : onOpen}
          style={{ flex: 1, minWidth: 0, cursor: opening ? 'default' : 'pointer' }}
        >
          <div style={{
            fontFamily: '"Lora", Georgia, serif',
            fontSize: 14,
            fontWeight: 600,
            color: '#1A1917',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>{book.title}</div>
          {book.author && (
            <div style={{
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: 12,
              color: '#8A8680',
              marginTop: 2,
            }}>{book.author}</div>
          )}
          {readingSeconds > 0 && (
            <div style={{
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: 11,
              color: '#B0ADA8',
              marginTop: 1,
            }}>
              {formatDuration(readingSeconds)} read
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span
            onClick={opening ? undefined : onOpen}
            style={{
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: 12,
              color: '#C4A882',
              fontWeight: 500,
              cursor: opening ? 'default' : 'pointer',
            }}
          >
            {opening ? 'Opening…' : 'Continue →'}
          </span>
          {!opening && (
            <button
              onClick={(e) => { e.stopPropagation(); onDetail() }}
              aria-label="Book details"
              style={{
                background: 'rgba(0,0,0,0.05)',
                border: 'none',
                borderRadius: 5,
                padding: '3px 7px',
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                color: '#8A8680',
                cursor: 'pointer',
                lineHeight: 1,
                letterSpacing: '0.05em',
              }}
            >
              ···
            </button>
          )}
        </div>
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
        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        gap: '28px 20px',
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

  return (
    <div
      style={{ position: 'relative', cursor: 'pointer' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        onClick={opening ? undefined : onOpen}
        style={{
          aspectRatio: '2/3',
          borderRadius: 7,
          overflow: 'hidden',
          background: '#EAE7E1',
          position: 'relative',
          boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.14)' : '0 2px 8px rgba(0,0,0,0.08)',
          transform: hovered ? 'translateY(-3px) scale(1.015)' : 'none',
          transition: 'all 200ms ease',
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

        {hovered && (
          <>
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)',
              display: 'flex',
              alignItems: 'flex-end',
              padding: '10px 10px',
              pointerEvents: 'none',
            }}>
              <span style={{
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 11,
                fontWeight: 600,
                color: '#FFFFFF',
                letterSpacing: '0.04em',
              }}>
                {opening ? 'Opening…' : book.status === 'archived' ? 'Read' : 'Read'}
              </span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDetail() }}
              aria-label="Book details"
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                background: 'rgba(255,255,255,0.92)',
                border: 'none',
                borderRadius: 5,
                padding: '3px 7px',
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 13,
                fontWeight: 700,
                color: '#8A8680',
                cursor: 'pointer',
                lineHeight: 1,
                letterSpacing: '0.05em',
              }}
            >
              ···
            </button>
          </>
        )}
      </div>

      <div style={{ marginTop: 8 }}>
        <div style={{
          fontFamily: '"Lora", Georgia, serif',
          fontSize: 12,
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
            color: '#8A8680',
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>{book.author}</div>
        )}
      </div>
    </div>
  )
}
