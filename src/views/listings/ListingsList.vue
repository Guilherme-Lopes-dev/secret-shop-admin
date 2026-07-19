<script setup lang="ts">
import { ref, onMounted } from 'vue'
import dayjs from 'dayjs'
import { useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'

type StatusEvent = { from: string | null; to: string; at: string; by: string; error?: string }
type Listing = {
    uuid: string
    asset_id: string
    market_hash_name: string
    name: string | null
    icon_url: string | null
    price: number
    status: string
    last_error: string | null
    status_history: StatusEvent[]
    trade_offer_id: string | null
    created_at: string
    seller: { uuid: string; username: string | null; avatar: string | null; steam_id: string | null }
}

const route = useRoute()
const listings = ref<Listing[]>([])
const loading = ref(true)
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const limit = ref(20)

const sellerFilter = ref((route.query.seller as string) ?? '')
const statusFilter = ref('')
const statusOptions = [
    { value: '', label: 'Todos' },
    { value: 'active', label: 'Ativo' },
    { value: 'pending_delivery', label: 'Entrega pendente' },
    { value: 'sold', label: 'Vendido' },
    { value: 'cancelled', label: 'Cancelado' },
]

const expanded = ref<string | null>(null)
const deliverTarget = ref<Listing | null>(null)
const deliverTradelink = ref('')
const deliverSteamId = ref('')
const busy = ref<string | null>(null)

const fetchListings = async (page: number) => {
    loading.value = true
    try {
        const { data } = await adminService.getListings(page, limit.value, {
            seller: sellerFilter.value.trim() || undefined,
            status: statusFilter.value || undefined,
        })
        listings.value = data.data
        totalPages.value = data.pages
        totalItems.value = data.total
        currentPage.value = data.page
    } catch (error) {
        console.error('Erro ao buscar anúncios:', error)
    } finally {
        loading.value = false
    }
}

const applyFilters = () => fetchListings(1)
const nextPage = () => { if (currentPage.value < totalPages.value) fetchListings(currentPage.value + 1) }
const prevPage = () => { if (currentPage.value > 1) fetchListings(currentPage.value - 1) }

const toggleExpand = (uuid: string) => { expanded.value = expanded.value === uuid ? null : uuid }

const syncListing = async (listing: Listing) => {
    busy.value = listing.uuid
    try {
        await adminService.syncListing(listing.uuid)
        await fetchListings(currentPage.value)
    } catch (error) {
        console.error('Erro ao sincronizar:', error)
    } finally {
        busy.value = null
    }
}

const cancelListing = async (listing: Listing) => {
    if (!confirm(`Cancelar o anúncio "${listing.name || listing.market_hash_name}"?`)) return
    busy.value = listing.uuid
    try {
        await adminService.cancelListing(listing.uuid)
        await fetchListings(currentPage.value)
    } catch (error) {
        console.error('Erro ao cancelar:', error)
    } finally {
        busy.value = null
    }
}

const openDeliver = (listing: Listing) => {
    deliverTarget.value = listing
    deliverTradelink.value = ''
    deliverSteamId.value = ''
}
const closeDeliver = () => { deliverTarget.value = null }

const confirmDeliver = async () => {
    if (!deliverTarget.value) return
    busy.value = deliverTarget.value.uuid
    try {
        await adminService.deliverListing(deliverTarget.value.uuid, {
            tradelink: deliverTradelink.value.trim(),
            partnersteamid: deliverSteamId.value.trim(),
        })
        closeDeliver()
        await fetchListings(currentPage.value)
    } catch (error: any) {
        alert(error?.response?.data?.message ?? 'Falha ao disparar a entrega')
    } finally {
        busy.value = null
    }
}

const statusClass = (status: string) => {
    if (status === 'sold') return 'status-completed'
    if (status === 'active') return 'status-active'
    if (status === 'pending_delivery') return 'status-pending'
    return 'status-canceled'
}
const statusLabel = (status: string) =>
    statusOptions.find(o => o.value === status)?.label ?? status

const formatDate = (iso: string) => dayjs(iso).format('DD/MM/YYYY HH:mm')

onMounted(() => fetchListings(1))
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Marketplace P2P</h1>
                <p class="page-subtitle">{{ totalItems }} anúncios no sistema</p>
            </div>
        </header>

        <div class="section filters-section">
            <div class="filter-grid">
                <div class="filter-field">
                    <label>Vendedor</label>
                    <input
                        v-model="sellerFilter"
                        type="search"
                        placeholder="username, steam_id ou uuid"
                        @keyup.enter="applyFilters"
                        @blur="applyFilters"
                    />
                </div>
                <div class="filter-field">
                    <label>Status</label>
                    <select v-model="statusFilter" @change="applyFilters">
                        <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                    </select>
                </div>
            </div>
        </div>

        <div class="section">
            <div v-if="loading" class="loading-state">Carregando anúncios...</div>
            <div v-else>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th></th>
                                <th>Item</th>
                                <th>Vendedor</th>
                                <th>Preço</th>
                                <th>Status</th>
                                <th>Erro</th>
                                <th>Data</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            <template v-for="listing in listings" :key="listing.uuid">
                                <tr>
                                    <td>
                                        <button class="expand-btn" @click="toggleExpand(listing.uuid)">
                                            <Icon :icon="expanded === listing.uuid ? 'mdi:chevron-down' : 'mdi:chevron-right'" />
                                        </button>
                                    </td>
                                    <td>
                                        <div class="item-cell">
                                            <img v-if="listing.icon_url" :src="listing.icon_url" :alt="listing.name || ''" />
                                            <span>{{ listing.name || listing.market_hash_name }}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="user-cell">
                                            <span>{{ listing.seller.username || 'Desconhecido' }}</span>
                                            <small v-if="listing.seller.steam_id" class="muted">{{ listing.seller.steam_id }}</small>
                                        </div>
                                    </td>
                                    <td class="price">{{ formatCurrency(listing.price / 100) }}</td>
                                    <td>
                                        <span class="status-badge" :class="statusClass(listing.status)">
                                            {{ statusLabel(listing.status) }}
                                        </span>
                                    </td>
                                    <td>
                                        <span v-if="listing.last_error" class="error-cell" :title="listing.last_error">
                                            {{ listing.last_error }}
                                        </span>
                                        <span v-else class="muted">-</span>
                                    </td>
                                    <td>{{ formatDate(listing.created_at) }}</td>
                                    <td>
                                        <div class="actions">
                                            <button
                                                v-if="listing.status === 'active'"
                                                class="btn-mini deliver"
                                                :disabled="busy === listing.uuid"
                                                @click="openDeliver(listing)"
                                            >Entregar</button>
                                            <button
                                                v-if="listing.status === 'pending_delivery'"
                                                class="btn-mini"
                                                :disabled="busy === listing.uuid"
                                                @click="syncListing(listing)"
                                            >Sync</button>
                                            <button
                                                v-if="['active', 'pending_delivery'].includes(listing.status)"
                                                class="btn-mini danger"
                                                :disabled="busy === listing.uuid"
                                                @click="cancelListing(listing)"
                                            >Cancelar</button>
                                        </div>
                                    </td>
                                </tr>
                                <tr v-if="expanded === listing.uuid" class="detail-row">
                                    <td colspan="8">
                                        <div class="detail">
                                            <div class="detail-meta">
                                                <span><strong>Asset:</strong> {{ listing.asset_id }}</span>
                                                <span v-if="listing.trade_offer_id"><strong>Trade:</strong> {{ listing.trade_offer_id }}</span>
                                                <span><strong>Anúncio:</strong> {{ listing.uuid }}</span>
                                            </div>
                                            <h4>Histórico de status</h4>
                                            <ol class="history">
                                                <li v-for="(ev, i) in listing.status_history" :key="i">
                                                    <span class="hist-time">{{ formatDate(ev.at) }}</span>
                                                    <span class="hist-transition">{{ ev.from ?? '∅' }} → {{ ev.to }}</span>
                                                    <span class="hist-by">{{ ev.by }}</span>
                                                    <span v-if="ev.error" class="hist-error">{{ ev.error }}</span>
                                                </li>
                                                <li v-if="!listing.status_history?.length" class="muted">Sem histórico.</li>
                                            </ol>
                                        </div>
                                    </td>
                                </tr>
                            </template>
                            <tr v-if="listings.length === 0">
                                <td colspan="8" class="empty-state">Nenhum anúncio encontrado.</td>
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

        <div v-if="deliverTarget" class="modal-overlay" @click.self="closeDeliver">
            <div class="modal">
                <h3>Disparar entrega (teste)</h3>
                <p class="modal-item">{{ deliverTarget.name || deliverTarget.market_hash_name }}</p>
                <label>Trade link do comprador</label>
                <input v-model="deliverTradelink" placeholder="https://steamcommunity.com/tradeoffer/new/?partner=...&token=..." />
                <label>SteamID64 do comprador</label>
                <input v-model="deliverSteamId" placeholder="7656..." />
                <div class="modal-actions">
                    <button class="btn-ghost" @click="closeDeliver">Cancelar</button>
                    <button class="btn-primary" :disabled="busy === deliverTarget.uuid" @click="confirmDeliver">
                        Disparar
                    </button>
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
    margin-bottom 2rem

    .page-title
        font-size 1.5rem
        font-weight 700

    .page-subtitle
        color #64748b
        font-size 0.85rem
        margin-top 0.25rem

.section
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.07)
    border-radius 12px
    padding 1.25rem
    margin-bottom 1.25rem

.filter-grid
    display flex
    gap 1rem
    flex-wrap wrap

.filter-field
    display flex
    flex-direction column
    gap 0.3rem

    label
        font-size 0.75rem
        color #64748b

    input, select
        background #121214
        border 1px solid rgba(255,255,255,0.1)
        border-radius 8px
        color #fff
        padding 0.5rem 0.75rem
        font-size 0.85rem
        outline none
        min-width 240px

        &:focus
            border-color #6366f1

.loading-state, .empty-state
    text-align center
    color #64748b
    padding 2rem

.table-wrapper
    overflow-x auto

table
    width 100%
    border-collapse collapse
    font-size 0.85rem

    th
        text-align left
        padding 0.6rem 0.75rem
        color #94a3b8
        font-weight 600
        border-bottom 1px solid rgba(255,255,255,0.08)
        white-space nowrap

    td
        padding 0.6rem 0.75rem
        border-bottom 1px solid rgba(255,255,255,0.04)
        vertical-align middle

.expand-btn
    background transparent
    border none
    color #64748b
    cursor pointer
    font-size 1.1rem
    display inline-flex

.item-cell
    display flex
    align-items center
    gap 0.5rem

    img
        width 32px
        height 32px
        object-fit contain

.user-cell
    display flex
    flex-direction column

    .muted
        font-size 0.72rem

.muted
    color #64748b

.price
    font-weight 700
    color #34d399

.status-badge
    padding 0.2rem 0.6rem
    border-radius 999px
    font-size 0.72rem
    font-weight 600
    white-space nowrap

.status-completed
    background rgba(99,102,241,0.15)
    color #a5b4fc

.status-active
    background rgba(52,211,153,0.15)
    color #34d399

.status-pending
    background rgba(245,158,11,0.15)
    color #fbbf24

.status-canceled
    background rgba(239,68,68,0.15)
    color #f87171

.error-cell
    color #f87171
    font-size 0.78rem
    display inline-block
    max-width 220px
    white-space nowrap
    overflow hidden
    text-overflow ellipsis

.actions
    display flex
    gap 0.35rem

.btn-mini
    background rgba(255,255,255,0.06)
    border 1px solid rgba(255,255,255,0.12)
    color #cbd5e1
    padding 0.3rem 0.6rem
    border-radius 6px
    font-size 0.75rem
    cursor pointer

    &:hover:not(:disabled)
        background rgba(255,255,255,0.12)

    &.deliver
        border-color rgba(99,102,241,0.4)
        color #a5b4fc

    &.danger
        border-color rgba(239,68,68,0.3)
        color #f87171

    &:disabled
        opacity 0.5
        cursor not-allowed

.detail-row td
    background #141417

.detail
    padding 0.5rem 0.25rem

    h4
        font-size 0.85rem
        margin 0.5rem 0
        color #cbd5e1

.detail-meta
    display flex
    gap 1.25rem
    flex-wrap wrap
    font-size 0.78rem
    color #94a3b8

.history
    list-style none
    padding 0
    margin 0
    display flex
    flex-direction column
    gap 0.35rem

    li
        display flex
        gap 0.75rem
        align-items center
        font-size 0.78rem
        flex-wrap wrap

.hist-time
    color #64748b
    min-width 130px

.hist-transition
    color #e2e8f0
    font-weight 600

.hist-by
    color #94a3b8
    text-transform uppercase
    font-size 0.68rem

.hist-error
    color #f87171

.pagination
    display flex
    align-items center
    justify-content center
    gap 1rem
    margin-top 1.25rem

.page-btn
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.1)
    color #fff
    padding 0.4rem 1rem
    border-radius 8px
    cursor pointer

    &:disabled
        opacity 0.4
        cursor not-allowed

.page-info
    color #94a3b8
    font-size 0.85rem

.modal-overlay
    position fixed
    inset 0
    background rgba(0,0,0,0.6)
    display flex
    align-items center
    justify-content center
    z-index 50

.modal
    background #17171b
    border 1px solid rgba(255,255,255,0.1)
    border-radius 14px
    padding 1.5rem
    width 100%
    max-width 440px
    display flex
    flex-direction column
    gap 0.5rem

    h3
        font-size 1.1rem
        font-weight 700

    label
        font-size 0.78rem
        color #64748b
        margin-top 0.4rem

    input
        background #0e0e10
        border 1px solid rgba(255,255,255,0.1)
        border-radius 8px
        padding 0.6rem 0.85rem
        color #fff
        font-size 0.85rem
        outline none

        &:focus
            border-color #6366f1

.modal-item
    color #94a3b8
    font-size 0.85rem

.modal-actions
    display flex
    justify-content flex-end
    gap 0.6rem
    margin-top 0.75rem

.btn-ghost
    background transparent
    border 1px solid rgba(255,255,255,0.15)
    color #cbd5e1
    padding 0.55rem 1rem
    border-radius 8px
    font-size 0.85rem
    cursor pointer

.btn-primary
    background #6366f1
    border none
    color #fff
    padding 0.55rem 1.1rem
    border-radius 8px
    font-size 0.85rem
    font-weight 600
    cursor pointer

    &:disabled
        opacity 0.6
        cursor not-allowed
</style>
