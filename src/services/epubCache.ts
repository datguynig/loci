/**
 * IndexedDB-based LRU cache for EPUB ArrayBuffers.
 *
 * Stores up to MAX_ENTRIES books. On each cache hit the entry's accessedAt
 * timestamp is refreshed. When a new entry would exceed the limit, the
 * least-recently-accessed entry is evicted first.
 *
 * Cache entries are invalidated when the stored fileSize differs from the
 * book's current fileSize (e.g. after the user re-uploads a revised edition).
 *
 * All functions are non-throwing — failures are swallowed so a cache miss is
 * always a safe fallback to a fresh MinIO download.
 */

const DB_NAME = 'loci-epub-cache'
const DB_VERSION = 1
const STORE = 'epubs'
const MAX_ENTRIES = 5

interface CacheEntry {
  bookId: string
  buffer: ArrayBuffer
  fileSize: number
  accessedAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'bookId' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Returns the cached ArrayBuffer for bookId, or null on miss/invalidation.
 * Pass expectedFileSize to auto-invalidate stale entries (e.g. re-uploaded books).
 * Pass null to skip size validation (e.g. for books with no known size).
 */
export async function getCachedEpub(
  bookId: string,
  expectedFileSize: number | null,
): Promise<ArrayBuffer | null> {
  try {
    const db = await openDb()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const req = store.get(bookId)
      req.onsuccess = () => {
        const entry = req.result as CacheEntry | undefined
        if (!entry) { resolve(null); return }
        // Invalidate if file size has changed (re-upload)
        if (expectedFileSize !== null && entry.fileSize !== expectedFileSize) {
          store.delete(bookId)
          resolve(null)
          return
        }
        // Refresh LRU timestamp
        store.put({ ...entry, accessedAt: Date.now() })
        resolve(entry.buffer)
      }
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

/** Stores an EPUB buffer, evicting the LRU entry if the store is full. */
export async function setCachedEpub(
  bookId: string,
  buffer: ArrayBuffer,
  fileSize: number,
): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const countReq = store.count()
      countReq.onsuccess = () => {
        const count = countReq.result
        if (count >= MAX_ENTRIES) {
          const getAllReq = store.getAll()
          getAllReq.onsuccess = () => {
            const entries = getAllReq.result as CacheEntry[]
            entries.sort((a, b) => a.accessedAt - b.accessedAt)
            // Evict enough entries to make room
            const evictCount = count - MAX_ENTRIES + 1
            for (let i = 0; i < evictCount; i++) {
              store.delete(entries[i].bookId)
            }
            store.put({ bookId, buffer, fileSize, accessedAt: Date.now() })
          }
          getAllReq.onerror = () => {
            store.put({ bookId, buffer, fileSize, accessedAt: Date.now() })
          }
        } else {
          store.put({ bookId, buffer, fileSize, accessedAt: Date.now() })
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // Cache write failure is non-fatal
  }
}

/** Removes a single book from the cache (call when the user deletes a book). */
export async function clearBookFromCache(bookId: string): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(bookId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    // Non-fatal
  }
}
