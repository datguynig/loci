// src/components/TrialBanner.tsx
interface TrialBannerProps {
  trialEndsAt: Date | null
  onUpgrade: () => void
  status?: string
  onManageBilling?: () => void
}

export default function TrialBanner({ trialEndsAt, onUpgrade, status, onManageBilling }: TrialBannerProps) {
  if (status === 'past_due') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: '8px 16px',
          background: 'rgba(220,38,38,0.08)',
          borderBottom: '1px solid rgba(220,38,38,0.18)',
          fontFamily: 'var(--font-ui)',
          fontSize: 13,
          color: 'var(--text-secondary)',
        }}
      >
        <span>Your payment failed — update your payment method to keep access.</span>
        <button
          onClick={onManageBilling}
          style={{
            background: 'var(--accent)',
            color: 'var(--bg-primary)',
            border: 'none',
            borderRadius: 6,
            padding: '4px 12px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'var(--font-ui)',
          }}
        >
          Manage billing
        </button>
      </div>
    )
  }

  if (!trialEndsAt) return null
  const daysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
  if (daysLeft === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '8px 16px',
        background: 'rgba(124,58,237,0.08)',
        borderBottom: '1px solid rgba(124,58,237,0.15)',
        fontFamily: 'var(--font-ui)',
        fontSize: 13,
        color: 'var(--text-secondary)',
      }}
    >
      <span>
        {daysLeft === 1
          ? 'Last day of your Scholar trial'
          : `${daysLeft} days left in your Scholar trial`}
      </span>
      <button
        onClick={onUpgrade}
        style={{
          background: 'var(--accent)',
          color: 'var(--bg-primary)',
          border: 'none',
          borderRadius: 6,
          padding: '4px 12px',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'var(--font-ui)',
        }}
      >
        Upgrade
      </button>
    </div>
  )
}
