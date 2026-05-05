<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { Icon } from '@iconify/vue'

const route = useRoute()
const router = useRouter()
const sale = ref<any>(null)
const loading = ref(true)
const nowTs = ref(Date.now())
let collectorTimer: number | null = null

const fetchSale = async () => {
    loading.value = true
    try {
        const response = await adminService.getSaleById(route.params.id as string)
        if (response.data) sale.value = response.data
    } catch (error) {
        console.error('Erro ao buscar venda:', error)
    } finally {
        loading.value = false
    }
}

const getStatusClass = (status: string) => {
    if (!status) return ''
    const normalized = status.toLowerCase()
    if (['completed', 'approved', 'paid'].includes(normalized)) return 'status-completed'
    if (['pending', 'processing'].includes(normalized)) return 'status-pending'
    return 'status-canceled'
}

const formatStatusText = (status: string) => {
    if (!status) return '-'
    const map: Record<string, string> = {
        PENDING: 'Pendente',
        COMPLETED: 'Concluido',
        APPROVED: 'Aprovado',
        PAID: 'Pago',
        CANCELED: 'Cancelado',
        FAILED: 'Falho',
    }
    return map[status.toUpperCase()] || status
}

const collectorReminder = computed(() => sale.value?.collector_shipping_reminder ?? null)

const collectorReminderStateLabel = computed(() => {
    if (!collectorReminder.value) return ''
    if (collectorReminder.value.is_sent) return 'Lembrete enviado'
    if (collectorReminder.value.is_due) return 'Prazo atingido'
    return 'Contagem ativa'
})

const collectorReminderStateClass = computed(() => {
    if (!collectorReminder.value) return ''
    if (collectorReminder.value.is_sent) return 'collector-sent'
    if (collectorReminder.value.is_due) return 'collector-due'
    return 'collector-pending'
})

const formatDuration = (ms: number) => {
    if (ms <= 0) return '0m'

    const totalMinutes = Math.floor(ms / 60000)
    const days = Math.floor(totalMinutes / (60 * 24))
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
    const minutes = totalMinutes % 60
    const parts: string[] = []

    if (days > 0) parts.push(`${days}d`)
    if (hours > 0 || days > 0) parts.push(`${hours}h`)
    parts.push(`${minutes}m`)

    return parts.join(' ')
}

const collectorReminderCountdown = computed(() => {
    if (!collectorReminder.value) return '-'
    if (collectorReminder.value.is_sent) return 'Aviso ja disparado'

    const dueAtTs = new Date(collectorReminder.value.due_at).getTime()
    const diff = dueAtTs - nowTs.value

    if (diff <= 0) return 'Aguardando envio do cron'
    return formatDuration(diff)
})

onMounted(async () => {
    await fetchSale()
    collectorTimer = window.setInterval(() => {
        nowTs.value = Date.now()
    }, 60000)
})

onBeforeUnmount(() => {
    if (collectorTimer !== null) {
        window.clearInterval(collectorTimer)
    }
})
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <button class="btn-back" @click="router.push('/sales')">
                <Icon icon="mdi:arrow-left" /> Vendas
            </button>
        </header>

        <div v-if="loading" class="loading-state">Carregando detalhes...</div>

        <template v-else-if="sale">
            <div class="sale-hero">
                <h1 class="page-title">Pedido #{{ sale.order_number }}</h1>
                <span class="status-badge-lg" :class="getStatusClass(sale.payment_status)">
                    {{ formatStatusText(sale.payment_status) }}
                </span>
            </div>

            <div class="details-grid">
                <div class="section main-info">
                    <h2 class="section-title">Resumo</h2>
                    <div class="info-grid">
                        <div class="info-group">
                            <label>Subtotal</label>
                            <p>{{ formatCurrency(sale.subtotal_amount) }}</p>
                        </div>
                        <div class="info-group">
                            <label>Desconto</label>
                            <p>{{ formatCurrency(sale.discount_amount) }}</p>
                        </div>
                        <div class="info-group highlight">
                            <label>Total</label>
                            <p>{{ formatCurrency(sale.total_amount) }}</p>
                        </div>
                        <div class="info-group">
                            <label>Criado em</label>
                            <p>{{ $dayjs(sale.created_at).format('DD/MM/YYYY HH:mm:ss') }}</p>
                        </div>
                    </div>

                    <div
                        v-if="collectorReminder"
                        class="collector-reminder-card"
                        :class="collectorReminderStateClass"
                    >
                        <div class="collector-reminder-head">
                            <div>
                                <span class="collector-kicker">Collector</span>
                                <h3 class="collector-title">Lembrete de envio manual</h3>
                            </div>
                            <span class="collector-pill" :class="collectorReminderStateClass">
                                {{ collectorReminderStateLabel }}
                            </span>
                        </div>

                        <div class="collector-grid">
                            <div class="collector-metric">
                                <label>Prazo de 30 dias</label>
                                <p>{{ $dayjs(collectorReminder.due_at).format('DD/MM/YYYY HH:mm:ss') }}</p>
                            </div>
                            <div class="collector-metric">
                                <label>Status do timer</label>
                                <p>{{ collectorReminderCountdown }}</p>
                            </div>
                            <div class="collector-metric">
                                <label>Itens collector</label>
                                <p>{{ collectorReminder.collector_items_count }}</p>
                            </div>
                            <div class="collector-metric">
                                <label>Base do lembrete</label>
                                <p>{{ $dayjs(collectorReminder.reminder_base_at).format('DD/MM/YYYY HH:mm:ss') }}</p>
                            </div>
                            <div v-if="collectorReminder.sent_at" class="collector-metric collector-span">
                                <label>WhatsApp / notificacao enviados em</label>
                                <p>{{ $dayjs(collectorReminder.sent_at).format('DD/MM/YYYY HH:mm:ss') }}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="section customer-info">
                    <h2 class="section-title">Cliente</h2>
                    <div class="info-list">
                        <div class="info-row">
                            <span class="label">Usuario</span>
                            <span class="value">{{ sale.users?.username || 'N/A' }}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">UUID</span>
                            <code class="value mono">{{ sale.users?.id || 'N/A' }}</code>
                        </div>
                        <div class="info-row">
                            <span class="label">IP</span>
                            <span class="value">{{ sale.ip_address || 'N/A' }}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Anti-fraude</span>
                            <span class="value">{{ sale.anti_fraud_score ?? '-' }}</span>
                        </div>
                    </div>
                </div>

                <div class="section items-info">
                    <h2 class="section-title">Itens ({{ sale.sale_items?.length || 0 }})</h2>
                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Nome</th>
                                    <th>Qtd</th>
                                    <th>Preco Unit.</th>
                                    <th>Desconto</th>
                                    <th>Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="item in sale.sale_items" :key="item.id">
                                    <td>
                                        <div class="item-name">
                                            <strong>{{ item.skin_name }}</strong>
                                            <span
                                                v-if="item.bot_inventory?.is_collector"
                                                class="collector-tag"
                                            >
                                                Collector
                                            </span>
                                        </div>
                                    </td>
                                    <td>{{ item.quantity }}</td>
                                    <td>{{ formatCurrency(item.unit_price) }}</td>
                                    <td>{{ formatCurrency(item.discount_applied) }}</td>
                                    <td>{{ formatCurrency(item.price) }}</td>
                                </tr>
                                <tr v-if="!sale.sale_items?.length">
                                    <td colspan="5" class="empty-state">Nenhum item.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="section system-info">
                    <h2 class="section-title">Sistema</h2>
                    <div class="info-list">
                        <div class="info-row">
                            <span class="label">ID</span>
                            <code class="value mono">{{ sale.id }}</code>
                        </div>
                        <div class="info-row">
                            <span class="label">Idempotencia</span>
                            <code class="value mono truncate" :title="sale.idempotency_key">
                                {{ sale.idempotency_key || 'N/A' }}
                            </code>
                        </div>
                    </div>

                    <h3 class="subsection-title">Historico de Status</h3>
                    <div class="timeline">
                        <div class="timeline-item" v-for="(history, index) in sale.status_history" :key="index">
                            <div class="timeline-dot"></div>
                            <div class="timeline-body">
                                <div class="timeline-status">{{ formatStatusText(history.to) }}</div>
                                <div class="timeline-meta">
                                    {{ $dayjs(history.at).format('DD/MM/YY HH:mm:ss') }} por
                                    <strong>{{ history.by }}</strong>
                                </div>
                            </div>
                        </div>
                        <div v-if="!sale.status_history?.length" class="empty-state">Sem historico.</div>
                    </div>
                </div>
            </div>
        </template>

        <div v-else class="loading-state">Venda nao encontrada.</div>
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

.btn-back
    display inline-flex
    align-items center
    gap 0.4rem
    background transparent
    border none
    color #94a3b8
    cursor pointer
    font-size 0.875rem
    padding 0.4rem 0.5rem
    border-radius 6px
    transition all 0.15s

    &:hover
        color #fff
        background rgba(255,255,255,0.05)

.sale-hero
    display flex
    align-items center
    gap 1rem
    margin-bottom 1.75rem
    flex-wrap wrap

.page-title
    font-size 1.8rem
    font-weight 700

.loading-state
    padding 3rem
    text-align center
    color #94a3b8
    background #1a1a1e
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.details-grid
    display grid
    grid-template-columns minmax(280px, 1fr) minmax(0, 2fr)
    gap 1.25rem
    align-items start

    @media (max-width: 1024px)
        grid-template-columns 1fr

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.main-info
    grid-column 1 / -1

.items-info
    grid-column 2 / 3
    grid-row 2 / 4

    @media (max-width: 1024px)
        grid-column 1
        grid-row auto

.customer-info
    grid-column 1 / 2
    grid-row 2

    @media (max-width: 1024px)
        grid-column 1
        grid-row auto

.system-info
    grid-column 1 / 2
    grid-row 3

    @media (max-width: 1024px)
        grid-column 1
        grid-row auto

.section-title
    font-size 1rem
    font-weight 600
    margin-bottom 1.25rem
    padding-bottom 0.75rem
    border-bottom 1px solid rgba(255,255,255,0.05)

.subsection-title
    font-size 0.9rem
    font-weight 600
    margin 1.25rem 0 0.75rem
    color #cbd5e1

.info-grid
    display grid
    grid-template-columns repeat(auto-fit, minmax(180px, 1fr))
    gap 1.25rem

.info-group
    label
        display block
        color #94a3b8
        font-size 0.8rem
        margin-bottom 0.35rem

    p
        font-size 1.1rem
        font-weight 600
        margin 0

    &.highlight p
        color #4caf50
        font-size 1.35rem

.collector-reminder-card
    margin-top 1.5rem
    padding 1.1rem 1.15rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.08)
    background linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))

.collector-reminder-head
    display flex
    align-items flex-start
    justify-content space-between
    gap 1rem
    margin-bottom 1rem
    flex-wrap wrap

.collector-kicker
    display inline-block
    font-size 0.72rem
    font-weight 700
    text-transform uppercase
    letter-spacing 0.08em
    color #f59e0b
    margin-bottom 0.35rem

.collector-title
    margin 0
    font-size 1rem
    font-weight 700

.collector-pill
    display inline-flex
    align-items center
    padding 0.35rem 0.75rem
    border-radius 999px
    font-size 0.78rem
    font-weight 600
    border 1px solid transparent

.collector-grid
    display grid
    grid-template-columns repeat(auto-fit, minmax(180px, 1fr))
    gap 0.9rem

.collector-metric
    label
        display block
        color #94a3b8
        font-size 0.78rem
        margin-bottom 0.35rem

    p
        margin 0
        color #f8fafc
        font-weight 600
        font-size 0.95rem

.collector-span
    grid-column 1 / -1

.collector-pending
    background rgba(245,158,11,0.08)
    border-color rgba(245,158,11,0.22)

.collector-pending.collector-pill
    color #fbbf24
    background rgba(245,158,11,0.14)
    border-color rgba(245,158,11,0.25)

.collector-due
    background rgba(239,68,68,0.08)
    border-color rgba(239,68,68,0.2)

.collector-due.collector-pill
    color #f87171
    background rgba(239,68,68,0.14)
    border-color rgba(239,68,68,0.24)

.collector-sent
    background rgba(76,175,80,0.08)
    border-color rgba(76,175,80,0.2)

.collector-sent.collector-pill
    color #4ade80
    background rgba(76,175,80,0.14)
    border-color rgba(76,175,80,0.24)

.info-list
    display flex
    flex-direction column

.info-row
    display flex
    justify-content space-between
    align-items center
    gap 1rem
    padding 0.55rem 0
    border-bottom 1px solid rgba(255,255,255,0.04)

    &:last-child
        border-bottom none

.label
    color #64748b
    font-size 0.8rem
    flex-shrink 0

.value
    font-size 0.875rem
    color #e2e8f0
    max-width 60%
    text-align right
    word-break break-word

    &.mono
        font-family monospace
        background rgba(255,255,255,0.04)
        padding 1px 5px
        border-radius 4px
        font-size 0.78rem

    &.truncate
        white-space nowrap
        overflow hidden
        text-overflow ellipsis

.table-wrapper
    overflow-x auto

table
    width 100%
    border-collapse collapse

    th
        text-align left
        color #94a3b8
        font-size 0.75rem
        font-weight 500
        padding 0.6rem 0.5rem
        border-bottom 1px solid rgba(255,255,255,0.05)
        text-transform uppercase

    td
        padding 0.65rem 0.5rem
        font-size 0.875rem
        border-bottom 1px solid rgba(255,255,255,0.04)

.item-name
    display flex
    align-items center
    gap 0.5rem
    flex-wrap wrap

.collector-tag
    display inline-flex
    align-items center
    padding 0.18rem 0.45rem
    border-radius 999px
    font-size 0.68rem
    font-weight 700
    text-transform uppercase
    letter-spacing 0.04em
    color #f59e0b
    background rgba(245,158,11,0.12)
    border 1px solid rgba(245,158,11,0.22)

.status-badge-lg
    padding 5px 12px
    border-radius 8px
    font-size 0.85rem
    font-weight 600
    text-transform uppercase
    letter-spacing 0.4px

.status-completed
    background rgba(76,175,80,0.1)
    color #4caf50
    border 1px solid rgba(76,175,80,0.2)

.status-pending
    background rgba(255,152,0,0.1)
    color #ff9800
    border 1px solid rgba(255,152,0,0.2)

.status-canceled
    background rgba(244,67,54,0.1)
    color #f44336
    border 1px solid rgba(244,67,54,0.2)

.timeline
    padding-left 1.25rem
    position relative

    &::before
        content ''
        position absolute
        top 0
        bottom 0
        left 0.35rem
        width 2px
        background rgba(255,255,255,0.08)

.timeline-item
    position relative
    margin-bottom 1.25rem

    &:last-child
        margin-bottom 0

.timeline-dot
    position absolute
    left -1.35rem
    top 0.25rem
    width 0.75rem
    height 0.75rem
    border-radius 50%
    background #6366f1
    border 2px solid #1a1a1e

.timeline-body
    background rgba(255,255,255,0.03)
    padding 0.6rem 0.875rem
    border-radius 8px

.timeline-status
    font-weight 600
    font-size 0.875rem
    color #e2e8f0
    margin-bottom 0.2rem

.timeline-meta
    font-size 0.78rem
    color #94a3b8

    strong
        color #cbd5e1

.empty-state
    text-align center
    padding 2rem
    color #64748b
    font-size 0.875rem
</style>
