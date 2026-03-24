import type { SupabaseClient } from '@supabase/supabase-js'
import ePub from 'epubjs'
import {
  uploadFile,
  downloadFile,
  getCoverPublicUrl,
  deleteFiles,
  type GetToken,
} from './storageService'

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
  getStorageToken: GetToken,
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

  try {
    await uploadFile(getStorageToken, 'books', filePath, file, 'application/epub+zip')
  } catch (uploadErr) {
    // Clean up the pending DB row so the user can retry cleanly
    await supabase.from('books').delete().eq('id', bookId)
    throw uploadErr
  }

  let coverUrl: string | null = null
  if (coverBlob) {
    const coverPath = `${userId}/${bookId}.jpg`
    try {
      await uploadFile(getStorageToken, 'covers', coverPath, coverBlob, 'image/jpeg')
      coverUrl = getCoverPublicUrl(coverPath)
    } catch {
      // Cover upload failure is non-fatal — book still accessible without cover
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('books')
    .update({ file_path: filePath, cover_url: coverUrl })
    .eq('id', bookId)
    .select()
    .single()
  if (updateError) {
    // Clean up storage and pending row so the user can retry cleanly
    await Promise.allSettled([
      deleteFiles(getStorageToken, 'books', [filePath]),
      coverUrl ? deleteFiles(getStorageToken, 'covers', [`${userId}/${bookId}.jpg`]) : Promise.resolve(),
      supabase.from('books').delete().eq('id', bookId),
    ])
    throw updateError
  }

  return toBook(updated)
}

export async function getBookFile(getStorageToken: GetToken, book: Book): Promise<File> {
  const blob = await downloadFile(getStorageToken, 'books', book.filePath)
  return new File([blob], `${book.title}.epub`, { type: 'application/epub+zip' })
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

export async function deleteBook(
  supabase: SupabaseClient,
  getStorageToken: GetToken,
  book: Book,
): Promise<void> {
  // Delete storage files in parallel
  await Promise.all([
    deleteFiles(getStorageToken, 'books', [book.filePath]),
    book.coverUrl
      ? deleteFiles(getStorageToken, 'covers', [`${book.userId}/${book.id}.jpg`])
      : Promise.resolve(),
  ])

  // Delete related rows that may not have ON DELETE CASCADE (annotations, reading_progress, bookmarks).
  // flashcards, scratchpad, and quiz_sessions have CASCADE on book_id so they clean up automatically,
  // but deleting them explicitly here is safe and consistent.
  const relatedTables = [
    'annotations',
    'reading_progress',
    'bookmarks',
    'flashcards',
    'scratchpad',
    'quiz_sessions',
  ]
  await Promise.all(
    relatedTables.map((table) =>
      supabase.from(table).delete().eq('book_id', book.id),
    ),
  )

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
