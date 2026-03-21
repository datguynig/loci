import type { SupabaseClient } from '@supabase/supabase-js'

export interface Bookmark {
  id: string
  bookId: string
  href: string
  label: string
  createdAt: number
}

export async function getBookmarks(supabase: SupabaseClient, bookId: string): Promise<Bookmark[]> {
  const { data } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('book_id', bookId)
    .order('created_at', { ascending: false })

  return (data ?? []).map((row) => ({
    id: row.id,
    bookId: row.book_id,
    href: row.href,
    label: row.label,
    createdAt: new Date(row.created_at).getTime(),
  }))
}

export async function saveBookmark(
  supabase: SupabaseClient,
  userId: string,
  bookId: string,
  href: string,
  label: string,
): Promise<Bookmark> {
  const id = crypto.randomUUID()
  const { data, error } = await supabase
    .from('bookmarks')
    .insert({ id, user_id: userId, book_id: bookId, href, label })
    .select()
    .single()

  if (error) throw error

  return {
    id: data.id,
    bookId: data.book_id,
    href: data.href,
    label: data.label,
    createdAt: new Date(data.created_at).getTime(),
  }
}

export async function deleteBookmark(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase.from('bookmarks').delete().eq('id', id)
}
