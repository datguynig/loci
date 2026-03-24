/**
 * Generates ElevenLabs voice demo MP3s for the landing page persona cards.
 * Run once: node scripts/generateVoiceDemos.mjs
 * Requires VITE_ELEVENLABS_API_KEY in environment (or .env.local via dotenv).
 *
 * Outputs: public/demo-voices/{rachel,adam,bella,antoni}.mp3
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

// Load .env / .env.local if present
for (const envFile of ['.env', '.env.local']) {
  const envPath = path.join(ROOT, envFile)
  if (!fs.existsSync(envPath)) continue
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const eqIdx = line.indexOf('=')
    if (eqIdx < 1) continue
    const key = line.slice(0, eqIdx).trim()
    const val = line.slice(eqIdx + 1).trim()
    if (key && val && !process.env[key]) process.env[key] = val
  }
}

const API_KEY = process.env.VITE_ELEVENLABS_API_KEY
if (!API_KEY) {
  console.error('VITE_ELEVENLABS_API_KEY not set. Copy .env.example to .env.local and add the key.')
  process.exit(1)
}

const VOICE_NAMES = ['Sarah', 'Adam', 'Bella', 'River']
const DEMO_TEXT = 'For this I had deprived myself of rest and health. I had desired it with an ardour that far exceeded moderation; but now that I had finished, the beauty of the dream vanished.'

async function main() {
  // Fetch voice list to resolve name → voice_id
  console.log('Fetching ElevenLabs voice list...')
  const listResp = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': API_KEY },
  })
  if (!listResp.ok) {
    console.error(`Failed to fetch voices: ${listResp.status} ${await listResp.text()}`)
    process.exit(1)
  }
  const { voices } = await listResp.json()

  const outDir = path.join(ROOT, 'public', 'demo-voices')
  fs.mkdirSync(outDir, { recursive: true })

  for (const name of VOICE_NAMES) {
    // API voice names can include descriptions e.g. "Sarah - Mature, Reassuring, Confident"
    const voice = voices.find((v) => v.name === name || v.name.startsWith(`${name} -`) || v.name.startsWith(`${name} (`))
    if (!voice) {
      console.warn(`⚠  Voice not found in your account: ${name} — skipping`)
      continue
    }

    console.log(`Generating ${name} (${voice.voice_id})...`)
    const ttsResp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.voice_id}`, {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: DEMO_TEXT,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    })

    if (!ttsResp.ok) {
      console.error(`  ✗ Failed: ${ttsResp.status} ${await ttsResp.text()}`)
      continue
    }

    const buffer = await ttsResp.arrayBuffer()
    const outPath = path.join(outDir, `${name.toLowerCase()}.mp3`)
    fs.writeFileSync(outPath, Buffer.from(buffer))
    console.log(`  ✓ Saved ${path.relative(ROOT, outPath)} (${Math.round(buffer.byteLength / 1024)} KB)`)
  }

  console.log('\nDone. Commit public/demo-voices/*.mp3 to make demos available for all users.')
}

main().catch((err) => { console.error(err); process.exit(1) })
