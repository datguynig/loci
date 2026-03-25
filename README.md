# Loci

Premium EPUB reader with cloud library, AI narration, an AI study assistant (quizzes, summaries, flashcards), reading progress sync, and annotations.

## Features

- **Cloud library** — upload and manage your EPUB collection, synced across devices via Supabase Storage
- **Reader** — paginated and scroll layouts, table of contents sidebar, chapter navigation
- **Annotations** — select any text to highlight and add a note; all notes sync to the cloud
- **Text-to-speech** — browser Web Speech (on-device) or ElevenLabs (premium AI voices) with sentence-level highlighting and auto-scroll
- **Reading progress** — resume exactly where you left off, across devices
- **Book management** — cover extraction, ratings, reviews, archive/restore
- **Reader settings** — theme (light/dark), font size (S/M/L/XL), layout, highlight on/off, autoscroll on/off
- **Keyboard shortcuts** — page turns, theme toggle, sidebar, TTS playback
- **AI study tools** — quiz me (scored, with retry), summaries, and flashcards powered by the AI study assistant; quiz attempts persisted to Supabase
- **Marketing landing page** — signed-out users see a full landing page (hero, narration section, feature grid, pricing, FAQ) with sign-up/sign-in via Clerk
- **Onboarding flow** — first-time users see a welcome screen with feature highlights before uploading their first book (dismissible; state stored in `localStorage` under `loci_onboarding_done`)
- **Reader tour** — four-step in-reader tooltip tour shown on a user's first book open (dismissible; state stored in `localStorage` under `loci_reader_tour_seen`)
- **Subscription management** — freemium model with Free, Reader ($7.99/mo), and Scholar ($13.99/mo) tiers; 7-day Scholar trial for all new sign-ups; Stripe-powered checkout and customer portal; subscription page embedded in Clerk's user profile modal

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

# Optional — ElevenLabs premium TTS (Loci Narration tiers)
VITE_ELEVENLABS_PROXY_URL=https://your-proxy.example.com

# Set to "true" to suppress first-run UI (onboarding, reader tour) during E2E tests
VITE_E2E_TEST=false
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

```sql
-- Quiz sessions table
create table public.quiz_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  book_id      uuid not null references public.books(id) on delete cascade,
  chapter_href text,
  score        int not null default 0,
  total        int not null default 0,
  questions    jsonb not null default '[]',
  created_at   timestamptz default now()
);
alter table public.quiz_sessions enable row level security;
create policy "Users manage own quiz sessions" on public.quiz_sessions
  for all using ((auth.jwt() ->> 'sub') = user_id);
create index quiz_sessions_user_book_idx on public.quiz_sessions(user_id, book_id);
```

```sql
-- Subscriptions table (managed by stripe-webhook edge function)
create table public.subscriptions (
  user_id                text primary key,
  tier                   text not null default 'free',
  status                 text not null default 'trialing',
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  updated_at             timestamptz default now()
);
alter table public.subscriptions enable row level security;
create policy "users read own subscription" on public.subscriptions
  for select using ((auth.jwt() ->> 'sub') = user_id);
```

> Migration files are also available in [`supabase/migrations/`](supabase/migrations/) if you prefer applying them via the Supabase CLI.

Create two Storage buckets in your Supabase dashboard:
- `books` — private (EPUB files)
- `covers` — public (cover images, served via CDN)

### Clerk JWT Template (required for subscriptions and storage)

The Edge Functions and the storage presign API verify the caller using a Clerk JWT signed with Supabase's JWT secret. You must create a JWT template named **exactly `supabase`** in Clerk:

1. Clerk Dashboard → **JWT Templates** → **New template** → choose **Supabase**.
2. Set the signing algorithm to **HS256** and paste your Supabase **JWT secret** (Supabase Dashboard → Project Settings → API → JWT Secret).
3. The template name must be `supabase` — the client calls `getToken({ template: 'supabase' })`.

Without this template, all Edge Function calls return 401, trial creation silently falls back to free, and checkout/portal fail.

### Stripe Setup (optional — subscriptions)

Stripe env vars are set in the **Supabase edge function environment** (Supabase Dashboard → Edge Functions → Secrets), **not** in `.env.local`:

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_READER_MONTHLY_PRICE_ID=price_...
STRIPE_READER_ANNUAL_PRICE_ID=price_...
STRIPE_SCHOLAR_MONTHLY_PRICE_ID=price_...
STRIPE_SCHOLAR_ANNUAL_PRICE_ID=price_...
APP_URL=https://your-production-domain.com   # used for checkout/portal return URLs
```

> Without `APP_URL`, successful Stripe checkouts and billing portal sessions will redirect back to `http://localhost:5173` in production.

Deploy the edge functions in `supabase/functions/` (`create-trial`, `create-checkout`, `create-portal`, `stripe-webhook`) and set these vars via the Supabase dashboard.

In Stripe Dashboard, set the webhook endpoint to:
```
https://<your-supabase-project>.supabase.co/functions/v1/stripe-webhook
```
and subscribe to: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.

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
- Loci uses Supabase for database and file storage (under your own account). Subscription state is managed via Stripe and synced to Supabase. EPUB processing happens entirely in the browser.

## License

MIT
