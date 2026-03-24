/**
 * IndexedDB-based LRU cache for EPUB ArrayBuffers.
 *
 * Stores up to MAX_ENTRIES books (5 × ~10 MB = ~50 MB typical budget).
 * On each cache hit the entry's accessedAt timestamp is refreshed.
 * When a new entry would exceed the limit, the least-recently-accessed
 * entry is evicted first via a cursor on the accessedAt index.
 *
 * Cache entries are invalidated when the stored fileSize differs from
 * the book's current fileSize (e.g. after the user re-uploads a revised
 * edition).
 *
 * A singleton IDBDatabase connection is reused across all calls to avoid
 * accumulating open connections.
 *
 * All functions are non-throwing — failures fall back to a fresh download.
 */

const DB_NAME = 'loci-epub-cache'
const DB_VERSION = 2           // bumped to add accessedAt index
const STORE = 'epubs'
const IDX = 'accessedAt'
const MAX_ENTRIES = 5

interface CacheEntry {
  bookId: string
  buffer: ArrayBuffer
  fileSize: number
  accessedAt: number
}

// ─── Singleton connection ──────────────────────────────────────────────────

let _dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!_dbPromise) {
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        // Drop old store (v1 had no index)
        if (db.objectStoreNames.contains(STORE)) db.deleteObjectStore(STORE)
        const store = db.createObjectStore(STORE, { keyPath: 'bookId' })
        store.createIndex(IDX, 'accessedAt', { unique: false })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => {
        _dbPromise = null   // allow retry on next call
        reject(req.error)
      }
      req.onblocked = () => {
        _dbPromise = null
        reject(new Error('IndexedDB open blocked'))
      }
    })
  }
  return _dbPromise
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Returns the cached ArrayBuffer for bookId, or null on miss/invalidation.
 * Pass expectedFileSize to auto-invalidate stale entries (re-uploaded books).
 * Pass null to skip size validation.
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
        if (expectedFileSize !== null && entry.fileSize !== expectedFileSize) {
          store.delete(bookId)
          resolve(null)
          return
        }
        // Refresh LRU timestamp on hit
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
      const idx = store.index(IDX)

      const countReq = store.count()
      countReq.onsuccess = () => {
        const count = countReq.result
        if (count < MAX_ENTRIES) {
          store.put({ bookId, buffer, fileSize, accessedAt: Date.now() })
          return
        }

        // Evict the (count - MAX_ENTRIES + 1) oldest entries via cursor
        // Using a cursor in the same transaction avoids the getAll() memory
        // spike and keeps all requests in a single synchronous event chain
        // so the transaction stays active.
        const evictCount = count - MAX_ENTRIES + 1
        let evicted = 0
        const cursorReq = idx.openCursor()
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result
          if (cursor && evicted < evictCount) {
            store.delete(cursor.primaryKey as string)
            evicted++
            cursor.continue()
          } else {
            store.put({ bookId, buffer, fileSize, accessedAt: Date.now() })
          }
        }
        cursorReq.onerror = () => {
          // Eviction failed — write anyway (worst case: one extra entry)
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
