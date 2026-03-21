import { describe, expect, it } from 'vitest'
import { sanitizeXhtmlMarkup } from '../../src/utils/epubSanitizer'

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
