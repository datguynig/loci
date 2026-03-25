// src/components/TrialBanner.tsx
interface TrialBannerProps {
  trialEndsAt: Date | null
  onUpgrade: () => void
}

export default function TrialBanner({ trialEndsAt, onUpgrade }: TrialBannerProps) {
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
        fontFamily: '"DM Sans", system-ui, sans-serif',
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
          background: '#7c3aed',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '4px 12px',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: '"DM Sans", system-ui, sans-serif',
        }}
      >
        Upgrade
      </button>
    </div>
  )
}
