import type { SupabaseClient } from '@supabase/supabase-js'
import ePub from 'epubjs'

export interface Book {
  id: string
  userId: string
  title: string
  author: string | null
  coverUrl: string | null
  filePath: string
  fileSize: number | null
  addedAt: string
  lastReadAt: string | null
  status: 'active' | 'archived'
  rating: number | null
  review: string | null
}

function toBook(row: Record<string, unknown>): Book {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    author: (row.author as string | null) ?? null,
    coverUrl: (row.cover_url as string | null) ?? null,
    filePath: row.file_path as string,
    fileSize: (row.file_size as number | null) ?? null,
    addedAt: row.added_at as string,
    lastReadAt: (row.last_read_at as string | null) ?? null,
    status: ((row.status as string | null) ?? 'active') as 'active' | 'archived',
    rating: (row.rating as number | null) ?? null,
    review: (row.review as string | null) ?? null,
  }
}

export async function listBooks(supabase: SupabaseClient): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .order('last_read_at', { ascending: false, nullsFirst: false })
    .order('added_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(toBook)
}

async function extractCover(file: File): Promise<Blob | null> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const book = ePub(arrayBuffer)
    await book.ready
    const coverUrl = await book.coverUrl()
    if (!coverUrl) {
      book.destroy()
      return null
    }
    // Fetch the blob BEFORE destroy — epubjs revokes the blob URL on destroy
    const res = await fetch(coverUrl)
    const blob = await res.blob()
    book.destroy()
    return blob
  } catch {
    return null
  }
}

export async function uploadBook(
  supabase: SupabaseClient,
  userId: string,
  file: File,
): Promise<Book> {
  const arrayBuffer = await file.arrayBuffer()
  const epubBook = ePub(arrayBuffer)
  await epubBook.ready
  const metadata = await epubBook.loaded.metadata
  const title = metadata.title || file.name.replace(/\.epub$/i, '')
  const author = metadata.creator || null
  const coverBlob = await extractCover(file)
  epubBook.destroy()

  // Insert row to get ID
  const { data: row, error: dbError } = await supabase
    .from('books')
    .insert({ user_id: userId, title, author, file_path: 'pending', file_size: file.size })
    .select()
    .single()
  if (dbError) throw dbError

  const bookId: string = row.id
  const filePath = `${userId}/${bookId}.epub`

  const { error: uploadError } = await supabase.storage
    .from('books')
    .upload(filePath, file, { contentType: 'application/epub+zip', upsert: true })
  if (uploadError) throw uploadError

  let coverUrl: string | null = null
  if (coverBlob) {
    const coverPath = `${userId}/${bookId}.jpg`
    const { error: coverError } = await supabase.storage
      .from('covers')
      .upload(coverPath, coverBlob, { contentType: 'image/jpeg', upsert: true })
    if (!coverError) {
      const { data: pub } = supabase.storage.from('covers').getPublicUrl(coverPath)
      coverUrl = pub.publicUrl
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('books')
    .update({ file_path: filePath, cover_url: coverUrl })
    .eq('id', bookId)
    .select()
    .single()
  if (updateError) throw updateError

  return toBook(updated)
}

export async function getBookFile(supabase: SupabaseClient, book: Book): Promise<File> {
  const { data, error } = await supabase.storage.from('books').download(book.filePath)
  if (error) throw error
  return new File([data], `${book.title}.epub`, { type: 'application/epub+zip' })
}

export async function markLastRead(supabase: SupabaseClient, bookId: string): Promise<void> {
  await supabase.from('books').update({ last_read_at: new Date().toISOString() }).eq('id', bookId)
}

export async function archiveBook(supabase: SupabaseClient, bookId: string): Promise<void> {
  const { error } = await supabase.from('books').update({ status: 'archived' }).eq('id', bookId)
  if (error) throw error
}

export async function unarchiveBook(supabase: SupabaseClient, bookId: string): Promise<void> {
  const { error } = await supabase.from('books').update({ status: 'active' }).eq('id', bookId)
  if (error) throw error
}

export async function deleteBook(supabase: SupabaseClient, book: Book): Promise<void> {
  await supabase.storage.from('books').remove([book.filePath])
  if (book.coverUrl) {
    const coverPath = `${book.userId}/${book.id}.jpg`
    await supabase.storage.from('covers').remove([coverPath])
  }
  const { error } = await supabase.from('books').delete().eq('id', book.id)
  if (error) throw error
}

export async function updateBookRating(
  supabase: SupabaseClient,
  bookId: string,
  rating: number | null,
): Promise<void> {
  const { error } = await supabase.from('books').update({ rating }).eq('id', bookId)
  if (error) throw error
}

export async function updateBookReview(
  supabase: SupabaseClient,
  bookId: string,
  review: string,
): Promise<void> {
  const { error } = await supabase.from('books').update({ review: review || null }).eq('id', bookId)
  if (error) throw error
}
