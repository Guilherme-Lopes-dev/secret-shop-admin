<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { adminService } from '@/services/admin/admin.service'
import type {
    DropshipNotificationDto,
    DropshipNotificationItem,
} from '@/services/admin/types'
import { formatCurrency } from '@/utils/formatCurrency'

interface ShippingRow {
    key: string
    notification: DropshipNotificationDto
    item: DropshipNotificationItem
}

const router = useRouter()
const notifications = ref<DropshipNotificationDto[]>([])
const loading = ref(true)
const resolvingId = ref<string | null>(null)
const currentPage = ref(1)
const totalPages = ref(1)
const totalOrders = ref(0)
const pendingCount = ref(0)
const limit = 20
const search = ref('')
const queueFilter = ref<'pending' | 'all'>('pending')

const rows = computed<ShippingRow[]>(() => {
    const query = search.value.trim().toLowerCase()

    return notifications.value.flatMap((notification) => {
        const metadata = notification.metadata
        const items = Array.isArray(metadata?.items) ? metadata.items : []

        return items
            .filter((item) => {
                if (!query) return true
                return [
                    item.name,
                    metadata?.orderNumber,
                    metadata?.userName,
                    metadata?.email,
                    metadata?.steamId,
                ].some(value => String(value ?? '').toLowerCase().includes(query))
            })
            .map((item, index) => ({
                key: `${notification.id}-${index}`,
                notification,
                item,
            }))
    })
})

const currentItemCount = computed(() =>
    notifications.value.reduce(
        (total, notification) => total + (notification.metadata?.items?.length ?? 0),
        0,
    ),
)

const fetchQueue = async (page = 1) => {
    loading.value = true
    try {
        const onlyUnread = queueFilter.value === 'pending'
        const [queueResponse, countResponse] = await Promise.all([
            adminService.getDropshipNotifications(page, limit, onlyUnread),
            adminService.getDropshipUnreadCount(),
        ])

        // Página esvaziou (ex.: último item resolvido)? Recua uma.
        if (!queueResponse.data.data.length && page > 1) return fetchQueue(page - 1)

        notifications.value = queueResponse.data.data
        totalOrders.value = queueResponse.data.total
        currentPage.value = queueResponse.data.page
        totalPages.value = Math.max(1, Math.ceil(queueResponse.data.total / limit))
        pendingCount.value = countResponse.data.count
    } catch (error) {
        console.error('Erro ao carregar fila dropship:', error)
        toast.error('Erro ao carregar os envios dropship.')
    } finally {
        loading.value = false
    }
}

const openDetail = (notification: DropshipNotificationDto) => {
    const saleUuid = notification.metadata?.saleUuid
    if (!saleUuid) {
        toast.error('Este alerta não possui uma venda vinculada.')
        return
    }

    router.push({
        name: 'dropship-order-detail',
        params: { uuid: saleUuid },
        query: { notification: notification.id },
        // JSON round-trip: history state não aceita proxy reativo.
        state: { dropshipNotification: JSON.parse(JSON.stringify(notification)) },
    })
}

const markResolved = async (notification: DropshipNotificationDto) => {
    resolvingId.value = notification.id
    try {
        await adminService.markDropshipNotificationRead(notification.id)
        toast.success(`Pedido ${notification.metadata?.orderNumber ?? ''} removido da fila.`)
        await fetchQueue(currentPage.value)
    } catch (error) {
        console.error('Erro ao resolver alerta dropship:', error)
        toast.error('Não foi possível marcar o envio como resolvido.')
    } finally {
        resolvingId.value = null
    }
}

const onFilterChange = () => fetchQueue(1)
const previousPage = () => {
    if (currentPage.value > 1) void fetchQueue(currentPage.value - 1)
}
const nextPage = () => {
    if (currentPage.value < totalPages.value) void fetchQueue(currentPage.value + 1)
}

onMounted(() => fetchQueue())
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div class="title-row">
                <span class="title-icon">
                    <Icon icon="mdi:package-variant-closed" />
                </span>
                <div>
                    <h1 class="page-title">Envios Dropship</h1>
                    <p class="page-subtitle">
                        Produtos pagos que precisam de compra e entrega manual pela Steam
                    </p>
                </div>
            </div>

            <div class="header-metrics">
                <div class="metric-card metric-card--warning">
                    <span class="metric-label">Pendentes</span>
                    <strong>{{ pendingCount }}</strong>
                </div>
                <div class="metric-card">
                    <span class="metric-label">Itens nesta página</span>
                    <strong>{{ currentItemCount }}</strong>
                </div>
            </div>
        </header>

        <section class="operation-note">
            <Icon icon="mdi:information-outline" />
            <p>
                Abra o item no Steam Market, compre a skin e envie pelo trade link do cliente.
                Ao concluir a operação, marque o pedido como resolvido.
            </p>
        </section>

        <div class="filters-bar">
            <div class="search-wrap">
                <Icon icon="mdi:magnify" class="search-icon" />
                <input
                    v-model="search"
                    type="search"
                    class="search-input"
                    placeholder="Filtrar nesta página por produto, pedido, cliente ou Steam ID..."
                />
            </div>

            <select v-model="queueFilter" class="filter-select" @change="onFilterChange">
                <option value="pending">Pendentes de envio</option>
                <option value="all">Todos os registros</option>
            </select>

            <button class="refresh-btn" :disabled="loading" @click="fetchQueue(currentPage)">
                <Icon :icon="loading ? 'mdi:loading' : 'mdi:refresh'" :class="{ spin: loading }" />
                Atualizar
            </button>
        </div>

        <section class="section">
            <div v-if="loading" class="loading-state">
                <Icon icon="mdi:loading" class="spin" />
                Carregando fila de envios...
            </div>

            <template v-else>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Produto</th>
                                <th>Pedido</th>
                                <th>Cliente</th>
                                <th>Qtd.</th>
                                <th>Valor</th>
                                <th>Recebido em</th>
                                <th>Status</th>
                                <th class="actions-heading">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="row in rows"
                                :key="row.key"
                                class="product-row"
                                @click="openDetail(row.notification)"
                            >
                                <td>
                                    <div class="product-cell">
                                        <span class="product-thumb">
                                            <Icon icon="mdi:sword-cross" />
                                        </span>
                                        <div class="product-copy">
                                            <strong :title="row.item.name">{{ row.item.name }}</strong>
                                            <a
                                                v-if="row.item.steamMarketUrl"
                                                :href="row.item.steamMarketUrl"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                @click.stop
                                            >
                                                <Icon icon="mdi:steam" />
                                                Abrir no Market
                                            </a>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <code class="order-number">{{ row.notification.metadata.orderNumber }}</code>
                                </td>
                                <td>
                                    <div class="customer-cell">
                                        <strong>{{ row.notification.metadata.userName || 'Cliente' }}</strong>
                                        <span>{{ row.notification.metadata.email || 'Sem e-mail' }}</span>
                                    </div>
                                </td>
                                <td>{{ row.item.quantity }}x</td>
                                <td class="price">{{ formatCurrency(row.item.unitPrice) }}</td>
                                <td class="date-cell">
                                    {{ $dayjs(row.notification.created_at).format('DD/MM/YY HH:mm') }}
                                </td>
                                <td>
                                    <span
                                        class="status-badge"
                                        :class="row.notification.is_read ? 'status-resolved' : 'status-pending'"
                                    >
                                        <span class="status-dot"></span>
                                        {{ row.notification.is_read ? 'Resolvido' : 'Pendente' }}
                                    </span>
                                </td>
                                <td>
                                    <div class="row-actions">
                                        <button
                                            class="icon-btn"
                                            title="Ver todos os dados"
                                            @click.stop="openDetail(row.notification)"
                                        >
                                            <Icon icon="mdi:arrow-right" />
                                        </button>
                                        <button
                                            v-if="!row.notification.is_read"
                                            class="resolve-btn"
                                            :disabled="resolvingId === row.notification.id"
                                            @click.stop="markResolved(row.notification)"
                                        >
                                            <Icon
                                                :icon="resolvingId === row.notification.id
                                                    ? 'mdi:loading'
                                                    : 'mdi:check'"
                                                :class="{ spin: resolvingId === row.notification.id }"
                                            />
                                            Resolver
                                        </button>
                                    </div>
                                </td>
                            </tr>

                            <tr v-if="rows.length === 0">
                                <td colspan="8">
                                    <div class="empty-state">
                                        <span class="empty-icon">
                                            <Icon icon="mdi:package-check" />
                                        </span>
                                        <strong>
                                            {{ search ? 'Nenhum produto encontrado' : 'Fila de envios em dia' }}
                                        </strong>
                                        <p>
                                            {{ search
                                                ? 'Tente ajustar o termo da busca.'
                                                : 'Não há produtos dropship aguardando envio.' }}
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <footer v-if="totalPages > 1" class="pagination">
                    <span>
                        {{ totalOrders }} pedido{{ totalOrders === 1 ? '' : 's' }} ·
                        página {{ currentPage }} de {{ totalPages }}
                    </span>
                    <div class="pagination-actions">
                        <button :disabled="currentPage === 1" @click="previousPage">
                            <Icon icon="mdi:chevron-left" />
                            Anterior
                        </button>
                        <button :disabled="currentPage === totalPages" @click="nextPage">
                            Próxima
                            <Icon icon="mdi:chevron-right" />
                        </button>
                    </div>
                </footer>
            </template>
        </section>
    </div>
</template>

<style lang="stylus" scoped>
.view-wrap
    min-height 100vh
    padding 2rem
    background #121214
    color #f8fafc

.page-header
    display flex
    align-items center
    justify-content space-between
    gap 1.5rem
    margin-bottom 1.25rem
    flex-wrap wrap

.title-row
    display flex
    align-items center
    gap 0.9rem

.title-icon
    width 46px
    height 46px
    display grid
    place-items center
    border-radius 13px
    font-size 1.5rem
    color #f59e0b
    background rgba(245, 158, 11, 0.1)
    border 1px solid rgba(245, 158, 11, 0.2)

.page-title
    margin 0 0 0.25rem
    font-size 1.8rem
    font-weight 750

.page-subtitle
    margin 0
    color #94a3b8
    font-size 0.9rem

.header-metrics
    display flex
    gap 0.75rem

.metric-card
    min-width 126px
    display flex
    flex-direction column
    gap 0.15rem
    padding 0.7rem 0.9rem
    border-radius 10px
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.07)

    strong
        font-size 1.25rem

    &--warning strong
        color #f59e0b

.metric-label
    color #64748b
    font-size 0.72rem
    text-transform uppercase
    letter-spacing 0.04em

.operation-note
    display flex
    align-items flex-start
    gap 0.65rem
    margin-bottom 1.25rem
    padding 0.8rem 1rem
    border 1px solid rgba(59,130,246,0.18)
    border-radius 10px
    color #bfdbfe
    background rgba(59,130,246,0.07)

    svg
        flex-shrink 0
        margin-top 0.1rem
        font-size 1.1rem

    p
        margin 0
        font-size 0.84rem
        line-height 1.5

.filters-bar
    display flex
    gap 0.75rem
    margin-bottom 1rem
    flex-wrap wrap

.search-wrap
    position relative
    min-width 280px
    flex 1

.search-icon
    position absolute
    left 0.75rem
    top 50%
    z-index 1
    transform translateY(-50%)
    color #64748b

.search-input,
.filter-select
    height 42px
    border 1px solid rgba(255,255,255,0.08)
    border-radius 9px
    outline none
    color #e2e8f0
    background #1a1a1e

    &:focus
        border-color rgba(99,102,241,0.55)

.search-input
    width 100%
    padding 0 0.8rem 0 2.35rem

.filter-select
    min-width 190px
    padding 0 0.75rem
    cursor pointer

.refresh-btn
    height 42px
    display inline-flex
    align-items center
    gap 0.45rem
    padding 0 0.9rem
    border 1px solid rgba(255,255,255,0.08)
    border-radius 9px
    color #cbd5e1
    background #1e1e24
    cursor pointer

    &:hover:not(:disabled)
        background #28282f

    &:disabled
        opacity 0.6

.section
    overflow hidden
    border 1px solid rgba(255,255,255,0.06)
    border-radius 12px
    background #1a1a1e

.loading-state
    min-height 320px
    display flex
    align-items center
    justify-content center
    gap 0.55rem
    color #94a3b8

.table-wrapper
    overflow-x auto

table
    width 100%
    border-collapse collapse

    th
        padding 0.8rem 0.9rem
        border-bottom 1px solid rgba(255,255,255,0.06)
        color #64748b
        font-size 0.7rem
        font-weight 650
        text-align left
        text-transform uppercase
        letter-spacing 0.05em
        white-space nowrap

    td
        padding 0.9rem
        border-bottom 1px solid rgba(255,255,255,0.045)
        color #cbd5e1
        font-size 0.84rem
        vertical-align middle

.product-row
    cursor pointer
    transition background 0.15s ease

    &:hover
        background rgba(255,255,255,0.025)

    &:last-child td
        border-bottom 0

.product-cell
    min-width 280px
    display flex
    align-items center
    gap 0.75rem

.product-thumb
    width 42px
    height 42px
    flex-shrink 0
    display grid
    place-items center
    border-radius 9px
    color #a5b4fc
    background linear-gradient(145deg, rgba(99,102,241,0.14), rgba(99,102,241,0.04))
    border 1px solid rgba(99,102,241,0.18)
    font-size 1.2rem

.product-copy
    min-width 0
    display flex
    flex-direction column
    gap 0.28rem

    strong
        max-width 300px
        color #e2e8f0
        white-space nowrap
        overflow hidden
        text-overflow ellipsis

    a
        width max-content
        display inline-flex
        align-items center
        gap 0.3rem
        color #60a5fa
        font-size 0.73rem
        text-decoration none

        &:hover
            text-decoration underline

.order-number
    padding 0.2rem 0.4rem
    border-radius 5px
    color #a5b4fc
    background rgba(99,102,241,0.08)
    font-size 0.78rem

.customer-cell
    min-width 150px
    display flex
    flex-direction column
    gap 0.18rem

    strong
        color #e2e8f0
        font-size 0.82rem

    span
        max-width 190px
        color #64748b
        font-size 0.74rem
        overflow hidden
        text-overflow ellipsis

.price
    color #4ade80
    font-weight 650
    white-space nowrap

.date-cell
    color #94a3b8
    white-space nowrap

.status-badge
    display inline-flex
    align-items center
    gap 0.4rem
    padding 0.28rem 0.58rem
    border-radius 999px
    font-size 0.7rem
    font-weight 650
    white-space nowrap

.status-dot
    width 6px
    height 6px
    border-radius 50%
    background currentColor

.status-pending
    color #fbbf24
    background rgba(245,158,11,0.1)
    border 1px solid rgba(245,158,11,0.2)

.status-resolved
    color #4ade80
    background rgba(34,197,94,0.1)
    border 1px solid rgba(34,197,94,0.2)

.actions-heading
    text-align right

.row-actions
    display flex
    align-items center
    justify-content flex-end
    gap 0.45rem

.icon-btn,
.resolve-btn
    height 34px
    display inline-flex
    align-items center
    justify-content center
    border-radius 7px
    cursor pointer

.icon-btn
    width 34px
    border 1px solid rgba(255,255,255,0.08)
    color #94a3b8
    background rgba(255,255,255,0.03)

    &:hover
        color #fff
        background rgba(255,255,255,0.08)

.resolve-btn
    gap 0.3rem
    padding 0 0.65rem
    border 1px solid rgba(34,197,94,0.2)
    color #4ade80
    background rgba(34,197,94,0.09)
    font-size 0.73rem
    font-weight 650

    &:hover:not(:disabled)
        background rgba(34,197,94,0.15)

    &:disabled
        opacity 0.55

.empty-state
    min-height 320px
    display flex
    flex-direction column
    align-items center
    justify-content center
    gap 0.35rem
    color #64748b

    strong
        color #cbd5e1
        font-size 0.95rem

    p
        margin 0
        font-size 0.82rem

.empty-icon
    width 52px
    height 52px
    display grid
    place-items center
    margin-bottom 0.4rem
    border-radius 50%
    color #4ade80
    background rgba(34,197,94,0.08)
    font-size 1.55rem

.pagination
    display flex
    align-items center
    justify-content space-between
    gap 1rem
    padding 0.9rem 1rem
    color #64748b
    font-size 0.78rem
    border-top 1px solid rgba(255,255,255,0.05)

.pagination-actions
    display flex
    gap 0.5rem

    button
        height 34px
        display inline-flex
        align-items center
        gap 0.25rem
        padding 0 0.65rem
        border 1px solid rgba(255,255,255,0.08)
        border-radius 7px
        color #cbd5e1
        background #24242a
        cursor pointer

        &:disabled
            opacity 0.35
            cursor not-allowed

.spin
    animation spin 0.85s linear infinite

@keyframes spin
    from
        transform rotate(0deg)
    to
        transform rotate(360deg)

@media (max-width: 720px)
    .view-wrap
        padding 1.2rem

    .header-metrics
        width 100%

    .metric-card
        flex 1

    .search-wrap
        min-width 100%

    .filter-select,
    .refresh-btn
        flex 1
</style>
