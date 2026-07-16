<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { adminService, type SkinPriceCatalogItem, type MarketExplorerFacets } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { toCents } from '@/utils/toCents'
import { Icon } from '@iconify/vue'

const router = useRouter()
const items = ref<SkinPriceCatalogItem[]>([])
const loading = ref(true)
const loadingMore = ref(false)
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const limit = ref(40)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const searchQuery = ref('')
const heroFilter = ref('')
const typeFilter = ref('')
const slotFilter = ref('')
const rarityFilter = ref('')
const qualityFilter = ref<string[]>([])
const priceFilter = ref<'all' | 'with' | 'without'>('all')
const priceMin = ref('')
const priceMax = ref('')
const sortValue = ref('update:desc')

const facets = ref<MarketExplorerFacets>({ heroes: [], types: [], slots: [], rarities: [], qualities: [] })
let searchTimeout: ReturnType<typeof setTimeout> | null = null
let fetchGeneration = 0

const fetchCatalog = async (page: number, append = false) => {
    const myGeneration = ++fetchGeneration
    let applied = false
    if (append) loadingMore.value = true
    else loading.value = true
    try {
        const [sortBy, sortDir] = sortValue.value.split(':') as [string, 'asc' | 'desc']
        const response = await adminService.getSkinsPriceCatalog(page, limit.value, {
            search: searchQuery.value || undefined,
            hero: heroFilter.value || undefined,
            type: typeFilter.value || undefined,
            slot: slotFilter.value || undefined,
            rarity: rarityFilter.value || undefined,
            qualities: qualityFilter.value.length ? qualityFilter.value : undefined,
            priceFilter: priceFilter.value !== 'all' ? priceFilter.value : undefined,
            priceMin: priceMin.value ? toCents(priceMin.value) : undefined,
            priceMax: priceMax.value ? toCents(priceMax.value) : undefined,
            sortBy: sortBy === 'update' ? undefined : (sortBy as 'price' | 'name' | 'rarity' | 'variation'),
            sortDir,
        })
        // resposta antiga (filtro mudou no meio) não pode sobrescrever a mais nova
        if (myGeneration !== fetchGeneration) return
        if (response.data) {
            items.value = append ? [...items.value, ...response.data.data] : response.data.data
            totalPages.value = response.data.pages
            totalItems.value = response.data.total
            currentPage.value = response.data.page
            facets.value = response.data.facets
            applied = true
        }
    } catch (error) {
        console.error('Erro ao buscar catálogo de preços:', error)
    } finally {
        if (myGeneration === fetchGeneration) {
            loading.value = false
            loadingMore.value = false
        }
    }
    if (!applied) return
    // sentinela pode seguir visível após render (página curta) — sem cruzar a borda o observer não refire
    await nextTick()
    if (sentinelInView()) loadMore()
}

const sentinelInView = () => {
    const el = sentinel.value
    if (!el) return false
    return el.getBoundingClientRect().top <= window.innerHeight + 200
}

const onFilterChange = () => fetchCatalog(1)
const onSearchInput = () => {
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => fetchCatalog(1), 400)
}
const loadMore = () => {
    if (loading.value || loadingMore.value) return
    if (currentPage.value >= totalPages.value) return
    fetchCatalog(currentPage.value + 1, true)
}

const toggleQuality = (q: string) => {
    const set = new Set(qualityFilter.value)
    set.has(q) ? set.delete(q) : set.add(q)
    qualityFilter.value = [...set]
    onFilterChange()
}
const clearQualities = () => {
    qualityFilter.value = []
    onFilterChange()
}
const clearAllFilters = () => {
    heroFilter.value = ''
    typeFilter.value = ''
    slotFilter.value = ''
    rarityFilter.value = ''
    qualityFilter.value = []
    priceFilter.value = 'all'
    priceMin.value = ''
    priceMax.value = ''
    searchQuery.value = ''
    sortValue.value = 'update:desc'
    onFilterChange()
}

const priceOptions = [
    { label: 'Todos', value: 'all' },
    { label: 'Com preço', value: 'with' },
    { label: 'Sem preço', value: 'without' },
]
const sortOptions = [
    { label: 'Última atualização', value: 'update:desc' },
    { label: 'Nome (A→Z)', value: 'name:asc' },
    { label: 'Nome (Z→A)', value: 'name:desc' },
    { label: 'Menor preço', value: 'price:asc' },
    { label: 'Maior preço', value: 'price:desc' },
    { label: 'Maior variação', value: 'variation:desc' },
    { label: 'Menor variação', value: 'variation:asc' },
    { label: 'Raridade', value: 'rarity:asc' },
]

const formatTrend = (pct: number | null) => {
    if (pct == null) return '—'
    return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
}
const trendClass = (pct: number | null) => {
    if (pct == null) return ''
    return pct > 0 ? 'trend-up' : pct < 0 ? 'trend-down' : ''
}

onMounted(() => {
    fetchCatalog(1)
    observer = new IntersectionObserver(
        ([entry]) => { if (entry?.isIntersecting) loadMore() },
        { rootMargin: '200px' },
    )
    if (sentinel.value) observer.observe(sentinel.value)
})
onUnmounted(() => observer?.disconnect())
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Evolução de Preços</h1>
                <p class="page-subtitle">{{ totalItems }} skins no catálogo</p>
            </div>
        </header>

        <div class="filters-row">
            <div class="search-wrap">
                <Icon icon="mdi:magnify" class="search-icon" />
                <input
                    v-model="searchQuery"
                    @input="onSearchInput"
                    type="search"
                    placeholder="Buscar por nome..."
                    class="search-input"
                />
            </div>
            <select v-model="heroFilter" @change="onFilterChange" class="filter-select">
                <option value="">Todos os heróis</option>
                <option v-for="h in facets.heroes" :key="h" :value="h">{{ h }}</option>
            </select>
            <select v-model="typeFilter" @change="onFilterChange" class="filter-select">
                <option value="">Todos os tipos</option>
                <option v-for="t in facets.types" :key="t" :value="t">{{ t }}</option>
            </select>
            <select v-model="slotFilter" @change="onFilterChange" class="filter-select">
                <option value="">Todos os slots</option>
                <option v-for="s in facets.slots" :key="s" :value="s">{{ s }}</option>
            </select>
            <select v-model="rarityFilter" @change="onFilterChange" class="filter-select">
                <option value="">Todas raridades</option>
                <option v-for="r in facets.rarities" :key="r" :value="r">{{ r }}</option>
            </select>
            <select v-model="priceFilter" @change="onFilterChange" class="filter-select">
                <option v-for="opt in priceOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <div class="price-range">
                <input v-model="priceMin" @change="onFilterChange" type="number" min="0" step="0.01" placeholder="R$ mín" class="price-input" />
                <span class="price-sep">—</span>
                <input v-model="priceMax" @change="onFilterChange" type="number" min="0" step="0.01" placeholder="R$ máx" class="price-input" />
            </div>
            <select v-model="sortValue" @change="onFilterChange" class="filter-select">
                <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <button class="chip chip-clear" @click="clearAllFilters">Limpar filtros</button>
        </div>

        <div class="quality-row" v-if="facets.qualities.length">
            <span class="quality-label">Qualidade:</span>
            <button
                v-for="q in facets.qualities"
                :key="q"
                class="chip"
                :class="{ active: qualityFilter.includes(q) }"
                @click="toggleQuality(q)"
            >{{ q }}</button>
            <button v-if="qualityFilter.length" class="chip chip-clear" @click="clearQualities">Limpar</button>
        </div>

        <div class="section">
            <div v-if="loading" class="loading-state">Carregando catálogo...</div>
            <div v-else>
                <div class="cards-grid">
                    <article
                        v-for="item in items"
                        :key="item.id"
                        class="card"
                        @click="router.push(`/skins/prices/${item.id}`)"
                    >
                        <div class="card-img-wrap">
                            <img v-if="item.icon_url_large" :src="`https://steamcommunity-a.akamaihd.net/economy/image/${item.icon_url_large}/184fx184f`" class="card-img" alt="" loading="lazy" />
                            <div v-else class="card-img-placeholder"><Icon icon="mdi:sword" /></div>
                        </div>
                        <div class="card-body">
                            <h3 class="card-name" :title="item.name">{{ item.name }}</h3>
                            <span v-if="item.hero" class="badge badge-hero">{{ item.hero }}</span>

                            <div class="card-price-grid">
                                <div class="card-price-cell">
                                    <span class="card-price-label">Menor</span>
                                    <span class="card-price-value">{{ formatCurrency(item.lowest_price) }}</span>
                                </div>
                                <div class="card-price-cell">
                                    <span class="card-price-label">Mediano</span>
                                    <span class="card-price-value">{{ formatCurrency(item.median_price) }}</span>
                                </div>
                                <div class="card-price-cell">
                                    <span class="card-price-label">Catálogo</span>
                                    <span class="card-price-value">{{ formatCurrency(item.manual_price) }}</span>
                                </div>
                            </div>

                            <div class="card-evolution">
                                <div class="card-evolution-cell">
                                    <span class="card-price-label">1º Valor</span>
                                    <span class="card-price-value">{{ item.first_median_price != null ? formatCurrency(item.first_median_price) : '—' }}</span>
                                </div>
                                <Icon icon="mdi:arrow-right" class="card-evolution-arrow" />
                                <div class="card-evolution-cell">
                                    <span class="card-price-label">Último</span>
                                    <span class="card-price-value">{{ item.last_median_price != null ? formatCurrency(item.last_median_price) : '—' }}</span>
                                </div>
                                <span class="card-trend" :class="trendClass(item.median_price_change_pct)">{{ formatTrend(item.median_price_change_pct) }}</span>
                            </div>

                            <span class="card-updated-at">{{ item.last_price_update_at ? `Atualizado ${$dayjs(item.last_price_update_at).format('DD/MM/YY HH:mm')}` : 'Sem atualização' }}</span>
                        </div>
                    </article>
                    <div v-if="!items.length" class="empty-state">Nenhuma skin encontrada.</div>
                </div>

                <div v-if="loadingMore" class="loading-state">Carregando mais...</div>
            </div>
        </div>
        <div ref="sentinel" class="scroll-sentinel"></div>
    </div>
</template>

<style lang="stylus" scoped>
.view-wrap
    padding 2rem
    color #fff
    background #121214
    min-height 100vh

.page-header
    display flex
    align-items flex-start
    justify-content space-between
    gap 1rem
    flex-wrap wrap
    margin-bottom 2rem

.page-title
    font-size 1.8rem
    font-weight 700
    margin-bottom 0.25rem

.page-subtitle
    color #94a3b8
    font-size 0.9rem

.filters-row
    display flex
    align-items center
    gap 0.75rem
    flex-wrap wrap
    margin-bottom 1.25rem

.search-wrap
    position relative
    flex 1
    min-width 200px

.search-icon
    position absolute
    left 0.65rem
    top 50%
    transform translateY(-50%)
    color #64748b
    font-size 1rem
    pointer-events none

.search-input
    width 100%
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.5rem 0.75rem 0.5rem 2.1rem
    font-size 0.875rem
    outline none
    box-sizing border-box

    &::placeholder
        color #64748b

    &:focus
        border-color rgba(99,102,241,0.4)

.filter-select
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.5rem 0.75rem
    font-size 0.875rem
    outline none
    cursor pointer

    option
        background #1a1a1e

.price-range
    display flex
    align-items center
    gap 0.4rem

.price-input
    width 110px
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.5rem 0.6rem
    font-size 0.875rem
    outline none

    &::placeholder
        color #64748b

    &:focus
        border-color rgba(99,102,241,0.4)

    &::-webkit-outer-spin-button, &::-webkit-inner-spin-button
        -webkit-appearance none

.price-sep
    color #64748b

.quality-row
    display flex
    align-items center
    gap 0.4rem
    flex-wrap wrap
    margin-bottom 1.25rem

.quality-label
    color #94a3b8
    font-size 0.8rem
    margin-right 0.25rem

.chip
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.1)
    color #cbd5e1
    padding 0.35rem 0.7rem
    border-radius 999px
    font-size 0.78rem
    cursor pointer
    transition all 0.15s

    &:hover
        border-color rgba(99,102,241,0.4)

    &.active
        background rgba(99,102,241,0.18)
        border-color rgba(99,102,241,0.5)
        color #a5b4fc

.chip-clear
    border-color rgba(244,67,54,0.3)
    color #f87171

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.loading-state
    padding 3rem
    text-align center
    color #94a3b8

.cards-grid
    display grid
    grid-template-columns repeat(auto-fill, minmax(240px, 1fr))
    gap 1rem
    margin-bottom 1.5rem

.card
    background #121214
    border 1px solid rgba(255,255,255,0.06)
    border-radius 10px
    overflow hidden
    cursor pointer
    transition all 0.15s
    display flex
    flex-direction column

    &:hover
        border-color rgba(99,102,241,0.4)
        transform translateY(-2px)

.card-img-wrap
    aspect-ratio 16 / 10
    background rgba(255,255,255,0.03)
    display flex
    align-items center
    justify-content center

.card-img
    width 100%
    height 100%
    object-fit contain

.card-img-placeholder
    color #3f3f46
    font-size 2rem

.card-body
    padding 0.85rem
    display flex
    flex-direction column
    gap 0.5rem

.card-name
    font-size 0.88rem
    font-weight 600
    line-height 1.25
    display -webkit-box
    -webkit-line-clamp 2
    -webkit-box-orient vertical
    overflow hidden
    min-height 2.2rem

.badge-hero
    align-self flex-start
    padding 2px 7px
    border-radius 5px
    font-size 0.68rem
    font-weight 600
    background rgba(76,175,80,0.12)
    color #86efac

.card-price-grid
    display grid
    grid-template-columns repeat(3, 1fr)
    gap 0.5rem
    padding-top 0.25rem
    border-top 1px solid rgba(255,255,255,0.05)

.card-price-cell
    display flex
    flex-direction column
    gap 0.15rem

.card-price-label
    font-size 0.65rem
    color #64748b
    text-transform uppercase

.card-price-value
    font-size 0.82rem
    font-weight 600
    color #4caf50

.card-evolution
    display flex
    align-items center
    gap 0.5rem
    padding-top 0.5rem
    border-top 1px solid rgba(255,255,255,0.05)

.card-evolution-cell
    display flex
    flex-direction column
    gap 0.15rem

.card-evolution-arrow
    color #64748b
    font-size 0.9rem

.card-trend
    margin-left auto
    font-size 0.8rem
    font-weight 700
    color #94a3b8

    &.trend-up
        color #4caf50

    &.trend-down
        color #f44336

.card-updated-at
    font-size 0.7rem
    color #64748b

.empty-state
    grid-column 1 / -1
    text-align center
    padding 3rem
    color #94a3b8

.scroll-sentinel
    height 1px
</style>
