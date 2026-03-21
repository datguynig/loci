import { motion, AnimatePresence } from 'framer-motion'

interface ScratchpadProps {
  isOpen: boolean
  onClose: () => void
  content: string
  onChange: (s: string) => void
  saving: boolean
}

export default function Scratchpad({
  isOpen,
  onClose,
  content,
  onChange,
  saving,
}: ScratchpadProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 320 }}
          animate={{ x: 0 }}
          exit={{ x: 320 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: 320,
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Scratchpad
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {saving && (
                <span
                  style={{
                    fontFamily: '"DM Sans", system-ui, sans-serif',
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  Saving…
                </span>
              )}
              <button
                onClick={onClose}
                aria-label="Close scratchpad"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  fontSize: 18,
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Textarea */}
          <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Write anything — ideas, summaries, exam notes…"
            style={{
              flex: 1,
              width: '100%',
              boxSizing: 'border-box',
              border: 'none',
              outline: 'none',
              resize: 'none',
              padding: '16px',
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: 14,
              lineHeight: 1.7,
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
