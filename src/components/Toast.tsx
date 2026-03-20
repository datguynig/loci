import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export interface ToastMessage {
  id: string
  text: string
}

interface ToastProps {
  messages: ToastMessage[]
  onDismiss: (id: string) => void
}

function ToastItem({ message, onDismiss }: { message: ToastMessage; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20, y: 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        borderRadius: 10,
        background: 'var(--accent-warm)',
        color: '#fff',
        fontSize: 13,
        fontFamily: 'var(--font-ui)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
        maxWidth: 340,
        lineHeight: 1.4,
      }}
    >
      <span style={{ flex: 1 }}>{message.text}</span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.75)',
          cursor: 'pointer',
          padding: 0,
          fontSize: 16,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </motion.div>
  )
}

export default function Toast({ messages, onDismiss }: ToastProps) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        right: 16,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence>
        {messages.map((msg) => (
          <div key={msg.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem message={msg} onDismiss={() => onDismiss(msg.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
