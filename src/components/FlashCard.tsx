import { useState } from 'react'
import { motion } from 'framer-motion'

interface FlashCardProps {
  front: string
  back: string
  isReview?: boolean
  onPrev?: () => void
  onNext?: () => void
  onMarkKnown?: () => void
}

export default function FlashCard({
  front,
  back,
  isReview,
  onPrev,
  onNext,
  onMarkKnown,
}: FlashCardProps) {
  const [flipped, setFlipped] = useState(false)

  const buttonBase: React.CSSProperties = {
    fontFamily: '"DM Sans", system-ui, sans-serif',
    fontSize: 12,
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '6px 12px',
    background: 'var(--bg-surface)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  }

  return (
    <div>
      {/* Card container */}
      <div
        onClick={() => setFlipped((f) => !f)}
        style={{ width: '100%', cursor: 'pointer', perspective: '1000px' }}
      >
        {/* Inner — animates rotateY */}
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          style={{ transformStyle: 'preserve-3d', position: 'relative', minHeight: 100 }}
        >
          {/* Front face */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              background: 'linear-gradient(135deg, var(--bg-primary), var(--bg-secondary))',
              borderRadius: 10,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 9,
                color: 'var(--text-tertiary)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              FRONT
            </div>
            <div
              style={{
                fontFamily: '"Lora", Georgia, serif',
                fontSize: 14,
                fontStyle: 'italic',
                color: 'var(--text-primary)',
                lineHeight: 1.6,
              }}
            >
              {front}
            </div>
            <div
              style={{
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 10,
                color: 'var(--accent-warm)',
                marginTop: 'auto',
              }}
            >
              Tap to flip
            </div>
          </div>

          {/* Back face */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: '#1A1917',
              borderRadius: 10,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 9,
                color: 'var(--accent-warm)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              BACK
            </div>
            <div
              style={{
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 13,
                color: '#F0EDE8',
                lineHeight: 1.55,
              }}
            >
              {back}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Review controls */}
      {isReview && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 8,
            justifyContent: 'center',
          }}
        >
          <button style={buttonBase} onClick={onPrev}>
            ← Prev
          </button>
          <button
            style={{
              ...buttonBase,
              background: 'var(--accent-warm)',
              color: '#fff',
              border: '1px solid var(--accent-warm)',
            }}
            onClick={onMarkKnown}
          >
            Mark as known ✓
          </button>
          <button style={buttonBase} onClick={onNext}>
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
