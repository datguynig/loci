import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import type { NavItem } from 'epubjs'

export interface SearchResult {
  cfi: string
  excerpt: string
  href: string
}

interface SearchPanelProps {
  onSearch: (query: string) => Promise<SearchResult[]>
  onNavigate: (href: string) => void
  onClose: () => void
  toc: NavItem[]
}

function chapterLabel(href: string, toc: NavItem[]): string {
  const norm = href.split('#')[0]
  const match = toc.find((item) => {
    const itemNorm = item.href.split('#')[0]
    return itemNorm === norm || itemNorm.endsWith('/' + norm) || norm.endsWith('/' + itemNorm)
  })
  return match?.label?.trim() ?? href.split('/').pop()?.replace(/\.[^.]+$/, '') ?? href
}

function highlightExcerpt(excerpt: string, query: string): React.ReactNode {
  const q = query.trim()
  if (!q) return excerpt
  const idx = excerpt.toLowerCase().indexOf(q.toLowerCase())
  if (idx < 0) return excerpt
  return (
    <>
      {excerpt.slice(0, idx)}
      <mark
        style={{
          background: 'rgba(196,168,130,0.45)',
          borderRadius: 2,
          color: 'inherit',
          padding: '0 1px',
        }}
      >
        {excerpt.slice(idx, idx + q.length)}
      </mark>
      {excerpt.slice(idx + q.length)}
    </>
  )
}

export default function SearchPanel({ onSearch, onNavigate, onClose, toc }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const runSearch = useCallback(
    (q: string) => {
      if (!q.trim()) {
        setResults([])
        return
      }
      setSearching(true)
      onSearch(q)
        .then((r) => {
          setResults(r)
          setSearching(false)
        })
        .catch(() => setSearching(false))
    },
    [onSearch],
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(q), 300)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 25,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        maxHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Search input row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 14px',
          gap: 8,
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-tertiary)"
          strokeWidth="2"
          style={{ flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Search in this book…"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: 'var(--font-ui)',
            fontSize: 13,
            color: 'var(--text-primary)',
          }}
        />
        {searching && (
          <div
            style={{
              width: 12,
              height: 12,
              border: '2px solid var(--border)',
              borderTop: '2px solid var(--accent-warm)',
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
              flexShrink: 0,
            }}
          />
        )}
        <button
          onClick={onClose}
          aria-label="Close search"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            fontSize: 16,
            lineHeight: 1,
            padding: 2,
            borderRadius: 4,
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* Results */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {!query.trim() && (
          <p
            style={{
              padding: '16px',
              fontFamily: 'var(--font-ui)',
              fontSize: 13,
              color: 'var(--text-tertiary)',
              margin: 0,
            }}
          >
            Type to search across all chapters
          </p>
        )}
        {query.trim() && !searching && results.length === 0 && (
          <p
            style={{
              padding: '16px',
              fontFamily: 'var(--font-ui)',
              fontSize: 13,
              color: 'var(--text-tertiary)',
              margin: 0,
            }}
          >
            No results for "{query}"
          </p>
        )}
        {results.map((r, i) => (
          <button
            key={`${r.cfi}-${i}`}
            onClick={() => {
              onNavigate(r.href)
              onClose()
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'background 100ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-secondary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--accent-warm)',
                marginBottom: 4,
              }}
            >
              {chapterLabel(r.href, toc)}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-reading)',
                fontStyle: 'italic',
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              …{highlightExcerpt(r.excerpt, query)}…
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  )
}
