# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start Vite dev server at http://localhost:5173
npm run build      # tsc + vite build (typecheck then bundle)
npm run preview    # serve the production build locally
```

No test runner is configured yet. TypeScript is checked as part of `build`.

## Environment

Copy `.env.example` to `.env.local` and set `VITE_ELEVENLABS_API_KEY` to enable the premium TTS tier. Without it the app falls back to browser voices automatically.

## Architecture

Loci is a single-page Vite + React 18 + TypeScript app. There is no backend — all EPUB processing happens in the browser.

### View routing

`App.tsx` holds a simple two-state view machine (`landing` | `reader`). Theme (`light`/`dark`) and font size (`sm`/`md`/`lg`/`xl`) are owned here and passed down. There is no routing library.

### EPUB layer — `useEpub`

`src/hooks/useEpub.ts` wraps the `epubjs` library. It owns the `Book` and `Rendition` refs, handles load/cleanup, injects theme/font-size CSS into the iframe rendition via `r.themes.default(styles)`, tracks `relocated` events for page/progress/chapter state, and exposes `getCurrentText()` which reads the live iframe DOM to extract plain text for TTS.

The rendition always uses `flow: 'paginated'` and `spread: 'none'`. Theme styles are defined inline in `getThemeStyles()` and injected directly into the epub iframe — not via Tailwind.

### TTS layer — `useSpeech` + `ttsService`

`src/hooks/useSpeech.ts` orchestrates sentence-by-sentence playback. Text from `getCurrentText()` is split into sentences, then played one at a time. Provider is fixed at mount based on whether `VITE_ELEVENLABS_API_KEY` is set.

`src/services/ttsService.ts` is the provider abstraction. `ELEVENLABS_BASE` is the single constant to change when moving to a VPS proxy (Phase 3). The service only handles ElevenLabs streaming; browser `SpeechSynthesisUtterance` is managed directly in `useSpeech`.

The hook uses parallel refs (`sentencesRef`, `indexRef`, `isPlayingRef`, etc.) alongside state to avoid stale closures inside the async playback loops. A `chromeBugIntervalRef` works around the Chrome `speechSynthesis` 15-second cutoff bug by calling `pause()`/`resume()` every 10 s.

### Component structure

| Component | Role |
|-----------|------|
| `Landing` | Drag-and-drop file picker |
| `Reader` | Main shell — mounts `useEpub` and `useSpeech`, handles keyboard shortcuts |
| `Sidebar` | Slide-out ToC with chapter progress |
| `AudioBar` | TTS controls — conditionally shows ElevenLabs voice/model selectors |
| `ProgressBar` | Chapter progress indicator |
| `ThemeToggle` | Light/dark toggle button |
| `Toast` | Ephemeral notification overlay |

### Styling

Tailwind 4 (via `@tailwindcss/vite`) for the shell UI. The epub content inside the rendition iframe is styled independently via `getThemeStyles()` in `useEpub`. CSS custom properties on `document.documentElement` drive the outer theme via `data-theme` attribute.

### Deployment model

- **Phase 1/2**: `VITE_ELEVENLABS_API_KEY` set as a Vercel env var — key is in the client bundle.
- **Phase 3**: Change `ELEVENLABS_BASE` in `ttsService.ts` to a VPS proxy URL; key moves server-side.
