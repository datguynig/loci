# Backend + Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce Clerk authentication and Supabase backend, replace the drop-zone landing with a persistent book library, sync all user data to the cloud, add a per-book notes panel, and document the design system.

**Architecture:** Clerk handles all identity (sign-up/in UI, session JWT). Supabase provides PostgreSQL + file Storage, verified via Clerk's JWKS endpoint. The React app wraps in `ClerkProvider`, creates an authenticated Supabase client per-request using Clerk's JWT, and routes unauthenticated users to a Clerk sign-in gate while authenticated users see the Library screen.

**Tech Stack:** `@clerk/clerk-react`, `@supabase/supabase-js`, Vite env vars, existing Vitest + Playwright test suite.

**Spec:** `docs/superpowers/specs/2026-03-21-loci-backend-library-design.md`

**Follow-up plan:** `docs/superpowers/plans/2026-03-21-reader-features.md` (bookmarks, cross-chapter TTS, search, export, stats, swipe)

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `src/services/supabaseClient.ts` | Factory: returns authenticated Supabase client using Clerk JWT |
| `src/services/bookService.ts` | Upload EPUB to Storage, extract cover/metadata via epubjs, list/delete books |
| `src/services/progressService.ts` | Read/write `reading_progress` table; debounced autosave |
| `src/services/preferencesService.ts` | Sync `preferences` table on sign-in and on change |
| `src/hooks/useLibrary.ts` | Fetch book list, manage upload state, expose library actions |
| `src/hooks/useReadingProgress.ts` | Autosave progress every 30s; restore position on book open |
| `src/components/Library.tsx` | Full library screen: empty state, book grid, continue reading banner |
| `src/components/BookNotesPanel.tsx` | Slide-over panel: all notes for one book, export as Markdown |
| `docs/designsystem.md` | Design token + component pattern reference |
| `.env.example` | Template for required env vars |
| `tests/unit/supabaseClient.test.ts` | Unit tests for client factory |
| `tests/unit/bookService.test.ts` | Unit tests for cover extraction and data mapping |
| `tests/unit/progressService.test.ts` | Unit tests for debounce logic and data shape |

### Modified files
| File | Change |
|---|---|
| `src/App.tsx` | Wrap in `ClerkProvider`; route: unauth → sign-in gate, auth + no file → Library, auth + file → Reader |
| `src/services/annotationService.ts` | Add Supabase read/write alongside localStorage cache |
| `src/hooks/useEpub.ts` | Accept `initialSpineHref` + `initialScrollFraction` params for resume |
| `src/components/Reader.tsx` | Add back-to-library nav, inline notes pane toggle, wire progress hook |
| `package.json` | Add `@clerk/clerk-react`, `@supabase/supabase-js` |
| `.gitignore` | Add `.superpowers/` |

---

## Task 1: Dependencies + env setup

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `.env.example`
- Modify: `.env` (local only, never committed)

- [ ] **Install packages**

```bash
npm install @clerk/clerk-react @supabase/supabase-js
```

Expected: both appear in `package.json` dependencies.

Note: `framer-motion` and `jszip` are already installed. `src/utils/epubSanitizer.ts` already exists.

- [ ] **Add `.superpowers/` to `.gitignore`**

Open `.gitignore`, add at the end:
```
.superpowers/
```

- [ ] **Create `.env.example`**

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_ELEVENLABS_PROXY_URL=
VITE_ELEVENLABS_API_KEY=
```

- [ ] **Populate `.env` with real values** (get from Clerk Dashboard + Supabase Dashboard)

```
VITE_CLERK_PUBLISHABLE_KEY=<your clerk publishable key>
VITE_SUPABASE_URL=<your supabase project url>
VITE_SUPABASE_ANON_KEY=<your supabase anon key>
```

- [ ] **Commit**

```bash
git add package.json package-lock.json .gitignore .env.example
git commit -m "chore: add clerk and supabase dependencies"
```

---

## Task 2: Supabase schema + storage

**This task is done in the Supabase Dashboard SQL editor — not in code.**

- [ ] **Create Supabase project** at supabase.com if not already done. Copy the project URL and anon key into `.env`.

- [ ] **Configure Clerk JWT template in Supabase**

In Supabase Dashboard → Settings → API → JWT Settings:
- Set "JWT Secret" to use Clerk's JWKS endpoint: `https://clerk.your-domain.com/.well-known/jwks.json`
- (Exact steps: Clerk Dashboard → JWT Templates → "Supabase" template → copy the signing key → paste into Supabase JWT secret field)

- [ ] **Run the following SQL in Supabase Dashboard → SQL Editor**

```sql
-- BOOKS
create table public.books (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  title        text not null,
  author       text,
  cover_url    text,
  file_path    text not null,
  file_size    bigint,
  added_at     timestamptz default now(),
  last_read_at timestamptz
);
alter table public.books enable row level security;
create policy "users own their books" on public.books
  for all using ((auth.jwt() ->> 'sub') = user_id);

-- READING PROGRESS
create table public.reading_progress (
  user_id            text not null,
  book_id            uuid not null references public.books(id) on delete cascade,
  spine_href         text not null,
  scroll_fraction    real default 0,
  tts_sentence_index int default 0,
  updated_at         timestamptz default now(),
  primary key (user_id, book_id)
);
alter table public.reading_progress enable row level security;
create policy "users own their progress" on public.reading_progress
  for all using ((auth.jwt() ->> 'sub') = user_id);

-- ANNOTATIONS
create table public.annotations (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  book_id    uuid not null references public.books(id) on delete cascade,
  spine_href text not null,
  quote      text not null,
  note       text not null default '',
  type       text not null default 'note',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.annotations enable row level security;
create policy "users own their annotations" on public.annotations
  for all using ((auth.jwt() ->> 'sub') = user_id);

-- PREFERENCES
create table public.preferences (
  user_id            text primary key,
  theme              text not null default 'light',
  font_size          text not null default 'md',
  layout_mode        text not null default 'scroll',
  highlight_enabled  boolean not null default true,
  autoscroll_enabled boolean not null default true,
  tts_provider       text not null default 'browser',
  tts_rate           real not null default 1.0,
  tts_voice_id       text,
  updated_at         timestamptz default now()
);
alter table public.preferences enable row level security;
create policy "users own their preferences" on public.preferences
  for all using ((auth.jwt() ->> 'sub') = user_id);
```

- [ ] **Create storage buckets in Supabase Dashboard → Storage**

1. Create bucket `books` — toggle **Private** (not public)
2. Create bucket `covers` — toggle **Public**
3. Add storage policy for `books` bucket:
```sql
-- Allow users to manage their own EPUBs
create policy "users manage own epubs" on storage.objects
  for all using (
    bucket_id = 'books' and
    (auth.jwt() ->> 'sub') = (storage.foldername(name))[1]
  );
```
4. Add storage policy for `covers` bucket:
```sql
create policy "users manage own covers" on storage.objects
  for all using (
    bucket_id = 'covers' and
    (auth.jwt() ->> 'sub') = (storage.foldername(name))[1]
  );
```

- [ ] **Verify in Supabase Dashboard** — all 4 tables appear in Table Editor, both buckets exist in Storage.

- [ ] **Commit**

```bash
git add .env.example
git commit -m "chore: document supabase schema (applied via dashboard)"
```

---

## Task 3: Supabase client factory

**Files:**
- Create: `src/services/supabaseClient.ts`
- Create: `tests/unit/supabaseClient.test.ts`

- [ ] **Write the failing test first**

Create `tests/unit/supabaseClient.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { createSupabaseClient } from '../../src/services/supabaseClient'

describe('createSupabaseClient', () => {
  it('returns a supabase client with the configured URL', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')

    const client = createSupabaseClient(async () => 'test-jwt')
    // SupabaseClient exposes supabaseUrl on its internal REST client
    expect((client as any).supabaseUrl).toBe('https://test.supabase.co')
  })

  it('throws if VITE_SUPABASE_URL is not set', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')

    expect(() => createSupabaseClient(async () => 'jwt')).toThrow('VITE_SUPABASE_URL')
  })
})
```

- [ ] **Run test — expect FAIL** (module doesn't exist yet)

```bash
npm run test -- supabaseClient
```

- [ ] **Create `src/services/supabaseClient.ts`**

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Returns an authenticated Supabase client using a Clerk JWT.
 * Call this inside a component/hook where useAuth() is available.
 *
 * Usage:
 *   const { getToken } = useAuth()
 *   const supabase = createSupabaseClient(() => getToken({ template: 'supabase' }))
 */
export function createSupabaseClient(
  getToken: () => Promise<string | null>
): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL as string
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  if (!url) throw new Error('VITE_SUPABASE_URL is not set')
  if (!key) throw new Error('VITE_SUPABASE_ANON_KEY is not set')

  return createClient(url, key, {
    global: {
      fetch: async (input, init) => {
        const token = await getToken()
        const headers = new Headers(init?.headers)
        if (token) headers.set('Authorization', `Bearer ${token}`)
        return fetch(input, { ...init, headers })
      },
    },
  })
}
```

- [ ] **Run test — expect PASS**

```bash
npm run test -- supabaseClient
```

- [ ] **Commit**

```bash
git add src/services/supabaseClient.ts tests/unit/supabaseClient.test.ts
git commit -m "feat: add supabase client factory with clerk jwt injection"
```

---

## Task 4: Clerk integration

**Files:**
- Modify: `src/App.tsx`

- [ ] **Add `ClerkProvider` and auth routing to `src/App.tsx`**

Replace the top of `App.tsx`. The full new structure:

```typescript
import { ClerkProvider, SignIn, useAuth } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import Reader from './components/Reader'
import Library from './components/Library'
import { usePreferences } from './hooks/usePreferences'

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string

function AppContent() {
  const { isSignedIn, isLoaded } = useAuth()
  const { prefs, set } = usePreferences()
  const [openFile, setOpenFile] = useState<File | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', prefs.theme)
  }, [prefs.theme])

  if (!isLoaded) {
    // Clerk is checking session — render nothing (or a spinner)
    return null
  }

  if (!isSignedIn) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--bg-primary)',
      }}>
        <SignIn routing="hash" />
      </div>
    )
  }

  if (openFile) {
    return (
      <Reader
        file={openFile}
        theme={prefs.theme}
        fontSize={prefs.fontSize}
        layoutMode={prefs.layoutMode}
        highlightEnabled={prefs.highlightEnabled}
        autoscrollEnabled={prefs.autoscrollEnabled}
        onThemeChange={(v) => set('theme', v)}
        onFontSizeChange={(v) => set('fontSize', v)}
        onLayoutModeChange={(v) => set('layoutMode', v)}
        onHighlightChange={(v) => set('highlightEnabled', v)}
        onAutoscrollChange={(v) => set('autoscrollEnabled', v)}
        onClose={() => setOpenFile(null)}
      />
    )
  }

  return <Library onOpenFile={setOpenFile} />
}

export default function App() {
  return (
    <ClerkProvider publishableKey={CLERK_KEY}>
      <AppContent />
    </ClerkProvider>
  )
}
```

Note: `Library` and `Reader` receive `onClose` / `onOpenFile` props. `Reader` does not yet exist with `onClose` — that prop will be wired in Task 9.

- [ ] **Verify app starts** — run `npm run dev`, open browser. Should show Clerk sign-in UI instead of the EPUB drop zone.

```bash
npm run dev
```

Expected: Clerk's hosted sign-in component renders at centre of screen.

- [ ] **Commit**

```bash
git add src/App.tsx
git commit -m "feat: wrap app in ClerkProvider with auth-gated routing"
```

---

## Task 5: Book service

**Files:**
- Create: `src/services/bookService.ts`
- Create: `tests/unit/bookService.test.ts`

- [ ] **Write failing tests**

Create `tests/unit/bookService.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { buildBookRecord } from '../../src/services/bookService'

describe('buildBookRecord', () => {
  it('maps metadata to a books-table row', () => {
    const record = buildBookRecord({
      userId: 'user_abc',
      bookId: 'uuid-123',
      title: 'Moby Dick',
      author: 'Herman Melville',
      coverUrl: 'https://cdn.example.com/cover.jpg',
      filePath: 'user_abc/uuid-123.epub',
      fileSize: 1024000,
    })

    expect(record.user_id).toBe('user_abc')
    expect(record.title).toBe('Moby Dick')
    expect(record.author).toBe('Herman Melville')
    expect(record.file_path).toBe('user_abc/uuid-123.epub')
    expect(record.file_size).toBe(1024000)
  })

  it('handles missing author gracefully', () => {
    const record = buildBookRecord({
      userId: 'user_abc', bookId: 'uuid-123',
      title: 'Unknown', author: undefined,
      coverUrl: null, filePath: 'user_abc/uuid-123.epub', fileSize: 0,
    })
    expect(record.author).toBeNull()
  })
})
```

- [ ] **Run test — expect FAIL**

```bash
npm run test -- bookService
```

- [ ] **Create `src/services/bookService.ts`**

```typescript
import { SupabaseClient } from '@supabase/supabase-js'

export interface BookRecord {
  id: string
  user_id: string
  title: string
  author: string | null
  cover_url: string | null
  file_path: string
  file_size: number
  added_at: string
  last_read_at: string | null
}

interface BookInput {
  userId: string
  bookId: string
  title: string
  author?: string
  coverUrl: string | null
  filePath: string
  fileSize: number
}

/** Pure function — maps input to a books-table insert row. Testable without Supabase. */
export function buildBookRecord(input: BookInput): Omit<BookRecord, 'added_at' | 'last_read_at'> & { id: string } {
  return {
    id: input.bookId,
    user_id: input.userId,
    title: input.title,
    author: input.author ?? null,
    cover_url: input.coverUrl ?? null,
    file_path: input.filePath,
    file_size: input.fileSize,
  }
}

/**
 * Uploads an EPUB to Supabase Storage and writes the book record to the database.
 *
 * Cover and metadata must be extracted by the caller (via epubjs) before calling this,
 * since epubjs cannot run in a worker context.
 */
export async function uploadBook(
  supabase: SupabaseClient,
  params: {
    userId: string
    bookId: string
    file: File
    title: string
    author?: string
    coverBlob: Blob | null
  }
): Promise<BookRecord> {
  const { userId, bookId, file, title, author, coverBlob } = params

  // 1. Upload EPUB to Storage
  const filePath = `${userId}/${bookId}.epub`
  const { error: uploadError } = await supabase.storage
    .from('books')
    .upload(filePath, file, { upsert: false })
  if (uploadError) throw uploadError

  // 2. Upload cover to public bucket (if available)
  let coverUrl: string | null = null
  if (coverBlob) {
    const coverPath = `${userId}/${bookId}.jpg`
    const { error: coverError } = await supabase.storage
      .from('covers')
      .upload(coverPath, coverBlob, { contentType: 'image/jpeg', upsert: true })
    if (!coverError) {
      const { data } = supabase.storage.from('covers').getPublicUrl(coverPath)
      coverUrl = data.publicUrl
    }
  }

  // 3. Write book record
  const record = buildBookRecord({ userId, bookId, title, author, coverUrl, filePath, fileSize: file.size })
  const { data, error: insertError } = await supabase
    .from('books')
    .insert(record)
    .select()
    .single()
  if (insertError) throw insertError

  return data as BookRecord
}

/** Fetches all books for the current user, ordered by last_read_at desc. */
export async function listBooks(supabase: SupabaseClient): Promise<BookRecord[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .order('last_read_at', { ascending: false, nullsFirst: false })
    .order('added_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as BookRecord[]
}

/** Returns a signed URL for downloading an EPUB (valid for 60 minutes). */
export async function getEpubUrl(supabase: SupabaseClient, filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('books')
    .createSignedUrl(filePath, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

/** Updates last_read_at for a book. */
export async function touchBook(supabase: SupabaseClient, bookId: string): Promise<void> {
  await supabase
    .from('books')
    .update({ last_read_at: new Date().toISOString() })
    .eq('id', bookId)
}

/** Deletes a book and its EPUB from storage. */
export async function deleteBook(
  supabase: SupabaseClient,
  bookId: string,
  filePath: string,
  coverPath: string | null
): Promise<void> {
  await supabase.from('books').delete().eq('id', bookId)
  await supabase.storage.from('books').remove([filePath])
  if (coverPath) await supabase.storage.from('covers').remove([coverPath])
}
```

- [ ] **Run tests — expect PASS**

```bash
npm run test -- bookService
```

- [ ] **Commit**

```bash
git add src/services/bookService.ts tests/unit/bookService.test.ts
git commit -m "feat: add book service for supabase storage + database"
```

---

## Task 6: Reading progress service

**Files:**
- Create: `src/services/progressService.ts`
- Create: `tests/unit/progressService.test.ts`

- [ ] **Write failing tests**

Create `tests/unit/progressService.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { buildProgressRecord } from '../../src/services/progressService'

describe('buildProgressRecord', () => {
  it('builds a valid progress row', () => {
    const row = buildProgressRecord({
      userId: 'user_abc',
      bookId: 'book-uuid',
      spineHref: 'chapter02.xhtml',
      scrollFraction: 0.42,
      ttsSentenceIndex: 7,
    })
    expect(row.user_id).toBe('user_abc')
    expect(row.book_id).toBe('book-uuid')
    expect(row.spine_href).toBe('chapter02.xhtml')
    expect(row.scroll_fraction).toBe(0.42)
    expect(row.tts_sentence_index).toBe(7)
  })

  it('clamps scroll_fraction between 0 and 1', () => {
    const row = buildProgressRecord({
      userId: 'u', bookId: 'b', spineHref: 'c.xhtml',
      scrollFraction: 1.5, ttsSentenceIndex: 0,
    })
    expect(row.scroll_fraction).toBe(1)
  })
})
```

- [ ] **Run test — expect FAIL**

```bash
npm run test -- progressService
```

- [ ] **Create `src/services/progressService.ts`**

```typescript
import { SupabaseClient } from '@supabase/supabase-js'

export interface ProgressRecord {
  user_id: string
  book_id: string
  spine_href: string
  scroll_fraction: number
  tts_sentence_index: number
  updated_at: string
}

interface ProgressInput {
  userId: string
  bookId: string
  spineHref: string
  scrollFraction: number
  ttsSentenceIndex: number
}

/** Pure function — builds a progress upsert row. Testable without Supabase. */
export function buildProgressRecord(input: ProgressInput): Omit<ProgressRecord, 'updated_at'> {
  return {
    user_id: input.userId,
    book_id: input.bookId,
    spine_href: input.spineHref,
    scroll_fraction: Math.min(1, Math.max(0, input.scrollFraction)),
    tts_sentence_index: input.ttsSentenceIndex,
  }
}

/** Upserts reading progress. Silently ignores errors (non-critical). */
export async function saveProgress(
  supabase: SupabaseClient,
  input: ProgressInput
): Promise<void> {
  const row = buildProgressRecord(input)
  await supabase
    .from('reading_progress')
    .upsert({ ...row, updated_at: new Date().toISOString() })
    .eq('user_id', input.userId)
    .eq('book_id', input.bookId)
}

/** Returns saved progress for a book, or null if none exists. */
export async function loadProgress(
  supabase: SupabaseClient,
  userId: string,
  bookId: string
): Promise<Omit<ProgressRecord, 'updated_at'> | null> {
  const { data } = await supabase
    .from('reading_progress')
    .select('user_id, book_id, spine_href, scroll_fraction, tts_sentence_index')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .single()
  return data ?? null
}
```

- [ ] **Run tests — expect PASS**

```bash
npm run test -- progressService
```

- [ ] **Commit**

```bash
git add src/services/progressService.ts tests/unit/progressService.test.ts
git commit -m "feat: add reading progress service"
```

---

## Task 7: Library hook

**Files:**
- Create: `src/hooks/useLibrary.ts`

- [ ] **Create `src/hooks/useLibrary.ts`**

This hook manages the book list and upload flow. No unit tests — it depends on Supabase + Clerk and is covered by E2E.

```typescript
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import ePub from 'epubjs'
import { v4 as uuidv4 } from 'uuid'  // add: npm install uuid @types/uuid
import { createSupabaseClient } from '../services/supabaseClient'
import { uploadBook, listBooks, BookRecord } from '../services/bookService'
import { sanitizeEpubBuffer } from '../utils/epubSanitizer'

export type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; progress: number }
  | { status: 'error'; message: string }

export function useLibrary() {
  const { getToken, userId } = useAuth()
  const [books, setBooks] = useState<BookRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' })

  const supabase = useCallback(
    () => createSupabaseClient(() => getToken({ template: 'supabase' })),
    [getToken]
  )

  // Load book list on mount
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listBooks(supabase())
      .then((list) => { if (!cancelled) setBooks(list) })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [supabase])

  const uploadEpub = useCallback(async (file: File): Promise<BookRecord> => {
    if (!userId) throw new Error('Not signed in')
    setUploadState({ status: 'uploading', progress: 0 })
    try {
      // Extract metadata + cover client-side via epubjs
      const rawBuffer = await file.arrayBuffer()
      const buffer = await sanitizeEpubBuffer(rawBuffer)
      const book = ePub(buffer)
      const [metadata, coverUrl] = await Promise.all([
        book.loaded.metadata,
        book.coverUrl(),
      ])

      // Convert cover URL to Blob for upload
      let coverBlob: Blob | null = null
      if (coverUrl) {
        try {
          const res = await fetch(coverUrl)
          coverBlob = await res.blob()
        } catch { /* cover optional */ }
      }
      book.destroy()

      setUploadState({ status: 'uploading', progress: 50 })

      const bookId = uuidv4()
      const record = await uploadBook(supabase(), {
        userId,
        bookId,
        file,
        title: (metadata as any).title || file.name.replace(/\.epub$/i, ''),
        author: (metadata as any).creator,
        coverBlob,
      })

      setBooks((prev) => [record, ...prev])
      setUploadState({ status: 'idle' })
      return record
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setUploadState({ status: 'error', message })
      throw err
    }
  }, [userId, supabase])

  const mostRecentBook = books[0] ?? null

  return { books, loading, uploadState, uploadEpub, mostRecentBook }
}
```

- [ ] **Install uuid**

```bash
npm install uuid
npm install --save-dev @types/uuid
```

- [ ] **Commit**

```bash
git add src/hooks/useLibrary.ts package.json package-lock.json
git commit -m "feat: add useLibrary hook for book list and upload"
```

---

## Task 8: Library component

**Files:**
- Create: `src/components/Library.tsx`

This is the main library screen. Design spec in `docs/superpowers/specs/2026-03-21-loci-backend-library-design.md` section 5. See also the approved mockup in `.superpowers/brainstorm/*/library-v3.html`.

- [ ] **Create `src/components/Library.tsx`**

```tsx
import { useRef, useCallback } from 'react'
import { useClerk } from '@clerk/clerk-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLibrary } from '../hooks/useLibrary'
import { BookRecord } from '../services/bookService'
import BookNotesPanel from './BookNotesPanel'
import { useState } from 'react'

interface Props {
  onOpenFile: (file: File) => void
}

export default function Library({ onOpenFile }: Props) {
  const { books, loading, uploadState, uploadEpub } = useLibrary()
  const { signOut, user } = useClerk()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [notesBook, setNotesBook] = useState<BookRecord | null>(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = useCallback(async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    const isEpub = file.name.toLowerCase().endsWith('.epub') || file.type === 'application/epub+zip'
    if (!isEpub) return
    try {
      await uploadEpub(file)
      // After upload, open the file directly in reader
      onOpenFile(file)
    } catch { /* uploadState.error is set */ }
  }, [uploadEpub, onOpenFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const mostRecent = books[0] ?? null
  const initials = user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? '?'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: 56, borderBottom: '1px solid var(--border)',
        background: 'var(--bg-primary)', position: 'sticky', top: 0, zIndex: 20,
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500 }}>Loci</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'var(--text-primary)', color: 'var(--bg-primary)',
              border: 'none', borderRadius: 8, padding: '7px 14px',
              fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 15 }}>+</span> Add book
          </button>
          <div
            onClick={() => signOut()}
            title="Sign out"
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--accent-warm)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {initials}
          </div>
        </div>
      </nav>

      <input
        ref={fileInputRef}
        type="file"
        accept=".epub,application/epub+zip"
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Upload error toast */}
      <AnimatePresence>
        {uploadState.status === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 16, right: 16, zIndex: 50,
              background: '#fff', border: '1px solid var(--border)',
              borderRadius: 10, padding: '12px 16px', fontSize: 13,
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            }}
          >
            {uploadState.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div style={{ padding: '32px 40px 100px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80, color: 'var(--text-tertiary)', fontSize: 13 }}>
            Loading your library…
          </div>
        ) : books.length === 0 ? (
          /* Empty state */
          <EmptyState dragging={dragging} onDrop={handleDrop} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onClick={() => fileInputRef.current?.click()} />
        ) : (
          <>
            {/* Continue reading */}
            {mostRecent && (
              <>
                <SectionLabel>Continue reading</SectionLabel>
                <ContinueCard book={mostRecent} onOpen={() => {/* TODO: open from signed URL in Task 9 */}} />
              </>
            )}

            {/* Book grid */}
            <SectionLabel style={{ marginTop: mostRecent ? 40 : 0 }}>All books</SectionLabel>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '28px 20px',
            }}>
              {books.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  onOpen={() => {/* TODO: open from signed URL in Task 9 */}}
                  onNotes={(e) => { e.stopPropagation(); setNotesBook(book) }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Notes slide-over */}
      <BookNotesPanel book={notesBook} onClose={() => setNotesBook(null)} />
    </div>
  )
}

/* ── Sub-components ── */

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const,
      letterSpacing: '0.8px', color: 'var(--text-tertiary)', marginBottom: 14, ...style,
    }}>
      {children}
    </div>
  )
}

function EmptyState({ dragging, onDrop, onDragOver, onDragLeave, onClick }: {
  dragging: boolean
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onClick: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 120px)', textAlign: 'center', padding: '0 40px' }}>
      <div style={{ fontSize: 32, marginBottom: 24, opacity: 0.4 }}>📚</div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 400, marginBottom: 10, letterSpacing: '-0.2px' }}>Your library is empty</h2>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 300, lineHeight: 1.65, marginBottom: 32 }}>
        Add your first book to get started. Your EPUBs are stored privately and sync across all your devices.
      </p>
      <div
        onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave} onClick={onClick}
        style={{
          width: 320, border: `1.5px dashed ${dragging ? 'var(--accent-warm)' : 'rgba(196,168,130,0.4)'}`,
          borderRadius: 14, padding: '36px 28px',
          background: dragging ? 'rgba(196,168,130,0.05)' : 'transparent',
          cursor: 'pointer', transition: 'all 200ms', color: 'var(--text-secondary)',
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 10 }}>↑</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent-warm)', marginBottom: 4 }}>Drop an EPUB here</div>
        <div style={{ fontSize: 13 }}>or click to browse</div>
      </div>
    </div>
  )
}

function ContinueCard({ book, onOpen }: { book: BookRecord; onOpen: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '14px 18px', marginBottom: 40,
        cursor: 'pointer', maxWidth: 480,
        boxShadow: hover ? '0 4px 18px rgba(0,0,0,0.09)' : '0 1px 8px rgba(0,0,0,0.05)',
        transform: hover ? 'translateY(-1px)' : 'none',
        transition: 'all 150ms',
      }}
    >
      <BookCover book={book} width={40} height={60} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{book.title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>{book.author}</div>
        <div style={{ background: 'var(--border)', borderRadius: 99, height: 2, width: 140 }} />
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
          {book.last_read_at ? `Last read ${formatRelative(book.last_read_at)}` : 'Not started'}
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, padding: '6px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 7, whiteSpace: 'nowrap', flexShrink: 0 }}>
        Continue →
      </div>
    </div>
  )
}

function BookCard({ book, onOpen, onNotes }: { book: BookRecord; onOpen: () => void; onNotes: (e: React.MouseEvent) => void }) {
  const [hover, setHover] = useState(false)
  return (
    <div style={{ cursor: 'pointer' }} onClick={onOpen} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div style={{ position: 'relative', marginBottom: 9 }}>
        <div style={{
          width: '100%', aspectRatio: '2/3', borderRadius: 7, overflow: 'hidden', position: 'relative',
          boxShadow: hover ? '0 8px 24px rgba(0,0,0,0.17)' : '0 3px 14px rgba(0,0,0,0.13)',
          transform: hover ? 'translateY(-3px) scale(1.015)' : 'none',
          transition: 'all 180ms',
        }}>
          <BookCover book={book} width="100%" height="100%" />
          {/* Hover overlay */}
          <div style={{
            position: 'absolute', inset: 0, opacity: hover ? 1 : 0, transition: 'opacity 180ms',
            background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 55%)',
            display: 'flex', alignItems: 'flex-end', padding: 9,
          }}>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: '#fff' }}>Read</span>
          </div>
          {/* Notes badge */}
          <button
            onClick={onNotes}
            style={{
              position: 'absolute', top: 7, right: 7,
              background: 'rgba(248,247,244,0.9)', border: '1px solid rgba(0,0,0,0.09)',
              borderRadius: 99, padding: '2px 7px', fontSize: 10, fontWeight: 500,
              color: 'var(--text-secondary)', opacity: hover ? 1 : 0, transition: 'opacity 180ms',
              cursor: 'pointer', backdropFilter: 'blur(8px)',
            }}
          >
            ✎
          </button>
          {/* Progress strip */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.2)' }} />
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.4 }}>{book.title}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{book.author}</div>
    </div>
  )
}

function BookCover({ book, width, height }: { book: BookRecord; width: number | string; height: number | string }) {
  if (book.cover_url) {
    return <img src={book.cover_url} alt={book.title} style={{ width, height, objectFit: 'cover', display: 'block' }} />
  }
  // Fallback: gradient placeholder derived from title
  const hue = (book.title.charCodeAt(0) * 17) % 360
  return (
    <div style={{
      width, height, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(150deg, hsl(${hue},35%,35%), hsl(${hue},30%,60%))`,
      padding: 8, textAlign: 'center',
    }}>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4, fontFamily: 'var(--font-display)' }}>{book.title}</span>
    </div>
  )
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
```

- [ ] **Verify app renders library** — sign in, the Library screen should show with empty state. Try dragging an EPUB onto the drop zone.

- [ ] **Commit**

```bash
git add src/components/Library.tsx
git commit -m "feat: add Library screen with empty state and book grid"
```

---

## Task 9: Open books from library (signed URL flow)

Books in Supabase Storage are private and require a signed URL. The Library can't pass a `File` object directly — it needs to download the EPUB as a `Blob` then convert it.

**Files:**
- Modify: `src/components/Library.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/Reader.tsx`

- [ ] **Update `App.tsx` to carry the `BookRecord` alongside the `File`**

Change the open-book state to carry both the file and the Supabase book record (for `bookId`):

```typescript
interface OpenBook {
  file: File
  bookId: string | null  // null when opened from a local File (no Supabase record yet)
}

const [openBook, setOpenBook] = useState<OpenBook | null>(null)
```

Update `handleOpenFile` so `Library` can pass the record:
```typescript
// In AppContent:
const handleOpenFile = useCallback((file: File, bookId?: string) => {
  setOpenBook({ file, bookId: bookId ?? null })
}, [])
```

Update the `Library` component's `onOpenFile` prop type:
```typescript
// In Library.tsx:
interface Props {
  onOpenFile: (file: File, bookId?: string) => void
}
```

In `handleOpenBook` inside `Library.tsx` (where the file is downloaded), pass the book ID:
```typescript
onOpenFile(file, book.id)   // book.id is the Supabase UUID
```

Pass `bookId` and `onClose` to Reader:
```typescript
<Reader
  file={openBook.file}
  bookId={openBook.bookId}   // new prop — used by useReadingProgress
  ...
  onClose={() => setOpenBook(null)}
/>
```

Add `bookId?: string | null` to `Reader`'s props interface.

- [ ] **Add download + open function to `Library.tsx`**

In `Library.tsx`, replace the `{/* TODO: open from signed URL in Task 9 */}` comments with:

```typescript
const handleOpenBook = useCallback(async (book: BookRecord) => {
  try {
    const url = await getEpubUrl(supabase(), book.file_path)
    const res = await fetch(url)
    const blob = await res.blob()
    const file = new File([blob], `${book.title}.epub`, { type: 'application/epub+zip' })
    onOpenFile(file)
  } catch (err) {
    console.error('Failed to open book', err)
  }
}, [supabase, onOpenFile])
```

Import `getEpubUrl` from `bookService`. Pass `handleOpenBook(book)` to `ContinueCard` and `BookCard` `onOpen` props.

- [ ] **Add `onClose` back-button to `Reader.tsx`**

`Reader.tsx` already receives props. Add `onClose?: () => void` to its props interface. In the header area (top-left), add a back arrow that calls `onClose`:

```typescript
// In Reader's header, alongside the hamburger/title area:
{onClose && (
  <button
    onClick={onClose}
    style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: 'var(--text-secondary)', fontSize: 13, padding: '4px 8px',
      borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4,
    }}
  >
    ← Library
  </button>
)}
```

- [ ] **Verify end-to-end:** upload an EPUB → book appears in library → click "Continue reading" → reader opens. Press "← Library" → returns to library.

- [ ] **Commit**

```bash
git add src/App.tsx src/components/Library.tsx src/components/Reader.tsx
git commit -m "feat: open books from supabase storage via signed url"
```

---

## Task 10: Reading progress autosave + restore

**Files:**
- Create: `src/hooks/useReadingProgress.ts`
- Modify: `src/components/Reader.tsx`
- Modify: `src/hooks/useEpub.ts`

- [ ] **Create `src/hooks/useReadingProgress.ts`**

```typescript
import { useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { createSupabaseClient } from '../services/supabaseClient'
import { saveProgress, loadProgress } from '../services/progressService'

interface Props {
  bookId: string | null
  spineHref: string | null
  scrollFraction: number
  ttsSentenceIndex: number
}

interface SavedPosition {
  spineHref: string
  scrollFraction: number
  ttsSentenceIndex: number
}

export function useReadingProgress({ bookId, spineHref, scrollFraction, ttsSentenceIndex }: Props) {
  const { getToken, userId } = useAuth()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const supabase = useCallback(
    () => createSupabaseClient(() => getToken({ template: 'supabase' })),
    [getToken]
  )

  // Autosave every 30s
  useEffect(() => {
    if (!bookId || !spineHref || !userId) return
    timerRef.current = setInterval(() => {
      saveProgress(supabase(), { userId, bookId, spineHref, scrollFraction, ttsSentenceIndex })
    }, 30_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [bookId, spineHref, scrollFraction, ttsSentenceIndex, userId, supabase])

  // Save on unmount (book closed)
  useEffect(() => {
    return () => {
      if (!bookId || !spineHref || !userId) return
      saveProgress(supabase(), { userId, bookId, spineHref, scrollFraction, ttsSentenceIndex })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId])

  const loadSavedPosition = useCallback(async (): Promise<SavedPosition | null> => {
    if (!bookId || !userId) return null
    const record = await loadProgress(supabase(), userId, bookId)
    if (!record) return null
    return {
      spineHref: record.spine_href,
      scrollFraction: record.scroll_fraction,
      ttsSentenceIndex: record.tts_sentence_index,
    }
  }, [bookId, userId, supabase])

  return { loadSavedPosition }
}
```

- [ ] **Expose `currentSpineHref` and `scrollFraction` from `useEpub.ts`**

In `src/hooks/useEpub.ts`, add to the returned object:
```typescript
// In the return statement of useEpub:
currentSpineHref: currentHref,  // already tracked as state
scrollFraction: 0,               // TODO: derive from rendition scroll position if needed
```

Also accept initial position params — add to `UseEpubOptions`:
```typescript
initialSpineHref?: string
```

In `loadBook`, after `attachRendition`, if `initialSpineHref` is set, navigate there:
```typescript
if (options.initialSpineHref) {
  await renditionRef.current?.display(options.initialSpineHref)
}
```

- [ ] **Wire `useReadingProgress` into `Reader.tsx`**

```typescript
// In Reader.tsx, after useEpub:
const { loadSavedPosition } = useReadingProgress({
  bookId: bookId ?? null,  // pass bookId as a prop from App.tsx (the Supabase book UUID)
  spineHref: epub.currentSpineHref,
  scrollFraction: 0,
  ttsSentenceIndex: speech.sentenceIndex ?? 0,
})

// On book load, restore position:
useEffect(() => {
  if (!bookId) return
  loadSavedPosition().then((pos) => {
    if (pos?.spineHref) epub.navigateTo(pos.spineHref)
  })
}, [bookId])
```

Pass `bookId` from `App.tsx` to `Reader` (the Supabase book UUID, available from `BookRecord.id`).

- [ ] **Verify:** Read to chapter 3, close book, reopen — should resume at chapter 3.

- [ ] **Commit**

```bash
git add src/hooks/useReadingProgress.ts src/hooks/useEpub.ts src/components/Reader.tsx
git commit -m "feat: autosave and restore reading progress via supabase"
```

---

## Task 11: Sync annotations to Supabase

**Files:**
- Modify: `src/services/annotationService.ts`

The current interface (`getAnnotations`, `saveAnnotation`, `deleteAnnotation`, `getAnnotationsForHref`) must remain unchanged so no callers break. Add Supabase write-through alongside localStorage.

- [ ] **Update `src/services/annotationService.ts`**

Add an optional `supabase` client parameter to write-through functions. When `supabase` is provided, write to Supabase; always write to localStorage as cache.

```typescript
import { SupabaseClient } from '@supabase/supabase-js'

// ... existing Annotation interface and localStorage functions unchanged ...

/** Saves to localStorage (always) and Supabase (when client + userId provided). */
export async function saveAnnotationSync(
  annotation: Annotation,
  supabase?: SupabaseClient,
  userId?: string        // Clerk userId — must be passed explicitly, never derived from bookId
): Promise<void> {
  // Always save locally first
  saveAnnotation(annotation)
  // Write to Supabase if available
  if (supabase && userId) {
    await supabase.from('annotations').upsert({
      id: annotation.id,
      user_id: userId,   // Clerk user ID passed from the hook/component that has useAuth()
      book_id: annotation.bookId,
      spine_href: annotation.href,
      quote: annotation.quote,
      note: annotation.note,
      type: 'note',
      updated_at: new Date().toISOString(),
    })
  }
}

/** Deletes from localStorage (always) and Supabase (when client provided). */
export async function deleteAnnotationSync(
  id: string,
  bookId: string,
  supabase?: SupabaseClient
): Promise<void> {
  deleteAnnotation(id, bookId)
  if (supabase) {
    await supabase.from('annotations').delete().eq('id', id)
  }
}

/** Loads annotations — Supabase first, falls back to localStorage. */
export async function loadAnnotationsFromCloud(
  bookId: string,
  supabase: SupabaseClient
): Promise<Annotation[]> {
  const { data, error } = await supabase
    .from('annotations')
    .select('*')
    .eq('book_id', bookId)
    .order('created_at', { ascending: true })
  if (error || !data) return getAnnotations(bookId)
  const annotations: Annotation[] = data.map((row: any) => ({
    id: row.id,
    bookId: row.book_id,
    href: row.spine_href,
    quote: row.quote,
    note: row.note,
    createdAt: new Date(row.created_at).getTime(),
  }))
  // Sync cloud annotations to localStorage cache
  localStorage.setItem(`loci_annotations_${bookId}`, JSON.stringify(annotations))
  return annotations
}
```

- [ ] **Run unit tests to ensure existing annotation tests still pass**

```bash
npm run test -- annotationService
```

Expected: all 14 existing tests pass.

- [ ] **Commit**

```bash
git add src/services/annotationService.ts
git commit -m "feat: add supabase write-through to annotation service"
```

---

## Task 12: Sync preferences to Supabase

**Files:**
- Create: `src/services/preferencesService.ts`
- Modify: `src/hooks/usePreferences.ts`

- [ ] **Create `src/services/preferencesService.ts`**

```typescript
import { SupabaseClient } from '@supabase/supabase-js'
import { Preferences } from '../hooks/usePreferences'

export async function loadPreferencesFromCloud(
  supabase: SupabaseClient,
  userId: string
): Promise<Partial<Preferences> | null> {
  const { data } = await supabase
    .from('preferences')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (!data) return null
  return {
    theme: data.theme,
    fontSize: data.font_size,
    layoutMode: data.layout_mode,
    highlightEnabled: data.highlight_enabled,
    autoscrollEnabled: data.autoscroll_enabled,
  }
}

export async function savePreferencesToCloud(
  supabase: SupabaseClient,
  userId: string,
  prefs: Preferences
): Promise<void> {
  await supabase.from('preferences').upsert({
    user_id: userId,
    theme: prefs.theme,
    font_size: prefs.fontSize,
    layout_mode: prefs.layoutMode,
    highlight_enabled: prefs.highlightEnabled,
    autoscroll_enabled: prefs.autoscrollEnabled,
    updated_at: new Date().toISOString(),
  })
}
```

- [ ] **Update `usePreferences.ts` to sync on sign-in**

In `src/hooks/usePreferences.ts`, the `usePreferences` hook currently loads from localStorage. Add a one-time cloud load on mount:

```typescript
// Add to usePreferences (inside the hook body, after useState):
const { getToken, userId, isSignedIn } = useAuth()

useEffect(() => {
  if (!isSignedIn || !userId) return
  const client = createSupabaseClient(() => getToken({ template: 'supabase' }))
  loadPreferencesFromCloud(client, userId).then((cloudPrefs) => {
    if (cloudPrefs) setPrefs((local) => ({ ...local, ...cloudPrefs }))
  })
}, [isSignedIn, userId]) // only on sign-in
```

Also sync to cloud when prefs change (add to the existing `useEffect`):
```typescript
useEffect(() => {
  savePreferences(prefs) // existing localStorage save
  if (isSignedIn && userId) {
    const client = createSupabaseClient(() => getToken({ template: 'supabase' }))
    savePreferencesToCloud(client, userId, prefs) // fire-and-forget
  }
}, [prefs])
```

- [ ] **Run existing preference tests**

```bash
npm run test -- preferences
```

Expected: all 11 tests still pass (the hook changes add optional cloud sync but don't break existing behaviour).

- [ ] **Commit**

```bash
git add src/services/preferencesService.ts src/hooks/usePreferences.ts
git commit -m "feat: sync preferences to supabase on sign-in and change"
```

---

## Task 13: BookNotesPanel component

**Files:**
- Create: `src/components/BookNotesPanel.tsx`

Notes panel slide-over. Opens from library when user clicks the notes badge on a book cover. Design reference: `.superpowers/brainstorm/*/library-v3.html` (Screen ① — hover a book, click ✎).

- [ ] **Create `src/components/BookNotesPanel.tsx`**

```tsx
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookRecord } from '../services/bookService'
import { Annotation, loadAnnotationsFromCloud } from '../services/annotationService'
import { createSupabaseClient } from '../services/supabaseClient'

interface Props {
  book: BookRecord | null
  onClose: () => void
}

export default function BookNotesPanel({ book, onClose }: Props) {
  const { getToken } = useAuth()
  const [notes, setNotes] = useState<Annotation[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!book) return
    setLoading(true)
    const client = createSupabaseClient(() => getToken({ template: 'supabase' }))
    loadAnnotationsFromCloud(book.id, client)
      .then(setNotes)
      .finally(() => setLoading(false))
  }, [book, getToken])

  const exportMarkdown = useCallback(() => {
    if (!book || notes.length === 0) return
    const lines = [
      `# Notes — ${book.title}`,
      `*${book.author ?? 'Unknown author'}*`,
      '',
    ]
    // Group by spine_href
    const groups = notes.reduce<Record<string, Annotation[]>>((acc, n) => {
      ;(acc[n.href] ??= []).push(n)
      return acc
    }, {})
    for (const [href, groupNotes] of Object.entries(groups)) {
      lines.push(`## ${href.replace(/\.x?html.*$/i, '').replace(/[-_]/g, ' ')}`, '')
      for (const n of groupNotes) {
        lines.push(`> ${n.quote}`, '', n.note || '', `*${new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}*`, '')
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${book.title} — Notes.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [book, notes])

  const isOpen = book !== null

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,26,0.15)', zIndex: 30 }}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <motion.div
        initial={{ x: '100%' }} animate={{ x: isOpen ? 0 : '100%' }}
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
        style={{
          position: 'fixed', right: 0, top: 0, bottom: 0, width: 400, zIndex: 40,
          background: 'var(--bg-surface)', boxShadow: '-2px 0 32px rgba(0,0,0,0.1)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {book && (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <NotesCover book={book} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{book.author}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{notes.length} notes</div>
              </div>
              <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>✕</button>
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <button
                onClick={exportMarkdown}
                disabled={notes.length === 0}
                style={{ fontSize: 12, fontWeight: 500, color: notes.length === 0 ? 'var(--text-tertiary)' : 'var(--text-secondary)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', cursor: notes.length === 0 ? 'default' : 'pointer' }}
              >
                ↗ Export as Markdown
              </button>
            </div>

            {/* Notes list */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Loading notes…</div>
              ) : notes.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, lineHeight: 1.65 }}>No notes yet.<br />Select text while reading to add one.</div>
              ) : (
                notes.map((note) => (
                  <div key={note.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: 'var(--accent-warm)', marginBottom: 7 }}>
                      {note.href.replace(/\.x?html.*$/i, '').replace(/[-_]/g, ' ')}
                    </div>
                    <div style={{ fontFamily: 'var(--font-reading)', fontStyle: 'italic', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65, paddingLeft: 10, borderLeft: '2px solid var(--accent-warm)', marginBottom: 7 }}>
                      {note.quote}
                    </div>
                    {note.note && (
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{note.note}</div>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
                      {new Date(note.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </motion.div>
    </>
  )
}

function NotesCover({ book }: { book: BookRecord }) {
  if (book.cover_url) {
    return <img src={book.cover_url} alt={book.title} style={{ width: 36, height: 54, borderRadius: 4, objectFit: 'cover', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }} />
  }
  const hue = (book.title.charCodeAt(0) * 17) % 360
  return <div style={{ width: 36, height: 54, borderRadius: 4, flexShrink: 0, background: `linear-gradient(150deg, hsl(${hue},35%,35%), hsl(${hue},30%,60%))` }} />
}
```

- [ ] **Verify:** Open library, hover a book with notes, click ✎ badge — panel slides in with notes listed. Click Export — `.md` file downloads.

- [ ] **Commit**

```bash
git add src/components/BookNotesPanel.tsx
git commit -m "feat: add per-book notes slide-over panel with markdown export"
```

---

## Task 14: Inline reader notes pane

**Files:**
- Modify: `src/components/Reader.tsx`

Add a right-side notes pane that slides in alongside the book text when the user clicks "✎ Notes" in the reader header. Design reference: `.superpowers/brainstorm/*/library-v3.html` (Screen ②).

- [ ] **Add notes pane state + toggle button to `Reader.tsx`**

```typescript
// New state in Reader:
const [notesOpen, setNotesOpen] = useState(false)
const [bookNotes, setBookNotes] = useState<Annotation[]>([])
```

- [ ] **Add notes toggle button to the reader header** (alongside existing settings gear)

```tsx
<button
  onClick={() => setNotesOpen((o) => !o)}
  aria-label="Toggle notes"
  aria-expanded={notesOpen}
  style={{
    padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)',
    fontSize: 12, fontWeight: 500, cursor: 'pointer',
    background: notesOpen ? 'rgba(196,168,130,0.15)' : 'var(--bg-surface)',
    borderColor: notesOpen ? 'rgba(196,168,130,0.4)' : 'var(--border)',
    color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
  }}
>
  ✎ Notes
</button>
```

- [ ] **Add the notes pane alongside the reader content**

Wrap the existing epub viewer and the notes pane in a flex row:

```tsx
<div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
  {/* Existing epub viewer — unchanged */}
  <div style={{ flex: 1, minWidth: 0, /* ... existing styles */ }}>
    {/* epub content */}
  </div>

  {/* Inline notes pane */}
  <motion.div
    animate={{ width: notesOpen ? 300 : 0 }}
    transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
    style={{
      flexShrink: 0, overflow: 'hidden',
      borderLeft: '1px solid var(--border)',
      background: 'var(--bg-surface)',
      display: 'flex', flexDirection: 'column',
    }}
  >
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>Notes</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{bookNotes.length} across all chapters</div>
    </div>
    <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
      {bookNotes.map((note) => (
        <div
          key={note.id}
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            borderLeft: note.href === epub.currentSpineHref ? '2px solid var(--accent-warm)' : '2px solid transparent',
            background: note.href === epub.currentSpineHref ? 'rgba(196,168,130,0.06)' : 'transparent',
          }}
        >
          <div style={{ fontFamily: 'var(--font-reading)', fontStyle: 'italic', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 4 }}>
            {note.quote.length > 80 ? note.quote.slice(0, 80) + '…' : note.quote}
          </div>
          {note.note && <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{note.note}</div>}
        </div>
      ))}
      {bookNotes.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12, lineHeight: 1.65 }}>
          Select text to add a note.
        </div>
      )}
    </div>
  </motion.div>
</div>
```

- [ ] **Load notes when book opens**

In the `useEffect` that fires when `file` loads, also load cloud annotations:
```typescript
if (bookId) {
  const client = createSupabaseClient(() => getToken({ template: 'supabase' }))
  loadAnnotationsFromCloud(bookId, client).then(setBookNotes)
}
```

Refresh `bookNotes` after a new annotation is saved.

- [ ] **Verify:** Open a book with notes, click ✎ Notes in header — pane slides in alongside the text. Notes on the current chapter are highlighted. TTS continues to work.

- [ ] **Commit**

```bash
git add src/components/Reader.tsx
git commit -m "feat: add inline notes pane to reader with chapter highlighting"
```

---

## Task 15: Design system doc

**Files:**
- Create: `docs/designsystem.md`

- [ ] **Create `docs/designsystem.md`**

Derive all values by reading `src/styles/globals.css` and the inline styles across all components. The document should cover:

```markdown
# Loci Design System

## Overview
Single-page EPUB reader. Editorial, warm, minimal. Light mode is primary; dark mode is a first-class variant.

## Color Tokens
All colors are CSS custom properties. Switch theme by setting `data-theme="dark"` on `<html>`.

### Light (default)
| Token | Value | Usage |
|---|---|---|
| --bg-primary | #F8F7F4 | Page background |
| --bg-secondary | #EFEDE8 | Hover states, input backgrounds |
| --bg-surface | #FFFFFF | Cards, panels, popovers |
| --text-primary | #1A1A1A | Body text, headings |
| --text-secondary | #6B6560 | Supporting labels |
| --text-tertiary | #B0ACA6 | Placeholders, metadata, timestamps |
| --accent | #1A1A1A | Same as text-primary |
| --accent-warm | #C4A882 | Active states, highlights, CTAs, progress |
| --border | rgba(0,0,0,0.08) | Dividers, card borders |
| --shadow | rgba(0,0,0,0.06) | Soft elevation shadows |

### Dark
| Token | Value |
|---|---|
| --bg-primary | #111110 |
| --bg-secondary | #1C1C1A |
| --bg-surface | #242422 |
| --text-primary | #F0EDE8 |
| --text-secondary | #8A8780 |
| --text-tertiary | #4A4845 |
| --accent-warm | #C4A882 (unchanged) |
| --border | rgba(255,255,255,0.07) |
| --shadow | rgba(0,0,0,0.3) |

## Typography
Three font families, each with a distinct role. Never mix roles.

| Font | Variable | Role | Sizes used |
|---|---|---|---|
| Playfair Display | --font-display | Wordmark, chapter headings, display text | 20px (nav), 22px (wordmark), 26–28px (headings) |
| Lora | --font-reading | Book body text, note quotes (italic) | 16–23px (body), 12–13px (quote excerpts) |
| DM Sans | --font-ui | All UI — buttons, labels, menus, metadata | 10–15px |

## Spacing Scale
Base unit: 8px. Common values: 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48px.

## Border Radius
| Size | Value | Usage |
|---|---|---|
| xs | 4px | Small buttons, toggle knobs |
| sm | 6–7px | Input fields, small cards |
| md | 8–10px | Popovers, notes editor, voice picker |
| lg | 12–14px | Library cards, modals |
| pill | 99px | Segmented controls, badges, progress bars |
| circle | 50% | Avatar, round transport buttons |

## Elevation / Shadow
| Level | Value | Usage |
|---|---|---|
| 1 (subtle) | 0 1px 8px rgba(0,0,0,0.05) | Library cards, continue reading |
| 2 (card) | 0 3px 14px rgba(0,0,0,0.13) | Book covers (rest) |
| 3 (raised) | 0 8px 32px rgba(0,0,0,0.12) | Popovers, slide-over panels, voice picker |
| 4 (overlay) | 0 8px 32px rgba(0,0,0,0.14) | Modals, selection bubble |

## Motion
Default transition: `120ms ease`. Use `150ms ease` for toggles and small state changes.

Framer Motion presets:
- **Page-level**: `{ duration: 0.18, ease: 'easeOut' }`
- **Panels / drawers**: `{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }` (custom cubic)
- **Micro-interactions**: `{ duration: 0.12 }`

Never animate layout properties (width/height) except via Framer Motion's `animate` prop.

## Component Patterns

### Buttons
```
Primary (dark fill):    background: var(--text-primary), color: var(--bg-primary), border-radius: 8px, padding: 7px 14px
Ghost:                  background: transparent, border: 1px solid var(--border), color: var(--text-secondary)
Active/selected:        background: var(--accent-warm), color: #fff
Disabled:              color: var(--text-tertiary), background: transparent
```
Hover: swap to `--bg-secondary` for ghost; reduce opacity to 0.82 for primary.

### Segmented controls
Container: `background: --bg-secondary; border-radius: 99px; padding: 2px; border: 1px solid --border`
Active item: `background: --bg-primary; font-weight: 600`
Inactive item: `background: transparent; color: --text-secondary; font-weight: 500`

### Toggle switches
Track: 32×18px, `border-radius: 99px`. Active: `--accent-warm`. Inactive: `--border`.
Knob: 14×14px circle, transitions left with `150ms ease`, `box-shadow: 0 1px 3px rgba(0,0,0,0.2)`.

### Focus styles
`:focus-visible { outline: 2px solid var(--accent-warm); outline-offset: 2px }`

## Accessibility
- All interactive elements have `aria-label` or visible label
- Toggle switches use `role="switch"` with `aria-checked`
- Modals/drawers use `role="dialog"` with `aria-label`
- Minimum contrast: 4.5:1 for body text, 3:1 for large text
- Keyboard navigation: Tab order follows visual order; Escape closes all overlays
```

- [ ] **Commit**

```bash
git add docs/designsystem.md
git commit -m "docs: add design system reference"
```

---

## Task 16: Final verification

- [ ] **Run full unit test suite**

```bash
npm run test
```

Expected: 39+ tests pass, ≥80% coverage on tracked files.

- [ ] **Run E2E tests**

```bash
npm run test:e2e
```

Expected: all 53 existing tests pass. (New E2E tests for library/auth are in the follow-up plan.)

- [ ] **Manual smoke test — full user flow**

1. Open app (unauthenticated) → Clerk sign-in appears
2. Sign up with new account → empty library with upload prompt
3. Drag an EPUB onto the drop zone → progress indicator → opens in reader
4. Read a few paragraphs → close book → library shows book with cover
5. Add a note (select text → save) → open notes badge on library card → note appears
6. Click "✎ Notes" in reader header → inline pane opens → note visible
7. Click "Export as Markdown" → .md file downloads with correct content
8. Close browser, reopen, sign in → same book visible, same preferences applied

- [ ] **Final commit**

```bash
git add -A
git commit -m "chore: backend + library implementation complete"
```
