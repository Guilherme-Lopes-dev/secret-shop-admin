// build: market-explorer facetas Steam (hero/type/slot/rarity/quality) — redeploy 2026-07-01
import { ref } from 'vue'
import type { MarketExplorerItem } from '@/services/admin/admin.service'
import { persistedRef } from '@/utils/persistedRef'

// Estado em escopo de módulo (singleton) → persiste ao abrir um item e voltar, sem re-fetch.
// Fonte atual dos dados: 'api' (steamwebapi) ou 'db' (dropship_products salvos).
export const source = ref<'api' | 'db'>('api')
// Catálogo inteiro carregado 1x; filtro/ordenação/paginação rodam no cliente (sem cache no servidor).
export const allItems = ref<MarketExplorerItem[]>([])
export const hasFetched = ref(false)
export const fetchedAt = ref<string | null>(null)

export const currentPage = ref(1)
export const pageSize = persistedRef('market-explorer:page-size', 50)

// Facetas disponíveis (populadas pelo catálogo, espelham os filtros da Steam).
export const heroes = ref<string[]>([])
export const types = ref<string[]>([])
export const slots = ref<string[]>([])
export const rarities = ref<string[]>([])
export const qualities = ref<string[]>([])

// Seleção dos filtros.
export const searchQuery = persistedRef('market-explorer:search', '')
export const heroFilter = persistedRef('market-explorer:hero', '')
export const typeFilter = persistedRef('market-explorer:type', 'Wearable') // default: só skins
export const slotFilter = persistedRef('market-explorer:slot', '')
export const rarityFilter = persistedRef('market-explorer:rarity', '')
export const qualityFilter = persistedRef<string[]>('market-explorer:quality', [])
export const priceFilter = persistedRef<'all' | 'with' | 'without'>('market-explorer:price', 'all')
export const priceMin = persistedRef('market-explorer:price-min', '') // reais, digitado
export const priceMax = persistedRef('market-explorer:price-max', '') // reais, digitado
export const sortValue = persistedRef('market-explorer:sort', 'name:asc')
