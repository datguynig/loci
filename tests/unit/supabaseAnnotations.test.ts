import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getAnnotationsFromSupabase,
  saveAnnotationToSupabase,
  deleteAnnotationFromSupabase,
  type Annotation,
} from '../../src/services/annotationService'

// ── Mock builder factory ──────────────────────────────────────────────
// Returns a chainable object that is also a Promise resolving to `result`.

function makeChain(result: { data: unknown; error: unknown }) {
  const p = Promise.resolve(result)
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnValue(p),
    // make chain itself awaitable (for `await supabase.from(...).delete().eq(...)`)
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
  return chain
}

function makeSupabase(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const chain = makeChain(result)
  return { from: vi.fn().mockReturnValue(chain), _chain: chain }
}

function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: 'ann-1',
    bookId: 'book-uuid-1',
    href: 'chapter1.xhtml',
    quote: 'Some quoted text',
    note: 'My note',
    createdAt: 1_000_000,
    ...overrides,
  }
}

// ── getAnnotationsFromSupabase ────────────────────────────────────────

describe('getAnnotationsFromSupabase', () => {
  it('returns empty array when Supabase returns null data', async () => {
    const supabase = makeSupabase({ data: null, error: null })
    const result = await getAnnotationsFromSupabase(supabase as never, 'book-1')
    expect(result).toEqual([])
  })

  it('returns empty array when Supabase returns an error', async () => {
    const supabase = makeSupabase({ data: null, error: { message: 'Not found' } })
    const result = await getAnnotationsFromSupabase(supabase as never, 'book-1')
    expect(result).toEqual([])
  })

  it('maps Supabase row format to Annotation interface', async () => {
    const row = {
      id: 'ann-uuid',
      book_id: 'book-uuid',
      spine_href: 'ch2.xhtml',
      quote: 'A passage',
      note: 'Interesting',
      created_at: '2026-01-15T10:00:00.000Z',
    }
    const supabase = makeSupabase({ data: [row], error: null })
    const [annotation] = await getAnnotationsFromSupabase(supabase as never, 'book-uuid')

    expect(annotation.id).toBe('ann-uuid')
    expect(annotation.bookId).toBe('book-uuid')
    expect(annotation.href).toBe('ch2.xhtml')
    expect(annotation.quote).toBe('A passage')
    expect(annotation.note).toBe('Interesting')
    expect(annotation.createdAt).toBe(new Date('2026-01-15T10:00:00.000Z').getTime())
  })

  it('defaults note to empty string when null in DB', async () => {
    const row = {
      id: 'x',
      book_id: 'b',
      spine_href: 'ch1.xhtml',
      quote: 'q',
      note: null,
      created_at: '2026-01-01T00:00:00.000Z',
    }
    const supabase = makeSupabase({ data: [row], error: null })
    const [annotation] = await getAnnotationsFromSupabase(supabase as never, 'b')
    expect(annotation.note).toBe('')
  })

  it('maps multiple rows preserving order', async () => {
    const rows = [
      { id: '1', book_id: 'b', spine_href: 'ch1.xhtml', quote: 'q1', note: '', created_at: '2026-01-01T00:00:00.000Z' },
      { id: '2', book_id: 'b', spine_href: 'ch2.xhtml', quote: 'q2', note: 'n', created_at: '2026-01-02T00:00:00.000Z' },
    ]
    const supabase = makeSupabase({ data: rows, error: null })
    const result = await getAnnotationsFromSupabase(supabase as never, 'b')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('1')
    expect(result[1].id).toBe('2')
  })

  it('queries the annotations table for the correct book_id', async () => {
    const supabase = makeSupabase({ data: [], error: null })
    await getAnnotationsFromSupabase(supabase as never, 'my-book-id')
    expect(supabase.from).toHaveBeenCalledWith('annotations')
    expect((supabase._chain.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('book_id', 'my-book-id')
  })
})

// ── saveAnnotationToSupabase ──────────────────────────────────────────

describe('saveAnnotationToSupabase', () => {
  it('calls upsert with correctly mapped fields', async () => {
    const supabase = makeSupabase()
    const ann = makeAnnotation({ id: 'ann-1', href: 'ch3.xhtml', quote: 'Q', note: 'N' })

    await saveAnnotationToSupabase(supabase as never, 'user-123', 'book-456', ann)

    const upsertArg = (supabase._chain.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(upsertArg.id).toBe('ann-1')
    expect(upsertArg.user_id).toBe('user-123')
    expect(upsertArg.book_id).toBe('book-456')
    expect(upsertArg.spine_href).toBe('ch3.xhtml')
    expect(upsertArg.quote).toBe('Q')
    expect(upsertArg.note).toBe('N')
    expect(upsertArg.type).toBe('note')
  })

  it('targets the annotations table', async () => {
    const supabase = makeSupabase()
    await saveAnnotationToSupabase(supabase as never, 'u', 'b', makeAnnotation())
    expect(supabase.from).toHaveBeenCalledWith('annotations')
  })
})

// ── deleteAnnotationFromSupabase ──────────────────────────────────────

describe('deleteAnnotationFromSupabase', () => {
  it('calls delete on the annotations table with the correct id', async () => {
    const supabase = makeSupabase()
    await deleteAnnotationFromSupabase(supabase as never, 'ann-to-delete')

    expect(supabase.from).toHaveBeenCalledWith('annotations')
    expect((supabase._chain.delete as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
    expect((supabase._chain.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('id', 'ann-to-delete')
  })
})
