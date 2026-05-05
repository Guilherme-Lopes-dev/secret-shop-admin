export function formatCurrency(valueInCents: number | null | undefined): string {
  if (valueInCents == null) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valueInCents / 100)
}
