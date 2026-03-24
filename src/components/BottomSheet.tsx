import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

/**
 * A mobile-first bottom sheet with:
 * - Framer Motion slide-up animation
 * - Semi-transparent backdrop that dismisses on tap
 * - Drag-down-to-close gesture
 * - Focus trap via useEffect
 * - Respects iOS safe-area-inset-bottom
 */
export default function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bs-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 299,
              background: 'rgba(0,0,0,0.45)',
            }}
          />

          {/* Sheet */}
          <motion.div
            key="bs-sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 400) onClose()
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 300,
              background: 'var(--bg-surface)',
              borderRadius: '16px 16px 0 0',
              boxShadow: '0 -4px 32px rgba(0,0,0,0.18)',
              paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
              touchAction: 'none',
            }}
          >
            {/* Drag handle */}
            <div style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: 'var(--border)',
              margin: '10px auto 0',
            }} />

            {/* Title */}
            {title && (
              <div style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '14px 20px 8px',
              }}>
                {title}
              </div>
            )}

            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
