import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { NavItem } from 'epubjs'
import type { Annotation } from '../services/annotationService'

interface SidebarProps {
  toc: NavItem[]
  isOpen: boolean
  currentHref: string
  onNavigate: (href: string) => void
  onClose: () => void
  annotations?: Annotation[]
  onDeleteAnnotation?: (id: string) => void
}

interface TocItemProps {
  item: NavItem
  depth: number
  currentHref: string
  onNavigate: (href: string) => void
}

function normaliseHref(href: string): string {
  return href.split('#')[0]
}

function isHrefActive(itemHref: string, currentHref: string): boolean {
  return normaliseHref(itemHref) === normaliseHref(currentHref)
}

function TocItemRow({ item, depth, currentHref, onNavigate }: TocItemProps) {
  const isActive = isHrefActive(item.href, currentHref)

  return (
    <>
      <button
        onClick={() => onNavigate(item.href)}
        aria-current={isActive ? 'page' : undefined}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: `8px 16px 8px ${16 + depth * 16}px`,
          background: isActive ? 'var(--bg-secondary)' : 'transparent',
          border: 'none',
          borderLeft: isActive ? '2px solid var(--accent-warm)' : '2px solid transparent',
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontFamily: 'var(--font-ui)',
          fontSize: depth === 0 ? 13 : 12,
          fontWeight: isActive ? 500 : 400,
          cursor: 'pointer',
          transition: 'all 120ms ease',
          lineHeight: 1.4,
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.color = 'var(--text-primary)'
            e.currentTarget.style.background = 'var(--bg-secondary)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.color = 'var(--text-secondary)'
            e.currentTarget.style.background = 'transparent'
          }
        }}
      >
        {item.label.trim()}
      </button>
      {item.subitems?.map((sub: NavItem, i: number) => (
        <TocItemRow
          key={`${sub.href}-${i}`}
          item={sub}
          depth={depth + 1}
          currentHref={currentHref}
          onNavigate={onNavigate}
        />
      ))}
    </>
  )
}

function AnnotationCard({
  annotation,
  onNavigate,
  onDelete,
}: {
  annotation: Annotation
  onNavigate: (href: string) => void
  onDelete: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const chapterLabel = annotation.href.split('/').pop()?.replace(/\.[^.]+$/, '') ?? annotation.href

  return (
    <div
      onClick={() => onNavigate(annotation.href)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        background: hovered ? 'var(--bg-secondary)' : 'transparent',
        transition: 'background 100ms ease',
        position: 'relative',
      }}
    >
      {/* Chapter label */}
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
        {chapterLabel}
      </div>

      {/* Quote */}
      <div
        style={{
          fontFamily: 'var(--font-reading)',
          fontStyle: 'italic',
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginBottom: annotation.note ? 6 : 0,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          lineHeight: 1.5,
        }}
      >
        "{annotation.quote}"
      </div>

      {/* Note text */}
      {annotation.note && (
        <div
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 12,
            color: 'var(--text-primary)',
            lineHeight: 1.5,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {annotation.note}
        </div>
      )}

      {/* Delete button */}
      {hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(annotation.id)
          }}
          aria-label="Delete annotation"
          style={{
            position: 'absolute',
            top: 8,
            right: 10,
            background: 'none',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: 2,
            borderRadius: 4,
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}

export default function Sidebar({
  toc,
  isOpen,
  currentHref,
  onNavigate,
  onClose,
  annotations = [],
  onDeleteAnnotation,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'contents' | 'notes'>('contents')
  const sortedAnnotations = [...annotations].sort((a, b) => b.createdAt - a.createdAt)

  const tabStyle = (tab: 'contents' | 'notes'): React.CSSProperties => ({
    flex: 1,
    border: 'none',
    background: activeTab === tab ? 'var(--bg-secondary)' : 'transparent',
    color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontFamily: 'var(--font-ui)',
    fontSize: 12,
    fontWeight: activeTab === tab ? 600 : 400,
    cursor: 'pointer',
    padding: '6px 0',
    borderRadius: 6,
    transition: 'all 120ms ease',
  })

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 40,
              background: 'rgba(0,0,0,0.2)',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
            }}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            aria-label="Table of contents"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              zIndex: 50,
              width: 280,
              background: 'var(--bg-surface)',
              borderRight: '1px solid var(--border)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '12px 16px 8px',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              {/* Tabs + close */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  role="tablist"
                  aria-label="Sidebar sections"
                  style={{
                    flex: 1,
                    display: 'flex',
                    background: 'var(--bg-primary)',
                    borderRadius: 8,
                    padding: 2,
                    border: '1px solid var(--border)',
                  }}
                >
                  <button
                    role="tab"
                    aria-selected={activeTab === 'contents'}
                    style={tabStyle('contents')}
                    onClick={() => setActiveTab('contents')}
                  >
                    Contents
                  </button>
                  <button
                    role="tab"
                    aria-selected={activeTab === 'notes'}
                    style={tabStyle('notes')}
                    onClick={() => setActiveTab('notes')}
                  >
                    Notes{annotations.length > 0 ? ` (${annotations.length})` : ''}
                  </button>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close table of contents"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    padding: 4,
                    borderRadius: 4,
                    fontSize: 18,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Contents tab */}
            {activeTab === 'contents' && (
              <nav style={{ flex: 1, padding: '8px 0' }}>
                {toc.length === 0 ? (
                  <p
                    style={{
                      padding: '16px',
                      color: 'var(--text-tertiary)',
                      fontFamily: 'var(--font-ui)',
                      fontSize: 13,
                    }}
                  >
                    No table of contents available
                  </p>
                ) : (
                  toc.map((item, i) => (
                    <TocItemRow
                      key={`${item.href}-${i}`}
                      item={item}
                      depth={0}
                      currentHref={currentHref}
                      onNavigate={(href) => {
                        onNavigate(href)
                        onClose()
                      }}
                    />
                  ))
                )}
              </nav>
            )}

            {/* Notes tab */}
            {activeTab === 'notes' && (
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {sortedAnnotations.length === 0 ? (
                  <p
                    style={{
                      padding: '16px',
                      color: 'var(--text-tertiary)',
                      fontFamily: 'var(--font-ui)',
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                  >
                    No notes yet. Select text in the book to add a note.
                  </p>
                ) : (
                  sortedAnnotations.map((a) => (
                    <AnnotationCard
                      key={a.id}
                      annotation={a}
                      onNavigate={(href) => {
                        onNavigate(href)
                        onClose()
                      }}
                      onDelete={(id) => onDeleteAnnotation?.(id)}
                    />
                  ))
                )}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
