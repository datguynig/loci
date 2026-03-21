declare module 'epubjs' {
  export interface NavItem {
    id: string
    href: string
    label: string
    subitems?: NavItem[]
  }

  export interface DisplayedLocation {
    page: number
    total: number
  }

  export interface LocationStart {
    cfi: string
    href: string
    index: number
    location?: number
    displayed: DisplayedLocation
  }

  export interface LocationEnd {
    cfi: string
    href: string
    index: number
    location?: number
    displayed: DisplayedLocation
  }

  export interface EpubLocation {
    start: LocationStart
    end: LocationEnd
    atStart?: boolean
    atEnd?: boolean
  }

  export interface Contents {
    document: Document
    content: Element
  }

  export interface ThemesManager {
    default(styles: Record<string, Record<string, string> | string>): void
    fontSize(size: string): void
    select(name: string): void
    register(name: string, styles: Record<string, Record<string, string>>): void
    override(name: string, value: string): void
  }

  export interface Rendition {
    display(target?: string | number): Promise<void>
    next(): Promise<void>
    prev(): Promise<void>
    themes: ThemesManager
    on(event: 'relocated', handler: (location: EpubLocation) => void): void
    on(event: 'rendered', handler: (section: unknown, view: unknown) => void): void
    on(event: 'started', handler: () => void): void
    on(event: 'attached', handler: () => void): void
    on(event: string, handler: (...args: unknown[]) => void): void
    getContents(): Contents[]
    destroy(): void
    resize(width?: string | number, height?: string | number): void
    currentLocation(): EpubLocation
  }

  export interface Navigation {
    toc: NavItem[]
  }

  export interface PackageMetadata {
    title: string
    creator: string
    description?: string
    pubdate?: string
    language?: string
  }

  export interface SpineSection {
    href: string
    index: number
    linear: string
    next?: () => SpineSection | undefined
    prev?: () => SpineSection | undefined
  }

  export interface Spine {
    spineItems: SpineSection[]
    /** No argument: first linear spine section (epub.js convention). */
    get(target?: string | number): SpineSection | null
  }

  export interface Book {
    spine: Spine
    navigation: Navigation
    package: {
      metadata: PackageMetadata
    }
    coverUrl(): Promise<string | null>
    renderTo(
      element: Element | string,
      options?: {
        width?: string | number
        height?: string | number
        flow?: 'paginated' | 'scrolled' | 'scrolled-continuous' | 'scrolled-doc'
        manager?: string
        spread?: string
        minSpreadWidth?: number
        defaultDirection?: string
        allowScriptedContent?: boolean
        fullsize?: boolean
      }
    ): Rendition
    loaded: {
      navigation: Promise<Navigation>
      spine: Promise<Spine>
      metadata: Promise<PackageMetadata>
      cover: Promise<string>
    }
    ready: Promise<void>
    destroy(): void
    key(): string
  }

  export default function ePub(input?: ArrayBuffer | string, options?: Record<string, unknown>): Book
}
