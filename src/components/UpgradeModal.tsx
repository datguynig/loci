// src/components/UpgradeModal.tsx
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export type BillingInterval = 'monthly' | 'annual'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  onCheckout: (tier: 'reader' | 'scholar', interval: BillingInterval) => void
  defaultTier?: 'reader' | 'scholar'
}

export default function UpgradeModal({ isOpen, onClose, onCheckout, defaultTier = 'scholar' }: UpgradeModalProps) {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly')
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const readerPrice  = billingInterval === 'monthly' ? '$7.99/mo' : '$79/yr'
  const scholarPrice = billingInterval === 'monthly' ? '$13.99/mo' : '$139/yr'

  async function handleCTA(tier: 'reader' | 'scholar') {
    setLoading(tier)
    try {
      await onCheckout(tier, billingInterval)
    } finally {
      setLoading(null)
    }
  }

  const card: React.CSSProperties = {
    flex: 1,
    borderRadius: 14,
    padding: '20px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  }

  const btn: React.CSSProperties = {
    width: '100%',
    padding: '11px 0',
    borderRadius: 9,
    border: 'none',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: '"DM Sans", system-ui, sans-serif',
    marginTop: 'auto',
  }

  const featureList = (items: string[]) => (
    <ul style={{ margin: 0, padding: '0 0 0 14px', fontSize: 13, lineHeight: 1.9, opacity: 0.8, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal={true}
            aria-labelledby="upgrade-modal-title"
            style={{ background: 'var(--bg-primary)', borderRadius: 18, padding: 24, width: '100%', maxWidth: 600, boxShadow: '0 24px 80px rgba(0,0,0,0.25)' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div id="upgrade-modal-title" style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Upgrade Loci
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: '"DM Sans", system-ui, sans-serif', marginTop: 4 }}>
                  Choose the plan that fits how you read.
                </div>
              </div>
              <button aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Billing toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 13 }}>
              <span style={{ opacity: billingInterval === 'monthly' ? 1 : 0.5, fontWeight: billingInterval === 'monthly' ? 600 : 400 }}>Monthly</span>
              <button
                role="switch"
                aria-checked={billingInterval === 'annual'}
                aria-label="Annual billing"
                onClick={() => setBillingInterval(i => i === 'monthly' ? 'annual' : 'monthly')}
                style={{
                  width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative',
                  background: billingInterval === 'annual' ? 'var(--accent)' : 'var(--border)',
                  transition: 'background 200ms',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: billingInterval === 'annual' ? 21 : 3,
                  width: 18, height: 18, borderRadius: 9, background: '#fff',
                  transition: 'left 200ms', display: 'block',
                }} />
              </button>
              <span style={{ opacity: billingInterval === 'annual' ? 1 : 0.5, fontWeight: billingInterval === 'annual' ? 600 : 400 }}>
                Annual <span style={{ background: 'var(--accent)', color: '#fff', fontSize: 11, borderRadius: 99, padding: '1px 7px', marginLeft: 4 }}>Save 2 months</span>
              </span>
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', gap: 14 }}>
              {/* Reader */}
              <div style={{ ...card, border: defaultTier === 'reader' ? '2px solid #2563eb' : '1px solid var(--border)', background: defaultTier === 'reader' ? 'rgba(37,99,235,0.03)' : 'var(--bg-secondary)' }}>
                <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2563eb' }}>Loci Reader</div>
                <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 26, fontWeight: 800, color: '#2563eb' }}>{readerPrice}</div>
                {featureList(['Unlimited books', 'Loci Narration — lifelike voices', 'Word-by-word highlighting', 'Multiple voice choices', 'Scratchpad'])}
                <button
                  style={{ ...btn, background: '#2563eb', color: '#fff', opacity: loading ? 0.7 : 1 }}
                  disabled={loading !== null}
                  onClick={() => handleCTA('reader')}
                >
                  {loading === 'reader' ? 'Loading…' : 'Get Reader'}
                </button>
              </div>

              {/* Scholar */}
              <div style={{ ...card, border: '2px solid #7c3aed', background: 'rgba(124,58,237,0.03)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: -1, right: 16, background: '#7c3aed', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: '0 0 8px 8px', letterSpacing: '0.04em', fontFamily: '"DM Sans", system-ui, sans-serif' }}>MOST POPULAR</div>
                <div style={{ fontFamily: '"DM Sans", system-ui, sans-serif', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7c3aed' }}>Loci Scholar</div>
                <div style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 26, fontWeight: 800, color: '#7c3aed' }}>{scholarPrice}</div>
                {featureList(['Everything in Reader', 'Narration Pro — audiobook-quality voices', 'Practice Quizzes', 'Chapter Briefs', 'Study Guide', 'Flashcards'])}
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: '"DM Sans", system-ui, sans-serif', opacity: 0.7 }}>
                  Students: use code <strong>STUDENT</strong> at checkout for $9.99/mo
                </div>
                <button
                  style={{ ...btn, background: '#7c3aed', color: '#fff', opacity: loading ? 0.7 : 1 }}
                  disabled={loading !== null}
                  onClick={() => handleCTA('scholar')}
                >
                  {loading === 'scholar' ? 'Loading…' : 'Get Scholar'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
