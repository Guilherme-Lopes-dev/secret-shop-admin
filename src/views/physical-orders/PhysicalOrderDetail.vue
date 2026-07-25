<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { toast } from 'vue3-toastify'
import { Icon } from '@iconify/vue'

const route  = useRoute()
const router = useRouter()

const API_URL = import.meta.env.VITE_API_URL?.trim() || ''
const mediaUrl = (path: string) => `${API_URL}${path}`

const order   = ref<any>(null)
const loading = ref(true)
const lines   = computed<any[]>(() => order.value?.physical_sales ?? [])

// Rastreio/status são por PEDIDO — todas as linhas se movem juntas (ver updateOrderDeliveryStatus).
const deliveryStatus = computed<string | null>(() => lines.value[0]?.delivery_status ?? null)
const trackingCode   = computed<string | null>(() => lines.value.find((l) => l.tracking_code)?.tracking_code ?? null)
const shippedAt      = computed<string | null>(() => lines.value.find((l) => l.shipped_at)?.shipped_at ?? null)
const deliveredAt    = computed<string | null>(() => lines.value.find((l) => l.delivered_at)?.delivered_at ?? null)

// ── Delivery modal ────────────────────────────────────────────────────────────
const deliveryModal      = ref(false)
const deliveryModalStatus = ref('')
const trackingDraft      = ref('')
const deliveryLoading    = ref(false)

// ── Cancel modal ──────────────────────────────────────────────────────────────
const cancelModal   = ref(false)
const cancelRefund  = ref(false)
const cancelLoading = ref(false)

// ── Asaas receipt ─────────────────────────────────────────────────────────────
const fetchingReceipt = ref(false)

const fetchOrder = async () => {
    loading.value = true
    try {
        const res = await adminService.getPhysicalOrderDetail(route.params.uuid as string)
        order.value = res.data
    } catch {
        toast.error('Pedido não encontrado.')
        router.push('/physical-orders')
    } finally {
        loading.value = false
    }
}

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
    AWAITING_PAYMENT: 'Aguardando Pagamento',
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
    AWAITING_SHIPPING: 'Aguardando Envio',
    SHIPPED:           'Enviado',
    DELIVERED:         'Entregue',
}[s ?? ''] ?? '-')

const paymentMethodLabel = (m: string | null) =>
    ({ PIX: 'PIX', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão de Crédito' }[m ?? ''] ?? m ?? '-')

const nextAction = computed((): { label: string; status: string } | null => {
    if (!order.value || order.value.payment_status !== 'PAID') return null
    return ({
        AWAITING_SHIPPING: { label: 'Marcar como Enviado',  status: 'SHIPPED'   },
        SHIPPED:           { label: 'Marcar como Entregue', status: 'DELIVERED' },
    } as Record<string, { label: string; status: string }>)[deliveryStatus.value ?? 'AWAITING_SHIPPING'] ?? null
})

const canCancel = () =>
    order.value && !['CANCELLED', 'REFUNDED', 'EXPIRED'].includes(order.value.payment_status)

const historyEntries = (): any[] =>
    Array.isArray(order.value?.status_history) ? order.value.status_history : []

const formatHistoryEntry = (entry: any) => {
    if (entry.kind === 'delivery') {
        return `Entrega: ${deliveryLabel(entry.from)} → ${deliveryLabel(entry.to)}`
    }
    return `Pagamento: ${paymentLabel(entry.from ?? 'início')} → ${paymentLabel(entry.to)}`
}

// ── Actions ───────────────────────────────────────────────────────────────────
const openDeliveryModal = () => {
    if (!nextAction.value) return
    deliveryModalStatus.value = nextAction.value.status
    trackingDraft.value = trackingCode.value ?? ''
    deliveryModal.value = true
}

const confirmDelivery = async () => {
    deliveryLoading.value = true
    try {
        await adminService.updatePhysicalOrderDelivery(order.value.id, {
            delivery_status: deliveryModalStatus.value as 'SHIPPED' | 'DELIVERED',
            tracking_code: trackingDraft.value || undefined,
        })
        toast.success('Status de entrega atualizado.')
        deliveryModal.value = false
        fetchOrder()
    } catch (err: any) {
        toast.error(err?.response?.data?.message ?? 'Erro ao atualizar entrega.')
    } finally {
        deliveryLoading.value = false
    }
}

const openCancelModal = () => {
    cancelRefund.value = false
    cancelModal.value = true
}

const confirmCancel = async () => {
    cancelLoading.value = true
    try {
        await adminService.cancelPhysicalOrder(order.value.id, cancelRefund.value)
        toast.success(cancelRefund.value ? 'Pedido cancelado com reembolso.' : 'Pedido cancelado.')
        cancelModal.value = false
        fetchOrder()
    } catch {
        toast.error('Erro ao cancelar pedido.')
    } finally {
        cancelLoading.value = false
    }
}

const openAsaasReceipt = async () => {
    if (!order.value?.payment_id) {
        toast.warning('Pedido não possui cobrança Asaas vinculada.')
        return
    }
    fetchingReceipt.value = true
    try {
        const { data } = await adminService.getPhysicalOrderAsaasPayment(route.params.uuid as string)
        const url = data?.invoiceUrl || data?.bankSlipUrl || data?.transactionReceiptUrl
        if (!url) {
            toast.warning('Asaas não retornou URL de pagamento.')
            return
        }
        window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Falha ao buscar cobrança no Asaas.')
    } finally {
        fetchingReceipt.value = false
    }
}

onMounted(fetchOrder)
</script>

<template>
    <div class="view-wrap">
        <div v-if="loading" class="loading-full">
            <Icon icon="mdi:loading" class="spin" />
            Carregando pedido...
        </div>

        <template v-else-if="order">
            <header class="page-header">
                <div class="header-left">
                    <button class="btn-back" @click="router.push('/physical-orders')">
                        <Icon icon="mdi:arrow-left" />
                        Pedidos Produto Físico
                    </button>
                    <div class="header-title-row">
                        <h1 class="page-title">{{ order.order_number }}</h1>
                        <div class="header-badges">
                            <span class="status-badge" :class="paymentBadgeClass(order.payment_status)">
                                {{ paymentLabel(order.payment_status) }}
                            </span>
                            <span v-if="deliveryStatus" class="status-badge" :class="deliveryBadgeClass(deliveryStatus)">
                                {{ deliveryLabel(deliveryStatus) }}
                            </span>
                        </div>
                    </div>
                    <p class="page-sub">Criado em {{ $dayjs(order.created_at).format('DD/MM/YYYY [às] HH:mm:ss') }}</p>
                </div>
                <div class="header-actions">
                    <button
                        v-if="order.payment_status === 'PAID'"
                        class="btn-action-main btn-neutral-soft"
                        :disabled="fetchingReceipt || !order.payment_id"
                        :title="!order.payment_id ? 'Pedido sem cobrança Asaas' : ''"
                        @click="openAsaasReceipt"
                    >
                        <Icon icon="mdi:receipt-text-outline" />
                        {{ fetchingReceipt ? 'Buscando...' : 'Comprovante Asaas' }}
                    </button>
                    <button
                        v-if="nextAction"
                        class="btn-action-main btn-ship"
                        @click="openDeliveryModal"
                    >
                        <Icon icon="mdi:truck-outline" />
                        {{ nextAction.label }}
                    </button>
                    <button
                        v-if="canCancel()"
                        class="btn-action-main btn-danger-soft"
                        @click="openCancelModal"
                    >
                        <Icon icon="mdi:close-circle-outline" />
                        Cancelar Pedido
                    </button>
                </div>
            </header>

            <div class="content-grid">
                <div class="col-main">
                    <!-- Itens -->
                    <div class="card">
                        <div class="card-title-row">
                            <span class="card-title">Itens ({{ lines.length }})</span>
                        </div>
                        <template v-for="(sl, index) in lines" :key="sl.id">
                            <div class="item-row">
                                <img
                                    v-if="sl.physical_products?.media?.[0]"
                                    :src="mediaUrl(sl.physical_products.media[0].url)"
                                    class="item-img"
                                    :alt="sl.physical_products?.name"
                                />
                                <div v-else class="item-img-placeholder">
                                    <Icon icon="mdi:trophy-award" />
                                </div>
                                <div class="item-info">
                                    <div class="item-name">{{ sl.physical_products?.name ?? '-' }}</div>
                                    <div class="line-qty-row">
                                        <span>{{ formatCurrency(sl.unit_price) }}</span>
                                    </div>
                                </div>
                            </div>
                            <div v-if="index < lines.length - 1" class="line-divider" />
                        </template>
                    </div>

                    <!-- Financeiro -->
                    <div class="card">
                        <span class="card-title">Financeiro</span>
                        <div class="kv-grid">
                            <div class="kv">
                                <span class="kv-label">Subtotal</span>
                                <span class="kv-value">{{ formatCurrency(order.subtotal_amount) }}</span>
                            </div>
                            <div class="kv">
                                <span class="kv-label">Frete</span>
                                <span class="kv-value">{{ formatCurrency(order.shipping_amount) }}</span>
                            </div>
                            <div class="kv">
                                <span class="kv-label">Total</span>
                                <span class="kv-value price-highlight">{{ formatCurrency(order.total_amount) }}</span>
                            </div>
                            <div class="kv">
                                <span class="kv-label">Método de Pagamento</span>
                                <span class="kv-value">{{ paymentMethodLabel(order.payment_method) }}</span>
                            </div>
                            <div class="kv" style="grid-column: span 2">
                                <span class="kv-label">Asaas Payment ID</span>
                                <span class="kv-value mono">{{ order.payment_id ?? '-' }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Endereço de entrega -->
                    <div class="card" v-if="order.shipping_address">
                        <span class="card-title">Endereço de Entrega</span>
                        <div class="kv-grid">
                            <div class="kv" style="grid-column: span 2">
                                <span class="kv-label">Destinatário</span>
                                <span class="kv-value">{{ order.shipping_address.recipient_name }} · {{ order.shipping_address.phone ?? '-' }}</span>
                            </div>
                            <div class="kv" style="grid-column: span 2">
                                <span class="kv-label">Endereço</span>
                                <span class="kv-value">
                                    {{ order.shipping_address.street }}, {{ order.shipping_address.number }}
                                    <template v-if="order.shipping_address.complement">— {{ order.shipping_address.complement }}</template>
                                </span>
                            </div>
                            <div class="kv">
                                <span class="kv-label">Bairro</span>
                                <span class="kv-value">{{ order.shipping_address.neighborhood }}</span>
                            </div>
                            <div class="kv">
                                <span class="kv-label">Cidade/UF</span>
                                <span class="kv-value">{{ order.shipping_address.city }}/{{ order.shipping_address.state }}</span>
                            </div>
                            <div class="kv">
                                <span class="kv-label">CEP</span>
                                <span class="kv-value mono">{{ order.shipping_address.cep }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Histórico de status -->
                    <div class="card" v-if="historyEntries().length">
                        <span class="card-title">Histórico de Status</span>
                        <div class="history-list">
                            <div
                                v-for="(entry, i) in historyEntries()"
                                :key="i"
                                class="history-entry"
                            >
                                <div class="history-left">
                                    <span class="history-kind" :class="entry.kind === 'delivery' ? 'kind-delivery' : 'kind-payment'">
                                        {{ entry.kind === 'delivery' ? 'Entrega' : 'Pagamento' }}
                                    </span>
                                    <span class="history-text">{{ formatHistoryEntry(entry) }}</span>
                                </div>
                                <span class="history-meta">{{ entry.by }} · {{ $dayjs(entry.at).format('DD/MM/YYYY HH:mm') }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Coluna lateral -->
                <div class="col-side">
                    <!-- Cliente -->
                    <div class="card">
                        <span class="card-title">Cliente</span>
                        <div class="kv-stack">
                            <div class="kv">
                                <span class="kv-label">Username</span>
                                <span class="kv-value">{{ order.users?.username ?? '-' }}</span>
                            </div>
                            <div class="kv">
                                <span class="kv-label">E-mail</span>
                                <span class="kv-value">{{ order.users?.email ?? '-' }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Rastreio -->
                    <div class="card" v-if="trackingCode">
                        <span class="card-title">Rastreio</span>
                        <div class="kv-stack">
                            <div class="kv">
                                <span class="kv-label">Código</span>
                                <span class="kv-value mono">{{ trackingCode }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Linha do tempo -->
                    <div class="card">
                        <span class="card-title">Linha do Tempo</span>
                        <div class="timeline">
                            <div class="timeline-item">
                                <Icon icon="mdi:plus-circle-outline" class="tl-icon tl-created" />
                                <div>
                                    <span class="tl-label">Criado</span>
                                    <span class="tl-date">{{ $dayjs(order.created_at).format('DD/MM/YYYY HH:mm:ss') }}</span>
                                </div>
                            </div>
                            <div class="timeline-item" v-if="order.reserved_at">
                                <Icon icon="mdi:lock-outline" class="tl-icon tl-reserved" />
                                <div>
                                    <span class="tl-label">Reservado</span>
                                    <span class="tl-date">{{ $dayjs(order.reserved_at).format('DD/MM/YYYY HH:mm:ss') }}</span>
                                </div>
                            </div>
                            <div class="timeline-item" v-if="order.expires_at && !order.paid_at">
                                <Icon icon="mdi:clock-outline" class="tl-icon tl-expires" />
                                <div>
                                    <span class="tl-label">Expira em</span>
                                    <span class="tl-date">{{ $dayjs(order.expires_at).format('DD/MM/YYYY HH:mm:ss') }}</span>
                                </div>
                            </div>
                            <div class="timeline-item" v-if="order.paid_at">
                                <Icon icon="mdi:check-circle-outline" class="tl-icon tl-paid" />
                                <div>
                                    <span class="tl-label">Pago</span>
                                    <span class="tl-date">{{ $dayjs(order.paid_at).format('DD/MM/YYYY HH:mm:ss') }}</span>
                                </div>
                            </div>
                            <div class="timeline-item" v-if="shippedAt">
                                <Icon icon="mdi:truck-outline" class="tl-icon tl-shipped" />
                                <div>
                                    <span class="tl-label">Enviado</span>
                                    <span class="tl-date">{{ $dayjs(shippedAt).format('DD/MM/YYYY HH:mm:ss') }}</span>
                                </div>
                            </div>
                            <div class="timeline-item" v-if="deliveredAt">
                                <Icon icon="mdi:package-variant-closed-check" class="tl-icon tl-delivered" />
                                <div>
                                    <span class="tl-label">Entregue</span>
                                    <span class="tl-date">{{ $dayjs(deliveredAt).format('DD/MM/YYYY HH:mm:ss') }}</span>
                                </div>
                            </div>
                            <div class="timeline-item" v-if="order.cancelled_at">
                                <Icon icon="mdi:close-circle-outline" class="tl-icon tl-cancelled" />
                                <div>
                                    <span class="tl-label">Cancelado</span>
                                    <span class="tl-date">{{ $dayjs(order.cancelled_at).format('DD/MM/YYYY HH:mm:ss') }}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Identificadores -->
                    <div class="card">
                        <span class="card-title">Identificadores</span>
                        <div class="kv-stack">
                            <div class="kv">
                                <span class="kv-label">UUID do Pedido</span>
                                <span class="kv-value mono small">{{ order.id }}</span>
                            </div>
                            <div class="kv" v-if="order.payment_id">
                                <span class="kv-label">ID Asaas</span>
                                <span class="kv-value mono small">{{ order.payment_id }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </template>

        <!-- ── Delivery Modal ─────────────────────────────────────────────────── -->
        <div v-if="deliveryModal" class="modal-backdrop" @click.self="deliveryModal = false">
            <div class="modal">
                <h2 class="modal-title">
                    <Icon icon="mdi:truck-outline" />
                    {{ deliveryModalStatus === 'SHIPPED' ? 'Marcar como Enviado' : 'Marcar como Entregue' }}
                </h2>
                <p class="modal-sub">Pedido <strong>{{ order?.order_number }}</strong> — 1 rastreio pra todos os itens</p>
                <div class="form-group">
                    <label class="form-label">Código de rastreio</label>
                    <input v-model="trackingDraft" type="text" class="form-input" placeholder="Ex: BR123456789" />
                </div>
                <div class="modal-actions">
                    <button class="btn-secondary" @click="deliveryModal = false">Cancelar</button>
                    <button class="btn-primary" :disabled="deliveryLoading" @click="confirmDelivery">
                        {{ deliveryLoading ? 'Salvando...' : 'Confirmar' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- ── Cancel Modal ───────────────────────────────────────────────────── -->
        <div v-if="cancelModal" class="modal-backdrop" @click.self="cancelModal = false">
            <div class="modal">
                <h2 class="modal-title cancel-title">
                    <Icon icon="mdi:close-circle-outline" />
                    Cancelar Pedido
                </h2>
                <p class="modal-sub">Pedido <strong>{{ order?.order_number }}</strong></p>
                <label v-if="order?.payment_status === 'PAID'" class="refund-toggle">
                    <input type="checkbox" v-model="cancelRefund" />
                    Solicitar reembolso no Asaas
                </label>
                <div class="modal-actions">
                    <button class="btn-secondary" @click="cancelModal = false">Voltar</button>
                    <button class="btn-danger" :disabled="cancelLoading" @click="confirmCancel">
                        {{ cancelLoading ? 'Cancelando...' : 'Confirmar Cancelamento' }}
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

.loading-full
    padding 4rem
    text-align center
    color #94a3b8
    display flex
    align-items center
    justify-content center
    gap 0.5rem
    font-size 1rem

.spin
    animation spin 1s linear infinite

@keyframes spin
    from transform rotate(0deg)
    to transform rotate(360deg)

.page-header
    display flex
    align-items flex-start
    justify-content space-between
    gap 1.5rem
    flex-wrap wrap
    margin-bottom 2rem

.header-left
    display flex
    flex-direction column
    gap 0.35rem

.btn-back
    display inline-flex
    align-items center
    gap 0.35rem
    background none
    border none
    color #64748b
    font-size 0.82rem
    cursor pointer
    padding 0
    margin-bottom 0.1rem
    transition color 0.2s

    &:hover
        color #94a3b8

.header-title-row
    display flex
    align-items center
    gap 0.85rem
    flex-wrap wrap

.page-title
    font-family monospace
    font-size 1.6rem
    font-weight 700
    color #a5b4fc
    margin 0

.header-badges
    display flex
    gap 0.4rem
    flex-wrap wrap

.page-sub
    color #64748b
    font-size 0.85rem
    margin 0

.header-actions
    display flex
    gap 0.75rem
    flex-wrap wrap
    align-items center

.btn-action-main
    display inline-flex
    align-items center
    gap 0.45rem
    padding 0.55rem 1.1rem
    border-radius 8px
    font-size 0.875rem
    font-weight 600
    cursor pointer
    border none
    transition all 0.2s

.btn-action-main.btn-ship
    background rgba(99,102,241,0.15)
    color #818cf8
    border 1px solid rgba(99,102,241,0.3)

    &:hover
        background rgba(99,102,241,0.3)

.btn-action-main.btn-danger-soft
    background rgba(239,68,68,0.1)
    color #f87171
    border 1px solid rgba(239,68,68,0.2)

    &:hover
        background rgba(239,68,68,0.2)

.btn-action-main.btn-neutral-soft
    background rgba(148,163,184,0.12)
    color #cbd5e1
    border 1px solid rgba(148,163,184,0.25)

    &:hover
        background rgba(148,163,184,0.22)

    &:disabled
        opacity 0.5
        cursor not-allowed

.content-grid
    display grid
    grid-template-columns 1fr 320px
    gap 1.5rem
    align-items start

    @media (max-width: 900px)
        grid-template-columns 1fr

.col-main
    display flex
    flex-direction column
    gap 1.25rem

.col-side
    display flex
    flex-direction column
    gap 1.25rem

.card
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.06)
    border-radius 12px
    padding 1.25rem 1.5rem

.card-title-row
    display flex
    align-items center
    justify-content space-between
    gap 0.75rem
    margin-bottom 1rem
    flex-wrap wrap

.card-title
    display block
    font-size 0.72rem
    font-weight 600
    text-transform uppercase
    letter-spacing 0.06em
    color #64748b
    margin-bottom 0

.item-row
    display flex
    align-items center
    gap 1rem
    margin-bottom 1.25rem

.item-img
    width 64px
    height 64px
    object-fit cover
    border-radius 8px
    background rgba(255,255,255,0.04)
    flex-shrink 0

.item-img-placeholder
    width 64px
    height 64px
    border-radius 8px
    background rgba(255,255,255,0.06)
    display flex
    align-items center
    justify-content center
    color #64748b
    font-size 1.8rem
    flex-shrink 0

.item-info
    flex 1

.item-name
    font-size 1rem
    font-weight 600
    color #e2e8f0
    margin-bottom 0.3rem

.line-qty-row
    display flex
    align-items center
    gap 0.4rem
    margin-top 0.35rem
    font-size 0.78rem
    color #64748b

.line-divider
    border none
    border-top 1px dashed rgba(255,255,255,0.08)
    margin 1rem 0

.kv-grid
    display grid
    grid-template-columns 1fr 1fr
    gap 1rem

.kv-stack
    display flex
    flex-direction column
    gap 0.85rem

.kv
    display flex
    flex-direction column
    gap 0.25rem

.kv-label
    font-size 0.7rem
    text-transform uppercase
    color #64748b
    letter-spacing 0.04em
    font-weight 500

.kv-value
    font-size 0.875rem
    color #cbd5e1
    word-break break-all

.kv-value.mono
    font-family monospace
    font-size 0.82rem
    color #a5b4fc

.kv-value.small
    font-size 0.78rem

.kv-value.price-highlight
    color #4caf50
    font-weight 700
    font-size 1.1rem

.history-list
    display flex
    flex-direction column
    gap 0

.history-entry
    display flex
    align-items center
    justify-content space-between
    gap 1rem
    padding 0.75rem 0
    border-bottom 1px solid rgba(255,255,255,0.04)

    &:last-child
        border-bottom none

.history-left
    display flex
    align-items center
    gap 0.6rem

.history-kind
    padding 0.15rem 0.5rem
    border-radius 4px
    font-size 0.68rem
    font-weight 600
    text-transform uppercase
    flex-shrink 0

.kind-payment
    background rgba(99,102,241,0.15)
    color #818cf8

.kind-delivery
    background rgba(59,130,246,0.15)
    color #60a5fa

.history-text
    color #e2e8f0
    font-size 0.875rem

.history-meta
    color #64748b
    font-size 0.78rem
    white-space nowrap
    flex-shrink 0

.timeline
    display flex
    flex-direction column
    gap 0.85rem

.timeline-item
    display flex
    align-items flex-start
    gap 0.6rem

.tl-icon
    font-size 1.1rem
    flex-shrink 0
    margin-top 0.05rem

.tl-created   { color #94a3b8 }
.tl-reserved  { color #f59e0b }
.tl-expires   { color #ef4444 }
.tl-paid      { color #4caf50 }
.tl-shipped   { color #3b82f6 }
.tl-delivered { color #22c55e }
.tl-cancelled { color #ef4444 }

.tl-label
    display block
    font-size 0.72rem
    text-transform uppercase
    color #64748b
    letter-spacing 0.04em
    font-weight 500

.tl-date
    display block
    font-size 0.82rem
    color #cbd5e1
    font-family monospace

.status-badge
    display inline-flex
    align-items center
    padding 0.25rem 0.65rem
    border-radius 999px
    font-size 0.75rem
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

.modal-backdrop
    position fixed
    inset 0
    background rgba(0,0,0,0.7)
    display flex
    align-items center
    justify-content center
    z-index 100
    backdrop-filter blur(4px)

.modal
    background #1e1e24
    border 1px solid rgba(255,255,255,0.1)
    border-radius 12px
    padding 1.75rem
    width 100%
    max-width 420px

.modal-title
    font-size 1.1rem
    font-weight 700
    margin 0 0 0.35rem
    display flex
    align-items center
    gap 0.5rem
    color #e2e8f0

.cancel-title
    color #ef4444

.modal-sub
    color #94a3b8
    font-size 0.875rem
    margin 0 0 1.25rem

.form-group
    margin-bottom 1.25rem

.form-label
    display block
    font-size 0.8rem
    color #94a3b8
    margin-bottom 0.35rem
    text-transform uppercase
    letter-spacing 0.04em

.form-input
    width 100%
    background #2a2a30
    border 1px solid rgba(255,255,255,0.08)
    color #e2e8f0
    border-radius 6px
    padding 0.6rem 0.75rem
    font-size 0.875rem
    outline none
    box-sizing border-box

    &:focus
        border-color rgba(99,102,241,0.4)

.refund-toggle
    display flex
    align-items center
    gap 0.5rem
    color #cbd5e1
    font-size 0.875rem
    cursor pointer
    margin-bottom 1.5rem
    user-select none

    input
        accent-color #ef4444
        cursor pointer

.modal-actions
    display flex
    justify-content flex-end
    gap 0.75rem

.btn-secondary
    background #2a2a30
    color #94a3b8
    border 1px solid rgba(255,255,255,0.1)
    padding 0.5rem 1.1rem
    border-radius 7px
    font-size 0.875rem
    font-weight 500
    cursor pointer
    transition all 0.2s

    &:hover
        background #3a3a42

.btn-primary
    background rgba(99,102,241,0.9)
    color #fff
    border none
    padding 0.5rem 1.1rem
    border-radius 7px
    font-size 0.875rem
    font-weight 600
    cursor pointer
    transition all 0.2s

    &:hover:not(:disabled)
        background rgba(99,102,241,1)

    &:disabled
        opacity 0.5
        cursor not-allowed

.btn-danger
    background rgba(239,68,68,0.85)
    color #fff
    border none
    padding 0.5rem 1.1rem
    border-radius 7px
    font-size 0.875rem
    font-weight 600
    cursor pointer
    transition all 0.2s

    &:hover:not(:disabled)
        background rgba(239,68,68,1)

    &:disabled
        opacity 0.5
        cursor not-allowed
</style>
