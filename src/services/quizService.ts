import type { SupabaseClient } from '@supabase/supabase-js'

export interface QuizQuestion {
  question: string
  userAnswer: string
  correct: boolean
  correctAnswer?: string
}

export interface QuizSession {
  id: string
  bookId: string
  chapterHref: string
  score: number
  total: number
  questions: QuizQuestion[]
  createdAt: number
}

export async function saveQuizSession(
  supabase: SupabaseClient,
  userId: string,
  bookId: string,
  chapterHref: string,
  score: number,
  total: number,
  questions: QuizQuestion[],
): Promise<void> {
  const { error } = await supabase.from('quiz_sessions').insert({
    user_id: userId,
    book_id: bookId,
    chapter_href: chapterHref,
    score,
    total,
    questions,
  })
  if (error) throw error
}

export async function getQuizSessions(
  supabase: SupabaseClient,
  bookId: string,
): Promise<QuizSession[]> {
  const { data, error } = await supabase
    .from('quiz_sessions')
    .select('id, book_id, chapter_href, score, total, questions, created_at')
    .eq('book_id', bookId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    bookId: row.book_id,
    chapterHref: row.chapter_href,
    score: row.score,
    total: row.total,
    questions: (row.questions ?? []) as QuizQuestion[],
    createdAt: new Date(row.created_at).getTime(),
  }))
}

/** Returns the single best score across all sessions for this book. */
export function getBestScore(sessions: QuizSession[]): { score: number; total: number } | null {
  if (!sessions.length) return null
  let best = sessions[0]
  for (const s of sessions) {
    if (s.total > 0 && s.score / s.total > best.score / best.total) best = s
  }
  return { score: best.score, total: best.total }
}
