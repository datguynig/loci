import { useEffect, useRef, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useUser } from '@clerk/clerk-react'
import { loadProgress, saveProgress } from '../services/progressService'

const AUTOSAVE_INTERVAL = 30_000

export function useReadingProgress(
  supabase: SupabaseClient | null,
  bookId: string | null,
  currentHref: string,
  progress: number,
  onRestoreHref: (href: string) => void,
  preferredHref?: string,
) {
  const { user } = useUser()
  const restoredRef = useRef(false)
  const onRestoreHrefRef = useRef(onRestoreHref)
  onRestoreHrefRef.current = onRestoreHref

  const sessionStartRef = useRef<number>(0)
  const savedSecondsRef = useRef<number>(0)

  const currentHrefRef = useRef(currentHref)
  currentHrefRef.current = currentHref
  const progressRef = useRef(progress)
  progressRef.current = progress

  // Restore saved position on mount and init session timer
  useEffect(() => {
    if (!supabase || !bookId || !user || restoredRef.current) return
    restoredRef.current = true
    sessionStartRef.current = Date.now()
    loadProgress(supabase, bookId).then((saved) => {
      const navTarget = preferredHref || saved?.spineHref
      if (navTarget) onRestoreHrefRef.current(navTarget)
      savedSecondsRef.current = saved?.totalReadingSeconds ?? 0
    })

    return () => {
      // Final save on unmount with accumulated reading time
      if (!supabase || !bookId || !user || !currentHrefRef.current) return
      const elapsed = sessionStartRef.current
        ? Math.floor((Date.now() - sessionStartRef.current) / 1000)
        : 0
      saveProgress(supabase, user.id, bookId, currentHrefRef.current, progressRef.current, 0, savedSecondsRef.current + elapsed).catch(console.error)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, bookId, user])

  const save = useCallback(() => {
    if (!supabase || !bookId || !user || !currentHref) return
    const elapsed = sessionStartRef.current
      ? Math.floor((Date.now() - sessionStartRef.current) / 1000)
      : 0
    saveProgress(supabase, user.id, bookId, currentHref, progress, 0, savedSecondsRef.current + elapsed)
  }, [supabase, bookId, user, currentHref, progress])

  // Autosave every 30s
  useEffect(() => {
    const id = setInterval(save, AUTOSAVE_INTERVAL)
    return () => clearInterval(id)
  }, [save])

  // Save on chapter change
  const prevHrefRef = useRef('')
  useEffect(() => {
    if (restoredRef.current && currentHref && currentHref !== prevHrefRef.current) {
      prevHrefRef.current = currentHref
      save()
    }
  }, [currentHref, save])

  return { save }
}
