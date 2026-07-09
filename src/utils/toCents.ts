// Reais digitado → centavos.
export function toCents(v: string | number): number | undefined {
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined
}
