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

export default function FlashCard({ front, back, isReview, onPrev, onNext, onMarkKnown }: FlashCardProps) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div>
      {/* Card */}
      <div
        role="button"
        tabIndex={0}
        aria-label={flipped ? 'Card back — click to see question' : 'Card front — click to reveal answer'}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setFlipped((f) => !f)}
        style={{ perspective: '1200px', cursor: 'pointer', outline: 'none' }}
      >
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformStyle: 'preserve-3d', position: 'relative', minHeight: 148 }}
        >
          {/* Front face */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '18px 20px 14px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 2px 10px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <div
              style={{
                fontFamily: '"Lora", Georgia, serif',
                fontSize: 14,
                color: 'var(--text-primary)',
                lineHeight: 1.68,
                flex: 1,
              }}
            >
              {front}
            </div>
            <div
              style={{
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 10,
                color: 'rgba(196,168,130,0.85)',
                marginTop: 12,
                letterSpacing: '0.02em',
              }}
            >
              tap to reveal
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
              borderRadius: 12,
              padding: '18px 20px 14px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 2px 10px rgba(0,0,0,0.14), 0 1px 3px rgba(0,0,0,0.10)',
            }}
          >
            {/* Warm accent rule */}
            <div
              style={{
                width: 22,
                height: 2,
                background: 'rgba(196,168,130,0.55)',
                borderRadius: 1,
                marginBottom: 14,
                flexShrink: 0,
              }}
            />
            <div
              style={{
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 13,
                color: '#F0EDE8',
                lineHeight: 1.65,
                flex: 1,
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
            gap: 6,
            marginTop: 10,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <button
            onClick={onPrev}
            aria-label="Previous card"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 120ms ease, color 120ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={onMarkKnown}
            style={{
              height: 30,
              padding: '0 14px',
              borderRadius: 8,
              border: '1px solid var(--accent-warm)',
              background: 'var(--accent-warm)',
              color: '#fff',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.01em',
              transition: 'opacity 120ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            Got it
          </button>
          <button
            onClick={onNext}
            aria-label="Next card"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 120ms ease, color 120ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
