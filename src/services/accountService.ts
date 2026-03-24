import type { SupabaseClient } from '@supabase/supabase-js'
import { listFiles, deleteFiles, type GetToken } from './storageService'

interface ClerkUser {
  id: string
  delete: () => Promise<void>
}

const LOCI_STATIC_KEYS = [
  'loci_preferences',
  'loci_onboarding_done',
  'loci_reader_tour_seen',
  'loci_color_scheme',
]

/**
 * Permanently deletes a user's account in the correct order:
 * 1. Supabase Storage files (books + covers)
 * 2. All Supabase database rows across every table
 * 3. Browser localStorage
 * 4. Clerk account (triggers automatic sign-out)
 */
export async function deleteAccount(
  supabase: SupabaseClient,
  getStorageToken: GetToken,
  userId: string,
  clerkUser: ClerkUser,
): Promise<void> {
  // 1 — Storage: delete EPUB files and cover images from MinIO
  const [bookKeys, coverKeys] = await Promise.all([
    listFiles(getStorageToken, 'books', `${userId}/`),
    listFiles(getStorageToken, 'covers', `${userId}/`),
  ])
  await Promise.all([
    deleteFiles(getStorageToken, 'books', bookKeys),
    deleteFiles(getStorageToken, 'covers', coverKeys),
  ])

  // 2 — Database: delete all rows (books last in case of FK constraints without cascade)
  const tables = [
    'quiz_sessions',
    'flashcards',
    'scratchpad',
    'bookmarks',
    'annotations',
    'reading_progress',
    'preferences',
    'books',
  ]
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId)
    if (error) throw new Error(`Failed to delete rows from ${table}: ${error.message}`)
  }

  // 3 — localStorage: clear known static keys
  LOCI_STATIC_KEYS.forEach((k) => localStorage.removeItem(k))
  // Clear dynamic annotation cache keys
  Object.keys(localStorage)
    .filter((k) => k.startsWith('loci_annotations_'))
    .forEach((k) => localStorage.removeItem(k))

  // 4 — Clerk: delete account and sign out (Clerk handles sign-out automatically)
  await clerkUser.delete()
}
