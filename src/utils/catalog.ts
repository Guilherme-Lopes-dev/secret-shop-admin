// Favoritos, carrinho e itens de pedido listam os mesmos três catálogos.
export const CATALOG_LABELS = { skin: 'Skin', collector: 'Collector', physical: 'Físico' } as const
export const CATALOG_ICONS = {
    skin: 'mdi:sword-cross',
    collector: 'mdi:trophy-outline',
    physical: 'mdi:package-variant-closed',
} as const

export type CatalogKind = keyof typeof CATALOG_LABELS

export interface CatalogItem {
    kind: CatalogKind
    name: string
    hero: string | null
    /** Skin e collector guardam o hash da Steam; produto físico guarda o path do nosso servidor. */
    image: string | null
}

const API_URL = import.meta.env.VITE_API_URL?.trim() || ''

// A URL sai do `kind`, não do formato do campo.
export const catalogThumb = (item: CatalogItem): string | null => {
    if (!item.image) return null
    if (item.kind === 'physical') return `${API_URL}${item.image}`

    return `https://steamcommunity-a.akamaihd.net/economy/image/${item.image}/62fx62f`
}

export const catalogLabel = (item: CatalogItem) => CATALOG_LABELS[item.kind] ?? item.kind
export const catalogIcon = (item: CatalogItem) => CATALOG_ICONS[item.kind] ?? 'mdi:heart-outline'
