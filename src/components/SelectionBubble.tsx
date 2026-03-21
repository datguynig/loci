import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface SelectionBubbleProps {
  quote: string
  position: { x: number; y: number }  // relative to epub viewer div
  onSave: (note: string) => void
  onDismiss: () => void
}

export default function SelectionBubble({ quote, position, onSave, onDismiss }: SelectionBubbleProps) {
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea when expanded
  useEffect(() => {
    if (expanded) {
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [expanded])

  // Escape key to dismiss
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onDismiss])

  const handleSave = () => {
    onSave(note)
    setNote('')
    setExpanded(false)
  }

  // Clamp so the bubble doesn't go above the viewport (overlay is position:fixed)
  const clampedY = Math.max(72, position.y)

  return (
    <div
      style={{
        position: 'absolute',
        left: position.x,
        top: clampedY,
        transform: 'translate(-50%, calc(-100% - 8px))',
        pointerEvents: 'all',
      }}
    >
      <AnimatePresence mode="wait">
        {!expanded ? (
          <motion.button
            key="pill"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.12 }}
            onClick={() => setExpanded(true)}
            aria-label="Add note for selected text"
            style={{
              background: 'var(--accent-warm)',
              color: '#fff',
              border: 'none',
              borderRadius: 99,
              padding: '5px 12px',
              fontFamily: 'var(--font-ui)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              whiteSpace: 'nowrap',
            }}
          >
            + Note
          </motion.button>
        ) : (
          <motion.div
            key="editor"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            style={{
              width: 220,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
              overflow: 'hidden',
            }}
          >
            {/* Quote preview */}
            <div
              style={{
                padding: '8px 12px 6px',
                borderBottom: '1px solid var(--border)',
                fontFamily: 'var(--font-reading)',
                fontStyle: 'italic',
                fontSize: 11,
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.5,
              }}
            >
              "{quote}"
            </div>

            {/* Note textarea */}
            <textarea
              ref={textareaRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note…"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
                e.stopPropagation()
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 12px',
                border: 'none',
                outline: 'none',
                resize: 'none',
                background: 'transparent',
                fontFamily: 'var(--font-ui)',
                fontSize: 12,
                color: 'var(--text-primary)',
                lineHeight: 1.5,
              }}
            />

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 6,
                padding: '6px 10px 8px',
                borderTop: '1px solid var(--border)',
              }}
            >
              <button
                onClick={onDismiss}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-tertiary)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: '3px 8px',
                  borderRadius: 6,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{
                  border: 'none',
                  background: 'var(--accent-warm)',
                  color: '#fff',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '3px 10px',
                  borderRadius: 6,
                }}
              >
                Save
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
