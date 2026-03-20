import { useState, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import Landing from './components/Landing'
import Reader from './components/Reader'
import type { FontSize, Theme } from './hooks/useEpub'

type View = 'landing' | 'reader'

export default function App() {
  const [view, setView] = useState<View>('landing')
  const [epubFile, setEpubFile] = useState<File | null>(null)
  const [theme, setTheme] = useState<Theme>('light')
  const [fontSize, setFontSize] = useState<FontSize>('md')

  const handleFileSelected = useCallback((file: File) => {
    setEpubFile(file)
    setView('reader')
  }, [])

  const handleThemeToggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'light' ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', next)
      return next
    })
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
          onThemeToggle={handleThemeToggle}
          onFontSizeChange={setFontSize}
        />
      )}
    </AnimatePresence>
  )
}
