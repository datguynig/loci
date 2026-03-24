import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { FontSize, LayoutMode } from '../hooks/useEpub'

const FONT_SIZE_ORDER: FontSize[] = ['sm', 'md', 'lg', 'xl']
const FONT_SIZE_LABELS: Record<FontSize, string> = { sm: 'S', md: 'M', lg: 'L', xl: 'XL' }

interface ReaderSettingsProps {
  isOpen: boolean
  onClose: () => void
  fontSize: FontSize
  onFontSizeChange: (s: FontSize) => void
  layoutMode: LayoutMode
  onLayoutModeChange: (m: LayoutMode) => void
  highlightEnabled: boolean
  onHighlightChange: (v: boolean) => void
  autoscrollEnabled: boolean
  onAutoscrollChange: (v: boolean) => void
  anchorRef: React.RefObject<HTMLButtonElement>
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        cursor: 'pointer',
        gap: 16,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: 12,
          color: 'var(--text-primary)',
          userSelect: 'none',
        }}
      >
        {label}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 32,
          height: 18,
          borderRadius: 99,
          border: 'none',
          background: checked ? 'var(--accent-warm)' : 'var(--border)',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 150ms ease',
          flexShrink: 0,
          padding: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 16 : 2,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 150ms ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        />
      </button>
    </label>
  )
}

export default function ReaderSettings({
  isOpen,
  onClose,
  fontSize,
  onFontSizeChange,
  layoutMode,
  onLayoutModeChange,
  highlightEnabled,
  onHighlightChange,
  autoscrollEnabled,
  onAutoscrollChange,
  anchorRef,
}: ReaderSettingsProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, onClose, anchorRef])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])


  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          role="dialog"
          aria-label="Reader settings"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            right: 0,
            zIndex: 200,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
            minWidth: 200,
            maxWidth: 'min(260px, calc(100vw - 32px))',
            overflow: 'hidden',
          }}
        >
          {/* Display section */}
          <div
            style={{
              padding: '8px 14px 6px',
              borderBottom: '1px solid var(--border)',
              fontFamily: 'var(--font-ui)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
            }}
          >
            Display
          </div>

          {/* Font size */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 14px',
              gap: 16,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 12,
                color: 'var(--text-primary)',
                userSelect: 'none',
              }}
            >
              Font size
            </span>
            <div style={{ display: 'flex', gap: 2 }}>
              {FONT_SIZE_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => onFontSizeChange(s)}
                  aria-label={`Font size ${s}`}
                  aria-pressed={fontSize === s}
                  style={{
                    width: 28,
                    height: 26,
                    border: 'none',
                    background: fontSize === s ? 'var(--accent-warm)' : 'var(--bg-secondary)',
                    color: fontSize === s ? '#fff' : 'var(--text-secondary)',
                    fontFamily: 'var(--font-ui)',
                    fontSize: 11,
                    fontWeight: fontSize === s ? 600 : 400,
                    cursor: 'pointer',
                    borderRadius: 5,
                    transition: 'all 120ms ease',
                  }}
                >
                  {FONT_SIZE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Layout */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 14px',
              gap: 16,
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 12,
                color: 'var(--text-primary)',
                userSelect: 'none',
              }}
            >
              Layout
            </span>
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-secondary)',
                borderRadius: 6,
                padding: 2,
              }}
            >
              {(['scroll', 'spread'] as LayoutMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => onLayoutModeChange(m)}
                  aria-pressed={layoutMode === m}
                  style={{
                    border: 'none',
                    background: layoutMode === m ? 'var(--accent-warm)' : 'transparent',
                    color: layoutMode === m ? '#fff' : 'var(--text-secondary)',
                    fontFamily: 'var(--font-ui)',
                    fontSize: 11,
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: 5,
                    fontWeight: layoutMode === m ? 600 : 400,
                    transition: 'all 120ms ease',
                  }}
                >
                  {m === 'scroll' ? 'Scroll' : '2 Page'}
                </button>
              ))}
            </div>
          </div>

          {/* Reading section */}
          <div
            style={{
              padding: '8px 14px 6px',
              borderBottom: '1px solid var(--border)',
              fontFamily: 'var(--font-ui)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
            }}
          >
            Reading
          </div>
          <Toggle label="Sentence highlight" checked={highlightEnabled} onChange={onHighlightChange} />
          <Toggle label="Auto-scroll to sentence" checked={autoscrollEnabled} onChange={onAutoscrollChange} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
