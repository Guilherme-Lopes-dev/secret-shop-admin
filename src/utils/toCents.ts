// Grupos de milhar com ponto: "1.000", "12.500", "1.234.567" — dinheiro não tem 3 casas decimais.
const THOUSANDS_WITH_DOTS = /^[1-9]\d{0,2}(\.\d{3})+$/

// pt-BR primeiro: com vírgula, ponto é milhar e vírgula é decimal ("1.234,56").
// Sem vírgula: ponto em grupos de 3 é milhar ("1.000"); senão é decimal ("12.5").
// Antes só a 1ª vírgula virava ponto: "1.234,56" → 1.234 → R$ 1,23 (buy order com preço errado).
const normalizeDecimal = (text: string) => {
  if (text.includes(',')) return text.replace(/\./g, '').replace(',', '.')
  if (THOUSANDS_WITH_DOTS.test(text)) return text.replace(/\./g, '')
  return text
}

// Reais digitado → centavos. Vazio ou inválido → undefined: nunca adivinha um valor.
export function toCents(v: string | number): number | undefined {
  const n = typeof v === 'number' ? v : Number(normalizeDecimal(String(v).trim()) || NaN)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined
}
