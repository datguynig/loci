export function calculateProgressPercent(
  currentPage: number,
  totalPages: number,
  cfiPercentage?: number | null,
): number {
  if (typeof cfiPercentage === 'number' && Number.isFinite(cfiPercentage)) {
    return clampPercent(Math.round(cfiPercentage * 100))
  }

  if (totalPages <= 0) return 0
  return clampPercent(Math.round((currentPage / totalPages) * 100))
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value))
}
