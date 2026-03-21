# Loci

Premium EPUB reader with cloud library, AI-powered text-to-speech, reading progress sync, and annotations.

## Features

- **Cloud library** — upload and manage your EPUB collection, synced across devices via Supabase Storage
- **Reader** — paginated and scroll layouts, table of contents sidebar, chapter navigation
- **Annotations** — select any text to highlight and add a note; all notes sync to the cloud
- **Text-to-speech** — browser Web Speech (on-device) or ElevenLabs (premium AI voices) with sentence-level highlighting and auto-scroll
- **Reading progress** — resume exactly where you left off, across devices
- **Book management** — cover extraction, ratings, reviews, archive/restore
- **Reader settings** — theme (light/dark), font size (S/M/L/XL), layout, highlight on/off, autoscroll on/off
- **Keyboard shortcuts** — page turns, theme toggle, sidebar, TTS playback

## Stack

- React 18 + TypeScript
- Vite
- epub.js
- Framer Motion
- Tailwind CSS 4
- Clerk (authentication)
- Supabase (database, storage, row-level security)
- Playwright (E2E tests)
- Vitest (unit tests)

## Getting Started

### Prerequisites

You need a [Clerk](https://clerk.com) account and a [Supabase](https://supabase.com) project.

### Environment Variables

Create a `.env.local` file:

```bash
# Clerk
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Optional — ElevenLabs premium TTS
VITE_ELEVENLABS_PROXY_URL=https://your-proxy.example.com
```

### Supabase Setup

Run the following SQL in your Supabase dashboard to create the required tables and storage buckets:

```sql
-- Books table
create table public.books (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  title      text not null,
  author     text,
  cover_url  text,
  file_path  text not null,
  file_size  bigint,
  added_at   timestamptz default now(),
  last_read_at timestamptz,
  status     text not null default 'active',
  rating     int check (rating between 1 and 5),
  review     text
);
alter table public.books enable row level security;
create policy "users own their books" on public.books
  for all using (auth.uid()::text = user_id::text);

-- Annotations table
create table public.annotations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  book_id    uuid not null references public.books(id) on delete cascade,
  spine_href text not null,
  quote      text not null,
  note       text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.annotations enable row level security;
create policy "users own their annotations" on public.annotations
  for all using (auth.uid()::text = user_id::text);

-- Reading progress table
create table public.reading_progress (
  user_id        uuid not null,
  book_id        uuid not null references public.books(id) on delete cascade,
  spine_href     text not null,
  scroll_fraction real default 0,
  updated_at     timestamptz default now(),
  primary key (user_id, book_id)
);
alter table public.reading_progress enable row level security;
create policy "users own their progress" on public.reading_progress
  for all using (auth.uid()::text = user_id::text);

-- Preferences table
create table public.preferences (
  user_id           uuid primary key,
  theme             text not null default 'light',
  font_size         text not null default 'md',
  layout_mode       text not null default 'scroll',
  highlight_enabled boolean not null default true,
  autoscroll_enabled boolean not null default true,
  tts_provider      text not null default 'browser',
  tts_rate          real not null default 1.0,
  tts_voice_id      text,
  updated_at        timestamptz default now()
);
alter table public.preferences enable row level security;
create policy "users own their preferences" on public.preferences
  for all using (auth.uid()::text = user_id::text);
```

Create two Storage buckets in your Supabase dashboard:
- `books` — private (EPUB files)
- `covers` — public (cover images, served via CDN)

### Install and Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, sign in, and upload an EPUB.

## Optional Premium TTS

Browser TTS works without configuration. To enable ElevenLabs, expose a proxy endpoint:

- `GET /v1/voices`
- `POST /v1/text-to-speech/:voiceId/stream`

Set `VITE_ELEVENLABS_PROXY_URL` to your proxy URL. Keep the ElevenLabs API key server-side — never put provider secrets in `VITE_` variables.

## Scripts

```bash
npm run dev          # development server
npm run build        # TypeScript check + Vite build
npm run preview      # preview production build
npm run test         # unit tests (Vitest)
npm run test:e2e     # E2E tests (Playwright)
npm run test:all     # all tests
```

## Design

See [docs/designsystem.md](docs/designsystem.md) for the full design system — colour tokens, typography, spacing, component patterns, motion guidelines, and dark mode rules.

## Privacy

- EPUB files are uploaded to your Supabase Storage project under your own account.
- Annotations, reading progress, and preferences are stored in your own Supabase database.
- Browser TTS is fully on-device.
- Proxy-backed TTS sends sentence text to your configured proxy endpoint.
- Loci does not have its own backend — all data stays in services you control.

## License

MIT
