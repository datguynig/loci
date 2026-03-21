import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { loadPreferences, savePreferences, usePreferences } from '../../src/hooks/usePreferences'

beforeEach(() => {
  localStorage.clear()
})

describe('loadPreferences', () => {
  it('returns defaults when nothing is stored', () => {
    const prefs = loadPreferences()
    expect(prefs.theme).toBe('light')
    expect(prefs.fontSize).toBe('md')
    expect(prefs.layoutMode).toBe('scroll')
    expect(prefs.highlightEnabled).toBe(true)
    expect(prefs.autoscrollEnabled).toBe(true)
  })

  it('returns stored values when preferences have been saved', () => {
    localStorage.setItem(
      'loci_preferences',
      JSON.stringify({ theme: 'dark', fontSize: 'xl', layoutMode: 'spread', highlightEnabled: false, autoscrollEnabled: false }),
    )
    const prefs = loadPreferences()
    expect(prefs.theme).toBe('dark')
    expect(prefs.fontSize).toBe('xl')
    expect(prefs.highlightEnabled).toBe(false)
    expect(prefs.autoscrollEnabled).toBe(false)
  })

  it('merges stored values with defaults for missing keys', () => {
    localStorage.setItem('loci_preferences', JSON.stringify({ theme: 'dark' }))
    const prefs = loadPreferences()
    expect(prefs.theme).toBe('dark')
    expect(prefs.fontSize).toBe('md') // default
  })

  it('returns defaults when stored value is invalid JSON', () => {
    localStorage.setItem('loci_preferences', 'not-valid-json')
    const prefs = loadPreferences()
    expect(prefs.theme).toBe('light')
  })
})

describe('savePreferences', () => {
  it('persists preferences to localStorage', () => {
    savePreferences({ theme: 'dark', fontSize: 'lg', layoutMode: 'scroll', highlightEnabled: true, autoscrollEnabled: false })
    const stored = JSON.parse(localStorage.getItem('loci_preferences')!)
    expect(stored.theme).toBe('dark')
    expect(stored.fontSize).toBe('lg')
    expect(stored.autoscrollEnabled).toBe(false)
  })

  it('overwrites previously saved preferences', () => {
    savePreferences({ theme: 'light', fontSize: 'sm', layoutMode: 'scroll', highlightEnabled: true, autoscrollEnabled: true })
    savePreferences({ theme: 'dark', fontSize: 'xl', layoutMode: 'spread', highlightEnabled: false, autoscrollEnabled: false })
    const stored = JSON.parse(localStorage.getItem('loci_preferences')!)
    expect(stored.theme).toBe('dark')
    expect(stored.fontSize).toBe('xl')
  })
})

describe('usePreferences hook', () => {
  it('initialises with defaults when localStorage is empty', () => {
    const { result } = renderHook(() => usePreferences())
    expect(result.current.prefs.theme).toBe('light')
    expect(result.current.prefs.fontSize).toBe('md')
    expect(result.current.prefs.highlightEnabled).toBe(true)
    expect(result.current.prefs.autoscrollEnabled).toBe(true)
  })

  it('initialises from stored preferences', () => {
    localStorage.setItem('loci_preferences', JSON.stringify({ theme: 'dark', fontSize: 'xl', layoutMode: 'scroll', highlightEnabled: false, autoscrollEnabled: true }))
    const { result } = renderHook(() => usePreferences())
    expect(result.current.prefs.theme).toBe('dark')
    expect(result.current.prefs.fontSize).toBe('xl')
    expect(result.current.prefs.highlightEnabled).toBe(false)
  })

  it('set() updates a single preference key', () => {
    const { result } = renderHook(() => usePreferences())
    act(() => { result.current.set('theme', 'dark') })
    expect(result.current.prefs.theme).toBe('dark')
    // other keys remain unchanged
    expect(result.current.prefs.fontSize).toBe('md')
  })

  it('persists to localStorage after set()', () => {
    const { result } = renderHook(() => usePreferences())
    act(() => { result.current.set('autoscrollEnabled', false) })
    const stored = JSON.parse(localStorage.getItem('loci_preferences')!)
    expect(stored.autoscrollEnabled).toBe(false)
  })

  it('set() can update all preference keys independently', () => {
    const { result } = renderHook(() => usePreferences())
    act(() => { result.current.set('fontSize', 'xl') })
    act(() => { result.current.set('layoutMode', 'spread') })
    act(() => { result.current.set('highlightEnabled', false) })
    expect(result.current.prefs.fontSize).toBe('xl')
    expect(result.current.prefs.layoutMode).toBe('spread')
    expect(result.current.prefs.highlightEnabled).toBe(false)
  })
})
