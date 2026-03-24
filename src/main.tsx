import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './styles/globals.css'
import App from './App'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (!PUBLISHABLE_KEY) throw new Error('VITE_CLERK_PUBLISHABLE_KEY is not set')

// CSS var references resolve at paint time, so this single config adapts
// automatically across all 4 theme combinations (library/slate × light/dark).
const clerkAppearance = {
  variables: {
    colorBackground:     'var(--bg-surface)',
    colorNeutral:        'var(--text-primary)',
    colorPrimary:        'var(--accent-warm)',
    colorDanger:         'var(--error)',
    colorForeground:     'var(--text-primary)',
    colorMutedForeground:'var(--text-secondary)',
    colorMuted:          'var(--bg-secondary)',
    colorInput:          'var(--bg-primary)',
    colorInputForeground:'var(--text-primary)',
    colorBorder:         'var(--border)',
    colorRing:           'var(--accent-warm)',
    colorModalBackdrop:  'rgba(0, 0, 0, 0.55)',
    fontFamily:          "'DM Sans', system-ui, sans-serif",
    fontFamilyButtons:   "'DM Sans', system-ui, sans-serif",
    fontSize:            '0.875rem',
    borderRadius:        '0.5rem',
    spacing:             '1rem',
  },
  options: {
    termsPageUrl:   '/#terms',
    privacyPageUrl: '/#privacy',
  },
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={clerkAppearance}>
      <App />
    </ClerkProvider>
  </StrictMode>,
)
