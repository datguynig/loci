interface ProgressBarProps {
  progress: number // 0–100
}

export default function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <div
      style={{
        position: 'relative',
        height: 2,
        background: 'var(--bg-secondary)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '0 auto 0 0',
          width: `${Math.min(100, Math.max(0, progress))}%`,
          background: 'var(--accent-warm)',
          transition: 'width 300ms ease-out',
        }}
      />
    </div>
  )
}
