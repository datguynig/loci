# Loci

Minimal EPUB reader with local file loading, paginated reading, and optional proxy-backed TTS.

Loci runs as a client-side React app. EPUB files stay in the browser. Browser speech works fully on-device; premium TTS requires your own backend proxy and will send sentence text to that proxy.

## Features

- Local EPUB loading with drag-and-drop or file picker
- Paginated reader with chapter navigation and reading progress
- Table of contents sidebar
- Browser Web Speech playback with voice and speed controls
- Optional ElevenLabs playback through a proxy endpoint
- Theme toggle and font size controls
- Keyboard shortcuts for page turns, theme, sidebar, and playback
- Playwright end-to-end coverage for the main reading flow

## Stack

- React 18 + TypeScript
- Vite
- epub.js
- Framer Motion
- Tailwind CSS
- Playwright
- Vitest for focused unit tests

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` and drop in an EPUB file.

## Optional Premium TTS

Browser TTS works without configuration. To enable ElevenLabs, expose a proxy endpoint that speaks the same paths used by the client:

- `GET /v1/voices`
- `POST /v1/text-to-speech/:voiceId/stream`

Then set:

```bash
VITE_ELEVENLABS_PROXY_URL=https://your-proxy.example.com
```

The proxy should keep the ElevenLabs API key on the server. Do not put provider secrets in `VITE_` variables.

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run test:unit
npm run test:e2e
```

## Testing Notes

- `tests/unit` covers the pure logic around sentence splitting, TTS provider detection, and EPUB progress calculation.
- `tests/e2e` covers the browser reading flow using Playwright.

## Privacy

- EPUB files are loaded locally and are not uploaded by this app.
- Browser speech stays on-device.
- Proxy-backed TTS sends sentence text to your configured proxy, and then onward according to that backend's implementation.

## Current Scope

This repo does not currently include bookmarks, notes, search, sync, accounts, or a bundled backend proxy service.

## License

MIT
