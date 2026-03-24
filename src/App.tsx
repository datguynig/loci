import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { SignedIn, SignedOut, useAuth, useUser } from '@clerk/clerk-react'
import { Analytics } from '@vercel/analytics/react'
import Library from './components/Library'
import Reader from './components/Reader'
import Landing from './components/Landing'
import PrivacyPolicy from './components/legal/PrivacyPolicy'
import TermsOfService from './components/legal/TermsOfService'
import { usePreferences } from './hooks/usePreferences'
import { createSupabaseClient } from './services/supabaseClient'
import { syncPreferencesFromSupabase, pushPreferencesToSupabase } from './services/preferencesService'
import type { FontSize, LayoutMode } from './hooks/useEpub'

type LegalPage = 'terms' | 'privacy'

function parseLegalHash(): LegalPage | null {
  const h = window.location.hash
  if (h === '#terms') return 'terms'
  if (h === '#privacy') return 'privacy'
  return null
}

// ─── E2E Test Mode ─────────────────────────────────────────────────────────
// When VITE_E2E_TEST=true (Playwright), we bypass Clerk auth and Supabase so
// the full reader test suite can run without real credentials.
function E2EApp() {
  const [openBook, setOpenBook] = useState<File | null>(null)
  const { prefs, set } = usePreferences()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', prefs.theme)
  }, [prefs.theme])

  useEffect(() => {
    if (prefs.colorScheme === 'slate') {
      document.documentElement.setAttribute('data-color-scheme', 'slate')
    } else {
      document.documentElement.removeAttribute('data-color-scheme')
    }
  }, [prefs.colorScheme])

  const handleThemeToggle = useCallback(() => {
    set('theme', prefs.theme === 'light' ? 'dark' : 'light')
  }, [prefs.theme, set])

  if (openBook) {
    return (
      <Reader
        file={openBook}
        bookId={null}
        supabase={null}
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
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
      <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 24, fontWeight: 700 }}>Loci</span>
      <p style={{ margin: 0 }}>Drop your EPUB to begin reading</p>
      <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
        or click to browse
      </button>
      <p style={{ margin: 0, fontSize: 12, color: '#888' }}>Your file stays on your device</p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".epub"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) setOpenBook(f) }}
      />
    </div>
  )
}

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

  // Raw Clerk JWT for the storage API (no Supabase template — the presign-api
  // verifies against Clerk JWKS directly).
  const getStorageToken = useCallback(() => getTokenRef.current(), [getToken]) // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    if (prefs.colorScheme === 'slate') {
      document.documentElement.setAttribute('data-color-scheme', 'slate')
    } else {
      document.documentElement.removeAttribute('data-color-scheme')
    }
  }, [prefs.colorScheme])

  const handleOpenBook = useCallback((file: File, bookId?: string, studyOptions?: { panel?: 'scratchpad'; chapterHref?: string }) => {
    setOpenBook({ file, bookId: bookId ?? null, studyOptions })
  }, [])

  const handleThemeToggle = useCallback(() => {
    set('theme', prefs.theme === 'light' ? 'dark' : 'light')
  }, [prefs.theme, set])

  const handleColorSchemeToggle = useCallback(() => {
    set('colorScheme', prefs.colorScheme === 'library' ? 'slate' : 'library')
  }, [prefs.colorScheme, set])

  return (
    <AnimatePresence mode="wait">
      {!openBook ? (
        <Library key="library" supabase={supabase} getStorageToken={getStorageToken} onOpenBook={handleOpenBook} theme={prefs.theme} onThemeToggle={handleThemeToggle} colorScheme={prefs.colorScheme} onColorSchemeToggle={handleColorSchemeToggle} />
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
  const [legalPage, setLegalPage] = useState<LegalPage | null>(parseLegalHash)

  // Listen for hash changes so <a href="#terms"> links work from anywhere
  useEffect(() => {
    const handler = () => setLegalPage(parseLegalHash())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const closeLegal = () => {
    window.location.hash = ''
    setLegalPage(null)
  }

  if (import.meta.env.VITE_E2E_TEST === 'true') return <E2EApp />

  return (
    <>
      <SignedOut>
        <Landing />
      </SignedOut>
      <SignedIn>
        <AppContent />
      </SignedIn>

      {/* Legal pages render as a full-screen overlay, visible regardless of auth state */}
      {legalPage === 'privacy' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, overflowY: 'auto', background: 'var(--bg-primary)' }}>
          <PrivacyPolicy onBack={closeLegal} />
        </div>
      )}
      {legalPage === 'terms' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, overflowY: 'auto', background: 'var(--bg-primary)' }}>
          <TermsOfService onBack={closeLegal} />
        </div>
      )}
      <Analytics />
    </>
  )
}
