import { describe, expect, it } from 'vitest'
import { calculateProgressPercent } from '../../src/utils/epub'

describe('calculateProgressPercent', () => {
  it('prefers the book-wide CFI percentage when available', () => {
    expect(calculateProgressPercent(2, 10, 0.63)).toBe(63)
  })

  it('falls back to page-based progress when locations are unavailable', () => {
    expect(calculateProgressPercent(3, 12)).toBe(25)
  })

  it('clamps the reported percentage into the valid range', () => {
    expect(calculateProgressPercent(5, 4)).toBe(100)
    expect(calculateProgressPercent(1, 10, -0.5)).toBe(0)
  })
})
