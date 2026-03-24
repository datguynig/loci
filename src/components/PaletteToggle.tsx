import type { ColorScheme } from '../hooks/usePreferences'

interface PaletteToggleProps {
  colorScheme: ColorScheme
  onToggle: () => void
}

// Swatch colours are hardcoded intentionally — they represent the other theme,
// not the current one, so they must not respond to CSS variable changes.
const SWATCHES: Record<ColorScheme, { accent: string; warm: string; label: string }> = {
  library: { accent: '#1D6B48', warm: '#B8952A', label: 'Library' },
  slate:   { accent: '#B5622A', warm: '#C8751E', label: 'Slate'   },
}

export default function PaletteToggle({ colorScheme, onToggle }: PaletteToggleProps) {
  const current = SWATCHES[colorScheme]
  const next    = colorScheme === 'library' ? SWATCHES.slate : SWATCHES.library

  return (
    <button
      onClick={onToggle}
      aria-label={`Switch to ${next.label} theme`}
      title={`Switch to ${next.label} theme`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 8px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'transparent',
        cursor: 'pointer',
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-secondary)'
        e.currentTarget.style.borderColor = 'var(--text-tertiary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      {/* Active scheme indicator — two small swatches */}
      <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: current.accent,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: current.warm,
            flexShrink: 0,
          }}
        />
      </span>
      <span style={{
        fontFamily: 'var(--font-ui)',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        letterSpacing: '0.02em',
        userSelect: 'none',
      }}>
        {current.label}
      </span>
    </button>
  )
}
