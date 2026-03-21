import { useState, useCallback, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import Landing from './components/Landing'
import Reader from './components/Reader'
import type { FontSize, Theme, LayoutMode } from './hooks/useEpub'

type View = 'landing' | 'reader'

function getInitialTheme(): Theme {
  return 'light'
}

export default function App() {
  const [view, setView] = useState<View>('landing')
  const [epubFile, setEpubFile] = useState<File | null>(null)
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [fontSize, setFontSize] = useState<FontSize>('md')
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('scroll')

  // Sync data-theme attribute whenever theme changes (including on mount)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const handleFileSelected = useCallback((file: File) => {
    setEpubFile(file)
    setView('reader')
  }, [])

  const handleThemeToggle = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  }, [])

  return (
    <AnimatePresence mode="wait">
      {view === 'landing' ? (
        <Landing key="landing" onFileSelected={handleFileSelected} />
      ) : (
        <Reader
          key="reader"
          file={epubFile!}
          theme={theme}
          fontSize={fontSize}
          layoutMode={layoutMode}
          onThemeToggle={handleThemeToggle}
          onFontSizeChange={setFontSize}
          onLayoutModeChange={setLayoutMode}
        />
      )}
    </AnimatePresence>
  )
}
