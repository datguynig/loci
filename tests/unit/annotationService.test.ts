import { describe, expect, it, beforeEach } from 'vitest'
import {
  getAnnotations,
  saveAnnotation,
  deleteAnnotation,
  getAnnotationsForHref,
  type Annotation,
} from '../../src/services/annotationService'

function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: 'a1',
    bookId: 'book1',
    href: 'chapter1.xhtml',
    quote: 'Some quoted text',
    note: 'My note',
    createdAt: 1000,
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('getAnnotations', () => {
  it('returns empty array when nothing stored', () => {
    expect(getAnnotations('book1')).toEqual([])
  })

  it('returns parsed annotations for the given bookId', () => {
    const ann = makeAnnotation()
    localStorage.setItem('loci_annotations_book1', JSON.stringify([ann]))
    expect(getAnnotations('book1')).toEqual([ann])
  })

  it('returns empty array when stored value is invalid JSON', () => {
    localStorage.setItem('loci_annotations_book1', 'not-json')
    expect(getAnnotations('book1')).toEqual([])
  })

  it('does not bleed across different bookIds', () => {
    const ann = makeAnnotation({ bookId: 'book2' })
    localStorage.setItem('loci_annotations_book2', JSON.stringify([ann]))
    expect(getAnnotations('book1')).toEqual([])
    expect(getAnnotations('book2')).toEqual([ann])
  })
})

describe('saveAnnotation', () => {
  it('adds a new annotation when none exist', () => {
    const ann = makeAnnotation()
    saveAnnotation(ann)
    expect(getAnnotations('book1')).toEqual([ann])
  })

  it('appends a new annotation to existing ones', () => {
    const a1 = makeAnnotation({ id: 'a1' })
    const a2 = makeAnnotation({ id: 'a2', quote: 'Second quote' })
    saveAnnotation(a1)
    saveAnnotation(a2)
    expect(getAnnotations('book1')).toEqual([a1, a2])
  })

  it('updates an existing annotation in place (upsert)', () => {
    const original = makeAnnotation({ note: 'original' })
    saveAnnotation(original)
    const updated = makeAnnotation({ note: 'updated' })
    saveAnnotation(updated)
    const result = getAnnotations('book1')
    expect(result).toHaveLength(1)
    expect(result[0].note).toBe('updated')
  })
})

describe('deleteAnnotation', () => {
  it('removes the annotation with the given id', () => {
    const a1 = makeAnnotation({ id: 'a1' })
    const a2 = makeAnnotation({ id: 'a2', quote: 'second' })
    saveAnnotation(a1)
    saveAnnotation(a2)
    deleteAnnotation('a1', 'book1')
    expect(getAnnotations('book1')).toEqual([a2])
  })

  it('is a no-op when the id does not exist', () => {
    const ann = makeAnnotation()
    saveAnnotation(ann)
    deleteAnnotation('non-existent', 'book1')
    expect(getAnnotations('book1')).toHaveLength(1)
  })

  it('leaves an empty array when the last annotation is deleted', () => {
    saveAnnotation(makeAnnotation())
    deleteAnnotation('a1', 'book1')
    expect(getAnnotations('book1')).toEqual([])
  })
})

describe('getAnnotationsForHref', () => {
  it('returns annotations matching the exact href', () => {
    const ann = makeAnnotation({ href: 'ch1.xhtml' })
    saveAnnotation(ann)
    expect(getAnnotationsForHref('book1', 'ch1.xhtml')).toEqual([ann])
  })

  it('ignores the fragment when matching hrefs', () => {
    const ann = makeAnnotation({ href: 'ch1.xhtml#section2' })
    saveAnnotation(ann)
    expect(getAnnotationsForHref('book1', 'ch1.xhtml')).toEqual([ann])
    expect(getAnnotationsForHref('book1', 'ch1.xhtml#other-fragment')).toEqual([ann])
  })

  it('excludes annotations from other chapters', () => {
    saveAnnotation(makeAnnotation({ id: 'a1', href: 'ch1.xhtml' }))
    saveAnnotation(makeAnnotation({ id: 'a2', href: 'ch2.xhtml' }))
    expect(getAnnotationsForHref('book1', 'ch1.xhtml')).toHaveLength(1)
    expect(getAnnotationsForHref('book1', 'ch2.xhtml')).toHaveLength(1)
  })

  it('returns empty array when no annotations match the href', () => {
    saveAnnotation(makeAnnotation({ href: 'ch1.xhtml' }))
    expect(getAnnotationsForHref('book1', 'ch99.xhtml')).toEqual([])
  })
})
