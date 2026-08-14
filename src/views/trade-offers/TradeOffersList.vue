<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
    adminService,
    type TradeOfferRow,
    type TradeOfferType,
} from '@/services/admin/admin.service'
import { typeBadge, typeOptions } from './tradeOfferType'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'

const router = useRouter()
const route = useRoute()

const offers = ref<TradeOfferRow[]>([])
const loading = ref(true)
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const limit = ref(20)
const statusFilter = ref((route.query.status as string) ?? '')
const typeFilter = ref((route.query.type as string) ?? '')
const saleSearch = ref((route.query.search as string) ?? '')
const retrySaleUuid = ref<string | null>(null)


const statusOptions = [
    { label: 'Todos', value: '' },
    { label: 'Aguardando aceite', value: 'AWAITING' },
    { label: 'Enviado', value: 'SENT' },
    { label: 'Aceito', value: 'ACCEPTED' },
    { label: 'Recusado', value: 'DECLINED' },
    { label: 'Cancelado', value: 'CANCELED' },
    { label: 'Pendente', value: 'PENDING' },
    { label: 'Falha', value: 'FAILED' },
]

const fetchOffers = async (page: number) => {
    loading.value = true
    try {
        const response = await adminService.getTradeOffers({
            page,
            limit: limit.value,
            status: statusFilter.value || undefined,
            type: (typeFilter.value || undefined) as TradeOfferType | undefined,
            search: saleSearch.value.trim() || undefined,
        })
        if (response.data) {
            offers.value = response.data.data
            totalPages.value = response.data.pages
            totalItems.value = response.data.total
            currentPage.value = response.data.page
        }
    } catch (error) {
        console.error('Erro ao buscar trade offers:', error)
    } finally {
        loading.value = false
    }
}

const onFilterChange = () => {
    const query: Record<string, string> = {}
    if (statusFilter.value) query.status = statusFilter.value
    if (typeFilter.value) query.type = typeFilter.value
    if (saleSearch.value.trim()) query.search = saleSearch.value.trim()

    router.replace({ query })
    fetchOffers(1)
}

// a busca agora roda no banco: sem debounce seria uma request por tecla
let searchTimer: ReturnType<typeof setTimeout>
watch(saleSearch, () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(onFilterChange, 400)
})
const nextPage = () => { if (currentPage.value < totalPages.value) fetchOffers(currentPage.value + 1) }
const prevPage = () => { if (currentPage.value > 1) fetchOffers(currentPage.value - 1) }

const retrySale = async (saleUuid: string) => {
    if (!saleUuid) return
    retrySaleUuid.value = saleUuid
    try {
        await adminService.retrySaleTrade(saleUuid)
        toast.success('Trade reenfileirado com sucesso!')
        fetchOffers(currentPage.value)
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao reenviar trade.')
    } finally {
        retrySaleUuid.value = null
    }
}

const syncOffer = async (tradeOfferId: string) => {
    try {
        await adminService.syncTradeOffer(tradeOfferId)
        toast.success('Sincronizado!')
        fetchOffers(currentPage.value)
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao sincronizar.')
    }
}

const getStatusClass = (status: string | null | undefined) => {
    if (!status) return ''
    const s = status.toUpperCase()
    if (['ACCEPTED', 'COMPLETED'].includes(s)) return 'status-completed'
    if (['SENT', 'ACTIVE', 'PENDING'].includes(s)) return 'status-pending'
    return 'status-canceled'
}

onMounted(() => fetchOffers(1))
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Trade Offers</h1>
                <p class="page-subtitle">{{ totalItems }} ofertas no sistema</p>
            </div>
            <div class="filters-row">
                <input
                    v-model="saleSearch"
                    type="search"
                    class="filter-input"
                    placeholder="Buscar por pedido ou Trade ID..."
                />
                <select v-model="typeFilter" @change="onFilterChange" class="filter-select">
                    <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
                <select v-model="statusFilter" @change="onFilterChange" class="filter-select">
                    <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
            </div>
        </header>

        <div class="section">
            <div v-if="loading" class="loading-state">Carregando trade offers...</div>
            <div v-else>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Trade ID (Steam)</th>
                                <th>Tipo</th>
                                <th>Pedido</th>
                                <th>Bot</th>
                                <th>Steam User</th>
                                <th>Status</th>
                                <th>Tentativas</th>
                                <th>Enviado em</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="offer in offers" :key="offer.id" class="clickable-row" @click="router.push(`/trade-offers/${offer.id}`)">
                                <td><code class="mono">{{ offer.trade_offer_id || '—' }}</code></td>
                                <td>
                                    <span class="type-badge" :class="typeBadge(offer.type).className">
                                        {{ typeBadge(offer.type).label }}
                                    </span>
                                </td>
                                <td>
                                    <router-link
                                        v-if="offer.sales"
                                        :to="`/sales/${offer.sales.id}`"
                                        class="order-link"
                                    >
                                        {{ offer.sales.order_number }}
                                    </router-link>
                                    <span v-else class="muted">—</span>
                                </td>
                                <td>{{ offer.steam_bots?.name || '—' }}</td>
                                <td><code class="mono">{{ offer.user_steam_id || '—' }}</code></td>
                                <td>
                                    <span class="status-badge" :class="getStatusClass(offer.offer_status || offer.status)">
                                        {{ offer.offer_status || offer.status || '—' }}
                                    </span>
                                </td>
                                <td class="center">{{ offer.attempt_count ?? 0 }}</td>
                                <td>{{ offer.sent_at ? $dayjs(offer.sent_at).format('DD/MM/YY HH:mm') : '—' }}</td>
                                <td>
                                    <div class="action-group">
                                        <button
                                            v-if="offer.sales?.id"
                                            class="btn-action btn-retry"
                                            :disabled="retrySaleUuid === offer.sales.id"
                                            @click.stop="retrySale(offer.sales.id)"
                                            title="Reenviar trade"
                                        >
                                            <Icon icon="mdi:refresh" />
                                        </button>
                                        <button
                                            v-if="offer.trade_offer_id"
                                            class="btn-action btn-sync"
                                            @click.stop="syncOffer(offer.trade_offer_id)"
                                            title="Sincronizar status"
                                        >
                                            <Icon icon="mdi:cloud-sync-outline" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            <tr v-if="offers.length === 0">
                                <td colspan="9" class="empty-state">Nenhuma trade offer encontrada.</td>
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

.filters-row
    display flex
    gap 0.75rem
    align-items center
    flex-wrap wrap

.filter-input
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.5rem 0.75rem
    font-size 0.875rem
    outline none
    min-width 220px

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

.mono
    font-family monospace
    font-size 0.8rem
    color #94a3b8

.muted
    color #64748b

.order-link
    color #6366f1
    text-decoration none
    font-weight 500

    &:hover
        text-decoration underline

.type-badge
    padding 3px 8px
    border-radius 5px
    font-size 0.72rem
    font-weight 600
    background rgba(148,163,184,0.12)
    color #94a3b8

.type-gift
    background rgba(236,72,153,0.12)
    color #ec4899

.type-swap
    background rgba(14,165,233,0.12)
    color #0ea5e9

.type-purchase
    background rgba(99,102,241,0.12)
    color #6366f1

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

.action-group
    display flex
    gap 0.4rem

.btn-action
    background transparent
    border none
    border-radius 6px
    cursor pointer
    padding 0.35rem
    font-size 1rem
    display flex
    align-items center
    transition all 0.15s

    &:disabled
        opacity 0.4
        cursor not-allowed

.btn-retry
    color #ff9800

    &:hover:not(:disabled)
        background rgba(255,152,0,0.1)

.btn-sync
    color #6366f1

    &:hover
        background rgba(99,102,241,0.1)

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
