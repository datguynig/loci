/**
 * Storage service — wraps the self-hosted MinIO presigned-URL API.
 *
 * All write/delete/list operations go through the Bun presign-api which
 * verifies the Clerk JWT before issuing presigned URLs or executing admin ops.
 * Cover images are served from a public MinIO bucket (no presigning needed).
 */

const API_BASE = import.meta.env.VITE_STORAGE_API_URL as string
const MINIO_PUBLIC_URL = import.meta.env.VITE_MINIO_PUBLIC_URL as string

if (!API_BASE) throw new Error('VITE_STORAGE_API_URL is not set')
if (!MINIO_PUBLIC_URL) throw new Error('VITE_MINIO_PUBLIC_URL is not set')

export type GetToken = () => Promise<string | null>

async function apiPost<T>(getToken: GetToken, path: string, body: unknown): Promise<T> {
  const token = await getToken()
  if (!token) throw new Error('Not authenticated')
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Storage API error ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

/** Upload a file to MinIO via a presigned PUT URL. */
export async function uploadFile(
  getToken: GetToken,
  bucket: string,
  key: string,
  body: Blob | File,
  contentType: string,
): Promise<void> {
  const { url } = await apiPost<{ url: string }>(getToken, '/presign/upload', {
    key,
    bucket,
    contentType,
  })
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  })
  if (!res.ok) throw new Error(`MinIO upload failed: ${res.status}`)
}

/** Download a file from MinIO via a presigned GET URL, returning it as a Blob. */
export async function downloadFile(
  getToken: GetToken,
  bucket: string,
  key: string,
): Promise<Blob> {
  const { url } = await apiPost<{ url: string }>(getToken, '/presign/download', { key, bucket })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`MinIO download failed: ${res.status}`)
  return res.blob()
}

/**
 * Returns the permanent public URL for a cover image.
 * The covers bucket is public (read-only), so no presigning is needed.
 * The key should NOT include the bucket prefix (e.g. "userId/bookId.jpg").
 */
export function getCoverPublicUrl(key: string): string {
  return `${MINIO_PUBLIC_URL}/covers/${key}`
}

/** Delete one or more objects from a bucket. */
export async function deleteFiles(
  getToken: GetToken,
  bucket: string,
  keys: string[],
): Promise<void> {
  if (!keys.length) return
  await apiPost(getToken, '/storage/delete', { keys, bucket })
}

/** List all object keys under a user prefix (e.g. "userId/"). */
export async function listFiles(
  getToken: GetToken,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const { keys } = await apiPost<{ keys: string[] }>(getToken, '/storage/list', { prefix, bucket })
  return keys
}
