import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'

interface LandingProps {
  onFileSelected: (file: File) => void
}

export default function Landing({ onFileSelected }: LandingProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateAndSelect = useCallback(
    (file: File) => {
      const isEpub =
        file.name.toLowerCase().endsWith('.epub') ||
        file.type === 'application/epub+zip'

      if (!isEpub) {
        setError("This file doesn't appear to be a valid EPUB")
        setTimeout(() => setError(null), 4000)
        return
      }
      onFileSelected(file)
    },
    [onFileSelected]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) validateAndSelect(file)
    },
    [validateAndSelect]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) validateAndSelect(file)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Wordmark */}
      <header
        style={{
          padding: '28px 32px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 500,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          Loci
        </span>
      </header>

      {/* Drop zone */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 16,
          padding: '0 24px 80px',
        }}
      >
        <motion.div
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.12 }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Drop EPUB file here or click to browse"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
          }}
          style={{
            width: 'min(400px, 100%)',
            height: 280,
            border: `2px dashed ${isDragging ? 'var(--accent-warm)' : 'var(--border)'}`,
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            cursor: 'pointer',
            background: isDragging ? 'rgba(196,168,130,0.06)' : 'transparent',
            transition: 'border-color 150ms ease, background 150ms ease',
          }}
        >
          {/* Book icon */}
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-tertiary)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>

          <div style={{ textAlign: 'center' }}>
            <p
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 14,
                color: 'var(--text-secondary)',
                margin: 0,
              }}
            >
              Drop your EPUB to begin reading
            </p>
            <p
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 12,
                color: 'var(--text-tertiary)',
                marginTop: 4,
                margin: '4px 0 0',
              }}
            >
              or click to browse
            </p>
          </div>
        </motion.div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".epub,application/epub+zip"
          style={{ display: 'none' }}
          onChange={handleFileInput}
          aria-hidden="true"
        />

        {/* Inline error */}
        {error && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 13,
              color: 'var(--accent-warm)',
              margin: 0,
            }}
          >
            {error}
          </motion.p>
        )}

        <p
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 11,
            color: 'var(--text-tertiary)',
            marginTop: 8,
            textAlign: 'center',
          }}
        >
          Your file stays on your device. Nothing is uploaded.
        </p>
      </main>
    </motion.div>
  )
}
