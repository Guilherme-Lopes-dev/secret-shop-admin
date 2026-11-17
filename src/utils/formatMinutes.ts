/** 0 → "—", 42 → "42 min", 95 → "1h 35min". */
export const formatMinutes = (minutes?: number | null): string => {
  if (!minutes) return '—'

  const rounded = Math.round(minutes)
  if (rounded < 60) return `${rounded} min`

  const hours = Math.floor(rounded / 60)
  const rest = rounded % 60
  if (!rest) return `${hours}h`

  return `${hours}h ${rest}min`
}
