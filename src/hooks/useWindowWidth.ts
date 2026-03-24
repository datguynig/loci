import { useState, useEffect } from 'react'

/**
 * Returns the current window inner width, updating on resize.
 * Shared hook — used by Library, BookDetailModal, AudioBar, Landing, etc.
 */
export function useWindowWidth(): number {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return width
}
