import { useState, useRef } from 'react'
import { motion } from 'framer-motion'

interface OnboardingWelcomeProps {
  onUpload: (files: FileList) => void
  onSkip: () => void
}

const BrainIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
  </svg>
)

const PenIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
  </svg>
)

const LockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

const features = [
  {
    Icon: BrainIcon,
    title: 'AI Study Assistant',
    body: 'Ask questions, run quizzes, generate flashcards — from the exact chapter you\'re reading.',
  },
  {
    Icon: PenIcon,
    title: 'Highlights & Notes',
    body: 'Annotate passages, add notes, and export everything as Markdown.',
  },
  {
    Icon: LockIcon,
    title: 'Private by Design',
    body: 'Your books stay on your device. Nothing is uploaded without your action.',
  },
]

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

export default function OnboardingWelcome({ onUpload, onSkip }: OnboardingWelcomeProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files?.length) {
      onUpload(e.dataTransfer.files)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      onUpload(e.target.files)
    }
  }

  const handleDropZoneClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        padding: 48,
        minHeight: 'calc(100vh - 60px)',
      }}
    >
      {/* Heading */}
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 32,
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '0 0 8px',
            letterSpacing: '-0.5px',
          }}
        >
          Welcome to Loci.
        </h1>
        <p
          style={{
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontSize: 16,
            color: 'var(--text-secondary)',
            margin: 0,
          }}
        >
          Read more. Remember more.
        </p>
      </div>

      {/* Feature cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          maxWidth: 640,
          width: '100%',
        }}
      >
        {features.map(({ Icon, title, body }) => (
          <motion.div
            key={title}
            variants={cardVariants}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 20,
              cursor: 'default',
            }}
          >
            <div style={{ color: 'var(--accent-warm)' }}>
              <Icon />
            </div>
            <div
              style={{
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginTop: 12,
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontFamily: '"DM Sans", system-ui, sans-serif',
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                marginTop: 4,
              }}
            >
              {body}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Drop zone */}
      <div style={{ maxWidth: 480, width: '100%' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".epub"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <div
          onClick={handleDropZoneClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? 'var(--accent-warm)' : 'var(--border)'}`,
            borderRadius: 12,
            padding: '32px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragging ? 'rgba(196,168,130,0.06)' : 'transparent',
            transition: 'border-color 180ms ease, background 180ms ease',
          }}
        >
          <p
            style={{
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: 14,
              color: 'var(--text-secondary)',
              margin: '0 0 4px',
            }}
          >
            Drop your first book here
          </p>
          <p
            style={{
              fontFamily: '"DM Sans", system-ui, sans-serif',
              fontSize: 12,
              color: 'var(--text-tertiary)',
              margin: 0,
              textDecoration: 'underline',
            }}
          >
            or click to browse
          </p>
        </div>
      </div>

      {/* Skip */}
      <button
        type="button"
        onClick={onSkip}
        style={{
          fontFamily: '"DM Sans", system-ui, sans-serif',
          fontSize: 12,
          color: 'var(--text-tertiary)',
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          padding: 0,
          textDecoration: 'none',
        }}
      >
        Skip intro
      </button>
    </div>
  )
}
