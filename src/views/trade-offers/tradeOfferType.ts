import type { TradeOfferType } from '@/services/admin/admin.service'

/** O tipo vem classificado da API — aqui só mora rótulo, cor e as opções do filtro. */
const labels: Record<TradeOfferType, { label: string; className: string }> = {
  purchase: { label: 'Compra', className: 'type-purchase' },
  gift: { label: 'Brinde', className: 'type-gift' },
  swap: { label: 'Swap', className: 'type-swap' },
}

const unknownType = { label: '—', className: '' }

export const typeBadge = (type: TradeOfferType | null | undefined) =>
  (type && labels[type]) || unknownType

export const typeOptions = [
  { label: 'Todos os tipos', value: '' },
  { label: 'Compra', value: 'purchase' },
  { label: 'Brinde', value: 'gift' },
  { label: 'Swap', value: 'swap' },
]
