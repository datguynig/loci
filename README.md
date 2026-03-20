# Loci

**A minimal EPUB reader and audiobook player built for focused study.**

Drop in any EPUB file and read or listen at your own pace. Your file never leaves your device — audio is either processed on-device (browser voices, free) or sent to ElevenLabs for high-quality synthesis (optional, requires API key).

---

## Features

- **Drag-and-drop EPUB loading** — open any EPUB file locally, nothing leaves your device
- **Paginated & scroll reading modes** — switch between page-by-page and continuous flow
- **Table of contents navigation** — slide-out sidebar with chapter progress indicators
- **Two-tier audiobook playback** — browser-native TTS free, ElevenLabs high-quality optional
- **Sentence-sync highlighting** — the current sentence is highlighted as it's read aloud
- **Model & voice controls** — choose between Turbo (fast) and Multilingual (quality) per session
- **Speed controls** — 0.5× to 2×
- **Light & dark mode** — warm off-white paper tones and a rich dark mode
- **Font size controls** — S / M / L / XL with persistent preference
- **Bookmarks & notes** — save your place and annotate by chapter
- **Keyboard navigation** — full keyboard shortcut support for hands-free use
- **Privacy-first EPUB handling** — your file is loaded locally and never uploaded to any server
- **Offline-capable** — reading and browser-voice TTS work with no network; ElevenLabs requires internet

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| EPUB rendering | epub.js |
| TTS — free tier | Web Speech API (browser native) |
| TTS — premium tier | ElevenLabs API (optional, via `VITE_ELEVENLABS_API_KEY`) |
| Animations | Framer Motion |
| Styling | Tailwind CSS + CSS custom properties |

---

## Getting Started

```bash
# Clone the repo
git clone https://github.com/your-username/loci.git
cd loci

# Install dependencies
npm install

# Optional: enable ElevenLabs high-quality TTS
cp .env.example .env.local
# Add your ElevenLabs API key to .env.local

# Start dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and drop in an EPUB file. No domain or deployment needed to use the app.

### ElevenLabs Setup (optional)

Without a key, Loci uses your browser's built-in voices. To enable high-quality audio:

1. Get an API key from [elevenlabs.io](https://elevenlabs.io)
2. Add it to `.env.local`:
```
VITE_ELEVENLABS_API_KEY=your_key_here
```
3. Restart the dev server — the audio bar will show voice and model selectors automatically

---

## Deployment

Loci uses a two-layer deployment model — frontend and audio proxy are kept separate.

### Frontend — Vercel (free)

```bash
npm install -g vercel
vercel
```

Vercel auto-detects Vite and deploys in under a minute. You get a free `*.vercel.app` URL — no domain required. Auto-deploys on every `git push`.

Add your ElevenLabs key in Vercel dashboard → Project → Settings → Environment Variables (`VITE_ELEVENLABS_API_KEY`).

### Audio Proxy — Hostinger VPS (when going commercial)

When protecting your ElevenLabs key for paying users, deploy the Express proxy in `/server` to your Hostinger VPS via PM2. Update one constant in `ttsService.ts` to point at your VPS — nothing else changes.

See the [deployment roadmap](#roadmap) for the full phased approach.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `→` / `Space` | Next page |
| `←` | Previous page |
| `[` | Previous chapter |
| `]` | Next chapter |
| `P` | Play / Pause TTS |
| `S` | Stop TTS |
| `T` | Toggle sidebar |
| `D` | Toggle dark mode |
| `+` / `-` | Font size up / down |

---

## Browser Support

Loci relies on the Web Speech API for TTS playback. Voice availability varies by platform:

| Platform | Best voice |
|---|---|
| macOS / iOS | Daniel (UK) or Samantha |
| Windows | Microsoft George |
| Chrome (any OS) | Google UK English Female |

Safari on iOS requires a tap to initiate speech — the play button handles this automatically.

---

## Privacy

**Your EPUB file** is loaded locally via the browser File API and never uploaded to any server under any circumstances.

**Audio processing** depends on which tier is active:

| Mode | What leaves your device |
|---|---|
| Browser voices (free) | Nothing — processed entirely on-device |
| ElevenLabs (premium) | Sentence text is sent to ElevenLabs' API to generate audio |

If privacy is a concern for sensitive study materials, use the browser voice tier. ElevenLabs' data handling is governed by their [privacy policy](https://elevenlabs.io/privacy).

**When commercialised:** user accounts and authentication will be required for the premium tier. The free reading and browser-voice experience will remain account-free.

---

## Roadmap

**Phase 1 — Personal tool (now)**
- [x] EPUB reader with paginated and scroll modes
- [x] ElevenLabs TTS with sentence sync
- [x] Light / dark mode, font controls, keyboard shortcuts
- [ ] Bookmarks and notes per chapter
- [ ] Search within book

**Phase 2 — Live MVP**
- [ ] Deploy frontend to Vercel (free tier)
- [ ] ElevenLabs key via Vercel env vars

**Phase 3 — Commercial**
- [ ] Express proxy on Hostinger VPS (key moves server-side)
- [ ] Auth + subscription gating for premium voice
- [ ] Per-user usage tracking and rate limiting
- [ ] Free tier (browser TTS) vs paid tier (ElevenLabs) split

**Future features**
- [ ] Flashcard mode — generate study cards from highlights
- [ ] AI Q&A — ask questions about the book via Claude
- [ ] Export highlights and notes to Markdown
- [ ] Progress sync across devices

---

## License

MIT
