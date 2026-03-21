import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SupabaseClient } from '@supabase/supabase-js'
import FlashCard from './FlashCard'
import { sendStudyMessage } from '../services/aiStudyService'
import type { StudyContext, Message } from '../services/aiStudyService'

interface StudyPanelProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  context: StudyContext
  supabase: SupabaseClient
  onFlashcardsGenerated: (cards: { front: string; back: string }[], chapterHref: string) => void
  chapterHref: string
  reviewMode?: { chapterHref: string }
  reviewFlashcards?: { front: string; back: string }[]
}

function extractChapterName(href: string): string {
  const filename = href.split('/').pop() ?? href
  const noExt = filename.replace(/\.[^.]+$/, '')
  const spaced = noExt.replace(/[-_]+/g, ' ')
  return spaced
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function computeChips(context: StudyContext, hasNotes: boolean, hasFlashcards: boolean): string[] {
  if (context.selectedText) return ['Explain this', 'Save as flashcard']
  if (hasNotes && hasFlashcards) return ['Review my notes', 'Quiz me', 'Review flashcards']
  if (hasNotes) return ['Review my notes', 'Summarise chapter', 'Quiz from notes']
  if (hasFlashcards) return ['Summarise chapter', 'Quiz me', 'Review flashcards']
  return ['Summarise chapter', 'Quiz me', 'Make flashcards']
}

function isFlashcardArray(value: unknown): value is { front: string; back: string }[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).front === 'string' &&
        typeof (item as Record<string, unknown>).back === 'string',
    )
  )
}

function tryParseFlashcards(content: string): { front: string; back: string }[] | null {
  try {
    const parsed: unknown = JSON.parse(content)
    if (isFlashcardArray(parsed)) return parsed
  } catch {
    // not JSON
  }
  return null
}

export default function StudyPanel({
  isOpen,
  onClose,
  context,
  supabase,
  onFlashcardsGenerated,
  chapterHref,
  reviewMode,
  reviewFlashcards,
}: StudyPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [reviewCards, setReviewCards] = useState<{ front: string; back: string }[]>([])
  const [reviewIndex, setReviewIndex] = useState(0)
  const [isInReviewMode, setIsInReviewMode] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reviewMode && reviewFlashcards?.length) {
      setReviewCards(reviewFlashcards)
      setReviewIndex(0)
      setIsInReviewMode(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streaming])

  async function handleSend(text: string) {
    if (!text.trim() || streaming) return
    const userMessage: Message = { role: 'user', content: text.trim() }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setStreaming(true)

    const action = text.toLowerCase().includes('flashcard')
      ? 'flashcards'
      : text.toLowerCase().includes('summar')
        ? 'summarise'
        : text.toLowerCase().includes('quiz') || text.toLowerCase().includes('test')
          ? 'quiz'
          : text.toLowerCase().includes('explain')
            ? 'explain'
            : 'chat'

    try {
      let fullContent = ''
      const allMessages = [...messages, userMessage]
      for await (const chunk of sendStudyMessage(supabase, action, allMessages, context)) {
        fullContent += chunk
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant') {
            return [...prev.slice(0, -1), { role: 'assistant', content: fullContent }]
          }
          return [...prev, { role: 'assistant', content: fullContent }]
        })
      }
      if (action === 'flashcards') {
        const parsed = tryParseFlashcards(fullContent)
        if (parsed) {
          onFlashcardsGenerated(parsed, chapterHref)
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ])
    } finally {
      setStreaming(false)
    }
  }

  const hasNotes = context.chapterNotes.length > 0
  const hasFlashcards = context.flashcards.length > 0
  const chips = computeChips(context, hasNotes, hasFlashcards)
  const chapterName = extractChapterName(chapterHref)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 320 }}
          animate={{ x: 0 }}
          exit={{ x: 320 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: 320,
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-surface)',
            borderLeft: '1px solid var(--border)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, color: 'var(--accent-warm)' }}>✦</span>
              <span
                style={{
                  fontFamily: '"DM Sans", system-ui, sans-serif',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Study Assistant
              </span>
            </div>
            <button
              onClick={onClose}
              style={{
                fontSize: 18,
                color: 'var(--text-tertiary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                lineHeight: 1,
                padding: 2,
              }}
            >
              ×
            </button>
          </div>

          {/* Context pill */}
          <div
            style={{
              padding: '6px 16px',
              display: 'flex',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                background: 'var(--bg-secondary)',
                borderRadius: 20,
                padding: '3px 10px',
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 10,
                color: 'var(--text-tertiary)',
              }}
            >
              {chapterName}
            </div>
          </div>

          {/* Review mode card */}
          {isInReviewMode && reviewCards.length > 0 && (
            <div style={{ padding: '0 12px 8px', flexShrink: 0 }}>
              <div
                style={{
                  fontFamily: '"DM Sans", system-ui, sans-serif',
                  fontSize: 10,
                  color: 'var(--text-tertiary)',
                  marginBottom: 6,
                  textAlign: 'center',
                }}
              >
                Card {reviewIndex + 1} of {reviewCards.length}
              </div>
              <FlashCard
                front={reviewCards[reviewIndex].front}
                back={reviewCards[reviewIndex].back}
                isReview
                onPrev={() => setReviewIndex((i) => Math.max(0, i - 1))}
                onNext={() => setReviewIndex((i) => Math.min(reviewCards.length - 1, i + 1))}
                onMarkKnown={() => {
                  setReviewIndex((i) => Math.min(reviewCards.length - 1, i + 1))
                  onFlashcardsGenerated([], chapterHref)
                }}
              />
            </div>
          )}

          {/* Chat thread */}
          <div
            ref={threadRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {messages.map((msg, idx) => {
              if (msg.role === 'user') {
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div
                      style={{
                        background: '#1A1917',
                        borderRadius: '10px 10px 2px 10px',
                        padding: '8px 12px',
                        maxWidth: '85%',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: '"DM Sans", system-ui, sans-serif',
                          fontSize: 13,
                          color: '#F0EDE8',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {msg.content}
                      </span>
                    </div>
                  </div>
                )
              }

              // Assistant message — check for flashcard JSON
              const flashcards = tryParseFlashcards(msg.content)
              if (flashcards) {
                return (
                  <div key={idx} style={{ display: 'flex', gap: 8 }}>
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        background: 'var(--accent-warm)',
                        borderRadius: '50%',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: '"DM Sans", system-ui, sans-serif',
                        fontSize: 10,
                        color: '#fff',
                        marginTop: 2,
                      }}
                    >
                      ✦
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontFamily: '"DM Sans", system-ui, sans-serif',
                          fontSize: 10,
                          color: 'var(--accent-warm)',
                          marginBottom: 6,
                        }}
                      >
                        Saved ✦
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {flashcards.map((card, cardIdx) => (
                          <FlashCard key={cardIdx} front={card.front} back={card.back} />
                        ))}
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div key={idx} style={{ display: 'flex', gap: 8 }}>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      background: 'var(--accent-warm)',
                      borderRadius: '50%',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: '"DM Sans", system-ui, sans-serif',
                      fontSize: 10,
                      color: '#fff',
                      marginTop: 2,
                    }}
                  >
                    ✦
                  </div>
                  <div
                    style={{
                      background: 'var(--bg-primary)',
                      borderRadius: '2px 10px 10px 10px',
                      padding: '8px 12px',
                      flex: 1,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: '"Lora", Georgia, serif',
                        fontSize: 13,
                        color: 'var(--text-primary)',
                        lineHeight: 1.65,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {msg.content}
                    </span>
                  </div>
                </div>
              )
            })}

            {/* Streaming indicator */}
            {streaming && (
              <div style={{ display: 'flex', gap: 8 }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    background: 'var(--accent-warm)',
                    borderRadius: '50%',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: '"DM Sans", system-ui, sans-serif',
                    fontSize: 10,
                    color: '#fff',
                    marginTop: 2,
                  }}
                >
                  ✦
                </div>
                <div
                  style={{
                    background: 'var(--bg-primary)',
                    borderRadius: '2px 10px 10px 10px',
                    padding: '8px 12px',
                    flex: 1,
                  }}
                >
                  <span
                    style={{
                      fontFamily: '"Lora", Georgia, serif',
                      fontSize: 13,
                      color: 'var(--text-tertiary)',
                      lineHeight: 1.65,
                    }}
                  >
                    ✦ thinking…
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Smart chips */}
          <div
            style={{
              padding: '8px 12px 4px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              flexShrink: 0,
            }}
          >
            {chips.map((chip) => (
              <button
                key={chip}
                onClick={() => handleSend(chip)}
                disabled={streaming}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 20,
                  padding: '4px 10px',
                  fontFamily: '"DM Sans", system-ui, sans-serif',
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  cursor: streaming ? 'default' : 'pointer',
                  opacity: streaming ? 0.5 : 1,
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input area */}
          <div
            style={{
              padding: '8px 12px 12px',
              borderTop: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend(input)
                  }
                }}
                placeholder="Ask anything…"
                style={{
                  flex: 1,
                  resize: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  fontFamily: '"DM Sans", system-ui, sans-serif',
                  fontSize: 13,
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => handleSend(input)}
                disabled={streaming || input.trim() === ''}
                style={{
                  width: 28,
                  height: 28,
                  background: '#1A1917',
                  borderRadius: 6,
                  border: 'none',
                  color: '#fff',
                  fontSize: 14,
                  cursor: streaming || input.trim() === '' ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: streaming || input.trim() === '' ? 0.4 : 1,
                  flexShrink: 0,
                }}
              >
                ↑
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
