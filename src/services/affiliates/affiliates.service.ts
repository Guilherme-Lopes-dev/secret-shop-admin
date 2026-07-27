import { api } from '@/lib/api/api'
import { formatCurrency } from '@/utils/formatCurrency'

export interface AffiliateBalances {
  pending: number
  approved: number
  paid: number
  reversed: number
}

// O backend serializa `uuid` como `id` (SerializeResponseInterceptor) — nunca tipar como uuid.
export interface AffiliateLinkRow {
  id: string
  code: string
  label: string | null
  couponCode: string | null
  clicks: number
  conversions: number
  isActive: boolean
  createdAt: string
}

export interface AffiliateRow {
  id: string
  displayName: string
  document: string
  pixKey: string | null
  rateNewBps: number | null
  rateReturningBps: number | null
  monthlyCap: number | null
  status: 'ACTIVE' | 'SUSPENDED'
  createdAt: string
  userUuid: string
  username: string | null
  avatar: string | null
  steam_id: string | null
  balances: AffiliateBalances
}

export interface AffiliatePayoutRow {
  id: string
  cycle: string
  amount: number
  status: 'OPEN' | 'REQUESTED' | 'PAID' | 'CANCELED'
  requested_at: string | null
  paid_at: string | null
  affiliate?: { id: string; display_name: string; pix_key: string | null; document: string }
}

export interface AffiliateDetail extends Omit<AffiliateRow, 'balances'> {
  links: AffiliateLinkRow[]
  balances: AffiliateBalances
  payouts: AffiliatePayoutRow[]
}

export interface CommissionRow {
  id: string
  orderNumber: string | null
  linkCode: string
  baseAmount: number
  rateBps: number
  amount: number
  customerKind: 'NEW' | 'RETURNING'
  status: 'PENDING' | 'APPROVED' | 'SUSPECT' | 'REVERSED' | 'PAID'
  reason: string | null
  holdUntil: string | null
  createdAt: string
  affiliateName?: string
  affiliateUuid?: string
}

export interface AffiliateConfig {
  rateNewBps: number
  rateReturningBps: number
  windowDays: number
  minPayout: number
  holdPixDays: number
  holdCardDays: number
  clickRetentionDays: number
  staleDays: number
}

const BASE = '/admin/affiliates'

/** Backend cap de `listCommissionsForAdmin`. Bater nele = tem coisa fora da tela. */
export const COMMISSIONS_LIMIT = 200

/** Campo em branco vira `null` para o backend limpar a coluna (herdar o global). */
export const optionalInt = (value: string | number): number | null => {
  if (value === '' || value === null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed) : null
}

/** Venda de referência das simulações: R$ 100,00. */
const SAMPLE_SALE_CENTS = 10_000

/** 800 → "8,00% · R$ 8,00 numa venda de R$ 100,00". */
export const describeRate = (value: string | number, emptyHint = 'Vazio herda a taxa global.') => {
  const bps = optionalInt(value)
  if (bps === null) return emptyHint
  if (bps < 0) return 'Valor inválido.'

  const commission = Math.round((bps * SAMPLE_SALE_CENTS) / 10_000)

  return `${(bps / 100).toFixed(2)}% · ${formatCurrency(commission)} numa venda de ${formatCurrency(SAMPLE_SALE_CENTS)}`
}

/** 500000 → "R$ 5.000,00". */
export const describeCents = (value: string | number, emptyHint: string) => {
  const cents = optionalInt(value)
  if (cents === null) return emptyHint
  if (cents < 0) return 'Valor inválido.'

  return formatCurrency(cents)
}

export const affiliatesService = {
  list(search?: string) {
    const query = search ? `?search=${encodeURIComponent(search)}` : ''
    return api.get<AffiliateRow[]>(`${BASE}${query}`)
  },

  detail(uuid: string) {
    return api.get<AffiliateDetail>(`${BASE}/${uuid}`)
  },

  create(payload: Record<string, unknown>) {
    return api.post(`${BASE}`, payload)
  },

  update(uuid: string, payload: Record<string, unknown>) {
    return api.patch(`${BASE}/${uuid}`, payload)
  },

  createLink(uuid: string, payload: Record<string, unknown>) {
    return api.post(`${BASE}/${uuid}/links`, payload)
  },

  updateLink(linkUuid: string, payload: Record<string, unknown>) {
    return api.patch(`${BASE}/links/${linkUuid}`, payload)
  },

  removeLink(linkUuid: string) {
    return api.delete(`${BASE}/links/${linkUuid}`)
  },

  commissions(status?: string) {
    const query = status ? `?status=${encodeURIComponent(status)}` : ''
    return api.get<CommissionRow[]>(`${BASE}/commissions${query}`)
  },

  reviewCommission(uuid: string, approve: boolean, note?: string) {
    return api.patch(`${BASE}/commissions/${uuid}/review`, { approve, note })
  },

  payouts(status?: string) {
    const query = status ? `?status=${encodeURIComponent(status)}` : ''
    return api.get<AffiliatePayoutRow[]>(`${BASE}/payouts${query}`)
  },

  closeCycle() {
    return api.post(`${BASE}/payouts/close-cycle`)
  },

  markPayoutPaid(uuid: string, note?: string) {
    return api.patch(`${BASE}/payouts/${uuid}/paid`, { note })
  },

  cancelPayout(uuid: string, note?: string) {
    return api.patch(`${BASE}/payouts/${uuid}/cancel`, { note })
  },

  getConfig() {
    return api.get<AffiliateConfig>(`${BASE}/config`)
  },

  setConfig(payload: Partial<AffiliateConfig>) {
    return api.patch<AffiliateConfig>(`${BASE}/config`, payload)
  },
}
