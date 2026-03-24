import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const CLERK_JWKS_URL = process.env.CLERK_JWKS_URL
if (!CLERK_JWKS_URL) throw new Error('CLERK_JWKS_URL is not set')
if (!process.env.MINIO_ENDPOINT) throw new Error('MINIO_ENDPOINT is not set')
if (!process.env.MINIO_PUBLIC_URL) throw new Error('MINIO_PUBLIC_URL is not set')
if (!process.env.MINIO_ROOT_USER) throw new Error('MINIO_ROOT_USER is not set')
if (!process.env.MINIO_ROOT_PASSWORD) throw new Error('MINIO_ROOT_PASSWORD is not set')

const JWKS = createRemoteJWKSet(new URL(CLERK_JWKS_URL))
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ?? 'https://loci.app').split(',')
const ALLOWED_BUCKETS = new Set(['books', 'covers'])

const credentials = {
  accessKeyId: process.env.MINIO_ROOT_USER,
  secretAccessKey: process.env.MINIO_ROOT_PASSWORD,
}

// Used for admin ops (delete, list) — reaches MinIO via Docker internal network
const s3Internal = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT,
  region: 'us-east-1',
  credentials,
  forcePathStyle: true,
})

// Used for presigned URLs — embeds the public hostname so browsers can reach MinIO
const s3External = new S3Client({
  endpoint: process.env.MINIO_PUBLIC_URL,
  region: 'us-east-1',
  credentials,
  forcePathStyle: true,
})

async function verifyJwt(req: Request): Promise<string> {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) throw new AuthError('Missing bearer token')
  const { payload } = await jwtVerify(auth.slice(7), JWKS)
  if (!payload.sub) throw new AuthError('Missing sub claim')
  return payload.sub
}

function validateKey(key: string, userId: string) {
  if (!key.startsWith(`${userId}/`)) throw new ForbiddenError('Key must start with your user ID')
}

function validateBucket(bucket: string) {
  if (!ALLOWED_BUCKETS.has(bucket)) throw new ForbiddenError(`Unknown bucket: ${bucket}`)
}

class AuthError extends Error {}
class ForbiddenError extends Error {}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

Bun.serve({
  port: parseInt(process.env.PORT ?? '3100'),

  async fetch(req) {
    const url = new URL(req.url)
    const origin = req.headers.get('Origin')

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, origin)
    }

    try {
      // POST /presign/upload → returns a presigned PUT URL (15 min)
      if (url.pathname === '/presign/upload') {
        const userId = await verifyJwt(req)
        const { key, bucket, contentType } = await req.json() as {
          key: string
          bucket: string
          contentType: string
        }
        validateBucket(bucket)
        validateKey(key, userId)
        const presignedUrl = await getSignedUrl(
          s3External,
          new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
          { expiresIn: 900 },
        )
        return json({ url: presignedUrl }, 200, origin)
      }

      // POST /presign/download → returns a presigned GET URL (1 hour)
      if (url.pathname === '/presign/download') {
        const userId = await verifyJwt(req)
        const { key, bucket } = await req.json() as { key: string; bucket: string }
        validateBucket(bucket)
        validateKey(key, userId)
        const presignedUrl = await getSignedUrl(
          s3External,
          new GetObjectCommand({ Bucket: bucket, Key: key }),
          { expiresIn: 3600 },
        )
        return json({ url: presignedUrl }, 200, origin)
      }

      // POST /storage/delete → deletes objects server-side
      if (url.pathname === '/storage/delete') {
        const userId = await verifyJwt(req)
        const { keys, bucket } = await req.json() as { keys: string[]; bucket: string }
        validateBucket(bucket)
        for (const key of keys) validateKey(key, userId)
        if (keys.length === 0) return json({ deleted: 0 }, 200, origin)
        await s3Internal.send(new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })) },
        }))
        return json({ deleted: keys.length }, 200, origin)
      }

      // POST /storage/list → lists objects under a user prefix
      if (url.pathname === '/storage/list') {
        const userId = await verifyJwt(req)
        const { prefix, bucket } = await req.json() as { prefix: string; bucket: string }
        validateBucket(bucket)
        if (prefix !== `${userId}/`) throw new ForbiddenError('Prefix must be exactly your user ID + /')
        const result = await s3Internal.send(
          new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }),
        )
        const keys = (result.Contents ?? []).map((o) => o.Key!).filter(Boolean)
        return json({ keys }, 200, origin)
      }

      return json({ error: 'Not found' }, 404, origin)
    } catch (err) {
      if (err instanceof AuthError) return json({ error: err.message }, 401, origin)
      if (err instanceof ForbiddenError) return json({ error: err.message }, 403, origin)
      console.error('[presign-api] error:', err)
      return json({ error: 'Internal server error' }, 500, origin)
    }
  },
})

console.log(`[presign-api] listening on port ${process.env.PORT ?? 3100}`)
