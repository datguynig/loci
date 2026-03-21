# Loci — Backend, Library & Notes Design Spec

**Date:** 2026-03-21
**Status:** Approved for implementation
**Scope:** Authentication, cloud book storage, library screen, user flow, notes panel, design system, feature roadmap

---

## 1. Context

Loci is a multi-user EPUB reader and audiobook platform. All data is currently browser-local (localStorage). This spec covers:

1. Introducing a backend (Clerk + Supabase) to support multi-device sync and a persistent book library
2. Replacing the single-file drop-zone landing with a proper library screen
3. A per-book notes slide-over panel accessible from the library and from within the reader
4. A `designsystem.md` reference document
5. A prioritised roadmap of reader features to build next

---

## 2. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Auth & identity | **Clerk** | Handles sign-up/in UI, session management, OAuth, magic link. Provides `userId` JWT. No custom auth code needed. |
| Database | **Supabase (PostgreSQL)** | Relational data with Row Level Security, real-time capable, integrates with Clerk JWT via JWKS. |
| File storage | **Supabase Storage** | Private EPUB bucket + public cover CDN bucket. Signed URL access for EPUB downloads. |
| Frontend | React + Vite (existing) | Wrap in `ClerkProvider`. Create Supabase client factory that injects Clerk JWT. |

### Clerk + Supabase JWT Integration

Supabase verifies Clerk JWTs via Clerk's JWKS endpoint. All RLS policies use:

```sql
(auth.jwt() ->> 'sub') = user_id
```

`user_id` columns are `text` (Clerk user ID format: `user_abc123`), not `uuid`. No `auth.users` reference. No `profiles` table — Clerk manages name, email, and avatar.

---

## 3. Database Schema

### `books`
```sql
create table public.books (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,                          -- Clerk user ID
  title         text not null,
  author        text,
  cover_url     text,                                   -- public URL in covers/ bucket
  file_path     text not null,                          -- storage path: {user_id}/{book_id}.epub
  file_size     bigint,
  added_at      timestamptz default now(),
  last_read_at  timestamptz
);
alter table public.books enable row level security;
create policy "users own their books" on public.books for all
  using ((auth.jwt() ->> 'sub') = user_id);
```

### `reading_progress`
```sql
create table public.reading_progress (
  user_id             text not null,
  book_id             uuid not null references public.books(id) on delete cascade,
  spine_href          text not null,
  scroll_fraction     real default 0,
  tts_sentence_index  int default 0,
  updated_at          timestamptz default now(),
  primary key (user_id, book_id)
);
alter table public.reading_progress enable row level security;
create policy "users own their progress" on public.reading_progress for all
  using ((auth.jwt() ->> 'sub') = user_id);
```

### `annotations`
Replaces `localStorage` key `loci_annotations_{bookId}`.
```sql
create table public.annotations (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  book_id     uuid not null references public.books(id) on delete cascade,
  spine_href  text not null,
  quote       text not null,
  note        text not null default '',
  type        text not null default 'note',  -- 'note' | 'bookmark'
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table public.annotations enable row level security;
create policy "users own their annotations" on public.annotations for all
  using ((auth.jwt() ->> 'sub') = user_id);
```

### `preferences`
Replaces `localStorage` key `loci_preferences`.
```sql
create table public.preferences (
  user_id             text primary key,
  theme               text not null default 'light',
  font_size           text not null default 'md',
  layout_mode         text not null default 'scroll',
  highlight_enabled   boolean not null default true,
  autoscroll_enabled  boolean not null default true,
  tts_provider        text not null default 'browser',
  tts_rate            real not null default 1.0,
  tts_voice_id        text,
  updated_at          timestamptz default now()
);
alter table public.preferences enable row level security;
create policy "users own their preferences" on public.preferences for all
  using ((auth.jwt() ->> 'sub') = user_id);
```

### Storage Buckets
```
books/    — private. Path: {user_id}/{book_id}.epub. Access via signed URL only.
covers/   — public CDN. Path: {user_id}/{book_id}.jpg. Extracted from EPUB on upload.
```

---

## 4. User Flow

```
App open (unauthenticated)
  → Clerk sign-in/sign-up modal
  → Authenticated

Authenticated + no books
  → Empty library: centred upload prompt (drag-drop or click to browse)
  → EPUB uploads to Supabase Storage
  → Cover extracted client-side via epubjs (`book.coverUrl()`) before upload, stored in covers/ bucket
  → Metadata (title, author) extracted client-side from `book.loaded.metadata`, written to books table
  → Book opens directly in reader (no intermediate confirmation)

Reading
  → Progress autosaves to reading_progress every 30s and on chapter change
  → Bookmarks: one-tap to mark position, listed in sidebar
  → Notes: select text → "+ Note" bubble → saves to annotations table
  → Search: Ctrl+F opens search bar within current book
  → TTS: plays with sentence highlight + autoscroll, continues across chapters

Close book
  → Back arrow returns to library
  → Library shows all books: cover grid, progress %, last-read date
  → Clicking a book resumes from saved reading_progress position

Library
  → "Continue reading" banner: most recently read book with progress bar
  → Book cover grid: hover reveals "Read" overlay and notes badge (✎ N)
  → Clicking notes badge opens per-book notes slide-over panel
```

---

## 5. Library Screen Design

**Theme:** Light mode (`#F8F7F4` background, `#FFFFFF` cards). Dark mode uses existing CSS custom properties.

### Nav
- Left: Loci wordmark (Playfair Display, 20px)
- Right: `+ Add book` button (dark fill) + user avatar (Clerk avatar or initials)

### Continue Reading Banner
- Compact card (max-width 480px): portrait thumbnail (40×60px fixed), title, author, 2px progress bar, metadata line, "Continue →" pill
- Only shown when at least one book has been opened

### Book Grid
- `auto-fill` columns, `minmax(130px, 1fr)`, 28px row gap, 20px column gap
- Each card: 2:3 aspect-ratio cover with 7px border-radius, subtle shadow
- Hover: cover lifts (-3px, scale 1.015), dark gradient overlay reveals "Read" label (bottom-left), notes badge appears (top-right)
- Notes badge: `✎ N` — shows note count, click opens notes panel. Hidden when 0 notes on non-hovered state (but still clickable on hover even when 0).
- 3px warm-tan progress strip at cover bottom

### Empty State (no books)
- Centred layout: icon, heading ("Your library is empty"), sub-text, drag-drop zone
- Drop zone: dashed warm-tan border, animates on hover

---

## 6. Notes Panel

### From Library (slide-over)
- Triggered by clicking the notes badge on a book cover
- 400px panel slides in from the right, backdrop dims the library
- Panel header: book thumbnail + title + author + note count + close button
- Toolbar: "↗ Export as Markdown" button
- Note list: chapter label (warm tan, uppercase), quote (Lora italic, tan left-border), note text (DM Sans), date
- Empty state: "No notes yet. Select text while reading to add one."

### From Reader (inline pane)
- Toggled via "✎ Notes" button in reader header (active state: warm-tan tint)
- Slides in from the right as a 320px fixed pane; book text reflows to accommodate
- Notes pane shows all notes for the book across all chapters
- Notes on the current chapter are highlighted (warm-tan left border + subtle background)
- Export button available in the reader pane too

### Export Format (Markdown)
```markdown
# Notes — The Design of Everyday Things
*Don Norman*

## Chapter 2 — The Psychology of Everyday Actions

> We bridge the gulf of execution through action and the gulf of evaluation through perception and interpretation.

Core mental model — every interaction has these two gulfs.

*18 Mar 2026*
```

---

## 7. Services Architecture

| File | Purpose |
|---|---|
| `src/services/supabaseClient.ts` | Supabase client factory. Accepts a `getToken` function from Clerk's `useAuth`. Returns authenticated client. |
| `src/services/bookService.ts` | Upload EPUB to Storage, extract cover, write to `books` table, download EPUB via signed URL. |
| `src/services/progressService.ts` | Read/write `reading_progress`. Debounced autosave every 30s. |
| `src/services/annotationService.ts` | Update existing service to write to Supabase instead of localStorage. Current interface: `getAnnotations(bookId)`, `saveAnnotation(annotation)`, `deleteAnnotation(id, bookId)`, `getAnnotationsForHref(bookId, href)`. Keep localStorage as offline cache. |
| `src/services/preferencesService.ts` | Sync `preferences` table on sign-in; write on change. |
| `src/components/Library.tsx` | New library screen. Replaces `Landing.tsx` for authenticated users. |
| `src/components/BookNotesPanel.tsx` | Slide-over notes panel (library context). |
| `src/hooks/useLibrary.ts` | Fetches book list from Supabase, manages upload state. |
| `src/hooks/useReadingProgress.ts` | Autosave + restore reading position. |

---

## 8. Build Order

### Phase 1 — Auth (prerequisite for everything)
1. Install `@clerk/clerk-react`
2. Wrap app in `ClerkProvider` with publishable key from env
3. Show Clerk `<SignIn>` when unauthenticated (replaces current app entry)
4. Sign-out in user avatar dropdown

### Phase 2 — Supabase foundation
1. Create Supabase project, configure JWKS from Clerk JWT template
2. Run schema SQL (all 4 tables + RLS policies)
3. Create storage buckets with policies
4. `src/services/supabaseClient.ts` — client factory with Clerk JWT injection

### Phase 3 — Book library
1. `src/services/bookService.ts` — upload, cover extract, signed URL download
2. `src/hooks/useLibrary.ts` — fetch books list
3. `src/components/Library.tsx` — grid + continue reading + empty state
4. Wire `App.tsx`: authenticated + has books → Library; authenticated + no books → empty Library with upload

### Phase 4 — Data sync
1. `progressService.ts` + `useReadingProgress.ts` — autosave every 30s, restore on open
2. `annotationService.ts` — write to Supabase (localStorage remains as cache)
3. `preferencesService.ts` — sync on sign-in, write on change

### Phase 5 — Notes panel
1. `src/components/BookNotesPanel.tsx` — library slide-over
2. Inline reader notes pane (extend existing sidebar or add right pane to Reader.tsx)
3. Markdown export

### Phase 5b — Design system doc
1. Write `docs/designsystem.md` covering all tokens, typography, spacing, component patterns, motion, and accessibility rules (derived from existing `src/styles/globals.css` and component inline styles)

### Phase 6 — Reader feature additions
1. Bookmarks (one-tap, sidebar list)
2. Cross-chapter TTS (auto-advance on chapter end)
3. Search within book (Ctrl+F)
4. Swipe gestures (mobile)
5. Export annotations (from reader toolbar)
6. Reading stats (tracked in `reading_progress`, surfaced in library card + future stats view)

---

## 9. Feature Roadmap (post-backend)

Selected by product owner. In priority order:

| Feature | Phase | Notes |
|---|---|---|
| Book library screen | 3 | Replaces Landing for auth'd users |
| Reading progress sync | 4 | 30s autosave + restore on open |
| Cross-chapter TTS | 6 | Auto-advance spine on chapter end |
| Bookmarks | 6 | One-tap, stored in annotations table with type='bookmark' |
| Search within book | 6 | epubjs search API |
| Export annotations | 6 | Markdown download |
| Reading stats | 6 | Time tracked in reading_progress |
| Swipe gestures | 6 | Touch events for mobile page turn |

Not in scope (deferred): font selection, sepia theme, public marketing landing page.

---

## 10. Design System

A `designsystem.md` reference document will be created at `docs/designsystem.md`. Contents:

- Color tokens (CSS custom properties, light + dark values)
- Typography (Playfair Display / Lora / DM Sans — roles and sizes)
- Spacing scale
- Component patterns (buttons, toggles, popovers, segmented controls, sidebar items)
- Elevation / shadow scale
- Motion / animation guidelines
- Accessibility rules (focus styles, ARIA patterns, contrast minimums)

---

## 11. Environment Variables

```
VITE_CLERK_PUBLISHABLE_KEY=pk_...
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_ELEVENLABS_PROXY_URL=   (existing)
VITE_ELEVENLABS_API_KEY=     (existing)
```

---

## 12. Verification

1. **Auth flow:** open app unauthenticated → Clerk modal → sign up → lands on empty library
2. **Upload:** drag EPUB onto empty state → progress indicator → opens in reader immediately
3. **Progress sync:** read to chapter 3, close, reopen on a different browser → resumes at chapter 3
4. **Notes:** add a note while reading → close → open library → hover book → click ✎ badge → note appears in panel
5. **Reader notes pane:** click ✎ Notes in reader header → panel slides in alongside text → current chapter notes highlighted
6. **Export:** open notes panel → click "Export as Markdown" → `.md` file downloads with correct structure
7. **TTS cross-chapter:** play TTS to end of chapter → automatically advances to next chapter and continues
8. **All existing tests pass:** `npm run test` (39 unit tests), `npm run test:e2e` (53 E2E tests)
