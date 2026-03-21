import type { SupabaseClient } from '@supabase/supabase-js'

export interface Flashcard {
  id: string
  bookId: string
  chapterHref: string
  front: string
  back: string
  createdAt: number
  lastReviewedAt: number | null
  reviewCount: number
}

function rowToFlashcard(row: Record<string, unknown>): Flashcard {
  return {
    id: row.id as string,
    bookId: row.book_id as string,
    chapterHref: row.chapter_href as string,
    front: row.front as string,
    back: row.back as string,
    createdAt: new Date(row.created_at as string).getTime(),
    lastReviewedAt: row.last_reviewed_at
      ? new Date(row.last_reviewed_at as string).getTime()
      : null,
    reviewCount: (row.review_count as number) ?? 0,
  }
}

export async function getFlashcards(
  supabase: SupabaseClient,
  bookId: string,
): Promise<Flashcard[]> {
  const { data, error } = await supabase
    .from('flashcards')
    .select('*')
    .eq('book_id', bookId)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data.map(rowToFlashcard)
}

export async function saveFlashcards(
  supabase: SupabaseClient,
  userId: string,
  bookId: string,
  chapterHref: string,
  cards: { front: string; back: string }[],
): Promise<Flashcard[]> {
  const rows = cards.map((card) => ({
    user_id: userId,
    book_id: bookId,
    chapter_href: chapterHref,
    front: card.front,
    back: card.back,
    review_count: 0,
  }))
  const { data, error } = await supabase
    .from('flashcards')
    .insert(rows)
    .select()
  if (error || !data) return []
  return data.map(rowToFlashcard)
}

export async function deleteFlashcard(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  await supabase.from('flashcards').delete().eq('id', id)
}

export async function markReviewed(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { data } = await supabase
    .from('flashcards')
    .select('review_count')
    .eq('id', id)
    .single()
  const currentCount: number = (data?.review_count as number) ?? 0
  await supabase
    .from('flashcards')
    .update({
      last_reviewed_at: new Date().toISOString(),
      review_count: currentCount + 1,
    })
    .eq('id', id)
}
