import { ref } from 'vue'
import type { MarketExplorerItem } from '@/services/admin/admin.service'

// Estado em escopo de módulo (singleton) → persiste ao abrir um item e voltar, sem re-fetch.
export const items = ref<MarketExplorerItem[]>([])
export const rarities = ref<string[]>([])
export const qualities = ref<string[]>([])
export const hasFetched = ref(false)
export const fetchedAt = ref<string | null>(null)

export const currentPage = ref(1)
export const totalPages = ref(1)
export const totalItems = ref(0)
export const pageSize = ref(50)

export const searchQuery = ref('')
export const rarityFilter = ref('')
export const qualityFilter = ref<string[]>([])
export const hideStickers = ref(true)
export const priceFilter = ref<'all' | 'with' | 'without'>('all')
export const sortValue = ref('name:asc')
