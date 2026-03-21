import { useState, useCallback, useEffect } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Bookmark } from '../services/bookmarkService'
import { getBookmarks, saveBookmark, deleteBookmark } from '../services/bookmarkService'

// Local-only fallback when Supabase isn't configured
const localStore = new Map<string, Bookmark[]>()

export function useBookmarks(
  supabase: SupabaseClient | null,
  userId: string | null,
  bookId: string | null,
) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])

  useEffect(() => {
    if (!bookId) return
    if (supabase && userId) {
      getBookmarks(supabase, bookId).then(setBookmarks).catch(() => {})
    } else {
      setBookmarks(localStore.get(bookId) ?? [])
    }
  }, [supabase, userId, bookId])

  const addBookmark = useCallback(
    (href: string, label: string) => {
      const tempId = crypto.randomUUID()
      const optimistic: Bookmark = { id: tempId, bookId: bookId ?? '', href, label, createdAt: Date.now() }
      setBookmarks((prev) => [optimistic, ...prev])

      if (supabase && userId && bookId) {
        saveBookmark(supabase, userId, bookId, href, label)
          .then((saved) => setBookmarks((prev) => prev.map((b) => (b.id === tempId ? saved : b))))
          .catch(() => {
            // Keep optimistic entry on failure
          })
      } else if (bookId) {
        const updated = [optimistic, ...(localStore.get(bookId) ?? [])]
        localStore.set(bookId, updated)
      }
    },
    [supabase, userId, bookId],
  )

  const removeBookmark = useCallback(
    (id: string) => {
      setBookmarks((prev) => prev.filter((b) => b.id !== id))
      if (supabase) {
        deleteBookmark(supabase, id).catch(console.error)
      } else if (bookId) {
        localStore.set(bookId, (localStore.get(bookId) ?? []).filter((b) => b.id !== id))
      }
    },
    [supabase, bookId],
  )

  return { bookmarks, addBookmark, removeBookmark }
}
