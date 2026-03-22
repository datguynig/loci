import { useState, useRef, useCallback, useEffect } from 'react'
import ePub from 'epubjs'
import type { Book, Rendition, NavItem, EpubLocation, SpineSection } from 'epubjs'
import { calculateProgressPercent } from '../utils/epub'
import { sanitizeEpubBuffer } from '../utils/epubSanitizer'
import type { Annotation } from '../services/annotationService'

interface EpubLocations {
  generate: (chars: number) => Promise<void>
  percentageFromCfi: (cfi: string) => number
}

type BookWithLocations = Book & { locations: EpubLocations }

export type FontSize = 'sm' | 'md' | 'lg' | 'xl'
export type Theme = 'light' | 'dark'
export type LayoutMode = 'scroll' | 'spread'

interface UseEpubOptions {
  fontSize: FontSize
  theme: Theme
  layoutMode: LayoutMode
  highlightEnabled?: boolean
  autoscrollEnabled?: boolean
}

export interface SearchResult {
  cfi: string
  excerpt: string
  href: string
}

export interface UseEpubReturn {
  book: Book | null
  rendition: Rendition | null
  toc: NavItem[]
  currentLocation: EpubLocation | null
  currentHref: string
  totalPages: number
  currentPage: number
  currentChapterIndex: number
  totalChapters: number
  currentChapter: number
  progress: number
  title: string
  author: string
  cover: string | null
  loadBook: (file: File) => Promise<void>
  nextPage: () => void
  prevPage: () => void
  nextChapter: () => void
  prevChapter: () => void
  goToHref: (href: string) => void
  getCurrentText: () => string
  getFullChapterText: () => string
  searchBook: (query: string) => Promise<SearchResult[]>
  highlightSentence: (text: string) => void
  clearSentenceHighlight: () => void
  setOnTextSelected: (cb: ((quote: string, href: string, pos: { x: number; y: number }) => void) | null) => void
  applyAnnotationHighlights: (annotations: Annotation[]) => void
  isLoading: boolean
  hasRenderedContent: boolean
  error: string | null
  viewerRef: React.RefObject<HTMLDivElement>
}

const FONT_SIZES: Record<FontSize, string> = {
  sm: '16px',
  md: '18px',
  lg: '20px',
  xl: '23px',
}

function injectThemeOverride(doc: Document, theme: Theme) {
  doc.getElementById('loci-dark-override')?.remove()
  if (theme !== 'dark') return
  const style = doc.createElement('style')
  style.id = 'loci-dark-override'
  style.textContent = [
    'html, body { color: #F0EDE8 !important; background-color: #111110 !important; }',
    'h1, h2, h3, h4, h5, h6, p, span, td, th, li, blockquote { color: #F0EDE8 !important; }',
    'a { color: #C4A882 !important; }',
  ].join('\n')
  doc.head.appendChild(style)
}

function getThemeStyles(
  theme: Theme,
  fontSize: FontSize,
  layoutMode: LayoutMode,
): Record<string, Record<string, string>> {
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
  const colors = theme === 'dark' ? dark : light
  const isPaginated = layoutMode !== 'scroll'

  return {
    body: {
      'font-family': "'Lora', Georgia, serif",
      'font-size': FONT_SIZES[fontSize],
      'line-height': '1.8',
      color: colors.textPrimary,
      background: colors.bgPrimary,
      padding: isPaginated ? '1.5rem 2.25rem 2rem' : '0 2rem 4rem',
      'max-width': isPaginated ? 'none' : '65ch',
      margin: isPaginated ? '0' : '0 auto',
      width: 'auto',
      'box-sizing': 'border-box',
      'user-select': 'text',
      '-webkit-user-select': 'text',
    },
    p: {
      'margin-bottom': '1.2em',
      'text-align': 'left',
    },
    h1: {
      'font-family': "'Playfair Display', Georgia, serif",
      'font-size': '1.6em',
      'font-weight': '500',
      color: colors.textPrimary,
      'margin-top': '1.5em',
      'margin-bottom': '0.75em',
      'line-height': '1.3',
    },
    h2: {
      'font-family': "'Playfair Display', Georgia, serif",
      'font-size': '1.3em',
      'font-weight': '500',
      color: colors.textPrimary,
      'margin-top': '1.4em',
      'margin-bottom': '0.6em',
    },
    h3: {
      'font-family': "'Playfair Display', Georgia, serif",
      'font-size': '1.1em',
      'font-weight': '500',
      color: colors.textPrimary,
      'margin-top': '1.2em',
    },
    a: {
      color: '#C4A882',
      'text-decoration': 'none',
    },
    blockquote: {
      'border-left': '3px solid #C4A882',
      'padding-left': '1em',
      'margin-left': '0',
      'font-style': 'italic',
      color: colors.textSecondary,
    },
  }
}

function splitHref(href: string): { path: string; fragment: string } {
  const [path = '', fragment = ''] = href.split('#')
  return {
    path,
    fragment: fragment ? `#${fragment}` : '',
  }
}

function normalizeRelativeHref(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/^(?:\.\.\/)+/, '')
    .replace(/^\.\//, '')
}

function resolveTocHref(href: string, spineItems: { href: string }[], currentHref = ''): string {
  const { path, fragment } = splitHref(href)
  if (!path) {
    const currentPath = splitHref(currentHref).path
    return `${currentPath}${fragment}`
  }

  const normalizedPath = normalizeRelativeHref(path)
  const matchedSpineItem = spineItems.find((item) => {
    const spineHref = item.href.replace(/\\/g, '/')
    return (
      spineHref === path ||
      spineHref === normalizedPath ||
      spineHref.endsWith(`/${normalizedPath}`)
    )
  })

  const resolvedPath = matchedSpineItem?.href ?? normalizedPath
  return `${resolvedPath}${fragment}`
}

function normalizeTocItems(items: NavItem[], spineItems: { href: string }[]): NavItem[] {
  return items.map((item) => ({
    ...item,
    href: resolveTocHref(item.href, spineItems),
    subitems: item.subitems ? normalizeTocItems(item.subitems, spineItems) : item.subitems,
  }))
}

function getSpinePosition(currentIndex: number, spineItems: { href: string }[]): { current: number; total: number } {
  return {
    current: Math.max(0, currentIndex) + 1,
    total: spineItems.length,
  }
}

function nextLinearSpineItem(items: SpineSection[], fromIndex: number): SpineSection | null {
  for (let i = fromIndex + 1; i < items.length; i++) {
    if (items[i].linear) return items[i]
  }
  return null
}

function prevLinearSpineItem(items: SpineSection[], fromIndex: number): SpineSection | null {
  for (let i = fromIndex - 1; i >= 0; i--) {
    if (items[i].linear) return items[i]
  }
  return null
}

function buildRenditionOptions(layoutMode: LayoutMode) {
  if (layoutMode === 'scroll') {
    return {
      flow: 'scrolled-doc' as const,
      spread: 'none' as const,
      minSpreadWidth: 9999,
    }
  }

  return {
    flow: 'paginated' as const,
    spread: 'auto' as const,
    minSpreadWidth: 960,
    fullsize: false,
  }
}


export function useEpub({ fontSize, theme, layoutMode, highlightEnabled = true, autoscrollEnabled = true }: UseEpubOptions): UseEpubReturn {
  const [book, setBook] = useState<Book | null>(null)
  const [rendition, setRendition] = useState<Rendition | null>(null)
  const [toc, setToc] = useState<NavItem[]>([])
  const [currentLocation, setCurrentLocation] = useState<EpubLocation | null>(null)
  const [currentHref, setCurrentHref] = useState('')
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0)
  const [totalChapters, setTotalChapters] = useState(0)
  const [currentChapter, setCurrentChapter] = useState(0)
  const [progress, setProgress] = useState(0)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [cover, setCover] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasRenderedContent, setHasRenderedContent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const viewerRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<Book | null>(null)
  const renditionRef = useRef<Rendition | null>(null)
  const tocRef = useRef<NavItem[]>([])
  const locationsReadyRef = useRef(false)
  const currentCfiRef = useRef('')
  const currentPageRef = useRef(0)
  const totalPagesRef = useRef(0)
  const currentSpineIndexRef = useRef(0)
  /** Mirrors last relocated href so chapter nav works before/without a stale spine index (e.g. non-linear cover). */
  const currentDisplayHrefRef = useRef('')
  const isFixedLayoutRef = useRef(false)
  const activeLoadIdRef = useRef(0)
  const layoutModeRef = useRef(layoutMode)
  const activeRenderIdRef = useRef(0)

  const themeRef = useRef(theme)
  const fontSizeRef = useRef(fontSize)
  const onTextSelectedRef = useRef<((quote: string, href: string, pos: { x: number; y: number }) => void) | null>(null)
  const selectionAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    themeRef.current = theme
  }, [theme])

  useEffect(() => {
    fontSizeRef.current = fontSize
  }, [fontSize])

  useEffect(() => {
    layoutModeRef.current = layoutMode
  }, [layoutMode])

  const applyTheme = useCallback((nextRendition: Rendition, currentTheme: Theme, currentFontSize: FontSize) => {
    nextRendition.themes.default(getThemeStyles(currentTheme, currentFontSize, layoutModeRef.current))
    // Force theme colors with !important to override any EPUB-internal CSS
    try {
      nextRendition.getContents().forEach((c) => injectThemeOverride(c.document, currentTheme))
    } catch { /* rendition may have no contents yet */ }
  }, [])

  const scrollReaderToTop = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    viewer.scrollTop = 0

    const container = viewer.querySelector('.epub-container') as HTMLElement | null
    container?.scrollTo({ top: 0, left: 0, behavior: 'auto' })

    const iframe = viewer.querySelector('iframe') as HTMLIFrameElement | null
    const scrollingElement = iframe?.contentDocument?.scrollingElement
    scrollingElement?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])

  const getPrimaryScroller = useCallback((): HTMLElement | null => {
    const viewer = viewerRef.current
    if (!viewer) return null

    // In scrolled-doc mode each spine section is its own auto-height iframe
    // stacked inside .epub-container. The book scrolls on the container, not
    // inside any individual iframe.
    if (layoutModeRef.current === 'scroll') {
      const container = viewer.querySelector('.epub-container') as HTMLElement | null
      return container ?? viewer
    }

    const iframe = viewer.querySelector('iframe') as HTMLIFrameElement | null
    const iframeScroller = iframe?.contentDocument?.scrollingElement as HTMLElement | null
    if (iframeScroller) return iframeScroller

    const container = viewer.querySelector('.epub-container') as HTMLElement | null
    if (container) return container

    return viewer
  }, [])

  useEffect(() => {
    if (!renditionRef.current) return
    applyTheme(renditionRef.current, theme, fontSize)
  }, [theme, fontSize, applyTheme])

  useEffect(() => {
    if (!viewerRef.current) return

    const element = viewerRef.current
    const observer = new ResizeObserver(() => {
      if (renditionRef.current && element.clientWidth > 0) {
        renditionRef.current.resize(element.clientWidth, element.clientHeight)
      }
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    return () => {
      activeLoadIdRef.current += 1
      renditionRef.current?.destroy()
      renditionRef.current = null
      bookRef.current?.destroy()
      bookRef.current = null
    }
  }, [])

  const resetBookState = useCallback(() => {
    locationsReadyRef.current = false
    currentCfiRef.current = ''
    currentDisplayHrefRef.current = ''
    currentPageRef.current = 0
    totalPagesRef.current = 0
    tocRef.current = []

    setError(null)
    setToc([])
    setCurrentLocation(null)
    setCurrentHref('')
    setCurrentPage(0)
    setTotalPages(0)
    setCurrentChapterIndex(0)
    setCurrentChapter(0)
    setTotalChapters(0)
    setProgress(0)
    setTitle('')
    setAuthor('')
    setCover(null)
    setHasRenderedContent(false)
  }, [])

  const waitForViewer = useCallback((): Promise<HTMLDivElement> => {
    return new Promise((resolve, reject) => {
      const isReady = () =>
        Boolean(
          viewerRef.current && viewerRef.current.clientWidth > 0 && viewerRef.current.clientHeight > 0,
        )
      if (isReady()) {
        resolve(viewerRef.current!)
        return
      }

      const interval = window.setInterval(() => {
        if (!isReady()) return
        window.clearInterval(interval)
        window.clearTimeout(timeout)
        resolve(viewerRef.current!)
      }, 50)

      const timeout = window.setTimeout(() => {
        window.clearInterval(interval)
        if (isReady()) {
          resolve(viewerRef.current!)
          return
        }
        reject(new Error('Viewer element not found'))
      }, 3000)
    })
  }, [])

  const parseFixedLayoutSize = useCallback((document: Document) => {
    const fixedLayoutRoot = document.getElementById('fxlChapter')
    if (!fixedLayoutRoot) return null

    const inlineStyle = fixedLayoutRoot.getAttribute('style') ?? ''
    const match = inlineStyle.match(/width:\s*(\d+)px;\s*height:\s*(\d+)px/i)
    if (match) {
      return {
        width: Number(match[1]),
        height: Number(match[2]),
        element: fixedLayoutRoot,
      }
    }

    const viewportMeta = document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? ''
    const viewportMatch = viewportMeta.match(/width\s*=\s*(\d+).+height\s*=\s*(\d+)/i)
    if (!viewportMatch) return null

    return {
      width: Number(viewportMatch[1]),
      height: Number(viewportMatch[2]),
      element: fixedLayoutRoot,
    }
  }, [])

  const normalizeFixedLayoutDocument = useCallback((document: Document) => {
    const viewerWidth = viewerRef.current?.clientWidth ?? 0
    const viewerHeight = viewerRef.current?.clientHeight ?? 0
    const fixedLayout = parseFixedLayoutSize(document)
    if (!fixedLayout || viewerWidth <= 0 || viewerHeight <= 0) return false

    const horizontalInset = 24
    const verticalInset = 40
    const availableWidth = Math.max(1, viewerWidth - horizontalInset * 2)
    const availableHeight = Math.max(1, viewerHeight - verticalInset * 2)
    const scale = Math.min(availableWidth / fixedLayout.width, availableHeight / fixedLayout.height)
    const scaledWidth = fixedLayout.width * scale
    const scaledHeight = fixedLayout.height * scale
    const offsetLeft = Math.max(0, (viewerWidth - scaledWidth) / 2)
    const offsetTop = Math.max(0, (viewerHeight - scaledHeight) / 2)
    const html = document.documentElement
    const body = document.body
    const head = document.head

    let resetStylesheet = document.getElementById('loci-fixed-layout-reset') as HTMLStyleElement | null
    if (!resetStylesheet) {
      resetStylesheet = document.createElement('style')
      resetStylesheet.id = 'loci-fixed-layout-reset'
      head.appendChild(resetStylesheet)
    }

    resetStylesheet.textContent = `
      html, body {
        width: ${viewerWidth}px !important;
        height: ${viewerHeight}px !important;
        margin: 0 !important;
        padding: 0 !important;
        padding-top: 0 !important;
        padding-right: 0 !important;
        padding-bottom: 0 !important;
        padding-left: 0 !important;
        overflow: hidden !important;
        max-width: none !important;
        min-width: 0 !important;
        min-height: 0 !important;
        background: transparent !important;
        column-width: auto !important;
        column-gap: 0 !important;
        column-count: auto !important;
        font-family: initial !important;
        font-size: medium !important;
        line-height: normal !important;
        text-align: initial !important;
        color: initial !important;
      }

      body {
        position: relative !important;
        display: block !important;
        box-sizing: border-box !important;
        transform: none !important;
      }

      #fxlChapter {
        position: absolute !important;
        left: ${offsetLeft}px !important;
        top: ${offsetTop}px !important;
        width: ${fixedLayout.width}px !important;
        height: ${fixedLayout.height}px !important;
        margin: 0 !important;
        transform: scale(${scale}) !important;
        transform-origin: top left !important;
        zoom: 1 !important;
      }

      #fxlChapter,
      #fxlChapter * {
        max-width: none !important;
      }
    `

    html.style.setProperty('width', `${viewerWidth}px`, 'important')
    html.style.setProperty('height', `${viewerHeight}px`, 'important')
    html.style.setProperty('overflow', 'hidden', 'important')
    html.style.setProperty('margin', '0', 'important')
    html.style.setProperty('padding', '0', 'important')
    html.style.setProperty('background', 'transparent', 'important')

    body.style.setProperty('width', `${viewerWidth}px`, 'important')
    body.style.setProperty('height', `${viewerHeight}px`, 'important')
    body.style.setProperty('overflow', 'hidden', 'important')
    body.style.setProperty('margin', '0', 'important')
    body.style.setProperty('padding', '0', 'important')
    body.style.setProperty('padding-top', '0', 'important')
    body.style.setProperty('padding-right', '0', 'important')
    body.style.setProperty('padding-bottom', '0', 'important')
    body.style.setProperty('padding-left', '0', 'important')
    body.style.setProperty('max-width', 'none', 'important')
    body.style.setProperty('column-width', 'auto', 'important')
    body.style.setProperty('column-gap', '0', 'important')
    body.style.setProperty('column-count', 'auto', 'important')
    body.style.setProperty('box-sizing', 'border-box', 'important')
    body.style.setProperty('display', 'block', 'important')
    body.style.setProperty('position', 'relative', 'important')
    body.style.setProperty('background', 'transparent', 'important')
    body.style.setProperty('font-family', 'initial', 'important')
    body.style.setProperty('font-size', 'medium', 'important')
    body.style.setProperty('line-height', 'normal', 'important')
    body.style.setProperty('color', 'initial', 'important')

    fixedLayout.element.style.setProperty('position', 'absolute', 'important')
    fixedLayout.element.style.setProperty('left', `${offsetLeft}px`, 'important')
    fixedLayout.element.style.setProperty('top', `${offsetTop}px`, 'important')
    fixedLayout.element.style.setProperty('width', `${fixedLayout.width}px`, 'important')
    fixedLayout.element.style.setProperty('height', `${fixedLayout.height}px`, 'important')
    fixedLayout.element.style.setProperty('transform', `scale(${scale})`, 'important')
    fixedLayout.element.style.setProperty('transform-origin', 'top left', 'important')
    fixedLayout.element.style.setProperty('zoom', '1', 'important')
    fixedLayout.element.style.setProperty('margin', '0', 'important')
    return true
  }, [parseFixedLayoutSize])

  const normalizeTemplateDocument = useCallback((document: Document) => {
    const applicationName = document.querySelector('meta[name="application-name"]')?.getAttribute('content') ?? ''
    const body = document.body
    if (applicationName.toLowerCase() !== 'ktemplate' || !body) return false

    let resetStylesheet = document.getElementById('loci-ktemplate-reset') as HTMLStyleElement | null
    if (!resetStylesheet) {
      resetStylesheet = document.createElement('style')
      resetStylesheet.id = 'loci-ktemplate-reset'
      document.head.appendChild(resetStylesheet)
    }

    resetStylesheet.textContent = `
      html, body {
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
      }

      body {
        padding: 0 !important;
        overflow-x: hidden !important;
      }

      .templateTitle,
      .templateBody,
      .templateToc {
        width: min(72rem, calc(100% - 48px)) !important;
        max-width: none !important;
        margin-left: auto !important;
        margin-right: auto !important;
        box-sizing: border-box !important;
      }

      .templateBody,
      .templateToc {
        padding: 48px 56px !important;
      }

      .templateTitle {
        height: auto !important;
        min-height: 240px !important;
      }

      .templateTitle img {
        width: 100% !important;
        height: auto !important;
        display: block !important;
      }

      .templateBody > *,
      .templateToc > * {
        width: auto !important;
        max-width: none !important;
      }
    `

    body.style.setProperty('width', '100%', 'important')
    body.style.setProperty('max-width', 'none', 'important')
    body.style.setProperty('padding', '0', 'important')
    body.style.setProperty('margin', '0', 'important')
    return true
  }, [])

  const hasRenditionDocument = useCallback((): boolean => {
    const contents = renditionRef.current?.getContents() ?? []
    return contents.some((content) => Boolean(content.document?.body))
  }, [])

  const hasRenderableContent = useCallback(() => {
    const contents = renditionRef.current?.getContents() ?? []
    return contents.some((content) => {
      const document = content.document
      if (!document?.body) return false
      const body = document.body

      const fixedLayoutImage = document.querySelector('#fxlChapter img') as HTMLImageElement | null
      if (fixedLayoutImage) {
        if (fixedLayoutImage.complete && fixedLayoutImage.naturalWidth > 0) return true
        if (fixedLayoutImage.getAttribute('src') || fixedLayoutImage.src) return true
      }

      if (document.querySelector('svg')) return true

      const compactHtml = body.innerHTML.replace(/\s+/g, '')
      if (compactHtml.length > 0) return true

      const visibleMedia = Array.from(document.images).some(
        (image) => image.complete && image.naturalWidth > 0,
      )
      if (visibleMedia) return true

      const text = body.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      if (text.length > 0) return true

      return body.children.length > 0
    })
  }, [])

  const waitForPendingImagesInRendition = useCallback(async (capMs: number) => {
    const contents = renditionRef.current?.getContents() ?? []
    await Promise.all(
      contents.map(
        (content) =>
          new Promise<void>((resolve) => {
            const doc = content.document
            if (!doc) {
              resolve()
              return
            }
            const imgs = Array.from(doc.images).filter((img) => !img.complete)
            if (imgs.length === 0) {
              resolve()
              return
            }
            const t = window.setTimeout(resolve, capMs)
            let pending = imgs.length
            const done = () => {
              pending -= 1
              if (pending <= 0) {
                window.clearTimeout(t)
                resolve()
              }
            }
            for (const img of imgs) {
              img.addEventListener('load', done, { once: true })
              img.addEventListener('error', done, { once: true })
            }
          }),
      ),
    )
  }, [])

  const recoverFromFailedNavigation = useCallback(() => {
    const hasDoc = hasRenditionDocument()
    setIsLoading(false)
    setHasRenderedContent(hasDoc)
    if (!hasDoc) {
      setError('Could not open that section.')
    }
  }, [hasRenditionDocument])

  const syncCurrentLayoutMode = useCallback((currentBook: Book | null = bookRef.current) => {
    const contents = renditionRef.current?.getContents() ?? []
    const hasFixedLayout = contents.some((content) => {
      const document = content.document
      if (!document) return false
      const isFixedLayout = normalizeFixedLayoutDocument(document)
      if (!isFixedLayout) {
        const isKTemplate = normalizeTemplateDocument(document)
        // In scroll mode, epub.js sets body inline styles (width, margin, padding)
        // that override our theme. Injecting a stylesheet with !important beats
        // inline styles (non-!important), centering the constrained body.
        if (!isKTemplate && layoutModeRef.current === 'scroll') {
          let centreStyle = document.getElementById('loci-scroll-centre') as HTMLStyleElement | null
          if (!centreStyle) {
            centreStyle = document.createElement('style')
            centreStyle.id = 'loci-scroll-centre'
            document.head.appendChild(centreStyle)
          }
          centreStyle.textContent = 'body { width: auto !important; margin-left: auto !important; margin-right: auto !important; }'
        }
      }
      return isFixedLayout
    })

    isFixedLayoutRef.current = hasFixedLayout

    if (currentBook) {
      const { current, total } = getSpinePosition(currentSpineIndexRef.current, currentBook.spine.spineItems)
      setCurrentChapter(current)
      setTotalChapters(total)

      if (layoutModeRef.current === 'scroll' || hasFixedLayout) {
        currentPageRef.current = current
        totalPagesRef.current = total
        setCurrentPage(current)
        setTotalPages(total)
      }
    }
  }, [normalizeFixedLayoutDocument, normalizeTemplateDocument])

  const waitForRenderableContent = useCallback(
    async (renderId: number, attempts = 24, delayMs = 100) => {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        if (renderId !== activeRenderIdRef.current) return false

        syncCurrentLayoutMode(bookRef.current)
        await waitForPendingImagesInRendition(500)
        if (renderId !== activeRenderIdRef.current) return false

        if (hasRenderableContent()) {
          setError(null)
          setHasRenderedContent(true)
          setIsLoading(false)
          return true
        }

        await new Promise((resolve) => window.setTimeout(resolve, delayMs))
      }

      if (renderId !== activeRenderIdRef.current) return false
      syncCurrentLayoutMode(bookRef.current)

      if (hasRenditionDocument()) {
        setError(null)
        setHasRenderedContent(true)
        setIsLoading(false)
        return true
      }

      setIsLoading(false)
      setHasRenderedContent(false)
      return false
    },
    [hasRenderableContent, hasRenditionDocument, syncCurrentLayoutMode, waitForPendingImagesInRendition],
  )

  const attachRendition = useCallback(async (currentBook: BookWithLocations, target?: string) => {
    activeRenderIdRef.current += 1
    const renderId = activeRenderIdRef.current
    const viewerElement = await waitForViewer()
    viewerElement.scrollTop = 0

    selectionAbortRef.current?.abort()
    selectionAbortRef.current = null
    renditionRef.current?.destroy()

    const nextRendition = currentBook.renderTo(viewerElement, {
      width: '100%',
      height: '100%',
      allowScriptedContent: true,
      ...buildRenditionOptions(layoutModeRef.current),
    })

    renditionRef.current = nextRendition
    setRendition(nextRendition)
    applyTheme(nextRendition, themeRef.current, fontSizeRef.current)

    // Inject dark-mode color overrides after each chapter renders (overrides EPUB's own CSS)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(nextRendition as any).hooks.content.register((contents: any) => {
      injectThemeOverride(contents.document as Document, themeRef.current)
    })

    nextRendition.on('rendered', () => {
      window.requestAnimationFrame(() => {
        syncCurrentLayoutMode(currentBook)
        // In scroll mode, skip scrollReaderToTop and resize on chapter-navigation
        // renders (renderId !== activeRenderIdRef.current). Both operations reset
        // the container's scroll position and trigger 'relocated' with the old
        // chapter's position, overriding the manual state updates in .then().
        // The ResizeObserver handles real viewport-size changes for all modes.
        // On the initial load render in scroll mode (renderId === activeRenderIdRef)
        // we still resize to ensure correct iframe widths.
        if (layoutModeRef.current !== 'scroll' || renderId === activeRenderIdRef.current) {
          scrollReaderToTop()
          if (viewerRef.current) {
            nextRendition.resize(viewerRef.current.clientWidth, viewerRef.current.clientHeight)
          }
        }
        // Only drive the loading-state machine for the render that set it up.
        // Page-turn handlers (nextPage/prevPage/etc.) increment activeRenderIdRef
        // before their own display/next/prev call, so renderId will not match and
        // waitForRenderableContent is correctly skipped here — their .then() handles it.
        if (renderId === activeRenderIdRef.current) {
          void waitForRenderableContent(renderId)
        }

        // Attach text-selection listeners to iframe documents.
        // Abort any previous set before creating new ones.
        selectionAbortRef.current?.abort()
        const selectionAbort = new AbortController()
        selectionAbortRef.current = selectionAbort
        const { signal } = selectionAbort

        try {
          const contents = nextRendition.getContents()
          for (const c of contents) {
            const doc = (c as { document?: Document }).document
            if (!doc) continue
            // Re-inject dark-mode override here (after EPUB's own CSS has loaded)
            injectThemeOverride(doc, themeRef.current)
            doc.addEventListener(
              'mouseup',
              (e) => {
                const sel = doc.getSelection()
                const text = sel?.toString().trim() ?? ''
                if (text.length < 3 || !onTextSelectedRef.current) return

                const iframes = viewerRef.current?.querySelectorAll('iframe') ?? []
                let targetIframe: HTMLIFrameElement | null = null
                for (const iframe of Array.from(iframes)) {
                  if (iframe.contentDocument === doc) {
                    targetIframe = iframe as HTMLIFrameElement
                    break
                  }
                }

                const range = sel!.getRangeAt(0)
                const rangeRect = range.getBoundingClientRect()
                const iframeRect = targetIframe?.getBoundingClientRect() ?? { left: 0, top: 0 }

                // Use viewport-absolute coords — the overlay is position:fixed so it
                // won't be clipped by the epub viewer's overflow:hidden ancestor.
                onTextSelectedRef.current(text, currentDisplayHrefRef.current, {
                  x: iframeRect.left + rangeRect.left + rangeRect.width / 2,
                  y: iframeRect.top + rangeRect.top,
                })
              },
              { signal },
            )

          }
        } catch {
          // getContents() may throw before the rendition is ready — safe to ignore
        }
      })
    })

    nextRendition.on('relocated', (location: EpubLocation) => {
      if (nextRendition !== renditionRef.current) return

      setCurrentLocation(location)
      setCurrentHref(location.start.href)
      currentDisplayHrefRef.current = location.start.href
      currentCfiRef.current = location.start.cfi
      currentSpineIndexRef.current = location.start.index
      syncCurrentLayoutMode(currentBook)

      const { current, total } = getSpinePosition(location.start.index, currentBook.spine.spineItems)
      setCurrentChapter(current)
      setTotalChapters(total)

      if (layoutModeRef.current === 'scroll' || isFixedLayoutRef.current) {
        currentPageRef.current = current
        totalPagesRef.current = total
        setCurrentPage(current)
        setTotalPages(total)
      } else {
        const displayedPage = location.start.displayed?.page ?? current
        const displayedTotal = location.start.displayed?.total ?? total
        currentPageRef.current = displayedPage
        totalPagesRef.current = displayedTotal
        setCurrentPage(displayedPage)
        setTotalPages(displayedTotal)
      }

      const cfiPercentage = locationsReadyRef.current
        ? currentBook.locations.percentageFromCfi(location.start.cfi)
        : null
      setProgress(calculateProgressPercent(current, total, cfiPercentage))

      const href = location.start.href
      const chapterIndex = tocRef.current.findIndex(
        (item) => item.href === href || item.href.split('#')[0] === href.split('#')[0],
      )
      if (chapterIndex >= 0) {
        setCurrentChapterIndex(chapterIndex)
      }
    })

    const displayTarget =
      target ?? currentBook.spine.get()?.href ?? currentBook.spine.spineItems[0]?.href
    await nextRendition.display(displayTarget)
    scrollReaderToTop()
    syncCurrentLayoutMode(currentBook)

    if (viewerRef.current) {
      nextRendition.resize(viewerRef.current.clientWidth, viewerRef.current.clientHeight)
    }

    const rendered = await waitForRenderableContent(renderId, 28, 120)
    if (!rendered && target) {
      await nextRendition.display(target)
      scrollReaderToTop()
      await waitForRenderableContent(renderId, 18, 120)
    }

    if (renderId === activeRenderIdRef.current && !hasRenditionDocument()) {
      setError('Unable to display this book.')
    }

    return nextRendition
  }, [
    applyTheme,
    hasRenditionDocument,
    scrollReaderToTop,
    syncCurrentLayoutMode,
    waitForRenderableContent,
    waitForViewer,
  ])

  const loadBook = useCallback(async (file: File) => {
    activeLoadIdRef.current += 1
    const loadId = activeLoadIdRef.current

    renditionRef.current?.destroy()
    renditionRef.current = null
    setRendition(null)

    bookRef.current?.destroy()
    bookRef.current = null
    setBook(null)

    resetBookState()
    setIsLoading(true)
    setHasRenderedContent(false)

    const ensureActiveLoad = () => {
      if (loadId !== activeLoadIdRef.current) {
        throw new Error('Stale EPUB load')
      }
    }

    const loadTimeout = <T,>(promise: Promise<T>, ms = 10000): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('Invalid EPUB: load timed out')), ms)
        promise.then(
          (value) => {
            window.clearTimeout(timeout)
            resolve(value)
          },
          (reason) => {
            window.clearTimeout(timeout)
            reject(reason)
          },
        )
      })

    try {
      const rawBuffer = await file.arrayBuffer()
      const buffer = await sanitizeEpubBuffer(rawBuffer)
      ensureActiveLoad()

      const nextBook = ePub(buffer) as BookWithLocations

      const navigation = await loadTimeout(nextBook.loaded.navigation)
      const spine = await loadTimeout(nextBook.loaded.spine)
      ensureActiveLoad()

      bookRef.current = nextBook
      setBook(nextBook)
      const tocItems = normalizeTocItems(navigation.toc, spine.spineItems)
      tocRef.current = tocItems
      setToc(tocItems)

      const metadata = await loadTimeout(nextBook.loaded.metadata)
      ensureActiveLoad()
      setTitle(metadata.title || file.name.replace(/\.epub$/i, ''))
      setAuthor(metadata.creator || '')

      try {
        const coverUrl = await nextBook.coverUrl()
        ensureActiveLoad()
        setCover(coverUrl)
      } catch {
        setCover(null)
      }

      const firstLinear = nextBook.spine.get()
      const initialTarget = firstLinear?.href ?? nextBook.spine.spineItems[0]?.href
      ensureActiveLoad()
      await attachRendition(nextBook, initialTarget)
      ensureActiveLoad()
      nextBook.locations.generate(1024).then(() => {
        if (loadId !== activeLoadIdRef.current) return

        locationsReadyRef.current = true
        if (!currentCfiRef.current) return

        const cfiPercentage = nextBook.locations.percentageFromCfi(currentCfiRef.current)
        setProgress(
          calculateProgressPercent(
            currentPageRef.current,
            totalPagesRef.current,
            cfiPercentage,
          ),
        )
      }).catch(() => {
        // Keep chapter-based progress if the location index fails.
      })
    } catch (error) {
      if ((error instanceof Error && error.message === 'Stale EPUB load') || loadId !== activeLoadIdRef.current) {
        return
      }

      setIsLoading(false)
      const message = error instanceof Error ? error.message : String(error)
      if (
        message.toLowerCase().includes('invalid') ||
        message.toLowerCase().includes('not a valid') ||
        message.toLowerCase().includes('mime') ||
        message.toLowerCase().includes('timed out') ||
        message === 'Viewer element not found'
      ) {
        setError("This file doesn't appear to be a valid EPUB")
      } else {
        setError('Unable to read this EPUB file. Try re-downloading it.')
      }
    }
  }, [attachRendition, resetBookState])

  useEffect(() => {
    const currentBook = bookRef.current as BookWithLocations | null
    if (!currentBook || !viewerRef.current) return
    if (currentBook.spine.spineItems.length === 0) return

    const target =
      currentCfiRef.current ||
      currentHref ||
      currentBook.spine.get(currentSpineIndexRef.current)?.href ||
      currentBook.spine.get()?.href ||
      currentBook.spine.spineItems[0]?.href
    setIsLoading(true)
    setHasRenderedContent(false)

    attachRendition(currentBook, target).catch(() => {
      recoverFromFailedNavigation()
    })
  }, [attachRendition, layoutMode, recoverFromFailedNavigation])

  const nextChapter = useCallback(() => {
    const currentBook = bookRef.current
    if (!currentBook) return

    const path = splitHref(currentDisplayHrefRef.current).path
    let current: SpineSection | undefined
    if (path) {
      current = currentBook.spine.get(path) ?? undefined
    }
    if (!current) {
      current = currentBook.spine.get(currentSpineIndexRef.current) ?? undefined
    }

    let nextSection = current?.next?.()
    if (!nextSection && current) {
      nextSection = nextLinearSpineItem(currentBook.spine.spineItems, current.index) ?? undefined
    }
    if (!nextSection) return

    activeRenderIdRef.current += 1
    const renderId = activeRenderIdRef.current
    setIsLoading(true)
    setHasRenderedContent(false)
    const targetBook = currentBook
    renditionRef.current
      ?.display(nextSection.href)
      .then(() => {
        setError(null)
        // Update position immediately — in scrolled-doc mode 'relocated' fires
        // from scroll events, not programmatic display() calls, so we can't
        // rely on it to advance position for the next navigation.
        currentDisplayHrefRef.current = nextSection.href
        currentSpineIndexRef.current = nextSection.index
        const { current, total } = getSpinePosition(nextSection.index, targetBook.spine.spineItems)
        setCurrentChapter(current)
        setTotalChapters(total)
        setCurrentPage(current)
        setTotalPages(total)
        // In scrolled-doc mode display() scrolls to the chapter — scrolling
        // back to top would undo the navigation and fire 'relocated' with the
        // wrong (previous) position.
        if (layoutModeRef.current !== 'scroll') scrollReaderToTop()
        void waitForRenderableContent(renderId, 16, 100)
      })
      .catch(() => {
        recoverFromFailedNavigation()
      })
  }, [recoverFromFailedNavigation, scrollReaderToTop, waitForRenderableContent])

  const prevChapter = useCallback(() => {
    const currentBook = bookRef.current
    if (!currentBook) return

    const path = splitHref(currentDisplayHrefRef.current).path
    let current: SpineSection | undefined
    if (path) {
      current = currentBook.spine.get(path) ?? undefined
    }
    if (!current) {
      current = currentBook.spine.get(currentSpineIndexRef.current) ?? undefined
    }

    let prevSection = current?.prev?.()
    if (!prevSection && current) {
      prevSection = prevLinearSpineItem(currentBook.spine.spineItems, current.index) ?? undefined
    }
    if (!prevSection) return

    activeRenderIdRef.current += 1
    const renderId = activeRenderIdRef.current
    setIsLoading(true)
    setHasRenderedContent(false)
    const targetBook = currentBook
    renditionRef.current
      ?.display(prevSection.href)
      .then(() => {
        setError(null)
        currentDisplayHrefRef.current = prevSection.href
        currentSpineIndexRef.current = prevSection.index
        const { current, total } = getSpinePosition(prevSection.index, targetBook.spine.spineItems)
        setCurrentChapter(current)
        setTotalChapters(total)
        setCurrentPage(current)
        setTotalPages(total)
        if (layoutModeRef.current !== 'scroll') scrollReaderToTop()
        void waitForRenderableContent(renderId, 16, 100)
      })
      .catch(() => {
        recoverFromFailedNavigation()
      })
  }, [recoverFromFailedNavigation, scrollReaderToTop, waitForRenderableContent])

  const nextPage = useCallback(() => {
    if (!renditionRef.current) return

    if (layoutModeRef.current === 'scroll') {
      const scroller = getPrimaryScroller()
      if (!scroller) return

      const step = Math.max(120, scroller.clientHeight * 0.9)
      const maxTop = scroller.scrollHeight - scroller.clientHeight
      const nextTop = Math.min(maxTop, scroller.scrollTop + step)

      if (maxTop > 0 && nextTop > scroller.scrollTop + 4) {
        scroller.scrollTo({ top: nextTop, behavior: 'smooth' })
        return
      }

      nextChapter()
      return
    }

    activeRenderIdRef.current += 1
    const renderId = activeRenderIdRef.current
    setIsLoading(true)
    setHasRenderedContent(false)
    void renditionRef.current
      .next()
      .then(() => {
        void waitForRenderableContent(renderId, 16, 100)
      })
      .catch(() => {
        recoverFromFailedNavigation()
      })
  }, [getPrimaryScroller, nextChapter, recoverFromFailedNavigation, waitForRenderableContent])

  const prevPage = useCallback(() => {
    if (!renditionRef.current) return

    if (layoutModeRef.current === 'scroll') {
      const scroller = getPrimaryScroller()
      if (!scroller) return

      const step = Math.max(120, scroller.clientHeight * 0.9)
      const nextTop = Math.max(0, scroller.scrollTop - step)

      if (nextTop < scroller.scrollTop - 4) {
        scroller.scrollTo({ top: nextTop, behavior: 'smooth' })
        return
      }

      prevChapter()
      return
    }

    activeRenderIdRef.current += 1
    const renderId = activeRenderIdRef.current
    setIsLoading(true)
    setHasRenderedContent(false)
    void renditionRef.current
      .prev()
      .then(() => {
        void waitForRenderableContent(renderId, 16, 100)
      })
      .catch(() => {
        recoverFromFailedNavigation()
      })
  }, [getPrimaryScroller, prevChapter, recoverFromFailedNavigation, waitForRenderableContent])

  const goToHref = useCallback((href: string) => {
    const spineItems = bookRef.current?.spine.spineItems ?? []
    const resolvedHref = resolveTocHref(href, spineItems, currentHref)
    activeRenderIdRef.current += 1
    const renderId = activeRenderIdRef.current
    setIsLoading(true)
    setHasRenderedContent(false)
    renditionRef.current
      ?.display(resolvedHref)
      .then(() => {
        setError(null)
        if (layoutModeRef.current !== 'scroll') scrollReaderToTop()
        void waitForRenderableContent(renderId, 16, 100)
      })
      .catch(() => {
        recoverFromFailedNavigation()
      })
  }, [currentHref, recoverFromFailedNavigation, scrollReaderToTop, waitForRenderableContent])

  const getCurrentText = useCallback((): string => {
    if (!renditionRef.current) return ''

    try {
      const contents = renditionRef.current.getContents()
      const SENTENCE_ENDERS = /[.!?]$/
      const blocks: string[] = []
      for (const content of contents) {
        const doc = (content as { document?: Document }).document
        if (!doc) continue
        const elements = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, td')
        for (const el of Array.from(elements)) {
          const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
          if (t.length < 2) continue
          // Ensure each block ends with sentence-ending punctuation so splitSentences
          // won't merge adjacent blocks (e.g. heading + first paragraph) into one sentence
          blocks.push(SENTENCE_ENDERS.test(t) ? t : t + '.')
        }
      }
      return blocks.join(' ')
    } catch {
      return ''
    }
  }, [])

  const getFullChapterText = useCallback((): string => {
    try {
      const contents = renditionRef.current?.getContents()
      if (!contents || contents.length === 0) return ''
      // getContents() returns an array of Contents objects; use the first one
      const doc = (contents[0] as any).document as Document | undefined
      if (!doc) return ''
      return doc.body?.innerText ?? doc.body?.textContent ?? ''
    } catch {
      return ''
    }
  }, [])

  const clearSentenceHighlight = useCallback(() => {
    const contents = renditionRef.current?.getContents() ?? []
    for (const c of contents) {
      const doc = c.document
      if (!doc) continue
      // Unwrap inline <mark> highlights by replacing with their children
      doc.querySelectorAll('mark[data-loci-reading]').forEach((mark) => {
        mark.replaceWith(...Array.from(mark.childNodes))
      })
      // Merge the text nodes fragmented by surroundContents so subsequent
      // indexOf searches see a single contiguous text node again
      doc.normalize()
      // Remove block-level fallback highlights
      doc.querySelectorAll('[data-loci-reading]').forEach((el) => {
        const h = el as HTMLElement
        h.style.background = ''
        h.style.borderRadius = ''
        delete h.dataset.lociReading
      })
    }
  }, [])

  const highlightSentence = useCallback((sentenceText: string) => {
    clearSentenceHighlight()
    if (!sentenceText.trim()) return
    if (!highlightEnabled) return

    // Strip trailing punctuation added by getCurrentText; normalise whitespace
    const search = sentenceText.replace(/[.!?]+$/, '').replace(/\s+/g, ' ').trim()
    if (!search) return
    const searchPrefix = search.slice(0, 20)

    // Regex that matches the prefix with flexible whitespace (epub may use \t/\n/&nbsp;)
    const prefixRe = new RegExp(
      searchPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'),
    )

    const contents = renditionRef.current?.getContents() ?? []
    for (const c of contents) {
      const doc = c.document
      if (!doc) continue

      // Find the block element whose normalised textContent contains the sentence
      const blocks = doc.querySelectorAll('p, li, blockquote, h1, h2, h3, h4, h5, h6, td')
      for (const block of Array.from(blocks)) {
        const blockNorm = (block.textContent ?? '').replace(/\s+/g, ' ')
        if (!blockNorm.includes(searchPrefix)) continue

        // Walk text nodes to find the one containing the sentence start
        const walker = doc.createTreeWalker(block, NodeFilter.SHOW_TEXT)
        let textNode: Text | null
        let markedInline = false
        while ((textNode = walker.nextNode() as Text | null)) {
          const nodeText = textNode.textContent ?? ''
          const m = nodeText.match(prefixRe)
          if (!m || m.index === undefined) continue

          // Wrap the matching text in a <mark> element
          const mark = doc.createElement('mark')
          mark.setAttribute('data-loci-reading', 'true')
          mark.style.cssText =
            'background:rgba(196,168,130,0.45);border-radius:3px;color:inherit;padding:1px 2px'
          try {
            const range = doc.createRange()
            range.setStart(textNode, m.index)
            range.setEnd(textNode, Math.min(m.index + search.length, nodeText.length))
            range.surroundContents(mark)
            markedInline = true
          } catch {
            // surroundContents fails when the range crosses element boundaries
          }
          break
        }

        if (!markedInline) {
          // Sentence start spans an inline element boundary (e.g. <em>, <strong>) —
          // fall back to a subtle block-level highlight so something always appears
          ;(block as HTMLElement).setAttribute('data-loci-reading', 'true')
          ;(block as HTMLElement).style.background = 'rgba(196,168,130,0.25)'
        }

        // Scroll the highlighted element into view if autoscroll is enabled
        if (autoscrollEnabled) {
          const el = doc.querySelector('[data-loci-reading]') as HTMLElement | null
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        return
      }
    }
  }, [clearSentenceHighlight, highlightEnabled, autoscrollEnabled])

  const searchBook = useCallback(async (query: string): Promise<SearchResult[]> => {
    const b = bookRef.current
    if (!b || !query.trim()) return []

    const results: SearchResult[] = []
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const spine = (b as any).spine
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sections: any[] = spine?.spineItems ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loader = (b as any).load.bind(b)

      for (const section of sections) {
        try {
          await section.load(loader)
          const found: { cfi: string; excerpt: string }[] = section.find(query.trim()) ?? []
          for (const r of found) {
            results.push({ cfi: r.cfi, excerpt: r.excerpt, href: section.href ?? '' })
          }
          section.unload()
        } catch {
          // skip sections that fail to load or search
        }
      }
    } catch {
      return []
    }

    return results
  }, [])

  const setOnTextSelected = useCallback(
    (cb: ((quote: string, href: string, pos: { x: number; y: number }) => void) | null) => {
      onTextSelectedRef.current = cb
    },
    [],
  )

  const applyAnnotationHighlights = useCallback((annotations: Annotation[]) => {
    const contents = renditionRef.current?.getContents() ?? []
    // Clear existing annotation highlights
    for (const c of contents) {
      c.document?.querySelectorAll('[data-loci-annotation]').forEach((el) => {
        const h = el as HTMLElement
        h.style.borderBottom = ''
        h.style.paddingBottom = ''
        delete h.dataset.lociAnnotation
      })
    }
    // Apply each annotation
    for (const annotation of annotations) {
      const search = annotation.quote.slice(0, 40).trim()
      if (!search) continue
      for (const c of contents) {
        const doc = c.document
        if (!doc) continue
        const blocks = doc.querySelectorAll('p, li, blockquote, h1, h2, h3, h4, h5, h6, td, div')
        for (const block of Array.from(blocks)) {
          if (block.textContent?.includes(search)) {
            const h = block as HTMLElement
            h.dataset.lociAnnotation = annotation.id
            h.style.borderBottom = '2px solid var(--accent-warm)'
            h.style.paddingBottom = '1px'
            break
          }
        }
      }
    }
  }, [])

  return {
    book,
    rendition,
    toc,
    currentLocation,
    currentHref,
    totalPages,
    currentPage,
    currentChapterIndex,
    totalChapters,
    currentChapter,
    progress,
    title,
    author,
    cover,
    loadBook,
    nextPage,
    prevPage,
    nextChapter,
    prevChapter,
    goToHref,
    getCurrentText,
    getFullChapterText,
    searchBook,
    highlightSentence,
    clearSentenceHighlight,
    setOnTextSelected,
    applyAnnotationHighlights,
    isLoading,
    hasRenderedContent,
    error,
    viewerRef,
  }
}
