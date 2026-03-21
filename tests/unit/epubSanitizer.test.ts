import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { sanitizeXhtmlMarkup, sanitizeEpubBuffer } from '../../src/utils/epubSanitizer'

describe('sanitizeXhtmlMarkup', () => {
  it('removes malformed conditional comment remnants', () => {
    const input = '<div><!--![endif]----></div><span><!--[endif]----></span>'
    expect(sanitizeXhtmlMarkup(input)).toBe('<div></div><span></span>')
  })

  it('removes clipboard fragment comments', () => {
    const input = '<p><!--StartFragment -->Hello<!--EndFragment --></p>'
    expect(sanitizeXhtmlMarkup(input)).toBe('<p>Hello</p>')
  })
})

describe('sanitizeEpubBuffer', () => {
  async function makeEpub(files: Record<string, string>): Promise<ArrayBuffer> {
    const zip = new JSZip()
    for (const [name, content] of Object.entries(files)) {
      zip.file(name, content)
    }
    return zip.generateAsync({ type: 'arraybuffer' })
  }

  it('sanitizes malformed markup inside XHTML files', async () => {
    const dirty = '<p><!--StartFragment -->Hello<!--EndFragment --></p>'
    const buffer = await makeEpub({ 'chapter.xhtml': dirty })
    const result = await sanitizeEpubBuffer(buffer)
    const zip = await JSZip.loadAsync(result)
    const content = await zip.files['chapter.xhtml'].async('string')
    expect(content).toBe('<p>Hello</p>')
  })

  it('returns the original buffer unchanged when no markup is dirty', async () => {
    const clean = '<p>Clean content with no comments</p>'
    const buffer = await makeEpub({ 'chapter.xhtml': clean })
    const result = await sanitizeEpubBuffer(buffer)
    expect(result).toBe(buffer)
  })

  it('skips non-XHTML files', async () => {
    const dirty = '<!--StartFragment -->should not be touched'
    const buffer = await makeEpub({ 'styles.css': dirty })
    const result = await sanitizeEpubBuffer(buffer)
    const zip = await JSZip.loadAsync(result)
    const content = await zip.files['styles.css'].async('string')
    expect(content).toBe(dirty)
  })
})
