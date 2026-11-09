import type { StoryPick } from '@/services/admin/types'
import { sortRows, type SortGetters } from '@/utils/tableSort'

/** Sinais que o admin pode exigir: o item só aparece se tiver todos os marcados. */
const SIGNALS = {
    inCarts: (pick: StoryPick) => pick.inCarts > 0,
    favorited: (pick: StoryPick) => pick.favorites > 0,
    belowSteam: (pick: StoryPick) => (pick.discountVsSteamPct ?? 0) > 0,
    rising: (pick: StoryPick) => (pick.steamChangePct ?? 0) > 0,
    soldInPeriod: (pick: StoryPick) => pick.siteSold > 0,
    searched: (pick: StoryPick) => pick.searchHits > 0,
    lastUnit: (pick: StoryPick) => pick.stock === 1,
}

export type StorySignal = keyof typeof SIGNALS

export const SIGNAL_OPTIONS: { value: StorySignal; label: string; icon: string }[] = [
    { value: 'inCarts', label: 'No carrinho', icon: 'mdi:cart-outline' },
    { value: 'favorited', label: 'Na lista de desejos', icon: 'mdi:heart-outline' },
    { value: 'belowSteam', label: 'Abaixo da Steam', icon: 'mdi:tag-arrow-down-outline' },
    { value: 'rising', label: 'Valorizando na Steam', icon: 'mdi:trending-up' },
    { value: 'soldInPeriod', label: 'Vendeu no período', icon: 'mdi:cart-check' },
    { value: 'searched', label: 'Buscado na loja', icon: 'mdi:magnify' },
    { value: 'lastUnit', label: 'Última unidade', icon: 'mdi:numeric-1-box-outline' },
]

const SORTS: SortGetters<StoryPick> = {
    score: pick => pick.score,
    profit: pick => pick.profit,
    marginPct: pick => pick.marginPct,
    inCarts: pick => pick.inCarts,
    favorites: pick => pick.favorites,
    discountVsSteamPct: pick => pick.discountVsSteamPct,
    steamChangePct: pick => pick.steamChangePct,
    siteSold: pick => pick.siteSold,
    searchHits: pick => pick.searchHits,
    stock: pick => pick.stock,
}

export type StorySort = keyof typeof SORTS

export const SORT_OPTIONS: { value: StorySort; label: string }[] = [
    { value: 'score', label: 'Recomendação (lucro × interesse)' },
    { value: 'profit', label: 'Lucro por unidade' },
    { value: 'marginPct', label: 'Margem %' },
    { value: 'inCarts', label: 'No carrinho' },
    { value: 'favorites', label: 'Na lista de desejos' },
    { value: 'discountVsSteamPct', label: 'Desconto vs Steam' },
    { value: 'steamChangePct', label: 'Valorização na Steam' },
    { value: 'siteSold', label: 'Vendas no período' },
    { value: 'searchHits', label: 'Buscas na loja' },
    { value: 'stock', label: 'Estoque' },
]

export type StoryFilters = {
    search: string
    /** '' = todos os heróis. */
    hero: string
    /** Em reais (o input é em R$; o pick vem em centavos). */
    minProfit: number
    minMarginPct: number
    signals: StorySignal[]
    sortBy: StorySort
    /** 0 = sem limite por herói. */
    maxPerHero: number
    /** 0 = mostrar todos. */
    limit: number
}

export const DEFAULT_FILTERS: StoryFilters = {
    search: '',
    hero: '',
    minProfit: 0,
    minMarginPct: 0,
    signals: [],
    sortBy: 'score',
    maxPerHero: 2,
    limit: 15,
}

const matchesText = (pick: StoryPick, search: string) => {
    const text = search.trim().toLowerCase()
    if (!text) return true

    return [pick.name, pick.hero, pick.rarity].join(' ').toLowerCase().includes(text)
}

const matchesFilters = (pick: StoryPick, filters: StoryFilters) =>
    matchesText(pick, filters.search) &&
    (!filters.hero || pick.hero === filters.hero) &&
    pick.profit >= (Number(filters.minProfit) || 0) * 100 &&
    pick.marginPct >= (Number(filters.minMarginPct) || 0) &&
    filters.signals.every(signal => SIGNALS[signal](pick))

type HeroCap = { kept: StoryPick[]; counts: Record<string, number> }

const keepIfUnderCap = (maxPerHero: number) => ({ kept, counts }: HeroCap, pick: StoryPick): HeroCap => {
    if (!pick.hero) return { kept: [...kept, pick], counts }

    const count = (counts[pick.hero] ?? 0) + 1
    if (count > maxPerHero) return { kept, counts }

    return { kept: [...kept, pick], counts: { ...counts, [pick.hero]: count } }
}

/** Mantém a ordem e corta o excedente de cada herói. Item sem herói nunca é cortado. */
const capPerHero = (picks: StoryPick[], maxPerHero: number) => {
    if (!maxPerHero) return picks

    return picks.reduce(keepIfUnderCap(maxPerHero), { kept: [], counts: {} }).kept
}

const takeFirst = (picks: StoryPick[], limit: number) => (limit ? picks.slice(0, limit) : picks)

/** Filtra, ordena (maior primeiro), varia heróis e corta. `matching` = quantos passaram nos filtros. */
export const applyStoryFilters = (picks: StoryPick[], filters: StoryFilters) => {
    const matching = picks.filter(pick => matchesFilters(pick, filters))
    const sorted = sortRows(matching, SORTS, { column: filters.sortBy, desc: true })

    return {
        matching: matching.length,
        visible: takeFirst(capPerHero(sorted, filters.maxPerHero), filters.limit),
    }
}

export const heroesOf = (picks: StoryPick[]) =>
    [...new Set(picks.map(pick => pick.hero).filter((hero): hero is string => Boolean(hero)))].sort()
