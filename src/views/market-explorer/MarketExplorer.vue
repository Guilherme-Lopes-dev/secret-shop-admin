<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { adminService, type MarketExplorerItem } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import {
  items, rarities, hasFetched, fetchedAt,
  currentPage, totalPages, totalItems, pageSize,
  searchQuery, rarityFilter, priceFilter, sortValue,
} from './explorerState'

const router = useRouter()
const loading = ref(false)

let searchTimeout: ReturnType<typeof setTimeout> | null = null

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
    const res = await adminService.getMarketExplorer({
      page,
      pageSize: pageSize.value,
      search: searchQuery.value || undefined,
      rarity: rarityFilter.value || undefined,
      priceFilter: priceFilter.value,
      sortBy: by,
      sortDir: dir,
      refresh,
    })
    const body = res.data
    items.value = body.data
    totalItems.value = body.total
    totalPages.value = body.pages
    currentPage.value = body.page
    fetchedAt.value = body.fetchedAt
    if (body.rarities?.length) rarities.value = body.rarities
    hasFetched.value = true
  } catch (e: any) {
    toast.error(e?.response?.data?.message || 'Erro ao buscar itens do market.')
  } finally {
    loading.value = false
  }
}

const fetchItems = () => load(1, true)

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
          <template v-if="hasFetched">{{ totalItems }} itens · atualizado {{ $dayjs(fetchedAt).format('DD/MM/YY HH:mm') }}</template>
          <template v-else>Catálogo cru do steamwebapi /items (Dota 2)</template>
        </p>
      </div>
      <div class="header-actions">
        <button class="btn-fetch" :disabled="loading" @click="fetchItems">
          <Icon :icon="loading ? 'mdi:loading' : 'mdi:cloud-download-outline'" :class="{ spinning: loading }" />
          {{ loading ? 'Buscando...' : 'Buscar itens' }}
        </button>
      </div>
    </header>

    <div class="filters-row" v-if="hasFetched">
      <div class="search-wrap">
        <Icon icon="mdi:magnify" class="search-icon" />
        <input v-model="searchQuery" @input="onSearchInput" type="text" placeholder="Buscar por nome..." class="search-input" />
      </div>
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
    </div>

    <div class="section">
      <div v-if="!hasFetched && !loading" class="empty-state">
        <Icon icon="mdi:cloud-search-outline" class="empty-icon" />
        <p>Clique em <strong>Buscar itens</strong> para carregar o catálogo do market.</p>
      </div>
      <div v-else-if="loading && !items.length" class="loading-state">Buscando itens do market...</div>
      <div v-else>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Raridade</th>
                <th>Preço atual</th>
                <th>Mediana</th>
                <th>Atualizado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in items" :key="item.marketHashName" class="row-clickable" @click="openItem(item)">
                <td>
                  <div class="item-cell">
                    <img v-if="item.image" :src="item.image" class="item-thumb" alt="" loading="lazy" />
                    <div v-else class="item-thumb-placeholder"><Icon icon="mdi:sword" /></div>
                    <span class="item-name">{{ item.name || item.marketHashName }}</span>
                  </div>
                </td>
                <td><span class="rarity">{{ item.rarity || '—' }}</span></td>
                <td class="price" :class="{ 'no-price': item.priceLatest == null }">
                  {{ item.priceLatest != null ? formatCurrency(item.priceLatest) : 'Sem preço' }}
                </td>
                <td class="price-muted">{{ item.priceMedian != null ? formatCurrency(item.priceMedian) : '—' }}</td>
                <td class="mono">{{ item.priceUpdatedAt ? $dayjs(item.priceUpdatedAt).format('DD/MM/YY HH:mm') : '—' }}</td>
              </tr>
              <tr v-if="!items.length">
                <td colspan="5" class="empty-state">Nenhum item encontrado.</td>
              </tr>
            </tbody>
          </table>
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

.table-wrapper
    overflow-x auto
    margin-bottom 1.5rem

table
    width 100%
    border-collapse collapse

    th
        text-align left
        color #94a3b8
        font-size 0.78rem
        font-weight 500
        padding 0.75rem
        border-bottom 1px solid rgba(255,255,255,0.05)
        white-space nowrap
        text-transform uppercase

    td
        padding 0.85rem 0.75rem
        font-size 0.875rem
        border-bottom 1px solid rgba(255,255,255,0.04)
        vertical-align middle

        &.price
            font-weight 600
            color #4caf50

            &.no-price
                color #64748b
                font-weight 400

        &.price-muted
            color #94a3b8

.row-clickable
    cursor pointer
    transition background 0.15s

    &:hover
        background rgba(255,255,255,0.03)

.item-cell
    display flex
    align-items center
    gap 0.625rem

.item-thumb
    width 40px
    height 40px
    object-fit contain
    border-radius 4px
    background rgba(255,255,255,0.04)

.item-thumb-placeholder
    width 40px
    height 40px
    border-radius 4px
    background rgba(255,255,255,0.05)
    display flex
    align-items center
    justify-content center
    color #64748b

.item-name
    font-weight 500
    font-size 0.85rem

.rarity
    color #cbd5e1
    font-size 0.8rem

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
