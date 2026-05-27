<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { toast } from 'vue3-toastify'
import { Icon } from '@iconify/vue'

const router = useRouter()

const sales       = ref<any[]>([])
const loading     = ref(true)
const currentPage = ref(1)
const totalPages  = ref(1)
const totalItems  = ref(0)
const limit       = ref(20)

const search         = ref('')
const filterPayment  = ref('')
const filterDelivery = ref('')
let   searchTimer: ReturnType<typeof setTimeout> | null = null

const fetchSales = async (page: number) => {
    loading.value = true
    try {
        const res = await adminService.getCollectorSales({
            page,
            limit:           limit.value,
            payment_status:  filterPayment.value  || undefined,
            delivery_status: filterDelivery.value || undefined,
            search:          search.value         || undefined,
        })
        if (res.data) {
            sales.value       = res.data.data
            totalItems.value  = res.data.total
            currentPage.value = res.data.page
            totalPages.value  = Math.ceil(res.data.total / limit.value) || 1
        }
    } catch {
        toast.error('Erro ao carregar pedidos collector.')
    } finally {
        loading.value = false
    }
}

const onSearchInput = () => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => fetchSales(1), 400)
}

const onFilterChange = () => fetchSales(1)
const nextPage = () => { if (currentPage.value < totalPages.value) fetchSales(currentPage.value + 1) }
const prevPage = () => { if (currentPage.value > 1) fetchSales(currentPage.value - 1) }

const goToDetail = (uuid: string) => router.push(`/collector-orders/${uuid}`)

const line      = (s: any) => s.collector_sales?.[0] ?? null
const itemName  = (s: any) => line(s)?.snapshot_data?.name ?? line(s)?.collectors?.name ?? '-'
const itemImage = (s: any) => line(s)?.snapshot_data?.icon_url_large ?? line(s)?.collectors?.icon_url_large ?? null

const paymentBadgeClass = (s: string) => ({
    PENDING:          'badge-pending',
    AWAITING_PAYMENT: 'badge-awaiting',
    PAID:             'badge-paid',
    EXPIRED:          'badge-expired',
    CANCELLED:        'badge-cancelled',
    REFUNDED:         'badge-refunded',
}[s] ?? 'badge-pending')

const paymentLabel = (s: string) => ({
    PENDING:          'Pendente',
    AWAITING_PAYMENT: 'Aguardando',
    PAID:             'Pago',
    EXPIRED:          'Expirado',
    CANCELLED:        'Cancelado',
    REFUNDED:         'Reembolsado',
}[s] ?? s)

const deliveryBadgeClass = (s: string | null) => ({
    AWAITING_SHIPPING: 'badge-awaiting',
    SHIPPED:           'badge-shipped',
    DELIVERED:         'badge-delivered',
}[s ?? ''] ?? '')

const deliveryLabel = (s: string | null) => ({
    AWAITING_SHIPPING: 'Aguard. Envio',
    SHIPPED:           'Enviado',
    DELIVERED:         'Entregue',
}[s ?? ''] ?? '-')

const paymentMethodLabel = (m: string | null) =>
    ({ PIX: 'PIX', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão' }[m ?? ''] ?? m ?? '-')

onMounted(() => fetchSales(1))
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">
                    <Icon icon="mdi:trophy-outline" class="title-icon" />
                    Pedidos Collector
                </h1>
                <p class="page-subtitle">
                    {{ totalItems }} pedido{{ totalItems !== 1 ? 's' : '' }} encontrado{{ totalItems !== 1 ? 's' : '' }}
                </p>
            </div>
        </header>

        <div class="filters-bar">
            <div class="search-wrap">
                <Icon icon="mdi:magnify" class="search-icon" />
                <input
                    v-model="search"
                    class="search-input"
                    placeholder="Buscar por nº pedido ou item..."
                    @input="onSearchInput"
                />
            </div>
            <select v-model="filterPayment" class="filter-select" @change="onFilterChange">
                <option value="">Todos pagamentos</option>
                <option value="PENDING">Pendente</option>
                <option value="AWAITING_PAYMENT">Aguardando</option>
                <option value="PAID">Pago</option>
                <option value="EXPIRED">Expirado</option>
                <option value="CANCELLED">Cancelado</option>
                <option value="REFUNDED">Reembolsado</option>
            </select>
            <select v-model="filterDelivery" class="filter-select" @change="onFilterChange">
                <option value="">Todas entregas</option>
                <option value="AWAITING_SHIPPING">Aguard. Envio</option>
                <option value="SHIPPED">Enviado</option>
                <option value="DELIVERED">Entregue</option>
            </select>
        </div>

        <div class="section">
            <div v-if="loading" class="loading-state">
                <Icon icon="mdi:loading" class="spin" />
                Carregando pedidos collector...
            </div>

            <template v-else>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Pedido</th>
                                <th>Item</th>
                                <th>Cliente</th>
                                <th>Qtd × Preço</th>
                                <th>Total</th>
                                <th>Pagamento</th>
                                <th>Entrega</th>
                                <th>Método</th>
                                <th>Data</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="sale in sales"
                                :key="sale.uuid"
                                class="row-main"
                                @click="goToDetail(sale.id)"
                            >
                                <td>
                                    <span class="order-number">{{ sale.order_number }}</span>
                                </td>
                                <td>
                                    <div class="item-cell">
                                        <img
                                            v-if="itemImage(sale)"
                                            :src="itemImage(sale)!"
                                            class="item-thumb"
                                            :alt="itemName(sale)"
                                        />
                                        <div v-else class="item-thumb-placeholder">
                                            <Icon icon="mdi:trophy-outline" />
                                        </div>
                                        <span class="item-name">{{ itemName(sale) }}</span>
                                    </div>
                                </td>
                                <td>
                                    <div class="customer-cell">
                                        <span class="customer-name">{{ sale.users?.username ?? '-' }}</span>
                                        <span class="customer-email">{{ sale.users?.email ?? '-' }}</span>
                                    </div>
                                </td>
                                <td class="qty-cell">{{ line(sale)?.quantity ?? '-' }} × {{ line(sale) ? formatCurrency(line(sale).unit_price) : '-' }}</td>
                                <td class="price-col">{{ line(sale) ? formatCurrency(line(sale).total_price) : '-' }}</td>
                                <td>
                                    <span class="status-badge" :class="paymentBadgeClass(sale.payment_status)">
                                        {{ paymentLabel(sale.payment_status) }}
                                    </span>
                                </td>
                                <td>
                                    <span v-if="line(sale)?.delivery_status" class="status-badge" :class="deliveryBadgeClass(line(sale)?.delivery_status ?? null)">
                                        {{ deliveryLabel(line(sale)?.delivery_status ?? null) }}
                                    </span>
                                    <span v-else class="muted">-</span>
                                </td>
                                <td class="muted">{{ paymentMethodLabel(sale.payment_method) }}</td>
                                <td class="date-col">{{ $dayjs(sale.created_at).format('DD/MM/YY HH:mm') }}</td>
                            </tr>

                            <tr v-if="sales.length === 0">
                                <td colspan="9" class="empty-state">
                                    <Icon icon="mdi:trophy-outline" class="empty-icon" />
                                    <p>Nenhum pedido collector encontrado.</p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="pagination" v-if="totalPages > 1">
                    <button class="page-btn" :disabled="currentPage === 1" @click="prevPage">Anterior</button>
                    <span class="page-info">Página {{ currentPage }} de {{ totalPages }}</span>
                    <button class="page-btn" :disabled="currentPage === totalPages" @click="nextPage">Próxima</button>
                </div>
            </template>
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
    margin-bottom 1.5rem

.page-title
    font-size 1.8rem
    font-weight 700
    margin-bottom 0.25rem
    display flex
    align-items center
    gap 0.5rem

.title-icon
    color #f59e0b
    font-size 1.6rem

.page-subtitle
    color #94a3b8
    font-size 0.9rem

.filters-bar
    display flex
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
    background #1e1e24
    border 1px solid rgba(255,255,255,0.08)
    color #e2e8f0
    font-size 0.875rem
    padding 0.5rem 0.75rem 0.5rem 2rem
    border-radius 8px
    outline none
    box-sizing border-box

    &::placeholder
        color #4a5568

    &:focus
        border-color rgba(99,102,241,0.4)

.filter-select
    background #1e1e24
    border 1px solid rgba(255,255,255,0.08)
    color #e2e8f0
    font-size 0.875rem
    padding 0.5rem 0.75rem
    border-radius 8px
    outline none
    cursor pointer

    &:focus
        border-color rgba(99,102,241,0.4)

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.loading-state
    padding 3rem
    text-align center
    color #94a3b8
    display flex
    align-items center
    justify-content center
    gap 0.5rem

.spin
    animation spin 1s linear infinite

@keyframes spin
    from transform rotate(0deg)
    to transform rotate(360deg)

.table-wrapper
    overflow-x auto
    margin-bottom 1.5rem

table
    width 100%
    border-collapse collapse

    th
        text-align left
        color #94a3b8
        font-size 0.75rem
        font-weight 500
        padding 0.6rem 0.75rem
        border-bottom 1px solid rgba(255,255,255,0.06)
        white-space nowrap
        text-transform uppercase

    td
        padding 0.75rem
        font-size 0.875rem
        border-bottom 1px solid rgba(255,255,255,0.04)
        vertical-align middle

.row-main
    cursor pointer
    transition background 0.15s

    &:hover td
        background rgba(255,255,255,0.025)

.order-number
    font-family monospace
    font-size 0.85rem
    color #a5b4fc

.item-cell
    display flex
    align-items center
    gap 0.6rem
    max-width 240px

.item-thumb
    width 36px
    height 36px
    object-fit contain
    border-radius 4px
    background rgba(255,255,255,0.04)
    flex-shrink 0

.item-thumb-placeholder
    width 36px
    height 36px
    border-radius 4px
    background rgba(255,255,255,0.06)
    display flex
    align-items center
    justify-content center
    color #64748b
    flex-shrink 0

.item-name
    white-space nowrap
    overflow hidden
    text-overflow ellipsis
    max-width 180px
    font-size 0.85rem
    color #e2e8f0

.customer-cell
    display flex
    flex-direction column
    gap 0.15rem

.customer-name
    color #cbd5e1
    font-size 0.85rem

.customer-email
    color #64748b
    font-size 0.78rem

.qty-cell
    color #94a3b8
    white-space nowrap

.price-col
    font-weight 600
    color #4caf50
    white-space nowrap

.date-col
    color #64748b
    font-size 0.82rem
    white-space nowrap

.muted
    color #64748b

.status-badge
    display inline-flex
    align-items center
    padding 0.2rem 0.55rem
    border-radius 999px
    font-size 0.72rem
    font-weight 600
    text-transform uppercase
    letter-spacing 0.03em
    white-space nowrap

.badge-pending
    background rgba(148,163,184,0.12)
    color #94a3b8
    border 1px solid rgba(148,163,184,0.25)

.badge-awaiting
    background rgba(245,158,11,0.12)
    color #f59e0b
    border 1px solid rgba(245,158,11,0.25)

.badge-paid
    background rgba(76,175,80,0.12)
    color #4caf50
    border 1px solid rgba(76,175,80,0.25)

.badge-expired
    background rgba(100,116,139,0.12)
    color #64748b
    border 1px solid rgba(100,116,139,0.25)

.badge-cancelled
    background rgba(239,68,68,0.1)
    color #ef4444
    border 1px solid rgba(239,68,68,0.2)

.badge-refunded
    background rgba(139,92,246,0.12)
    color #8b5cf6
    border 1px solid rgba(139,92,246,0.25)

.badge-shipped
    background rgba(59,130,246,0.12)
    color #3b82f6
    border 1px solid rgba(59,130,246,0.25)

.badge-delivered
    background rgba(34,197,94,0.12)
    color #22c55e
    border 1px solid rgba(34,197,94,0.25)

.empty-state
    text-align center
    padding 4rem
    color #64748b

    .empty-icon
        font-size 2.5rem
        margin-bottom 0.75rem
        display block
        margin-left auto
        margin-right auto

    p
        margin 0

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
    font-size 0.85rem
</style>
