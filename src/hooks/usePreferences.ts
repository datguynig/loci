import { useState, useEffect, useCallback } from 'react'
import type { FontSize, Theme, LayoutMode } from './useEpub'

export type ColorScheme = 'library' | 'slate'

export interface Preferences {
  theme: Theme
  colorScheme: ColorScheme
  fontSize: FontSize
  layoutMode: LayoutMode
  highlightEnabled: boolean
  autoscrollEnabled: boolean
}

const STORAGE_KEY = 'loci_preferences'

const DEFAULTS: Preferences = {
  theme: 'light',
  colorScheme: 'library',
  fontSize: 'md',
  layoutMode: 'scroll',
  highlightEnabled: true,
  autoscrollEnabled: true,
}

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function savePreferences(prefs: Preferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // ignore storage errors (private browsing, quota exceeded)
  }
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences)

  useEffect(() => {
    savePreferences(prefs)
  }, [prefs])

  const set = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }))
  }, [])

  return { prefs, set }
}
