import { describe, it, expect, vi } from 'vitest'
import { loadProgress, saveProgress } from '../../src/services/progressService'

// ── Mock builder ──────────────────────────────────────────────────────

function makeChain(result: { data: unknown; error: unknown }) {
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnValue(p),
    maybeSingle: vi.fn().mockReturnValue(p),
    upsert: vi.fn().mockReturnValue(p),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
}

function makeSupabase(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const chain = makeChain(result)
  return { from: vi.fn().mockReturnValue(chain), _chain: chain }
}

// ── loadProgress ──────────────────────────────────────────────────────

describe('loadProgress', () => {
  it('returns null when Supabase returns an error', async () => {
    const supabase = makeSupabase({ data: null, error: { message: 'Not found' } })
    const result = await loadProgress(supabase as never, 'book-1')
    expect(result).toBeNull()
  })

  it('returns null when data is null', async () => {
    const supabase = makeSupabase({ data: null, error: null })
    const result = await loadProgress(supabase as never, 'book-1')
    expect(result).toBeNull()
  })

  it('maps Supabase row fields to ReadingProgress', async () => {
    const row = {
      user_id: 'user-abc',
      book_id: 'book-xyz',
      spine_href: 'chapter3.xhtml',
      scroll_fraction: 0.42,
      tts_sentence_index: 7,
      updated_at: '2026-03-01T12:00:00.000Z',
    }
    const supabase = makeSupabase({ data: row, error: null })
    const progress = await loadProgress(supabase as never, 'book-xyz')

    expect(progress).not.toBeNull()
    expect(progress!.userId).toBe('user-abc')
    expect(progress!.bookId).toBe('book-xyz')
    expect(progress!.spineHref).toBe('chapter3.xhtml')
    expect(progress!.scrollFraction).toBe(0.42)
    expect(progress!.ttsSentenceIndex).toBe(7)
  })

  it('defaults scrollFraction to 0 when null in DB', async () => {
    const row = {
      user_id: 'u',
      book_id: 'b',
      spine_href: 'ch1.xhtml',
      scroll_fraction: null,
      tts_sentence_index: null,
      updated_at: '2026-01-01T00:00:00.000Z',
    }
    const supabase = makeSupabase({ data: row, error: null })
    const progress = await loadProgress(supabase as never, 'b')
    expect(progress!.scrollFraction).toBe(0)
    expect(progress!.ttsSentenceIndex).toBe(0)
  })

  it('queries the reading_progress table for the correct book_id', async () => {
    const supabase = makeSupabase({ data: null, error: null })
    await loadProgress(supabase as never, 'my-book')
    expect(supabase.from).toHaveBeenCalledWith('reading_progress')
    expect((supabase._chain.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('book_id', 'my-book')
  })
})

// ── saveProgress ──────────────────────────────────────────────────────

describe('saveProgress', () => {
  it('upserts to the reading_progress table with correct fields', async () => {
    const supabase = makeSupabase()
    await saveProgress(supabase as never, 'user-1', 'book-2', 'ch5.xhtml', 0.75, 3)

    expect(supabase.from).toHaveBeenCalledWith('reading_progress')
    const upsertArg = (supabase._chain.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(upsertArg.user_id).toBe('user-1')
    expect(upsertArg.book_id).toBe('book-2')
    expect(upsertArg.spine_href).toBe('ch5.xhtml')
    expect(upsertArg.scroll_fraction).toBe(0.75)
    expect(upsertArg.tts_sentence_index).toBe(3)
  })

  it('upserts with conflict target user_id,book_id', async () => {
    const supabase = makeSupabase()
    await saveProgress(supabase as never, 'u', 'b', 'ch1.xhtml', 0, 0)
    const [, options] = (supabase._chain.upsert as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(options.onConflict).toBe('user_id,book_id')
  })

  it('includes an updated_at timestamp', async () => {
    const before = Date.now()
    const supabase = makeSupabase()
    await saveProgress(supabase as never, 'u', 'b', 'ch1.xhtml', 0, 0)
    const upsertArg = (supabase._chain.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const ts = new Date(upsertArg.updated_at).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(Date.now())
  })
})
