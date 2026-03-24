import sharp from 'sharp'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = resolve(__dirname, '../public/og-image.svg')
const pngPath = resolve(__dirname, '../public/og-image.png')

const svg = readFileSync(svgPath)

await sharp(svg)
  .resize(1200, 630)
  .png({ quality: 95 })
  .toFile(pngPath)

console.log('✓ public/og-image.png written (1200×630)')
