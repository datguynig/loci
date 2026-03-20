import { motion, AnimatePresence } from 'framer-motion'
import type { NavItem } from 'epubjs'

interface SidebarProps {
  toc: NavItem[]
  isOpen: boolean
  currentChapterIndex: number
  onNavigate: (href: string) => void
  onClose: () => void
}

interface TocItemProps {
  item: NavItem
  depth: number
  isActive: boolean
  onNavigate: (href: string) => void
}

function TocItemRow({ item, depth, isActive, onNavigate }: TocItemProps) {
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
          isActive={false}
          onNavigate={onNavigate}
        />
      ))}
    </>
  )
}

export default function Sidebar({ toc, isOpen, currentChapterIndex, onNavigate, onClose }: SidebarProps) {
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
                padding: '16px 16px 12px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 15,
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                }}
              >
                Contents
              </span>
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
                }}
              >
                ×
              </button>
            </div>

            {/* TOC list */}
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
                    isActive={i === currentChapterIndex}
                    onNavigate={(href) => {
                      onNavigate(href)
                      onClose()
                    }}
                  />
                ))
              )}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
