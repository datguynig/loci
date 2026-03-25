# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start Vite dev server at http://localhost:5173
npm run build      # tsc + vite build (typecheck then bundle)
npm run preview    # serve the production build locally
npm run test       # unit tests (Vitest)
npm run test:e2e   # E2E tests (Playwright)
```

TypeScript is checked as part of `build`.

## Environment

Copy `.env.example` to `.env.local`. Key variables:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_ELEVENLABS_PROXY_URL=https://your-proxy.example.com  # optional; enables Loci Narration
VITE_E2E_TEST=false  # set true to suppress onboarding/tour in E2E tests
```

`VITE_ELEVENLABS_PROXY_URL` enables the premium TTS tiers. Without it the app falls back to browser voices automatically. The ElevenLabs API key must live server-side — never in a `VITE_` variable.

## Architecture

Loci is a single-page Vite + React 18 + TypeScript app. EPUB processing happens entirely in the browser. Supabase provides the database, file storage, and Stripe-connected edge functions. Clerk handles authentication.

### View routing

`App.tsx` has three views driven by Clerk auth state:

- **`landing`** (`<SignedOut>`) — marketing page
- **`library`** (`<SignedIn>`, no open book) — cloud book grid
- **`reader`** (`<SignedIn>`, book open) — EPUB reader

`AppContent` manages the `library`↔`reader` transition via `openBook` state. There is no routing library.

Theme (`light`/`dark`) and color scheme (`library`/`slate`) are owned at `App` level and applied as `data-theme` / `data-color-scheme` on `document.documentElement`.

### Subscription & feature gating

`useSubscription(supabase, userId)` is called once in `AppContent` and passed as props. It returns a `subscription` object with `tier` (`free`|`reader`|`scholar`), `status`, `isTrialing`, and `canAccess(feature)`.

Feature keys: `unlimited-books`, `scratchpad`, `loci-narration`, `loci-narration-pro`, `practice-quizzes`, `chapter-briefs`, `study-guide`, `flashcards`.

New users automatically start a 7-day Scholar trial via the `create-trial` Supabase edge function. Stripe checkout goes through `create-checkout`; subscription lifecycle is synced by `stripe-webhook`.

### EPUB layer — `useEpub`

`src/hooks/useEpub.ts` wraps the `epubjs` library. It owns the `Book` and `Rendition` refs, handles load/cleanup, injects theme/font-size CSS into the iframe rendition via `r.themes.default(styles)`, tracks `relocated` events for page/progress/chapter state, and exposes `getCurrentText()` which reads the live iframe DOM to extract plain text for TTS.

The rendition always uses `flow: 'paginated'` and `spread: 'none'`. Theme styles are defined inline in `getThemeStyles()` and injected directly into the epub iframe — not via Tailwind.

### TTS layer — `useSpeech` + `ttsService`

`src/hooks/useSpeech.ts` orchestrates sentence-by-sentence playback. Text from `getCurrentText()` is split into sentences, then played one at a time. Provider is selected at mount based on subscription tier and whether `VITE_ELEVENLABS_PROXY_URL` is set.

`src/services/ttsService.ts` is the provider abstraction. `ELEVENLABS_BASE` is the single constant to change when moving to a different proxy URL. The service handles ElevenLabs streaming; browser `SpeechSynthesisUtterance` is managed directly in `useSpeech`.

The hook uses parallel refs (`sentencesRef`, `indexRef`, `isPlayingRef`, etc.) alongside state to avoid stale closures inside the async playback loops. A `chromeBugIntervalRef` works around the Chrome `speechSynthesis` 15-second cutoff bug by calling `pause()`/`resume()` every 10 s.

### Component structure

| Component | Role |
|-----------|------|
| `Landing` | Marketing page (hero, features, pricing, FAQ) for signed-out users |
| `Library` | Cloud book grid — upload, manage, open books; Clerk UserButton with custom Subscription page |
| `Reader` | Main reader shell — mounts `useEpub` and `useSpeech`, keyboard shortcuts |
| `Sidebar` | Slide-out ToC with chapter progress |
| `AudioBar` | TTS controls — narration tier gating, voice/model selectors |
| `StudyPanel` | Study tools: Practice Quiz, Chapter Brief, Study Guide, Flashcards — gated behind Scholar |
| `SearchPanel` | Full-text search in current book |
| `Scratchpad` | In-reader notes panel — gated behind Reader/Scholar |
| `SelectionBubble` | Text-selection annotation tools (highlight, note) |
| `BookDetailModal` | Book metadata, ratings, review, archive/delete |
| `UpgradeModal` | Tier selection modal with Stripe checkout (Reader/Scholar, monthly/annual) |
| `TrialBanner` | Persistent banner showing trial days remaining |
| `ReaderSettings` | Theme, font size, layout, highlight, autoscroll settings |
| `ReaderTour` | Four-step first-book tooltip guide |
| `OnboardingWelcome` | First-time user welcome screen |
| `VoicePicker` | ElevenLabs voice/model selector |
| `FlashCard` | Flashcard display component |
| `BottomSheet` | Reusable bottom-sheet modal |
| `DeleteAccountModal` | Account deletion confirmation |
| `PaletteToggle` | Library/Slate colour palette selector |
| `ProgressBar` | Chapter progress indicator |
| `ThemeToggle` | Light/dark mode toggle |
| `Toast` | Ephemeral notification overlay |

### Hook structure

| Hook | Role |
|------|------|
| `useEpub` | epubjs wrapper — pagination, theme injection, `getCurrentText()` |
| `useSpeech` | Sentence-by-sentence TTS orchestration |
| `useSubscription` | Subscription state from Supabase; exposes `canAccess(feature)` |
| `useLibrary` | Cloud book CRUD via Supabase |
| `useAnnotations` | Annotation CRUD |
| `useBookmarks` | Bookmark management |
| `useReadingProgress` | Chapter progress persistence |
| `useFlashcards` | Flashcard operations |
| `useScratchpad` | Scratchpad notes |
| `usePreferences` | Reader preferences (theme, font, layout) |
| `useWindowWidth` | Responsive breakpoint helper |

### Styling

Tailwind 4 (via `@tailwindcss/vite`) for the shell UI. The epub content inside the rendition iframe is styled independently via `getThemeStyles()` in `useEpub`. CSS custom properties on `document.documentElement` drive the outer theme via `data-theme` and `data-color-scheme` attributes.

See `docs/designsystem.md` for the full colour token reference and design rules.

### Deployment model

Deployed on Vercel. Stripe env vars (`STRIPE_SECRET_KEY`, etc.) are set in the Supabase edge function environment — not in Vercel or `.env.local`.
