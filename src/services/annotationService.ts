import type { SupabaseClient } from '@supabase/supabase-js'

export interface Annotation {
  id: string
  bookId: string
  href: string       // spine item href — chapter anchor
  quote: string      // verbatim selected text (empty string for chapter_note type)
  note: string       // user's freeform note (may be empty)
  type: 'note' | 'chapter_note'
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

// ── Supabase write-through ────────────────────────────────────────────

export async function saveAnnotationToSupabase(
  supabase: SupabaseClient,
  userId: string,
  bookId: string,
  annotation: Annotation,
): Promise<void> {
  await supabase.from('annotations').upsert(
    {
      id: annotation.id,
      user_id: userId,
      book_id: bookId,
      spine_href: annotation.href,
      quote: annotation.quote,
      note: annotation.note,
      type: annotation.type ?? 'note',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )
}

export async function deleteAnnotationFromSupabase(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  await supabase.from('annotations').delete().eq('id', id)
}

export async function getAnnotationsFromSupabase(
  supabase: SupabaseClient,
  bookId: string,
): Promise<Annotation[]> {
  const { data, error } = await supabase
    .from('annotations')
    .select('*')
    .eq('book_id', bookId)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data.map((row) => ({
    id: row.id,
    bookId: row.book_id,
    href: row.spine_href,
    quote: row.quote,
    note: row.note ?? '',
    type: (row.type ?? 'note') as Annotation['type'],
    createdAt: new Date(row.created_at).getTime(),
  }))
}
