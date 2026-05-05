<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { useRouter } from 'vue-router'
import { toast } from 'vue3-toastify'
import { Icon } from '@iconify/vue'

const router = useRouter()
const notifications = ref<any[]>([])
const loading = ref(true)
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const limit = ref(20)
const unreadCount = ref(0)
const onlyUnread = ref(false)
const markingAllRead = ref(false)

const fetchNotifications = async (page: number) => {
    loading.value = true
    try {
        const response = await adminService.getCollectorNotifications(page, limit.value, onlyUnread.value)
        if (response.data) {
            notifications.value = response.data.data
            totalItems.value = response.data.total
            currentPage.value = response.data.page
            totalPages.value = Math.ceil(response.data.total / limit.value) || 1
        }
    } catch (error) {
        console.error('Erro ao buscar notificações:', error)
        toast.error('Erro ao carregar pedidos collector.')
    } finally {
        loading.value = false
    }
}

const fetchUnreadCount = async () => {
    try {
        const response = await adminService.getCollectorUnreadCount()
        unreadCount.value = response.data.count
    } catch {}
}

const markRead = async (notification: any) => {
    if (notification.is_read) return
    try {
        await adminService.markCollectorNotificationRead(notification.id ?? notification.uuid)
        notification.is_read = true
        notification.read_at = new Date().toISOString()
        unreadCount.value = Math.max(0, unreadCount.value - 1)
    } catch {
        toast.error('Erro ao marcar como lido.')
    }
}

const markAllRead = async () => {
    markingAllRead.value = true
    try {
        await adminService.markAllCollectorNotificationsRead()
        notifications.value.forEach(n => {
            n.is_read = true
            n.read_at = new Date().toISOString()
        })
        unreadCount.value = 0
        toast.success('Todas marcadas como lidas.')
    } catch {
        toast.error('Erro ao marcar todas como lidas.')
    } finally {
        markingAllRead.value = false
    }
}

const onFilterChange = () => {
    fetchNotifications(1)
}

const nextPage = () => { if (currentPage.value < totalPages.value) fetchNotifications(currentPage.value + 1) }
const prevPage = () => { if (currentPage.value > 1) fetchNotifications(currentPage.value - 1) }

const getItems = (notification: any): string => {
    const items = notification.metadata?.items
    if (!Array.isArray(items) || items.length === 0) return '-'
    return items.map((i: any) => `${i.name} x${i.quantity}`).join(', ')
}

const totalAmount = (notification: any): number => {
    return notification.metadata?.totalAmount ?? 0
}

const orderNumber = (notification: any): string => {
    return notification.metadata?.orderNumber ?? notification.title
}

const userName = (notification: any): string => {
    return notification.metadata?.userName ?? '-'
}

const notificationTypeLabel = (notification: any): string => {
    if (notification.type === 'COLLECTOR_SHIPPING_REMINDER') return 'Lembrete 30 dias'
    return 'Compra collector'
}

const notificationTypeClass = (notification: any): string => {
    return notification.type === 'COLLECTOR_SHIPPING_REMINDER' ? 'type-reminder' : 'type-purchase'
}

const saleUuid = (notification: any): string | null => {
    return notification.metadata?.saleUuid ?? null
}

onMounted(async () => {
    await Promise.all([fetchNotifications(1), fetchUnreadCount()])
})
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
                    <span v-if="unreadCount > 0" class="unread-badge">{{ unreadCount }} não lido{{ unreadCount !== 1 ? 's' : '' }}</span>
                </p>
            </div>
            <div class="header-actions">
                <label class="filter-toggle">
                    <input type="checkbox" v-model="onlyUnread" @change="onFilterChange" />
                    Apenas não lidos
                </label>
                <button
                    v-if="unreadCount > 0"
                    class="btn-mark-all"
                    :disabled="markingAllRead"
                    @click="markAllRead"
                >
                    <Icon icon="mdi:check-all" />
                    {{ markingAllRead ? 'Marcando...' : 'Marcar todas como lidas' }}
                </button>
            </div>
        </header>

        <div class="section">
            <div v-if="loading" class="loading-state">
                <Icon icon="mdi:loading" class="spin" />
                Carregando pedidos collector...
            </div>
            <div v-else>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th></th>
                                <th>N° Pedido</th>
                                <th>Cliente</th>
                                <th>Itens Collector</th>
                                <th>Valor Total</th>
                                <th>Data</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="n in notifications"
                                :key="n.id ?? n.uuid"
                                :class="{ 'row-unread': !n.is_read, 'row-clickable': !!saleUuid(n) }"
                                @click="saleUuid(n) && router.push(`/sales/${saleUuid(n)}`)"
                            >
                                <td class="status-col">
                                    <span
                                        class="read-dot"
                                        :class="n.is_read ? 'dot-read' : 'dot-unread'"
                                        :title="n.is_read ? 'Lido' : 'Não lido'"
                                    />
                                </td>
                                <td @click.stop>
                                    <div class="order-cell">
                                        <div class="order-copy">
                                            <strong class="order-number">{{ orderNumber(n) }}</strong>
                                            <span class="type-badge" :class="notificationTypeClass(n)">
                                                {{ notificationTypeLabel(n) }}
                                            </span>
                                        </div>
                                        <button
                                            v-if="saleUuid(n)"
                                            class="btn-view-inline"
                                            @click="router.push(`/sales/${saleUuid(n)}`)"
                                            title="Ver detalhes do pedido"
                                        >
                                            <Icon icon="mdi:open-in-new" />
                                            Ver Detalhes
                                        </button>
                                    </div>
                                </td>
                                <td class="username-col">{{ userName(n) }}</td>
                                <td class="items-col">
                                    <span class="items-text">{{ getItems(n) }}</span>
                                </td>
                                <td class="price">{{ formatCurrency(totalAmount(n)) }}</td>
                                <td class="date-col">{{ $dayjs(n.created_at).format('DD/MM/YYYY HH:mm') }}</td>
                                <td @click.stop>
                                    <div class="actions-cell">
                                        <button
                                            v-if="!n.is_read"
                                            class="btn-read"
                                            @click="markRead(n)"
                                            title="Marcar como lido"
                                        >
                                            <Icon icon="mdi:check" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            <tr v-if="notifications.length === 0">
                                <td colspan="7" class="empty-state">
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
    display flex
    align-items center
    gap 0.5rem

.title-icon
    color #f59e0b
    font-size 1.6rem

.page-subtitle
    color #94a3b8
    font-size 0.9rem
    display flex
    align-items center
    gap 0.75rem

.unread-badge
    background rgba(245,158,11,0.15)
    color #f59e0b
    font-size 0.75rem
    font-weight 600
    padding 2px 8px
    border-radius 20px
    border 1px solid rgba(245,158,11,0.3)

.header-actions
    display flex
    align-items center
    gap 1rem
    flex-wrap wrap

.filter-toggle
    display flex
    align-items center
    gap 0.5rem
    color #94a3b8
    font-size 0.875rem
    cursor pointer
    user-select none

    input
        accent-color #6366f1
        cursor pointer

.btn-mark-all
    display flex
    align-items center
    gap 0.4rem
    background rgba(99,102,241,0.1)
    color #6366f1
    border 1px solid rgba(99,102,241,0.25)
    padding 0.45rem 1rem
    border-radius 8px
    font-size 0.85rem
    font-weight 500
    cursor pointer
    transition all 0.2s

    &:hover:not(:disabled)
        background rgba(99,102,241,0.2)

    &:disabled
        opacity 0.5
        cursor not-allowed

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

.row-clickable
    cursor pointer

.row-unread
    background rgba(245,158,11,0.03)

    &:hover
        background rgba(245,158,11,0.06)

tr:not(.row-unread):hover td
    background rgba(255,255,255,0.015)

.status-col
    width 20px

.read-dot
    display inline-block
    width 8px
    height 8px
    border-radius 50%
    flex-shrink 0

.dot-unread
    background #f59e0b
    box-shadow 0 0 6px rgba(245,158,11,0.5)

.dot-read
    background rgba(255,255,255,0.12)

.order-cell
    display flex
    align-items center
    justify-content space-between
    gap 0.6rem

.order-copy
    display flex
    flex-direction column
    gap 0.35rem

.order-number
    color #e2e8f0
    font-family monospace
    font-size 0.875rem

.type-badge
    display inline-flex
    align-items center
    width fit-content
    padding 0.2rem 0.5rem
    border-radius 999px
    font-size 0.7rem
    font-weight 600
    text-transform uppercase
    letter-spacing 0.03em

.type-purchase
    background rgba(245,158,11,0.14)
    color #f59e0b
    border 1px solid rgba(245,158,11,0.28)

.type-reminder
    background rgba(239,68,68,0.12)
    color #f87171
    border 1px solid rgba(248,113,113,0.24)

.btn-view-inline
    display inline-flex
    align-items center
    gap 0.3rem
    background rgba(99,102,241,0.12)
    color #6366f1
    border 1px solid rgba(99,102,241,0.2)
    padding 0.25rem 0.6rem
    border-radius 5px
    font-size 0.75rem
    font-weight 500
    cursor pointer
    white-space nowrap
    transition all 0.2s
    flex-shrink 0

    &:hover
        background rgba(99,102,241,0.25)
        border-color rgba(99,102,241,0.4)

.username-col
    color #cbd5e1

.items-col
    max-width 320px

.items-text
    display block
    white-space nowrap
    overflow hidden
    text-overflow ellipsis
    max-width 300px
    color #94a3b8
    font-size 0.825rem

.price
    font-weight 600
    color #4caf50
    white-space nowrap

.date-col
    color #64748b
    font-size 0.82rem
    white-space nowrap

.actions-cell
    display flex
    align-items center
    gap 0.5rem

.btn-view
    display flex
    align-items center
    gap 0.35rem
    background rgba(99,102,241,0.1)
    color #6366f1
    border none
    padding 0.4rem 0.75rem
    border-radius 6px
    font-size 0.82rem
    font-weight 500
    cursor pointer
    transition all 0.2s
    white-space nowrap

    &:hover
        background rgba(99,102,241,0.2)

.btn-read
    display flex
    align-items center
    justify-content center
    background rgba(245,158,11,0.1)
    color #f59e0b
    border 1px solid rgba(245,158,11,0.2)
    width 30px
    height 30px
    border-radius 6px
    cursor pointer
    transition all 0.2s
    flex-shrink 0

    &:hover
        background rgba(245,158,11,0.2)

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
