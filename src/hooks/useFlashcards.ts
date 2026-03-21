import { useState, useCallback, useEffect } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Flashcard } from '../services/flashcardService'
import {
  getFlashcards,
  saveFlashcards,
  deleteFlashcard as deleteFlashcardService,
  markReviewed as markReviewedService,
} from '../services/flashcardService'

export type { Flashcard }

export function useFlashcards(
  supabase: SupabaseClient,
  userId: string,
  bookId: string,
) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])

  useEffect(() => {
    if (!bookId) return
    getFlashcards(supabase, bookId).then(setFlashcards).catch(() => {})
  }, [supabase, userId, bookId])

  const addFlashcards = useCallback(
    async (chapterHref: string, cards: { front: string; back: string }[]): Promise<void> => {
      // Create optimistic placeholders with temp IDs
      const tempIds = cards.map(() => crypto.randomUUID())
      const now = Date.now()
      const placeholders: Flashcard[] = cards.map((card, i) => ({
        id: tempIds[i],
        bookId,
        chapterHref,
        front: card.front,
        back: card.back,
        createdAt: now,
        lastReviewedAt: null,
        reviewCount: 0,
      }))

      setFlashcards((prev) => [...prev, ...placeholders])

      try {
        const saved = await saveFlashcards(supabase, userId, bookId, chapterHref, cards)
        // Replace placeholders with real DB records
        const tempIdSet = new Set<string>(tempIds)
        setFlashcards((prev) => {
          const withoutPlaceholders = prev.filter((f) => !tempIdSet.has(f.id))
          return [...withoutPlaceholders, ...saved]
        })
      } catch {
        // Keep optimistic entries on failure
      }
    },
    [supabase, userId, bookId],
  )

  const deleteFlashcard = useCallback(
    async (id: string): Promise<void> => {
      setFlashcards((prev) => prev.filter((f) => f.id !== id))
      try {
        await deleteFlashcardService(supabase, id)
      } catch {
        // Optimistic removal stands on failure
      }
    },
    [supabase],
  )

  const markReviewed = useCallback(
    async (id: string): Promise<void> => {
      const now = Date.now()
      setFlashcards((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, lastReviewedAt: now, reviewCount: f.reviewCount + 1 }
            : f,
        ),
      )
      try {
        await markReviewedService(supabase, id)
      } catch {
        // Keep optimistic update on failure
      }
    },
    [supabase],
  )

  return { flashcards, addFlashcards, deleteFlashcard, markReviewed }
}
