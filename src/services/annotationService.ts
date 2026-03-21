export interface Annotation {
  id: string
  bookId: string
  href: string       // spine item href — chapter anchor
  quote: string      // verbatim selected text
  note: string       // user's freeform note (may be empty)
  createdAt: number  // Date.now()
}

function storageKey(bookId: string): string {
  return `loci_annotations_${bookId}`
}

export function getAnnotations(bookId: string): Annotation[] {
  try {
    const raw = localStorage.getItem(storageKey(bookId))
    return raw ? (JSON.parse(raw) as Annotation[]) : []
  } catch {
    return []
  }
}

export function saveAnnotation(annotation: Annotation): void {
  const all = getAnnotations(annotation.bookId)
  const existing = all.findIndex((a) => a.id === annotation.id)
  if (existing >= 0) {
    all[existing] = annotation
  } else {
    all.push(annotation)
  }
  localStorage.setItem(storageKey(annotation.bookId), JSON.stringify(all))
}

export function deleteAnnotation(id: string, bookId: string): void {
  const all = getAnnotations(bookId).filter((a) => a.id !== id)
  localStorage.setItem(storageKey(bookId), JSON.stringify(all))
}

export function getAnnotationsForHref(bookId: string, href: string): Annotation[] {
  const base = href.split('#')[0]
  return getAnnotations(bookId).filter((a) => a.href.split('#')[0] === base)
}
