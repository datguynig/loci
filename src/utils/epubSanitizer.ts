import JSZip from 'jszip'

const XHTML_FILE_PATTERN = /\.(xhtml|html|htm)$/i

export function sanitizeXhtmlMarkup(markup: string): string {
  return markup
    .replace(/<!--!\[endif\]-+-->/gi, '')
    .replace(/<!--\[endif\]-+-->/gi, '')
    .replace(/<!--(?:StartFragment|EndFragment)\s*-->/gi, '')
}

export async function sanitizeEpubBuffer(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer)
  let changed = false

  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir || !XHTML_FILE_PATTERN.test(name)) continue

    const original = await entry.async('string')
    const sanitized = sanitizeXhtmlMarkup(original)
    if (sanitized === original) continue

    zip.file(name, sanitized)
    changed = true
  }

  if (!changed) return buffer
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
}
