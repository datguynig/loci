// formatDuration(seconds: number): string
// Examples:
//   0       → ""         (no time, don't show)
//   45      → "< 1m"
//   60      → "1m"
//   3600    → "1h"
//   3723    → "1h 2m"
//   7200    → "2h"
// Rules:
//   - If seconds <= 0: return "" (empty string — caller should check before displaying)
//   - If seconds < 60: return "< 1m"
//   - If seconds < 3600: return "{m}m" (whole minutes)
//   - If minutes === 0: return "{h}h" (whole hours, no minutes shown if 0)
//   - Otherwise: return "{h}h {m}m"
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return ''
  if (seconds < 60) return '< 1m'

  const totalMinutes = Math.floor(seconds / 60)
  if (totalMinutes < 60) return `${totalMinutes}m`

  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
