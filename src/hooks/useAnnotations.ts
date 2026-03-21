import { useState, useCallback, useEffect } from 'react'
import {
  type Annotation,
  getAnnotations,
  saveAnnotation,
  deleteAnnotation,
  getAnnotationsForHref,
} from '../services/annotationService'

export type { Annotation }

interface UseAnnotationsReturn {
  annotations: Annotation[]
  addAnnotation: (href: string, quote: string, note: string, type?: Annotation['type']) => Annotation
  removeAnnotation: (id: string) => void
  annotationsForHref: (href: string) => Annotation[]
}

export function useAnnotations(bookId: string | null): UseAnnotationsReturn {
  const [annotations, setAnnotations] = useState<Annotation[]>([])

  // Load from localStorage when bookId is available
  useEffect(() => {
    setAnnotations(bookId ? getAnnotations(bookId) : [])
  }, [bookId])

  const addAnnotation = useCallback(
    (href: string, quote: string, note: string, type: Annotation['type'] = 'note'): Annotation => {
      const annotation: Annotation = {
        id: crypto.randomUUID(),
        bookId: bookId ?? '',
        href,
        quote,
        note,
        type,
        createdAt: Date.now(),
      }
      saveAnnotation(annotation)
      setAnnotations((prev) => [...prev, annotation])
      return annotation
    },
    [bookId],
  )

  const removeAnnotation = useCallback(
    (id: string) => {
      if (!bookId) return
      deleteAnnotation(id, bookId)
      setAnnotations((prev) => prev.filter((a) => a.id !== id))
    },
    [bookId],
  )

  const annotationsForHref = useCallback(
    (href: string): Annotation[] => {
      if (!bookId) return []
      return getAnnotationsForHref(bookId, href)
    },
    [bookId],
  )

  return { annotations, addAnnotation, removeAnnotation, annotationsForHref }
}
