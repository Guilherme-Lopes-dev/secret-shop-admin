// build: market-explorer facetas Steam (hero/type/slot/rarity/quality) — redeploy 2026-07-01
import { ref } from 'vue'
import type { MarketExplorerItem } from '@/services/admin/admin.service'

// Estado em escopo de módulo (singleton) → persiste ao abrir um item e voltar, sem re-fetch.
export const items = ref<MarketExplorerItem[]>([])
export const hasFetched = ref(false)
export const fetchedAt = ref<string | null>(null)

export const currentPage = ref(1)
export const totalPages = ref(1)
export const totalItems = ref(0)
export const pageSize = ref(50)

// Facetas disponíveis (populadas pelo catálogo, espelham os filtros da Steam).
export const heroes = ref<string[]>([])
export const types = ref<string[]>([])
export const slots = ref<string[]>([])
export const rarities = ref<string[]>([])
export const qualities = ref<string[]>([])

// Seleção dos filtros.
export const searchQuery = ref('')
export const heroFilter = ref('')
export const typeFilter = ref('Wearable') // default: só skins
export const slotFilter = ref('')
export const rarityFilter = ref('')
export const qualityFilter = ref<string[]>([])
export const priceFilter = ref<'all' | 'with' | 'without'>('all')
export const sortValue = ref('name:asc')
