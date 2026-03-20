import { useState, useRef, useCallback, useEffect } from 'react'
import ePub from 'epubjs'
import type { Book, Rendition, NavItem, EpubLocation } from 'epubjs'

export type FontSize = 'sm' | 'md' | 'lg' | 'xl'
export type Theme = 'light' | 'dark'

interface UseEpubOptions {
  fontSize: FontSize
  theme: Theme
}

export interface UseEpubReturn {
  book: Book | null
  rendition: Rendition | null
  toc: NavItem[]
  currentLocation: EpubLocation | null
  totalPages: number
  currentPage: number
  currentChapterIndex: number
  progress: number
  title: string
  author: string
  cover: string | null
  loadBook: (file: File) => Promise<void>
  nextPage: () => void
  prevPage: () => void
  goToHref: (href: string) => void
  getCurrentText: () => string
  isLoading: boolean
  error: string | null
  viewerRef: React.RefObject<HTMLDivElement>
}

const FONT_SIZES: Record<FontSize, string> = {
  sm: '16px',
  md: '18px',
  lg: '20px',
  xl: '23px',
}

function getThemeStyles(theme: Theme): Record<string, Record<string, string>> {
  const light = {
    bgPrimary: '#F8F7F4',
    textPrimary: '#1A1A1A',
    textSecondary: '#6B6560',
  }
  const dark = {
    bgPrimary: '#111110',
    textPrimary: '#F0EDE8',
    textSecondary: '#8A8780',
  }
  const c = theme === 'dark' ? dark : light

  return {
    body: {
      'font-family': "'Lora', Georgia, serif",
      'font-size': '18px',
      'line-height': '1.8',
      'color': c.textPrimary,
      'background': c.bgPrimary,
      'padding': '0 2rem 4rem',
      'max-width': '65ch',
      'margin': '0 auto',
    },
    p: {
      'margin-bottom': '1.2em',
      'text-align': 'left',
    },
    h1: {
      'font-family': "'Playfair Display', Georgia, serif",
      'font-size': '1.6em',
      'font-weight': '500',
      'color': c.textPrimary,
      'margin-top': '1.5em',
      'margin-bottom': '0.75em',
      'line-height': '1.3',
    },
    h2: {
      'font-family': "'Playfair Display', Georgia, serif",
      'font-size': '1.3em',
      'font-weight': '500',
      'color': c.textPrimary,
      'margin-top': '1.4em',
      'margin-bottom': '0.6em',
    },
    h3: {
      'font-family': "'Playfair Display', Georgia, serif",
      'font-size': '1.1em',
      'font-weight': '500',
      'color': c.textPrimary,
      'margin-top': '1.2em',
    },
    a: {
      'color': '#C4A882',
      'text-decoration': 'none',
    },
    'blockquote': {
      'border-left': '3px solid #C4A882',
      'padding-left': '1em',
      'margin-left': '0',
      'font-style': 'italic',
      'color': c.textSecondary,
    },
  }
}

export function useEpub({ fontSize, theme }: UseEpubOptions): UseEpubReturn {
  const [book, setBook] = useState<Book | null>(null)
  const [rendition, setRendition] = useState<Rendition | null>(null)
  const [toc, setToc] = useState<NavItem[]>([])
  const [currentLocation, setCurrentLocation] = useState<EpubLocation | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [cover, setCover] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const viewerRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<Book | null>(null)
  const renditionRef = useRef<Rendition | null>(null)
  const tocRef = useRef<NavItem[]>([])

  // Inject/update theme + font size into the rendition
  const applyTheme = useCallback((r: Rendition, currentTheme: Theme, currentFontSize: FontSize) => {
    const styles = getThemeStyles(currentTheme)
    styles.body['font-size'] = FONT_SIZES[currentFontSize]
    r.themes.default(styles)
  }, [])

  // Re-apply theme when theme or fontSize changes
  useEffect(() => {
    if (renditionRef.current) {
      applyTheme(renditionRef.current, theme, fontSize)
    }
  }, [theme, fontSize, applyTheme])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      renditionRef.current?.resize()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const loadBook = useCallback(async (file: File) => {
    // Cleanup previous book
    if (renditionRef.current) {
      renditionRef.current.destroy()
      renditionRef.current = null
      setRendition(null)
    }
    if (bookRef.current) {
      bookRef.current.destroy()
      bookRef.current = null
      setBook(null)
    }

    setIsLoading(true)
    setError(null)
    setToc([])
    setCurrentLocation(null)
    setCurrentPage(0)
    setTotalPages(0)
    setProgress(0)

    try {
      const buffer = await file.arrayBuffer()
      const newBook = ePub(buffer)
      bookRef.current = newBook
      setBook(newBook)

      // Load metadata
      const nav = await newBook.loaded.navigation
      const tocItems = nav.toc
      setToc(tocItems)
      tocRef.current = tocItems

      const metadata = await newBook.loaded.metadata
      setTitle(metadata.title || file.name.replace('.epub', ''))
      setAuthor(metadata.creator || '')

      // Load cover
      try {
        const coverUrl = await newBook.coverUrl()
        setCover(coverUrl)
      } catch {
        setCover(null)
      }

      // Wait for viewer DOM element
      const waitForViewer = (): Promise<HTMLDivElement> =>
        new Promise((resolve) => {
          if (viewerRef.current) {
            resolve(viewerRef.current)
            return
          }
          const interval = setInterval(() => {
            if (viewerRef.current) {
              clearInterval(interval)
              resolve(viewerRef.current)
            }
          }, 50)
          setTimeout(() => {
            clearInterval(interval)
            if (viewerRef.current) resolve(viewerRef.current)
          }, 3000)
        })

      const viewerEl = await waitForViewer()

      const newRendition = newBook.renderTo(viewerEl, {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        spread: 'none',
        minSpreadWidth: 9999,
      })

      renditionRef.current = newRendition
      setRendition(newRendition)

      // Apply theme after rendition is created
      applyTheme(newRendition, theme, fontSize)

      // Track location changes
      newRendition.on('relocated', (location: EpubLocation) => {
        setCurrentLocation(location)
        const page = location.start.displayed.page
        const total = location.start.displayed.total
        setCurrentPage(page)
        setTotalPages(total)
        if (total > 0) setProgress(Math.round((page / total) * 100))

        // Update current chapter index
        const href = location.start.href
        const idx = tocRef.current.findIndex(
          (item) => item.href === href || item.href.split('#')[0] === href.split('#')[0]
        )
        if (idx >= 0) setCurrentChapterIndex(idx)
      })

      // Display first chapter
      await newRendition.display()
      setIsLoading(false)
    } catch (err) {
      setIsLoading(false)
      const msg = err instanceof Error ? err.message : String(err)
      if (
        msg.toLowerCase().includes('invalid') ||
        msg.toLowerCase().includes('not a valid') ||
        msg.toLowerCase().includes('mime')
      ) {
        setError("This file doesn't appear to be a valid EPUB")
      } else {
        setError('Unable to read this EPUB file. Try re-downloading it.')
      }
    }
  }, [theme, fontSize, applyTheme])

  const nextPage = useCallback(() => {
    renditionRef.current?.next()
  }, [])

  const prevPage = useCallback(() => {
    renditionRef.current?.prev()
  }, [])

  const goToHref = useCallback((href: string) => {
    renditionRef.current?.display(href)
  }, [])

  const getCurrentText = useCallback((): string => {
    if (!renditionRef.current) return ''
    try {
      const contents = renditionRef.current.getContents()
      return contents
        .map((c: { document?: Document }) => ((c.document?.body) as HTMLElement)?.innerText ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    } catch {
      return ''
    }
  }, [])

  return {
    book,
    rendition,
    toc,
    currentLocation,
    totalPages,
    currentPage,
    currentChapterIndex,
    progress,
    title,
    author,
    cover,
    loadBook,
    nextPage,
    prevPage,
    goToHref,
    getCurrentText,
    isLoading,
    error,
    viewerRef,
  }
}
