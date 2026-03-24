/**
 * One-time migration script: copies all files from Supabase Storage to MinIO.
 *
 * Run from the infra/ directory on the VPS (where MinIO is accessible):
 *   bun run scripts/migrate.ts
 *
 * Required env vars (copy from .env and add Supabase service role key):
 *   MINIO_ENDPOINT, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT
const MINIO_ROOT_USER = process.env.MINIO_ROOT_USER
const MINIO_ROOT_PASSWORD = process.env.MINIO_ROOT_PASSWORD

if (!SUPABASE_URL) throw new Error('SUPABASE_URL is not set')
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
if (!MINIO_ENDPOINT) throw new Error('MINIO_ENDPOINT is not set')
if (!MINIO_ROOT_USER) throw new Error('MINIO_ROOT_USER is not set')
if (!MINIO_ROOT_PASSWORD) throw new Error('MINIO_ROOT_PASSWORD is not set')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const s3 = new S3Client({
  endpoint: MINIO_ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: MINIO_ROOT_USER, secretAccessKey: MINIO_ROOT_PASSWORD },
  forcePathStyle: true,
})

async function existsInMinio(bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch {
    return false
  }
}

async function migrateBucket(bucket: string) {
  console.log(`\n── Migrating bucket: ${bucket}`)

  // List all user folders (top-level prefixes)
  const { data: folders, error: folderErr } = await supabase.storage.from(bucket).list('')
  if (folderErr) throw new Error(`Failed to list ${bucket}: ${folderErr.message}`)
  if (!folders?.length) { console.log(`  (empty)`); return }

  let total = 0
  let skipped = 0
  let copied = 0
  let failed = 0

  for (const folder of folders) {
    const prefix = folder.name
    const { data: files, error: fileErr } = await supabase.storage.from(bucket).list(prefix)
    if (fileErr) { console.error(`  Failed to list ${bucket}/${prefix}:`, fileErr.message); continue }
    if (!files?.length) continue

    for (const file of files) {
      const key = `${prefix}/${file.name}`
      total++

      // Skip if already migrated (idempotent)
      if (await existsInMinio(bucket, key)) {
        skipped++
        process.stdout.write('.')
        continue
      }

      try {
        const { data, error } = await supabase.storage.from(bucket).download(key)
        if (error) throw new Error(error.message)

        const contentType = bucket === 'books'
          ? 'application/epub+zip'
          : 'image/jpeg'

        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: Buffer.from(await data.arrayBuffer()),
          ContentType: contentType,
        }))

        copied++
        process.stdout.write('+')
      } catch (err) {
        failed++
        console.error(`\n  Failed to migrate ${key}:`, err instanceof Error ? err.message : err)
      }
    }
  }

  console.log(`\n  Total: ${total} | Copied: ${copied} | Skipped (already exist): ${skipped} | Failed: ${failed}`)
}

async function updateCoverUrls(supabasePublicBase: string, minioPublicBase: string) {
  console.log('\n── Updating cover_url values in books table')
  const { error } = await supabase.rpc('replace_cover_urls', {
    old_base: `${supabasePublicBase}/storage/v1/object/public/covers/`,
    new_base: `${minioPublicBase}/covers/`,
  })
  if (error) {
    console.warn('  RPC not available — run this SQL manually:')
    console.warn(`
  UPDATE books
  SET cover_url = REPLACE(
    cover_url,
    '${supabasePublicBase}/storage/v1/object/public/covers/',
    '${minioPublicBase}/covers/'
  )
  WHERE cover_url LIKE '%supabase%';
    `)
  } else {
    console.log('  cover_url values updated.')
  }
}

async function main() {
  console.log('Loci Storage Migration: Supabase → MinIO')
  console.log('=========================================')

  await migrateBucket('books')
  await migrateBucket('covers')

  const minioPublicBase = process.env.MINIO_PUBLIC_URL ?? 'https://minio.loci.app'
  await updateCoverUrls(SUPABASE_URL!, minioPublicBase)

  console.log('\n✓ Migration complete.')
  console.log('\nNext steps:')
  console.log('  1. Verify a few books open correctly in the app')
  console.log('  2. Deploy the updated Loci client code (VITE_STORAGE_API_URL + VITE_MINIO_PUBLIC_URL)')
  console.log('  3. After 2 weeks stable, delete Supabase Storage files to free quota')
}

main().catch((err) => {
  console.error('\nMigration failed:', err)
  process.exit(1)
})
