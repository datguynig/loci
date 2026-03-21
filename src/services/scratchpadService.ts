import type { SupabaseClient } from '@supabase/supabase-js'

export async function getScratchpad(
  supabase: SupabaseClient,
  bookId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('scratchpad')
    .select('content')
    .eq('book_id', bookId)
    .maybeSingle()
  if (error || !data) return ''
  return (data.content as string) ?? ''
}

export async function saveScratchpad(
  supabase: SupabaseClient,
  userId: string,
  bookId: string,
  content: string,
): Promise<void> {
  await supabase.from('scratchpad').upsert(
    {
      user_id: userId,
      book_id: bookId,
      content,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,book_id' },
  )
}
