import type { MarketPriceHistoryPoint } from '@/services/admin/admin.service'
import type { SteamOrderLevel } from '@/services/admin/types'

const ISO_CURRENCY = /^[A-Z]{3}$/

/** A Steam pode responder em outra moeda (depende do IP do servidor) — nunca assume BRL. */
export const formatMoney = (cents: number | null | undefined, currency: string | null) => {
    if (cents == null) return '—'
    if (!currency || !ISO_CURRENCY.test(currency)) return `${(cents / 100).toFixed(2)} ${currency ?? ''}`.trim()

    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(cents / 100)
}

export const pctChange = (value: number | null | undefined, base: number | null | undefined) => {
    if (value == null || !base) return null
    return ((value - base) / base) * 100
}

export const formatPct = (pct: number | null) => {
    if (pct == null) return '—'
    return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
}

const orLowest = (value: number | null, lowest: number) => (value ? value : lowest)
const median3 = (a: number, b: number, c: number) => Math.max(Math.min(a, b), Math.min(Math.max(a, b), c))

/** Mesma regra do CONSENSUS_PRICE_SQL (Tendências): mediana de lowest, median e média 24h. */
export const consensusCents = (point: MarketPriceHistoryPoint) => {
    const lowest = point.lowest_price
    if (lowest == null) return point.median_price

    return median3(lowest, orLowest(point.median_price, lowest), orLowest(point.price_avg_24h, lowest))
}

export const withCumulative = (levels: SteamOrderLevel[]) => {
    let running = 0
    return levels.map(level => {
        running += level.quantity
        return { ...level, cumulative: running }
    })
}
