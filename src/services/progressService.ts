import type { SupabaseClient } from '@supabase/supabase-js'

export interface ReadingProgress {
  userId: string
  bookId: string
  spineHref: string
  scrollFraction: number
  ttsSentenceIndex: number
  updatedAt: string
  totalReadingSeconds: number
}

export async function loadProgress(
  supabase: SupabaseClient,
  bookId: string,
): Promise<ReadingProgress | null> {
  const { data, error } = await supabase
    .from('reading_progress')
    .select('*')
    .eq('book_id', bookId)
    .single()
  if (error || !data) return null
  return {
    userId: data.user_id,
    bookId: data.book_id,
    spineHref: data.spine_href,
    scrollFraction: data.scroll_fraction ?? 0,
    ttsSentenceIndex: data.tts_sentence_index ?? 0,
    updatedAt: data.updated_at,
    totalReadingSeconds: data.total_reading_seconds ?? 0,
  }
}

export async function saveProgress(
  supabase: SupabaseClient,
  userId: string,
  bookId: string,
  spineHref: string,
  scrollFraction: number,
  ttsSentenceIndex: number,
  totalReadingSeconds: number = 0,
): Promise<void> {
  await supabase.from('reading_progress').upsert(
    {
      user_id: userId,
      book_id: bookId,
      spine_href: spineHref,
      scroll_fraction: scrollFraction,
      tts_sentence_index: ttsSentenceIndex,
      total_reading_seconds: totalReadingSeconds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,book_id' },
  )
}
