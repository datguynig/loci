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

  const readerPrice  = billingInterval === 'monthly' ? '$7.99' : '$6.58'
  const scholarPrice = billingInterval === 'monthly' ? '$13.99' : '$11.58'

  async function handleCTA(tier: 'reader' | 'scholar') {
    setLoading(tier)
    try {
      await onCheckout(tier, billingInterval)
    } finally {
      setLoading(null)
    }
  }

  const featureList = (items: string[], accentColor: string) => (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9, fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
      {items.map((item) => (
        <li key={item} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          <span style={{ color: accentColor, fontWeight: 700, lineHeight: '18px', flexShrink: 0 }}>✓</span>
          <span>{item}</span>
        </li>
      ))}
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
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal={true}
            aria-labelledby="upgrade-modal-title"
            style={{ background: 'var(--bg-primary)', borderRadius: 20, padding: '24px 24px 20px', width: '100%', maxWidth: 580, boxShadow: '0 24px 80px rgba(0,0,0,0.22)' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div id="upgrade-modal-title" style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Upgrade Loci
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--font-ui)', marginTop: 3 }}>
                  Choose the plan that fits how you read.
                </div>
              </div>
              <button aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, lineHeight: 1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Billing toggle */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 20, fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 99, padding: '5px 14px 5px 10px' }}>
              <button
                role="switch"
                aria-checked={billingInterval === 'annual'}
                aria-label="Annual billing"
                onClick={() => setBillingInterval(i => i === 'monthly' ? 'annual' : 'monthly')}
                style={{ width: 38, height: 21, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative', background: billingInterval === 'annual' ? 'var(--accent)' : 'var(--border)', transition: 'background 200ms', flexShrink: 0, padding: 0 }}
              >
                <span style={{ position: 'absolute', top: 2, left: billingInterval === 'annual' ? 18 : 2, width: 17, height: 17, borderRadius: 9, background: 'var(--bg-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.18)', transition: 'left 200ms', display: 'block' }} />
              </button>
              <span style={{ fontWeight: 500, color: billingInterval === 'annual' ? 'var(--text-primary)' : 'var(--text-tertiary)', transition: 'color 150ms' }}>
                {billingInterval === 'annual'
                  ? <><span style={{ color: 'var(--accent)', fontWeight: 700 }}>Annual</span> — 2 months free</>
                  : 'Switch to annual · save 2 months'}
              </span>
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', gap: 12 }}>
              {/* Reader */}
              <div style={{ flex: 1, borderRadius: 16, padding: '20px 18px 18px', display: 'flex', flexDirection: 'column', gap: 12, border: defaultTier === 'reader' ? '1.5px solid var(--accent)' : '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)' }}>Loci Reader</div>
                <div>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{readerPrice}</span>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 2 }}>/mo</span>
                </div>
                {featureList(['Unlimited books', 'Loci Narration — lifelike voices', 'Word-by-word highlighting', 'Multiple voice choices', 'Scratchpad'], 'var(--accent)')}
                <button
                  style={{ width: '100%', padding: '11px 0', borderRadius: 9, border: 'none', fontSize: 14, fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontFamily: 'var(--font-ui)', marginTop: 'auto', background: 'var(--accent)', color: 'var(--bg-primary)', opacity: loading ? 0.6 : 1, transition: 'opacity 150ms' }}
                  disabled={loading !== null}
                  onClick={() => handleCTA('reader')}
                >
                  {loading === 'reader' ? 'Loading…' : 'Get Reader'}
                </button>
              </div>

              {/* Scholar */}
              <div style={{ flex: 1, borderRadius: 16, padding: '20px 18px 18px', display: 'flex', flexDirection: 'column', gap: 12, border: '1.5px solid var(--accent-warm)', background: 'var(--bg-secondary)', position: 'relative', boxShadow: '0 4px 20px var(--shadow)' }}>
                <div style={{ position: 'absolute', top: -1, right: 14, background: 'var(--accent-warm)', color: 'var(--bg-primary)', fontSize: 9, fontWeight: 800, padding: '3px 9px', borderRadius: '0 0 7px 7px', letterSpacing: '0.08em', fontFamily: 'var(--font-ui)' }}>MOST POPULAR</div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-warm)' }}>Loci Scholar</div>
                <div>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>{scholarPrice}</span>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 2 }}>/mo</span>
                </div>
                {featureList(['Everything in Reader', 'Loci Narration Pro — audiobook-quality voices', 'Practice Quizzes', 'Chapter Briefs', 'Study Guide', 'Flashcards'], 'var(--accent-warm)')}
                <button
                  style={{ width: '100%', padding: '11px 0', borderRadius: 9, border: 'none', fontSize: 14, fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontFamily: 'var(--font-ui)', marginTop: 'auto', background: 'var(--accent-warm)', color: 'var(--bg-primary)', opacity: loading ? 0.6 : 1, transition: 'opacity 150ms' }}
                  disabled={loading !== null}
                  onClick={() => handleCTA('scholar')}
                >
                  {loading === 'scholar' ? 'Loading…' : 'Get Scholar'}
                </button>
              </div>
            </div>

            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-tertiary)', margin: '14px 0 0', textAlign: 'center' }}>No credit card required · cancel anytime</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
