<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { adminService, type MarketExplorerItem } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import {
  source, items, heroes, types, slots, rarities, qualities, hasFetched, fetchedAt,
  currentPage, totalPages, totalItems, pageSize,
  searchQuery, heroFilter, typeFilter, slotFilter, rarityFilter, qualityFilter, priceFilter, sortValue,
  excludedKeys,
} from './explorerState'

const router = useRouter()
const loading = ref(false)
const saving = ref(false)

// Filtros aplicados (só campos setados) — enviados ao back na busca e no salvamento.
const filterParams = () => ({
  search: searchQuery.value || undefined,
  hero: heroFilter.value || undefined,
  type: typeFilter.value || undefined,
  slot: slotFilter.value || undefined,
  rarity: rarityFilter.value || undefined,
  qualities: qualityFilter.value.length ? qualityFilter.value : undefined,
  priceFilter: priceFilter.value,
})

// Cards visíveis = página atual menos os itens removidos manualmente.
const visibleItems = computed(() =>
  items.value.filter((i) => !excludedKeys.value.includes(i.marketHashName)),
)

const removeItem = (item: MarketExplorerItem) => {
  if (!excludedKeys.value.includes(item.marketHashName)) {
    excludedKeys.value = [...excludedKeys.value, item.marketHashName]
  }
}
const restoreExcluded = () => {
  excludedKeys.value = []
}

const saveToDb = async () => {
  const estimate = Math.max(totalItems.value - excludedKeys.value.length, 0)
  const ok = window.confirm(
    `Salvar ~${estimate} itens no banco (filtro atual, menos ${excludedKeys.value.length} removidos)?`,
  )
  if (!ok) return
  saving.value = true
  try {
    const res = await adminService.saveDropshipProducts(filterParams(), excludedKeys.value)
    toast.success(`${res.data.saved} itens salvos (${res.data.batches} lotes).`)
  } catch (e: any) {
    toast.error(e?.response?.data?.message || 'Erro ao salvar no banco.')
  } finally {
    saving.value = false
  }
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null

// Preset pedido: só qualidades cosméticas comuns.
const QUALITY_PRESET = ['Exalted', 'Genuine', 'Inscribed', 'Standard']

const toggleQuality = (q: string) => {
  const set = new Set(qualityFilter.value)
  set.has(q) ? set.delete(q) : set.add(q)
  qualityFilter.value = [...set]
  onFilterChange()
}
const applyQualityPreset = () => {
  const available = QUALITY_PRESET.filter((q) => qualities.value.includes(q))
  qualityFilter.value = available.length ? available : QUALITY_PRESET
  onFilterChange()
}
const clearQualities = () => {
  qualityFilter.value = []
  onFilterChange()
}

// "Só skins" = tipo Wearable (o que a Steam chama de itens de herói vestíveis).
const onlySkins = () => {
  typeFilter.value = 'Wearable'
  onFilterChange()
}
const clearAllFilters = () => {
  heroFilter.value = ''
  typeFilter.value = ''
  slotFilter.value = ''
  rarityFilter.value = ''
  qualityFilter.value = []
  priceFilter.value = 'all'
  searchQuery.value = ''
  onFilterChange()
}

// Snapshot dos filtros atuais → base pro algoritmo futuro. Só campos setados.
const currentFilters = () => {
  const [sortBy, sortDir] = sortValue.value.split(':')
  const f: Record<string, unknown> = { sortBy, sortDir }
  if (searchQuery.value) f.search = searchQuery.value
  if (heroFilter.value) f.hero = heroFilter.value
  if (typeFilter.value) f.type = typeFilter.value
  if (slotFilter.value) f.slot = slotFilter.value
  if (rarityFilter.value) f.rarity = rarityFilter.value
  if (qualityFilter.value.length) f.qualities = qualityFilter.value
  if (priceFilter.value !== 'all') f.priceFilter = priceFilter.value
  return f
}
const copyFilters = async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(currentFilters(), null, 2))
    toast.success('Filtros copiados.')
  } catch {
    toast.error('Não foi possível copiar.')
  }
}

const priceOptions = [
  { label: 'Todos', value: 'all' },
  { label: 'Com preço', value: 'with' },
  { label: 'Sem preço', value: 'without' },
]

const sortOptions = [
  { label: 'Nome (A→Z)', by: 'name', dir: 'asc' },
  { label: 'Nome (Z→A)', by: 'name', dir: 'desc' },
  { label: 'Menor preço', by: 'price', dir: 'asc' },
  { label: 'Maior preço', by: 'price', dir: 'desc' },
  { label: 'Raridade', by: 'rarity', dir: 'asc' },
]

const load = async (page: number, refresh = false) => {
  loading.value = true
  try {
    const [by, dir] = sortValue.value.split(':') as ['price' | 'name' | 'rarity', 'asc' | 'desc']
    const query = { page, pageSize: pageSize.value, ...filterParams(), sortBy: by, sortDir: dir }
    const res =
      source.value === 'db'
        ? await adminService.getDropshipProducts(query)
        : await adminService.getMarketExplorer({ ...query, refresh })
    const body = res.data
    items.value = body.data
    totalItems.value = body.total
    totalPages.value = body.pages
    currentPage.value = body.page
    fetchedAt.value = body.fetchedAt
    const f = body.facets
    if (f) {
      if (f.heroes?.length) heroes.value = f.heroes
      if (f.types?.length) types.value = f.types
      if (f.slots?.length) slots.value = f.slots
      if (f.rarities?.length) rarities.value = f.rarities
      if (f.qualities?.length) qualities.value = f.qualities
    }
    hasFetched.value = true
  } catch (e: any) {
    toast.error(e?.response?.data?.message || 'Erro ao buscar itens do market.')
  } finally {
    loading.value = false
  }
}

const fetchFromApi = () => { source.value = 'api'; load(1, true) }
const fetchFromDb = () => { source.value = 'db'; load(1) }

const onFilterChange = () => {
  if (!hasFetched.value) return
  load(1)
}
const onSearchInput = () => {
  if (!hasFetched.value) return
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => load(1), 400)
}
const nextPage = () => { if (currentPage.value < totalPages.value) load(currentPage.value + 1) }
const prevPage = () => { if (currentPage.value > 1) load(currentPage.value - 1) }

const openItem = (item: MarketExplorerItem) => {
  router.push({ name: 'market-explorer-item', query: { name: item.marketHashName } })
}
</script>

<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <h1 class="page-title">Market Explorer</h1>
        <p class="page-subtitle">
          <template v-if="hasFetched">
            <span class="source-tag" :class="source">{{ source === 'db' ? 'Banco' : 'API' }}</span>
            {{ totalItems }} itens · atualizado {{ $dayjs(fetchedAt).format('DD/MM/YY HH:mm') }}
          </template>
          <template v-else>Busque da API (steamwebapi) ou do banco (produtos salvos)</template>
        </p>
      </div>
      <div class="header-actions">
        <span v-if="source === 'api' && excludedKeys.length" class="excluded-badge">
          {{ excludedKeys.length }} removido(s)
          <button class="undo-btn" @click="restoreExcluded" title="Restaurar removidos">
            <Icon icon="mdi:undo" />
          </button>
        </span>
        <button v-if="hasFetched && source === 'api'" class="btn-save" :disabled="saving || loading" @click="saveToDb">
          <Icon :icon="saving ? 'mdi:loading' : 'mdi:database-plus-outline'" :class="{ spinning: saving }" />
          {{ saving ? 'Salvando...' : 'Salvar no banco' }}
        </button>
        <button class="btn-fetch outline" :disabled="loading" @click="fetchFromDb">
          <Icon icon="mdi:database-outline" /> Buscar do banco
        </button>
        <button class="btn-fetch" :disabled="loading" @click="fetchFromApi">
          <Icon :icon="loading ? 'mdi:loading' : 'mdi:cloud-download-outline'" :class="{ spinning: loading && source === 'api' }" />
          {{ loading && source === 'api' ? 'Buscando...' : 'Buscar da API' }}
        </button>
      </div>
    </header>

    <div class="filters-row" v-if="hasFetched">
      <div class="search-wrap">
        <Icon icon="mdi:magnify" class="search-icon" />
        <input v-model="searchQuery" @input="onSearchInput" type="text" placeholder="Buscar por nome..." class="search-input" />
      </div>
      <select v-model="heroFilter" @change="onFilterChange" class="filter-select">
        <option value="">Todos os heróis</option>
        <option v-for="h in heroes" :key="h" :value="h">{{ h }}</option>
      </select>
      <select v-model="typeFilter" @change="onFilterChange" class="filter-select">
        <option value="">Todos os tipos</option>
        <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
      </select>
      <select v-model="slotFilter" @change="onFilterChange" class="filter-select">
        <option value="">Todos os slots</option>
        <option v-for="s in slots" :key="s" :value="s">{{ s }}</option>
      </select>
      <select v-model="rarityFilter" @change="onFilterChange" class="filter-select">
        <option value="">Todas raridades</option>
        <option v-for="r in rarities" :key="r" :value="r">{{ r }}</option>
      </select>
      <select v-model="priceFilter" @change="onFilterChange" class="filter-select">
        <option v-for="opt in priceOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <select v-model="sortValue" @change="onFilterChange" class="filter-select">
        <option v-for="opt in sortOptions" :key="`${opt.by}:${opt.dir}`" :value="`${opt.by}:${opt.dir}`">{{ opt.label }}</option>
      </select>
      <button class="chip chip-preset" @click="onlySkins">Só skins</button>
      <button class="chip chip-clear" @click="clearAllFilters">Limpar filtros</button>
      <button class="chip chip-copy" @click="copyFilters">
        <Icon icon="mdi:content-copy" /> Copiar filtros
      </button>
    </div>

    <div class="quality-row" v-if="hasFetched && qualities.length">
      <span class="quality-label">Qualidade:</span>
      <button
        v-for="q in qualities"
        :key="q"
        class="chip"
        :class="{ active: qualityFilter.includes(q) }"
        @click="toggleQuality(q)"
      >{{ q }}</button>
      <button class="chip chip-preset" @click="applyQualityPreset">★ Exalted/Genuine/Inscribed/Standard</button>
      <button v-if="qualityFilter.length" class="chip chip-clear" @click="clearQualities">Limpar</button>
    </div>

    <div class="section">
      <div v-if="!hasFetched && !loading" class="empty-state">
        <Icon icon="mdi:cloud-search-outline" class="empty-icon" />
        <p><strong>Buscar da API</strong> = catálogo do market · <strong>Buscar do banco</strong> = produtos já salvos.</p>
      </div>
      <div v-else-if="loading && !items.length" class="loading-state">Buscando itens do market...</div>
      <div v-else>
        <div class="cards-grid">
          <article
            v-for="item in visibleItems"
            :key="item.marketHashName"
            class="card"
            @click="openItem(item)"
          >
            <button v-if="source === 'api'" class="card-remove" title="Remover da listagem" @click.stop="removeItem(item)">
              <Icon icon="mdi:close" />
            </button>
            <div class="card-img-wrap">
              <img v-if="item.image" :src="item.image" class="card-img" alt="" loading="lazy" />
              <div v-else class="card-img-placeholder"><Icon icon="mdi:sword" /></div>
            </div>
            <div class="card-body">
              <h3 class="card-name" :title="item.name || item.marketHashName">{{ item.name || item.marketHashName }}</h3>
              <div class="card-badges">
                <span v-if="item.quality" class="badge badge-quality">{{ item.quality }}</span>
                <span v-if="item.rarity" class="badge badge-rarity">{{ item.rarity }}</span>
                <span v-if="item.hero" class="badge badge-hero">{{ item.hero }}</span>
              </div>
              <div class="card-prices">
                <span class="card-price" :class="{ 'no-price': item.priceLatest == null }">
                  {{ item.priceLatest != null ? formatCurrency(item.priceLatest) : 'Sem preço' }}
                </span>
                <span v-if="item.priceMedian != null" class="card-median">med. {{ formatCurrency(item.priceMedian) }}</span>
              </div>
            </div>
          </article>
          <div v-if="!visibleItems.length" class="empty-state">Nenhum item para exibir.</div>
        </div>

        <div class="pagination" v-if="totalPages > 1">
          <button class="page-btn" :disabled="currentPage === 1 || loading" @click="prevPage">Anterior</button>
          <span class="page-info">Página {{ currentPage }} de {{ totalPages }}</span>
          <button class="page-btn" :disabled="currentPage === totalPages || loading" @click="nextPage">Próxima</button>
        </div>
      </div>
    </div>
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

.header-actions
    display flex
    gap 0.75rem
    align-items center

.btn-fetch
    display inline-flex
    align-items center
    gap 0.4rem
    background #6366f1
    color #fff
    border none
    padding 0.6rem 1.2rem
    border-radius 8px
    font-size 0.9rem
    font-weight 600
    cursor pointer
    transition all 0.2s

    &:hover:not(:disabled)
        background #4f52d4

    &:disabled
        opacity 0.5
        cursor not-allowed

    &.outline
        background transparent
        border 1px solid rgba(255,255,255,0.15)
        color #cbd5e1
        font-weight 500

        &:hover:not(:disabled)
            background rgba(255,255,255,0.06)
            border-color rgba(255,255,255,0.25)

.source-tag
    display inline-block
    padding 1px 8px
    border-radius 5px
    font-size 0.72rem
    font-weight 700
    margin-right 0.4rem
    text-transform uppercase

    &.api
        background rgba(99,102,241,0.18)
        color #a5b4fc

    &.db
        background rgba(34,197,94,0.16)
        color #4ade80

.spinning
    animation spin 1s linear infinite

@keyframes spin
    from transform rotate(0deg)
    to transform rotate(360deg)

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

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.loading-state
    padding 3rem
    text-align center
    color #94a3b8

.empty-state
    text-align center
    padding 3rem
    color #94a3b8

.empty-icon
    font-size 3rem
    color #3f3f46
    margin-bottom 1rem

.btn-save
    display inline-flex
    align-items center
    gap 0.4rem
    background rgba(34,197,94,0.14)
    color #4ade80
    border 1px solid rgba(34,197,94,0.35)
    padding 0.6rem 1.2rem
    border-radius 8px
    font-size 0.9rem
    font-weight 600
    cursor pointer
    transition all 0.2s

    &:hover:not(:disabled)
        background rgba(34,197,94,0.24)

    &:disabled
        opacity 0.5
        cursor not-allowed

.excluded-badge
    display inline-flex
    align-items center
    gap 0.35rem
    color #f87171
    font-size 0.8rem

.undo-btn
    background transparent
    border none
    color #f87171
    cursor pointer
    display inline-flex
    font-size 1rem

    &:hover
        color #fca5a5

.cards-grid
    display grid
    grid-template-columns repeat(auto-fill, minmax(200px, 1fr))
    gap 1rem
    margin-bottom 1.5rem

.card
    position relative
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

.card-remove
    position absolute
    top 6px
    right 6px
    z-index 2
    width 26px
    height 26px
    border-radius 6px
    border none
    background rgba(0,0,0,0.55)
    color #f87171
    cursor pointer
    display flex
    align-items center
    justify-content center
    font-size 1rem
    opacity 0
    transition opacity 0.15s

    &:hover
        background rgba(244,67,54,0.85)
        color #fff

.card:hover .card-remove
    opacity 1

.card-img-wrap
    aspect-ratio 4 / 3
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
    padding 0.7rem
    display flex
    flex-direction column
    gap 0.4rem

.card-name
    font-size 0.82rem
    font-weight 600
    line-height 1.25
    display -webkit-box
    -webkit-line-clamp 2
    -webkit-box-orient vertical
    overflow hidden
    min-height 2.05rem

.card-badges
    display flex
    flex-wrap wrap
    gap 0.25rem

.badge
    padding 2px 7px
    border-radius 5px
    font-size 0.68rem
    font-weight 600

.badge-quality
    background rgba(99,102,241,0.15)
    color #a5b4fc

.badge-rarity
    background rgba(255,255,255,0.07)
    color #cbd5e1

.badge-hero
    background rgba(76,175,80,0.12)
    color #86efac

.card-prices
    display flex
    align-items baseline
    justify-content space-between
    gap 0.4rem
    margin-top 0.15rem

.card-price
    font-weight 700
    font-size 0.9rem
    color #4caf50

    &.no-price
        color #64748b
        font-weight 400
        font-size 0.8rem

.card-median
    font-size 0.72rem
    color #94a3b8

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

.chip-preset
    border-color rgba(234,179,8,0.35)
    color #eab308

    &:hover
        background rgba(234,179,8,0.1)

.chip-clear
    border-color rgba(244,67,54,0.3)
    color #f87171

.chip-copy
    display inline-flex
    align-items center
    gap 0.3rem
    border-color rgba(34,197,94,0.35)
    color #4ade80

    &:hover
        background rgba(34,197,94,0.1)

.mono
    font-family monospace
    font-size 0.8rem
    color #94a3b8

.pagination
    display flex
    justify-content flex-end
    align-items center
    gap 1rem
    padding-top 1rem
    border-top 1px solid rgba(255,255,255,0.05)

.page-btn
    background #2a2a30
    color #fff
    border 1px solid rgba(255,255,255,0.1)
    padding 0.45rem 1rem
    border-radius 6px
    cursor pointer
    font-size 0.85rem
    transition all 0.2s

    &:hover:not(:disabled)
        background #3a3a42

    &:disabled
        opacity 0.4
        cursor not-allowed

.page-info
    color #94a3b8
    font-size 0.875rem
</style>
