<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'

const router = useRouter()
const items = ref<any[]>([])
const bots = ref<any[]>([])
const loading = ref(true)
const syncing = ref(false)
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const limit = ref(20)
const botFilter = ref('')
const statusFilter = ref('')
const searchQuery = ref('')
const sortFilter = ref('')
const minPriceInput = ref('')
const maxPriceInput = ref('')
let searchTimeout: ReturnType<typeof setTimeout> | null = null

const statusOptions = [
    { label: 'Todos', value: '' },
    { label: 'Disponível', value: 'available' },
    { label: 'Reservado', value: 'reserved' },
    { label: 'Vendido', value: 'sold' },
]

const sortOptions = [
    { label: 'Mais recente', value: '' },
    { label: 'Maior preço', value: 'price_desc' },
    { label: 'Menor preço', value: 'price_asc' },
]

const fetchInventory = async (page: number) => {
    loading.value = true
    try {
        const minPrice = minPriceInput.value ? Math.round(parseFloat(minPriceInput.value) * 100) : undefined
        const maxPrice = maxPriceInput.value ? Math.round(parseFloat(maxPriceInput.value) * 100) : undefined
        const response = await adminService.getInventory(
            page,
            limit.value,
            botFilter.value || undefined,
            statusFilter.value || undefined,
            searchQuery.value || undefined,
            sortFilter.value || undefined,
            minPrice,
            maxPrice,
        )
        if (response.data) {
            items.value = response.data.data
            totalPages.value = response.data.pages
            totalItems.value = response.data.total
            currentPage.value = response.data.page
        }
    } catch (error) {
        console.error('Erro ao buscar inventário:', error)
    } finally {
        loading.value = false
    }
}

const fetchBots = async () => {
    try {
        const response = await adminService.getBots()
        if (response.data) bots.value = response.data
    } catch {}
}

const triggerSync = async () => {
    syncing.value = true
    try {
        await adminService.syncInventory()
        toast.success('Sync de inventário disparado!')
        setTimeout(() => fetchInventory(1), 2000)
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao sincronizar inventário.')
    } finally {
        syncing.value = false
    }
}

const onFilterChange = () => fetchInventory(1)
const onSearchInput = () => {
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => fetchInventory(1), 400)
}
const nextPage = () => { if (currentPage.value < totalPages.value) fetchInventory(currentPage.value + 1) }
const prevPage = () => { if (currentPage.value > 1) fetchInventory(currentPage.value - 1) }

const itemStatus = (item: any) => {
    if (item.is_sold) return { label: 'Vendido', cls: 'status-canceled' }
    if (item.is_reserved) return { label: 'Reservado', cls: 'status-pending' }
    return { label: 'Disponível', cls: 'status-completed' }
}

onMounted(() => {
    fetchBots()
    fetchInventory(1)
})
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Inventário dos Bots</h1>
                <p class="page-subtitle">{{ totalItems }} itens no inventário</p>
            </div>
            <div class="header-actions">
                <select v-model="botFilter" @change="onFilterChange" class="filter-select">
                    <option value="">Todos os bots</option>
                    <option v-for="bot in bots" :key="bot.id ?? bot.uuid" :value="bot.id ?? bot.uuid">{{ bot.name }}</option>
                </select>
                <select v-model="statusFilter" @change="onFilterChange" class="filter-select">
                    <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
                <button class="btn-sync" :disabled="syncing" @click="triggerSync">
                    <Icon :icon="syncing ? 'mdi:loading' : 'mdi:cloud-sync-outline'" :class="{ spinning: syncing }" />
                    {{ syncing ? 'Sincronizando...' : 'Sincronizar' }}
                </button>
                <router-link to="/products/create" class="btn-add">
                    <Icon icon="mdi:plus" /> Add Produto
                </router-link>
            </div>
        </header>

        <div class="filters-row">
            <div class="search-wrap">
                <Icon icon="mdi:magnify" class="search-icon" />
                <input
                    v-model="searchQuery"
                    @input="onSearchInput"
                    type="text"
                    placeholder="Buscar por nome..."
                    class="search-input"
                />
            </div>
            <select v-model="sortFilter" @change="onFilterChange" class="filter-select">
                <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <div class="price-range">
                <input
                    v-model="minPriceInput"
                    @change="onFilterChange"
                    type="number"
                    min="0"
                    placeholder="Preço mín (R$)"
                    class="price-input"
                />
                <span class="price-sep">—</span>
                <input
                    v-model="maxPriceInput"
                    @change="onFilterChange"
                    type="number"
                    min="0"
                    placeholder="Preço máx (R$)"
                    class="price-input"
                />
            </div>
        </div>

        <div class="section">
            <div v-if="loading" class="loading-state">Carregando inventário...</div>
            <div v-else>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Qtd</th>
                                <th>Bot</th>
                                <th>Asset ID</th>
                                <th>Preço</th>
                                <th>Tradable</th>
                                <th>Status</th>
                                <th>Criado em</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="item in items" :key="item.id" class="row-clickable" @click="router.push(`/inventory/${item.id}`)">
                                <td>
                                    <div class="item-cell">
                                        <img
                                            v-if="item.skins?.icon_url_large"
                                            :src="`https://steamcommunity-a.akamaihd.net/economy/image/${item.skins.icon_url_large}/62fx62f`"
                                            class="item-thumb"
                                            alt=""
                                        />
                                        <div v-else class="item-thumb-placeholder">
                                            <Icon icon="mdi:sword" />
                                        </div>
                                        <div>
                                            <span class="item-name">{{ item.skins?.name || '—' }}</span>
                                            <small class="item-hero">{{ item.skins?.hero || '' }}</small>
                                        </div>
                                    </div>
                                </td>
                                <td class="center qty">{{ item.skins?.item_count ?? '—' }}</td>
                                <td>{{ item.steam_bots?.name || '—' }}</td>
                                <td><code class="mono">{{ item.asset_id }}</code></td>
                                <td class="price">{{ formatCurrency(item.price) }}</td>
                                <td class="center">
                                    <Icon :icon="item.tradable ? 'mdi:check-circle' : 'mdi:close-circle'" :style="{ color: item.tradable ? '#4caf50' : '#f44336' }" />
                                </td>
                                <td>
                                    <span class="status-badge" :class="itemStatus(item).cls">
                                        {{ itemStatus(item).label }}
                                    </span>
                                </td>
                                <td>{{ $dayjs(item.created_at).format('DD/MM/YY') }}</td>
                            </tr>
                            <tr v-if="items.length === 0">
                                <td colspan="8" class="empty-state">Nenhum item encontrado.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="pagination" v-if="totalPages > 1">
                    <button class="page-btn" :disabled="currentPage === 1" @click="prevPage">Anterior</button>
                    <span class="page-info">Página {{ currentPage }} de {{ totalPages }}</span>
                    <button class="page-btn" :disabled="currentPage === totalPages" @click="nextPage">Próxima</button>
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
    flex-wrap wrap

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

.btn-sync
    display inline-flex
    align-items center
    gap 0.4rem
    background rgba(99,102,241,0.12)
    color #6366f1
    border 1px solid rgba(99,102,241,0.25)
    padding 0.5rem 1rem
    border-radius 8px
    font-size 0.875rem
    font-weight 500
    cursor pointer
    transition all 0.2s

    &:hover:not(:disabled)
        background rgba(99,102,241,0.22)

    &:disabled
        opacity 0.5
        cursor not-allowed

.btn-add
    display inline-flex
    align-items center
    gap 0.4rem
    background #6366f1
    color #fff
    text-decoration none
    padding 0.5rem 1rem
    border-radius 8px
    font-size 0.875rem
    font-weight 500
    transition all 0.2s

    &:hover
        background #4f52d4

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

.price-range
    display flex
    align-items center
    gap 0.4rem

.price-input
    width 130px
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.5rem 0.75rem
    font-size 0.875rem
    outline none

    &::placeholder
        color #64748b

    &:focus
        border-color rgba(99,102,241,0.4)

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button
        -webkit-appearance none

.price-sep
    color #64748b
    font-size 0.875rem

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.loading-state
    padding 3rem
    text-align center
    color #94a3b8

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

        &.center
            text-align center

        &.price
            font-weight 600
            color #4caf50

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
    display block
    font-weight 500
    font-size 0.85rem

.item-hero
    display block
    color #64748b
    font-size 0.73rem

.qty
    font-weight 600
    color #e2e8f0

.mono
    font-family monospace
    font-size 0.8rem
    color #94a3b8

.status-badge
    padding 3px 8px
    border-radius 5px
    font-size 0.72rem
    font-weight 600
    text-transform uppercase

.status-completed
    background rgba(76,175,80,0.1)
    color #4caf50

.status-pending
    background rgba(255,152,0,0.1)
    color #ff9800

.status-canceled
    background rgba(244,67,54,0.1)
    color #f44336

.empty-state
    text-align center
    padding 3rem
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
