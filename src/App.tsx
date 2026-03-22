import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { SignedIn, SignedOut, SignIn, useAuth, useUser } from '@clerk/clerk-react'
import Library from './components/Library'
import Reader from './components/Reader'
import { usePreferences } from './hooks/usePreferences'
import { createSupabaseClient } from './services/supabaseClient'
import { syncPreferencesFromSupabase, pushPreferencesToSupabase } from './services/preferencesService'
import type { FontSize, LayoutMode } from './hooks/useEpub'

interface OpenBook {
  file: File
  bookId: string | null
  studyOptions?: { panel?: 'scratchpad'; chapterHref?: string }
}

function AppContent() {
  const [openBook, setOpenBook] = useState<OpenBook | null>(null)
  const { prefs, set } = usePreferences()
  const { getToken } = useAuth()
  const { user } = useUser()
  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken

  // Create the Supabase client once — use a ref for getToken so the client
  // is never recreated (prevents multiple GoTrueClient instances).
  const supabase = useMemo(
    () => createSupabaseClient(() => getTokenRef.current({ template: 'supabase' })),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Sync preferences from Supabase on sign-in (once per session)
  const syncedRef = useRef(false)
  useEffect(() => {
    if (!user || syncedRef.current) return
    syncedRef.current = true
    syncPreferencesFromSupabase(supabase).catch(console.error)
  }, [user, supabase])

  // Push preferences to Supabase whenever they change
  const prefsRef = useRef(prefs)
  useEffect(() => {
    if (!user || !syncedRef.current) return
    // Skip the initial mount — only push after the sync has completed
    if (prefsRef.current === prefs) return
    prefsRef.current = prefs
    pushPreferencesToSupabase(supabase, user.id, prefs).catch(console.error)
  }, [prefs, user, supabase])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', prefs.theme)
  }, [prefs.theme])

  const handleOpenBook = useCallback((file: File, bookId?: string, studyOptions?: { panel?: 'scratchpad'; chapterHref?: string }) => {
    setOpenBook({ file, bookId: bookId ?? null, studyOptions })
  }, [])

  const handleThemeToggle = useCallback(() => {
    set('theme', prefs.theme === 'light' ? 'dark' : 'light')
  }, [prefs.theme, set])

  return (
    <AnimatePresence mode="wait">
      {!openBook ? (
        <Library key="library" supabase={supabase} onOpenBook={handleOpenBook} theme={prefs.theme} onThemeToggle={handleThemeToggle} />
      ) : (
        <Reader
          key="reader"
          file={openBook.file}
          bookId={openBook.bookId}
          supabase={supabase}
          theme={prefs.theme}
          fontSize={prefs.fontSize}
          layoutMode={prefs.layoutMode}
          highlightEnabled={prefs.highlightEnabled}
          autoscrollEnabled={prefs.autoscrollEnabled}
          onThemeToggle={handleThemeToggle}
          onFontSizeChange={(s: FontSize) => set('fontSize', s)}
          onLayoutModeChange={(m: LayoutMode) => set('layoutMode', m)}
          onHighlightChange={(v: boolean) => set('highlightEnabled', v)}
          onAutoscrollChange={(v: boolean) => set('autoscrollEnabled', v)}
          onClose={() => setOpenBook(null)}
          studyOptions={openBook.studyOptions}
        />
      )}
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <>
      <SignedOut>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: '#F8F7F4',
          }}
        >
          <SignIn routing="hash" />
        </div>
      </SignedOut>
      <SignedIn>
        <AppContent />
      </SignedIn>
    </>
  )
}
