import { useCallback, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import Landing from './components/Landing'
import Reader from './components/Reader'
import { useState } from 'react'
import { usePreferences } from './hooks/usePreferences'

type View = 'landing' | 'reader'

export default function App() {
  const [view, setView] = useState<View>('landing')
  const [epubFile, setEpubFile] = useState<File | null>(null)
  const { prefs, set } = usePreferences()

  // Sync data-theme attribute whenever theme changes (including on mount)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', prefs.theme)
  }, [prefs.theme])

  const handleFileSelected = useCallback((file: File) => {
    setEpubFile(file)
    setView('reader')
  }, [])

  const handleThemeToggle = useCallback(() => {
    set('theme', prefs.theme === 'light' ? 'dark' : 'light')
  }, [prefs.theme, set])

  return (
    <AnimatePresence mode="wait">
      {view === 'landing' ? (
        <Landing key="landing" onFileSelected={handleFileSelected} />
      ) : (
        <Reader
          key="reader"
          file={epubFile!}
          theme={prefs.theme}
          fontSize={prefs.fontSize}
          layoutMode={prefs.layoutMode}
          highlightEnabled={prefs.highlightEnabled}
          autoscrollEnabled={prefs.autoscrollEnabled}
          onThemeToggle={handleThemeToggle}
          onFontSizeChange={(s) => set('fontSize', s)}
          onLayoutModeChange={(m) => set('layoutMode', m)}
          onHighlightChange={(v) => set('highlightEnabled', v)}
          onAutoscrollChange={(v) => set('autoscrollEnabled', v)}
        />
      )}
    </AnimatePresence>
  )
}
