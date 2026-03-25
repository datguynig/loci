import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@clerk/clerk-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import FlashCard from './FlashCard'
import { sendStudyMessage } from '../services/aiStudyService'
import type { StudyContext, Message } from '../services/aiStudyService'
import { saveQuizSession } from '../services/quizService'
import type { QuizQuestion } from '../services/quizService'
import type { SubscriptionState, SubscriptionFeature } from '../hooks/useSubscription'

interface StudyPanelProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  bookId: string
  context: StudyContext
  supabase: SupabaseClient
  onFlashcardsGenerated: (cards: { front: string; back: string }[], chapterHref: string) => void
  chapterHref: string
  chapterTitle?: string
  reviewMode?: { chapterHref: string }
  reviewFlashcards?: import('../services/flashcardService').Flashcard[]
  onMarkReviewed?: (id: string) => void
  subscription?: SubscriptionState
  onUpgrade?: () => void
}

// ─── Quiz state ────────────────────────────────────────────────────────────

interface QuizState {
  active: boolean
  total: number
  current: number      // last question number seen from AI (1-indexed)
  correct: number      // running correct count
  answered: number     // feedback responses received
  completed: boolean
  encouragement: string
  questions: QuizQuestion[]
}

const NULL_QUIZ: QuizState = {
  active: false, total: 5, current: 0, correct: 0,
  answered: 0, completed: false, encouragement: '', questions: [],
}

// ─── Message classification ─────────────────────────────────────────────────

type MsgKind =
  | { type: 'flashcards'; cards: { front: string; back: string }[] }
  | { type: 'quiz_question'; number: number; total: number; text: string }
  | { type: 'quiz_feedback'; isCorrect: boolean; explanation: string; correctAnswer?: string; next?: { number: number; total: number; text: string } }
  | { type: 'quiz_complete'; score: number; total: number; encouragement: string }
  | { type: 'normal' }

function classifyMsg(content: string, quizActive: boolean): MsgKind {
  const flashcards = tryParseFlashcards(content)
  if (flashcards) return { type: 'flashcards', cards: flashcards }

  const hasQuizMarkers = quizActive
    || /Question \d+\/\d+:/i.test(content)
    || /[✓✗]/.test(content)
    || /Quiz complete/i.test(content)

  if (!hasQuizMarkers) return { type: 'normal' }

  // Quiz complete — check before feedback since it may also contain ✓/✗
  const completeMatch = content.match(/Quiz complete\.\s*You scored (\d+)\/(\d+)\.?\s*([\s\S]*)/i)
  if (completeMatch) {
    return {
      type: 'quiz_complete',
      score: parseInt(completeMatch[1]),
      total: parseInt(completeMatch[2]),
      encouragement: completeMatch[3].trim(),
    }
  }

  // Feedback (✓ or ✗)
  const isCorrect = /✓\s*Correct\.?/i.test(content)
  const isIncorrect = /✗\s*Incorrect\.?/i.test(content)
  if (isCorrect || isIncorrect) {
    const answerMatch = content.match(/The answer is:\s*([^.\n]+)/i)
    const explMatch = isCorrect
      ? content.match(/✓\s*Correct\.?\s*(.*?)(?:\n+Question|\n+Quiz|$)/si)
      : content.match(/✗\s*Incorrect\.[^.]*\.\s*(.*?)(?:\n+Question|\n+Quiz|$)/si)
    const explanation = explMatch?.[1]?.trim() ?? ''

    const qMatch = content.match(/\n+Question (\d+)\/(\d+):\s*([\s\S]+)/si)
    const next = qMatch
      ? { number: parseInt(qMatch[1]), total: parseInt(qMatch[2]), text: qMatch[3].trim() }
      : undefined

    return {
      type: 'quiz_feedback',
      isCorrect,
      explanation,
      correctAnswer: answerMatch?.[1]?.trim(),
      next,
    }
  }

  // Standalone question
  const qMatch = content.match(/Question (\d+)\/(\d+):\s*([\s\S]+)/i)
  if (qMatch) {
    return { type: 'quiz_question', number: parseInt(qMatch[1]), total: parseInt(qMatch[2]), text: qMatch[3].trim() }
  }

  return { type: 'normal' }
}

// ─── Utility helpers ────────────────────────────────────────────────────────

function extractChapterName(href: string): string {
  const filename = href.split('/').pop() ?? href
  const noExt = filename.replace(/\.[^.]+$/, '')
  return noExt
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function computeChips(context: StudyContext, hasNotes: boolean, hasFlashcards: boolean, quizActive: boolean): string[] {
  if (quizActive) return []
  if (context.selectedText) return ['Explain this', 'Save as flashcard']
  if (hasNotes && hasFlashcards) return ['Review my notes', 'Quiz me', 'Review flashcards']
  if (hasNotes) return ['Review my notes', 'Summarise chapter', 'Quiz from notes']
  if (hasFlashcards) return ['Summarise chapter', 'Quiz me', 'Review flashcards']
  return ['Summarise chapter', 'Quiz me', 'Make flashcards']
}

function featureForChip(chip: string): SubscriptionFeature | null {
  const lc = chip.toLowerCase()
  if (lc.includes('quiz') || lc.includes('test')) return 'practice-quizzes'
  if (lc.includes('summar')) return 'chapter-briefs'
  if (lc.includes('flashcard') || lc.includes('flash card')) return 'flashcards'
  if (lc.includes('explain') || lc.includes('notes')) return 'study-guide'
  return null
}

function isFlashcardArray(v: unknown): v is { front: string; back: string }[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every(
      (i) =>
        i !== null &&
        typeof i === 'object' &&
        typeof (i as Record<string, unknown>).front === 'string' &&
        typeof (i as Record<string, unknown>).back === 'string',
    )
  )
}

function tryParseFlashcards(content: string): { front: string; back: string }[] | null {
  let text = content.trim()
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) text = fenceMatch[1].trim()

  try {
    const p: unknown = JSON.parse(text)
    if (isFlashcardArray(p)) return p
  } catch { /* fall through */ }

  const arrayMatch = text.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    try {
      const p: unknown = JSON.parse(arrayMatch[0])
      if (isFlashcardArray(p)) return p
    } catch { /* not flashcards */ }
  }
  return null
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 20 }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
          style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-warm)' }}
        />
      ))}
    </div>
  )
}

function FlashCardDeck({ cards }: { cards: { front: string; back: string }[] }) {
  const [idx, setIdx] = useState(0)
  const total = cards.length
  const dotCount = Math.min(total, 9)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 10, color: 'var(--accent-warm)', letterSpacing: '0.02em' }}>
          ✦ {total} flashcard{total !== 1 ? 's' : ''} saved
        </span>
        <span style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 10, color: 'var(--text-tertiary)' }}>
          {idx + 1} / {total}
        </span>
      </div>

      <FlashCard front={cards[idx].front} back={cards[idx].back} />

      {total > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <NavBtn onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>←</NavBtn>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 5 }}>
            {Array.from({ length: dotCount }).map((_, i) => {
              const dotIdx = total > 9 ? Math.round((i / (dotCount - 1)) * (total - 1)) : i
              const active = total > 9 ? i === Math.round((idx / (total - 1)) * (dotCount - 1)) : i === idx
              return (
                <div
                  key={i}
                  onClick={() => setIdx(dotIdx)}
                  style={{ width: active ? 6 : 4, height: active ? 6 : 4, borderRadius: '50%', background: active ? 'var(--accent-warm)' : 'var(--border)', cursor: 'pointer', transition: 'all 150ms ease', flexShrink: 0 }}
                />
              )
            })}
          </div>
          <NavBtn onClick={() => setIdx((i) => Math.min(total - 1, i + 1))} disabled={idx === total - 1}>→</NavBtn>
        </div>
      )}
    </div>
  )
}

function NavBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1, fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
    >
      {children}
    </button>
  )
}

// Quiz question — editorial style with gold left border
function QuizQuestionBlock({ number, total, text }: { number: number; total: number; text: string }) {
  return (
    <div style={{ borderLeft: '2px solid var(--accent-warm)', paddingLeft: 12, marginLeft: 4 }}>
      <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.10em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
        Question {number} of {total}
      </div>
      <div style={{ fontFamily: '"Lora", Georgia, serif', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
        {text}
      </div>
    </div>
  )
}

// Quiz feedback — color-coded left border
function QuizFeedbackBlock({ isCorrect, explanation, correctAnswer }: { isCorrect: boolean; explanation: string; correctAnswer?: string }) {
  const borderColor = isCorrect ? 'rgba(141,163,140,0.7)' : 'rgba(196,140,100,0.7)'
  const labelColor = isCorrect ? 'rgb(95,130,95)' : 'rgb(180,100,60)'
  const label = isCorrect ? '✓ Correct.' : '✗ Incorrect.'

  return (
    <div style={{
      borderLeft: `2px solid ${borderColor}`,
      background: 'rgba(26,25,23,0.02)',
      borderRadius: '0 8px 8px 0',
      padding: '8px 12px',
    }}>
      <span style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 12, fontWeight: 600, color: labelColor }}>
        {label}
      </span>
      {!isCorrect && correctAnswer && (
        <span style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
          {' '}The answer is: {correctAnswer}.
        </span>
      )}
      {explanation && (
        <span style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 12, color: 'var(--text-secondary)' }}>
          {' '}{explanation}
        </span>
      )}
    </div>
  )
}

interface QuizCompleteBlockProps {
  score: number
  total: number
  encouragement: string
  wrongQuestions: QuizQuestion[]
  onNewQuiz: () => void
  onRetry: () => void
  onSaveAsFlashcards: () => void
}

function QuizCompleteBlock({ score, total, encouragement, wrongQuestions, onNewQuiz, onRetry, onSaveAsFlashcards }: QuizCompleteBlockProps) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0
  const hasWrong = wrongQuestions.length > 0

  return (
    <div style={{
      background: 'linear-gradient(160deg, #FDFCFB 0%, #F3EFE8 100%)',
      border: '1px solid rgba(196,168,130,0.25)',
      borderRadius: 14,
      padding: '22px 20px 18px',
    }}>
      {/* Score */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
        <span style={{ fontFamily: '"Lora", Georgia, serif', fontSize: 38, color: '#1A1917', lineHeight: 1, fontWeight: 400 }}>
          {score} / {total}
        </span>
        <span style={{
          fontFamily: '"DM Sans", system-ui, sans-serif',
          fontSize: 12,
          color: 'var(--accent-warm)',
          border: '1px solid rgba(196,168,130,0.35)',
          borderRadius: 20,
          padding: '2px 8px',
        }}>
          {pct}%
        </span>
      </div>

      {/* Encouragement */}
      {encouragement && (
        <p style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', margin: '0 0 16px', lineHeight: 1.5 }}>
          {encouragement}
        </p>
      )}

      <div style={{ height: 1, background: 'rgba(26,25,23,0.08)', margin: '14px 0' }} />

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
        <button
          onClick={onNewQuiz}
          style={{ height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 11 }}
        >
          New quiz
        </button>
        {hasWrong && (
          <button
            onClick={onRetry}
            style={{ height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(196,140,100,0.5)', background: 'transparent', color: 'rgb(180,100,60)', cursor: 'pointer', fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 11 }}
          >
            Retry {wrongQuestions.length} wrong
          </button>
        )}
        {hasWrong && (
          <button
            onClick={onSaveAsFlashcards}
            style={{ height: 30, padding: '0 12px', borderRadius: 8, border: 'none', background: 'var(--accent-warm)', color: '#fff', cursor: 'pointer', fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 11, fontWeight: 600 }}
          >
            Save as flashcards
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function StudyPanel({
  isOpen,
  onClose,
  userId,
  bookId,
  context,
  supabase,
  onFlashcardsGenerated,
  chapterHref,
  chapterTitle,
  reviewMode,
  reviewFlashcards,
  onMarkReviewed,
  subscription,
  onUpgrade,
}: StudyPanelProps) {
  const { getToken } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [reviewIndex, setReviewIndex] = useState(0)
  const [isInReviewMode, setIsInReviewMode] = useState(false)
  const [quizState, setQuizState] = useState<QuizState>(NULL_QUIZ)

  // Refs for quiz tracking — not needing re-renders
  const pendingQuestionRef = useRef('')   // question text we're waiting for user to answer
  const lastUserAnswerRef = useRef('')    // user's most recent answer during quiz
  const autoContinueRef = useRef(false)   // flag to trigger seamless next-question continuation
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reviewMode && reviewFlashcards?.length) {
      setReviewIndex(0)
      setIsInReviewMode(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streaming])

  // Save quiz session when it completes
  useEffect(() => {
    if (!quizState.completed || !userId || !bookId) return
    saveQuizSession(supabase, userId, bookId, chapterHref, quizState.correct, quizState.total, quizState.questions)
      .catch(console.error)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizState.completed])

  // When streaming ends, check if we need to seamlessly continue the quiz
  // (fires when AI gave feedback but forgot to include the next question)
  const handleContinueQuizRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    if (!streaming && autoContinueRef.current) {
      autoContinueRef.current = false
      handleContinueQuizRef.current()
    }
  }, [streaming])

  // ── Seamless continuation when AI gives feedback without next question ────
  async function handleContinueQuiz() {
    if (streaming) return
    setStreaming(true)

    // The last message in state is the feedback-only assistant message.
    // We'll MERGE the continuation into it (appending the next question) so
    // messages never has two consecutive assistant entries, keeping the API
    // conversation history valid for all future turns.
    const lastMsg = messages[messages.length - 1]
    const baseContent = lastMsg?.role === 'assistant' ? lastMsg.content : ''

    const continueMsg: Message = { role: 'user', content: '(next question)' }
    const allMessages = [...messages, continueMsg]
    let fullContent = ''

    try {
      for await (const chunk of sendStudyMessage(
        () => getToken({ template: 'supabase' }),
        'quiz',
        allMessages,
        { ...context, quizLength: quizState.total },
      )) {
        fullContent += chunk
        const combined = baseContent + '\n\n' + fullContent
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant') return [...prev.slice(0, -1), { role: 'assistant', content: combined }]
          return [...prev, { role: 'assistant', content: combined }]
        })
      }
      updateQuizStateFromResponse(fullContent)
    } catch {
      // Silent failure — user can still type to proceed
    } finally {
      setStreaming(false)
    }
  }

  // Keep ref in sync so the auto-continue effect always calls the latest version
  handleContinueQuizRef.current = handleContinueQuiz

  // ── Parse quiz markers from a completed AI response ──────────────────────
  function updateQuizStateFromResponse(content: string) {
    const questionMatch = content.match(/Question (\d+)\/(\d+):\s*(.*?)(?:\n|$)/i)
    const isCorrect = /✓\s*Correct\.?/i.test(content)
    const isIncorrect = /✗\s*Incorrect\.?/i.test(content)
    const correctAnswerMatch = content.match(/The answer is:\s*([^.\n]+)/i)
    const completeMatch = content.match(/Quiz complete\.\s*You scored (\d+)\/(\d+)\.?\s*([\s\S]*)/i)

    setQuizState((prev) => {
      const next = { ...prev, questions: [...prev.questions] }

      // Record feedback for the question we were waiting on
      if (isCorrect || isIncorrect) {
        next.answered = prev.answered + 1
        if (isCorrect) next.correct = prev.correct + 1
        next.questions.push({
          question: pendingQuestionRef.current,
          userAnswer: lastUserAnswerRef.current,
          correct: isCorrect,
          correctAnswer: isIncorrect ? correctAnswerMatch?.[1]?.trim() : undefined,
        })
      }

      // Update current question pointer and set pending question text
      if (questionMatch) {
        next.current = parseInt(questionMatch[1])
        pendingQuestionRef.current = questionMatch[3].trim()
      }

      if (completeMatch) {
        next.completed = true
        next.correct = parseInt(completeMatch[1])
        next.total = parseInt(completeMatch[2])
        next.encouragement = completeMatch[3].trim()
      }

      return next
    })
  }

  // ── Send handler ─────────────────────────────────────────────────────────
  async function handleSend(text: string, config?: { retryQuestions?: string[]; forceQuizStart?: number }) {
    if (!text.trim() || streaming) return

    const lowerText = text.toLowerCase()
    const isStartingRetry = config?.forceQuizStart != null
    const isStartingNewQuiz = !quizState.active && (lowerText.includes('quiz') || lowerText.includes('test'))

    let action = 'chat'
    if (lowerText.includes('flashcard') || lowerText.includes('flash card')) action = 'flashcards'
    else if (lowerText.includes('summar')) action = 'summarise'
    else if (isStartingNewQuiz || isStartingRetry) action = 'quiz'
    else if (lowerText.includes('explain') && !quizState.active) action = 'explain'
    else if (quizState.active) action = 'quiz'

    // Gate by feature key
    const featureForAction: Record<string, SubscriptionFeature> = {
      quiz: 'practice-quizzes',
      summarise: 'chapter-briefs',
      flashcards: 'flashcards',
      explain: 'study-guide',
      chat: 'study-guide',
    }
    const requiredFeature = featureForAction[action] as SubscriptionFeature
    if (subscription && requiredFeature && !subscription.canAccess(requiredFeature)) {
      onUpgrade?.()
      return
    }

    let quizTotalForContext: number | undefined
    if (isStartingRetry) {
      const total = config!.forceQuizStart!
      quizTotalForContext = total
      setQuizState({ ...NULL_QUIZ, active: true, total })
    } else if (isStartingNewQuiz) {
      const numMatch = text.match(/\b(\d+)\b/)
      const total = numMatch ? Math.max(3, Math.min(20, parseInt(numMatch[1]))) : 5
      quizTotalForContext = total
      setQuizState({ ...NULL_QUIZ, active: true, total })
    } else if (quizState.active) {
      quizTotalForContext = quizState.total
      if (quizState.current > 0 && !quizState.completed) {
        lastUserAnswerRef.current = text.trim()
      }
    }

    const quizContext: StudyContext = {
      ...context,
      quizLength: action === 'quiz' ? quizTotalForContext : undefined,
      retryQuestions: config?.retryQuestions,
    }

    const userMessage: Message = { role: 'user', content: text.trim() }
    setMessages((prev) => (isStartingRetry ? [userMessage] : [...prev, userMessage]))
    setInput('')
    setStreaming(true)

    try {
      let fullContent = ''
      // Retry starts fresh — don't include any prior conversation history
      const allMessages = isStartingRetry ? [userMessage] : [...messages, userMessage]
      for await (const chunk of sendStudyMessage(
        () => getToken({ template: 'supabase' }),
        action,
        allMessages,
        quizContext,
      )) {
        fullContent += chunk
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant') return [...prev.slice(0, -1), { role: 'assistant', content: fullContent }]
          return [...prev, { role: 'assistant', content: fullContent }]
        })
      }

      if (action === 'flashcards') {
        const parsed = tryParseFlashcards(fullContent)
        if (parsed) onFlashcardsGenerated(parsed, chapterHref)
      }

      if (action === 'quiz' || quizState.active) {
        updateQuizStateFromResponse(fullContent)

        // If the AI gave feedback but omitted the next question, seamlessly auto-continue
        const hasFeedback = /[✓✗]/.test(fullContent)
        const hasNextQuestion = /Question \d+\/\d+:/i.test(
          fullContent.slice(Math.max(0, fullContent.search(/[✓✗]/)))
        )
        const isComplete = /Quiz complete/i.test(fullContent)
        if (hasFeedback && !hasNextQuestion && !isComplete) {
          autoContinueRef.current = true
          // useEffect watching [streaming] will fire handleContinueQuiz once streaming → false
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    } finally {
      setStreaming(false)
    }
  }

  function handleRetryWrong() {
    const wrongQs = quizState.questions.filter((q) => !q.correct)
    if (!wrongQs.length) return
    pendingQuestionRef.current = ''
    lastUserAnswerRef.current = ''
    const total = wrongQs.length
    handleSend(`Retry quiz — ${total} question${total !== 1 ? 's' : ''} I got wrong`, {
      retryQuestions: wrongQs.map((q) => q.question),
      forceQuizStart: total,
    })
  }

  function handleNewQuiz() {
    pendingQuestionRef.current = ''
    lastUserAnswerRef.current = ''
    setQuizState(NULL_QUIZ)
    setMessages([])
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  const hasNotes = context.chapterNotes.length > 0
  const hasFlashcards = context.flashcards.length > 0
  const chips = computeChips(context, hasNotes, hasFlashcards, quizState.active)
  const chapterName = chapterTitle || extractChapterName(chapterHref)
  const answered = quizState.answered
  const total = quizState.total

  function renderAssistantMsg(content: string, idx: number, isLast: boolean) {
    // While streaming a flashcard response, hide the raw JSON accumulation
    if (streaming && isLast && content.trimStart().startsWith('[')) {
      return (
        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <AiAvatar />
          <ThinkingDots />
        </div>
      )
    }

    const kind = classifyMsg(content, quizState.active)

    if (kind.type === 'flashcards') {
      return (
        <div key={idx} style={{ display: 'flex', gap: 8 }}>
          <AiAvatar />
          <div style={{ flex: 1 }}>
            <FlashCardDeck cards={kind.cards} />
          </div>
        </div>
      )
    }

    if (kind.type === 'quiz_complete') {
      const wrongQs = quizState.questions.filter((q) => !q.correct)
      return (
        <div key={idx} style={{ flex: 1 }}>
          <QuizCompleteBlock
            score={kind.score}
            total={kind.total}
            encouragement={kind.encouragement}
            wrongQuestions={wrongQs}
            onNewQuiz={handleNewQuiz}
            onRetry={handleRetryWrong}
            onSaveAsFlashcards={() => {
              const pairs = wrongQs
                .filter((q) => q.correctAnswer)
                .map((q) => ({ front: q.question, back: q.correctAnswer! }))
              if (pairs.length) onFlashcardsGenerated(pairs, chapterHref)
            }}
          />
        </div>
      )
    }

    if (kind.type === 'quiz_feedback') {
      // Show a manual "Next →" button only on the last message if auto-continue failed
      const showNextBtn = !kind.next && !quizState.completed && isLast && !streaming && quizState.answered < quizState.total
      return (
        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <QuizFeedbackBlock
            isCorrect={kind.isCorrect}
            explanation={kind.explanation}
            correctAnswer={kind.correctAnswer}
          />
          {kind.next && (
            <QuizQuestionBlock number={kind.next.number} total={kind.next.total} text={kind.next.text} />
          )}
          {showNextBtn && (
            <button
              onClick={handleContinueQuiz}
              style={{
                alignSelf: 'flex-start',
                marginLeft: 4,
                height: 28,
                padding: '0 12px',
                borderRadius: 8,
                border: '1px solid var(--accent-warm)',
                background: 'transparent',
                color: 'var(--accent-warm)',
                cursor: 'pointer',
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              Next question →
            </button>
          )}
        </div>
      )
    }

    if (kind.type === 'quiz_question') {
      return (
        <div key={idx}>
          <QuizQuestionBlock number={kind.number} total={kind.total} text={kind.text} />
        </div>
      )
    }

    // Normal assistant message
    return (
      <div key={idx} style={{ display: 'flex', gap: 8 }}>
        <AiAvatar />
        <div style={{ background: 'var(--bg-primary)', borderRadius: '2px 10px 10px 10px', padding: '9px 12px', flex: 1 }}>
          <span style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
            {content}
          </span>
        </div>
      </div>
    )
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 320 }}
          animate={{ x: 0 }}
          exit={{ x: 320 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 320, zIndex: 20, display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)' }}
        >
          {/* Header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, color: 'var(--accent-warm)' }}>✦</span>
              <span style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Study Assistant
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close study assistant"
              style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 100ms ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Quiz progress strip OR chapter context pill */}
          {quizState.active ? (
            <div style={{ padding: '7px 16px', background: 'rgba(26,25,23,0.03)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                <span style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                  Q {Math.max(1, quizState.current)} / {total}
                </span>
                <div style={{ flex: 1, height: 2, background: 'var(--border)', borderRadius: 1, overflow: 'hidden' }}>
                  <motion.div
                    animate={{ width: `${total > 0 ? (answered / total) * 100 : 0}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    style={{ height: '100%', background: 'var(--accent-warm)', borderRadius: 1 }}
                  />
                </div>
                <span style={{
                  fontFamily: '"DM Sans", system-ui, sans-serif',
                  fontSize: 10,
                  color: quizState.correct > 0 ? 'var(--accent-warm)' : 'var(--text-tertiary)',
                  flexShrink: 0,
                }}>
                  {quizState.correct} correct
                </span>
              </div>
            </div>
          ) : (
            <div style={{ padding: '6px 16px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 20, padding: '3px 10px', fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 10, color: 'var(--text-tertiary)' }}>
                {chapterName}
              </div>
            </div>
          )}

          {/* Review mode card */}
          {isInReviewMode && reviewFlashcards && reviewFlashcards.length > 0 && (
            <div style={{ padding: '0 12px 8px', flexShrink: 0 }}>
              <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6, textAlign: 'center' }}>
                Card {reviewIndex + 1} of {reviewFlashcards.length}
              </div>
              <FlashCard
                front={reviewFlashcards[reviewIndex].front}
                back={reviewFlashcards[reviewIndex].back}
                isReview
                onPrev={() => setReviewIndex((i) => Math.max(0, i - 1))}
                onNext={() => setReviewIndex((i) => Math.min(reviewFlashcards.length - 1, i + 1))}
                onMarkKnown={() => {
                  onMarkReviewed?.(reviewFlashcards[reviewIndex].id)
                  setReviewIndex((i) => Math.min(reviewFlashcards.length - 1, i + 1))
                }}
              />
            </div>
          )}

          {/* Chat thread */}
          <div
            ref={threadRef}
            style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            {messages.map((msg, idx) => {
              if (msg.role === 'user') {
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ background: '#1A1917', borderRadius: '10px 10px 2px 10px', padding: '8px 12px', maxWidth: '85%' }}>
                      <span style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 13, color: '#F0EDE8', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {msg.content}
                      </span>
                    </div>
                  </div>
                )
              }
              return renderAssistantMsg(msg.content, idx, idx === messages.length - 1)
            })}

            {/* Thinking indicator — shown only before the first streaming chunk */}
            {streaming && messages[messages.length - 1]?.role !== 'assistant' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <AiAvatar />
                <ThinkingDots />
              </div>
            )}
          </div>

          {/* Smart chips (hidden during active quiz) */}
          {chips.length > 0 && (
            <div style={{ padding: '8px 12px 4px', flexShrink: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: chips.length === 1 ? '1fr' : '1fr 1fr', gap: 6 }}>
                {chips.map((chip, i) => (
                  <button
                    key={chip}
                    onClick={() => handleSend(chip)}
                    disabled={streaming}
                    style={{
                      gridColumn: chips.length % 2 !== 0 && i === chips.length - 1 ? '1 / -1' : undefined,
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '7px 14px',
                      fontFamily: '"DM Sans", system-ui, sans-serif',
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      cursor: streaming ? 'default' : 'pointer',
                      opacity: streaming ? 0.5 : 1,
                      textAlign: 'center',
                    }}
                  >
                    <>
                      {chip}
                      {(() => {
                        const feat = featureForChip(chip)
                        return feat && subscription && !subscription.canAccess(feat)
                          ? <span style={{ fontSize: 10, color: '#7c3aed', marginLeft: 4, fontWeight: 600 }}>Scholar</span>
                          : null
                      })()}
                    </>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input area */}
          <div style={{ padding: '8px 12px 12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
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
                placeholder={quizState.active && !quizState.completed ? 'Type your answer…' : 'Ask anything…'}
                style={{ flex: 1, resize: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
              />
              <button
                onClick={() => handleSend(input)}
                disabled={streaming || input.trim() === ''}
                style={{
                  width: 28,
                  height: 28,
                  background: quizState.active && !quizState.completed ? 'var(--accent-warm)' : '#1A1917',
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

function AiAvatar() {
  return (
    <div style={{ width: 20, height: 20, background: 'var(--accent-warm)', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', marginTop: 2 }}>
      ✦
    </div>
  )
}
