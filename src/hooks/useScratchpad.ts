import { useState, useCallback, useEffect, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getScratchpad, saveScratchpad } from '../services/scratchpadService'

export function useScratchpad(
  supabase: SupabaseClient,
  userId: string,
  bookId: string,
) {
  const [content, setContentState] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Keep a ref to the latest content so the debounce closure always reads current value
  const contentRef = useRef<string>(content)

  useEffect(() => {
    if (!bookId) return
    getScratchpad(supabase, bookId)
      .then((loaded) => {
        setContentState(loaded)
        contentRef.current = loaded
      })
      .catch(() => {})
  }, [supabase, bookId])

  const setContent = useCallback(
    (s: string) => {
      setContentState(s)
      contentRef.current = s

      // Reset debounce timer
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null
        setSaving(true)
        saveScratchpad(supabase, userId, bookId, contentRef.current)
          .finally(() => setSaving(false))
      }, 1000)
    },
    [supabase, userId, bookId],
  )

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return { content, setContent, saving }
}
