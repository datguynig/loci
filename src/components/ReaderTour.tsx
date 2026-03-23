import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface TourStep {
  position: React.CSSProperties
  title: string
  body: string
}

const STEPS: TourStep[] = [
  {
    position: { top: 64, left: 16 },
    title: 'Navigate chapters',
    body: 'Open the table of contents to jump between chapters.',
  },
  {
    position: { bottom: 120, right: 16 },
    title: 'Reading settings',
    body: 'Adjust font size, layout, and switch to dark mode.',
  },
  {
    position: { top: '40%', right: 16 },
    title: 'AI study tools',
    body: "Summarise chapters, run quizzes, and generate flashcards. The AI knows exactly what you're reading.",
  },
  {
    position: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
    title: 'Highlight anything',
    body: 'Select any text to annotate, highlight, or bookmark.',
  },
]

export default function ReaderTour({ onDismiss }: { onDismiss: () => void }) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]

  const handleNext = () => {
    if (step === STEPS.length - 1) {
      onDismiss()
    } else {
      setStep(step + 1)
    }
  }

  return (
    <>
      {/* Full-screen overlay — barely visible, doesn't block interaction */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.12)',
          zIndex: 200,
          pointerEvents: 'none',
        }}
      />

      {/* Tooltip card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            ...current.position,
            zIndex: 201,
            pointerEvents: 'auto',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '16px 20px',
            maxWidth: 260,
            boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
          }}
        >
          {/* Step indicator */}
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 11,
              color: 'var(--text-tertiary)',
              marginBottom: 8,
            }}
          >
            {step + 1} of {STEPS.length}
          </div>

          {/* Title */}
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 6,
            }}
          >
            {current.title}
          </div>

          {/* Body */}
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 12,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              marginBottom: 16,
            }}
          >
            {current.body}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={onDismiss}
              style={{
                background: 'none',
                border: 'none',
                fontFamily: 'var(--font-ui)',
                fontSize: 12,
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Skip tour
            </button>
            <button
              onClick={handleNext}
              style={{
                background: 'var(--text-primary)',
                color: 'var(--bg-primary)',
                border: 'none',
                borderRadius: 6,
                fontFamily: 'var(--font-ui)',
                fontSize: 12,
                fontWeight: 600,
                padding: '6px 14px',
                cursor: 'pointer',
              }}
            >
              {step === STEPS.length - 1 ? 'Got it' : 'Next →'}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  )
}
