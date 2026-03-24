import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useUser } from '@clerk/clerk-react'
import { listBooks, uploadBook, type Book } from '../services/bookService'
import type { GetToken } from '../services/storageService'

export type UploadState = 'idle' | 'uploading' | 'error'

export function useLibrary(supabase: SupabaseClient, getStorageToken: GetToken) {
  const { user } = useUser()
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listBooks(supabase)
      setBooks(list)
    } catch (err) {
      console.error('Failed to load books', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    if (user) refresh()
  }, [user, refresh])

  const upload = useCallback(
    async (file: File): Promise<Book | null> => {
      if (!user) return null
      setUploadState('uploading')
      setUploadError(null)
      try {
        const book = await uploadBook(supabase, getStorageToken, user.id, file)
        setBooks((prev) => [book, ...prev])
        setUploadState('idle')
        return book
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : (err as { message?: string })?.message ?? 'Upload failed'
        console.error('[useLibrary] upload error:', err)
        setUploadError(msg)
        setUploadState('error')
        return null
      }
    },
    [supabase, getStorageToken, user],
  )

  return { books, loading, uploadState, uploadError, upload, refresh }
}
