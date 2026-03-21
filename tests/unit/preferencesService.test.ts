import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncPreferencesFromSupabase, pushPreferencesToSupabase } from '../../src/services/preferencesService'
import { loadPreferences, savePreferences } from '../../src/hooks/usePreferences'
import type { Preferences } from '../../src/hooks/usePreferences'

// ── Mock builder ──────────────────────────────────────────────────────

function makeChain(result: { data: unknown; error: unknown }) {
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnValue(p),
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

const BASE_PREFS: Preferences = {
  theme: 'light',
  fontSize: 'md',
  layoutMode: 'scroll',
  highlightEnabled: true,
  autoscrollEnabled: true,
}

beforeEach(() => {
  localStorage.clear()
})

// ── syncPreferencesFromSupabase ───────────────────────────────────────

describe('syncPreferencesFromSupabase', () => {
  it('does nothing when Supabase returns an error', async () => {
    savePreferences({ ...BASE_PREFS, theme: 'dark' })
    const supabase = makeSupabase({ data: null, error: { message: 'No row' } })
    await syncPreferencesFromSupabase(supabase as never)
    expect(loadPreferences().theme).toBe('dark') // unchanged
  })

  it('does nothing when Supabase returns null data', async () => {
    savePreferences({ ...BASE_PREFS, theme: 'dark' })
    const supabase = makeSupabase({ data: null, error: null })
    await syncPreferencesFromSupabase(supabase as never)
    expect(loadPreferences().theme).toBe('dark')
  })

  it('writes Supabase values to localStorage', async () => {
    const row = {
      theme: 'dark',
      font_size: 'xl',
      layout_mode: 'spread',
      highlight_enabled: false,
      autoscroll_enabled: false,
    }
    const supabase = makeSupabase({ data: row, error: null })
    await syncPreferencesFromSupabase(supabase as never)

    const prefs = loadPreferences()
    expect(prefs.theme).toBe('dark')
    expect(prefs.fontSize).toBe('xl')
    expect(prefs.layoutMode).toBe('spread')
    expect(prefs.highlightEnabled).toBe(false)
    expect(prefs.autoscrollEnabled).toBe(false)
  })

  it('falls back to local value for missing Supabase fields', async () => {
    savePreferences({ ...BASE_PREFS, theme: 'dark', fontSize: 'lg' })
    const supabase = makeSupabase({ data: { theme: null, font_size: null, layout_mode: null, highlight_enabled: null, autoscroll_enabled: null }, error: null })
    await syncPreferencesFromSupabase(supabase as never)

    const prefs = loadPreferences()
    expect(prefs.theme).toBe('dark')  // preserved from localStorage
    expect(prefs.fontSize).toBe('lg')
  })
})

// ── pushPreferencesToSupabase ─────────────────────────────────────────

describe('pushPreferencesToSupabase', () => {
  it('upserts to the preferences table', async () => {
    const supabase = makeSupabase()
    await pushPreferencesToSupabase(supabase as never, 'user-1', BASE_PREFS)
    expect(supabase.from).toHaveBeenCalledWith('preferences')
    expect((supabase._chain.upsert as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
  })

  it('maps Preferences keys to DB column names', async () => {
    const supabase = makeSupabase()
    const prefs: Preferences = {
      theme: 'dark',
      fontSize: 'xl',
      layoutMode: 'spread',
      highlightEnabled: false,
      autoscrollEnabled: false,
    }
    await pushPreferencesToSupabase(supabase as never, 'user-42', prefs)

    const upsertArg = (supabase._chain.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(upsertArg.user_id).toBe('user-42')
    expect(upsertArg.theme).toBe('dark')
    expect(upsertArg.font_size).toBe('xl')
    expect(upsertArg.layout_mode).toBe('spread')
    expect(upsertArg.highlight_enabled).toBe(false)
    expect(upsertArg.autoscroll_enabled).toBe(false)
  })

  it('upserts with conflict target user_id', async () => {
    const supabase = makeSupabase()
    await pushPreferencesToSupabase(supabase as never, 'u', BASE_PREFS)
    const [, options] = (supabase._chain.upsert as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(options.onConflict).toBe('user_id')
  })

  it('includes an updated_at timestamp', async () => {
    const before = Date.now()
    const supabase = makeSupabase()
    await pushPreferencesToSupabase(supabase as never, 'u', BASE_PREFS)
    const upsertArg = (supabase._chain.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const ts = new Date(upsertArg.updated_at).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(Date.now())
  })
})
