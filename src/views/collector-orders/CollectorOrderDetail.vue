<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { toast } from 'vue3-toastify'
import { Icon } from '@iconify/vue'

const route  = useRoute()
const router = useRouter()

const sale    = ref<any>(null)
const loading = ref(true)
const lines   = computed<any[]>(() => sale.value?.collector_sales ?? [])

// AWAITING_SHIPPING tem prioridade: se qualquer linha está pendente, o pedido está pendente
const aggregateDeliveryStatus = computed<string | null>(() => {
    const ls = lines.value
    if (!ls.length) return null
    if (ls.every((l: any) => l.delivery_status === 'DELIVERED')) return 'DELIVERED'
    if (ls.some((l: any) => l.delivery_status === 'AWAITING_SHIPPING')) return 'AWAITING_SHIPPING'
    if (ls.some((l: any) => l.delivery_status === 'SHIPPED')) return 'SHIPPED'
    return null
})

const deliveredCount   = computed(() => lines.value.filter((l: any) => l.delivery_status === 'DELIVERED').length)
const pendingLines     = computed(() => lines.value.filter((l: any) => l.delivery_status !== 'DELIVERED'))
const isPartiallyDelivered = computed(() => deliveredCount.value > 0 && deliveredCount.value < lines.value.length)

const firstShippedAt = computed<string | null>(() => {
    const dates = lines.value.filter((l: any) => l.shipped_at).map((l: any) => l.shipped_at)
    if (!dates.length) return null
    return dates.reduce((a: string, b: string) => (a < b ? a : b))
})

const firstPartialDeliveredAt = computed<string | null>(() => {
    const dates = lines.value.filter((l: any) => l.delivered_at).map((l: any) => l.delivered_at)
    if (!dates.length) return null
    return dates.reduce((a: string, b: string) => (a < b ? a : b))
})

const lastDeliveredAt = computed<string | null>(() => {
    const ls = lines.value
    if (!ls.length || !ls.every((l: any) => l.delivered_at)) return null
    const dates = ls.map((l: any) => l.delivered_at)
    return dates.reduce((a: string, b: string) => (a > b ? a : b))
})

// ── Delivery modal ────────────────────────────────────────────────────────────
const deliveryModal   = ref(false)
const deliveryStatus  = ref('')
const deliveryNotes   = ref('')
const deliveryLoading = ref(false)

// ── Cancel modal ──────────────────────────────────────────────────────────────
const cancelModal   = ref(false)
const cancelRefund  = ref(false)
const cancelLoading = ref(false)

// ── Asaas receipt ─────────────────────────────────────────────────────────────
const fetchingReceipt = ref(false)

// ── Friendship Steam ──────────────────────────────────────────────────────────
const friendship        = ref<any>(null)
const friendshipLoading = ref(false)

// ── Fetch ─────────────────────────────────────────────────────────────────────
const fetchSale = async () => {
    loading.value = true
    try {
        const res = await adminService.getCollectorSaleDetail(route.params.uuid as string)
        sale.value = res.data
        void fetchFriendship()
    } catch {
        toast.error('Pedido não encontrado.')
        router.push('/collector-orders')
    } finally {
        loading.value = false
    }
}

const fetchFriendship = async () => {
    friendshipLoading.value = true
    try {
        const res = await adminService.getCollectorSaleFriendship(route.params.uuid as string)
        friendship.value = res.data?.bots?.[0] ?? null
    } catch {
        friendship.value = null
    } finally {
        friendshipLoading.value = false
    }
}

const friendshipTitle = () => {
    if (friendshipLoading.value) return 'Consultando Steam...'
    if (!friendship.value) return 'Amizade Steam'
    if (!friendship.value.available) return 'Steam ID indisponível'
    if (friendship.value.privacy_blocked) return 'Lista de amigos privada'
    return friendship.value.are_friends ? 'São amigos na Steam' : 'Ainda não são amigos'
}

const friendshipTone = () => {
    if (friendshipLoading.value || !friendship.value) return 'neutral'
    if (!friendship.value.available || friendship.value.privacy_blocked) return 'warning'
    return friendship.value.are_friends ? 'success' : 'warning'
}

const friendshipDescription = () => {
    const f = friendship.value
    if (friendshipLoading.value) return 'Aguarde — consultando a Steam Web API.'
    if (!f) return ''
    if (!f.available) {
        return f.reason === 'collector_sem_steam_id'
            ? 'Bot vendedor sem steamid cadastrado.'
            : 'Usuário comprador sem steamid cadastrado.'
    }
    if (f.privacy_blocked) return 'Lista de amigos privada em ambos os lados.'
    return f.are_friends
        ? 'Troca pode prosseguir após confirmação de pagamento.'
        : 'O comprador precisa adicionar o bot vendedor antes da entrega.'
}

const friendshipDuration = (days: number | null) => {
    if (days === null) return null
    if (days < 1)   return 'Menos de 1 dia'
    if (days < 30)  return `${days} ${days === 1 ? 'dia' : 'dias'}`
    const months = Math.floor(days / 30)
    if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`
    const years = Math.floor(days / 365)
    return `${years} ${years === 1 ? 'ano' : 'anos'}`
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const lineImage = (sl: any) =>
    sl?.snapshot_data?.icon_url_large ?? sl?.collectors?.icon_url_large ?? null

const lineName = (sl: any) =>
    sl?.snapshot_data?.name ?? sl?.collectors?.name ?? '-'

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
    if (!sale.value || sale.value.payment_status !== 'PAID') return null
    return ({
        AWAITING_SHIPPING: { label: 'Marcar como Enviado',  status: 'SHIPPED'   },
        SHIPPED:           { label: 'Marcar como Entregue', status: 'DELIVERED' },
    } as Record<string, { label: string; status: string }>)[aggregateDeliveryStatus.value ?? ''] ?? null
})

const canCancel = () =>
    sale.value && !['CANCELLED', 'REFUNDED', 'EXPIRED'].includes(sale.value.payment_status)

const historyEntries = (): any[] =>
    Array.isArray(sale.value?.status_history) ? sale.value.status_history : []

const formatHistoryEntry = (entry: any) => {
    if (entry.kind === 'delivery') {
        return `Entrega: ${deliveryLabel(entry.from)} → ${deliveryLabel(entry.to)}`
    }
    return `Pagamento: ${paymentLabel(entry.from ?? 'início')} → ${paymentLabel(entry.to)}`
}

// ── Actions ───────────────────────────────────────────────────────────────────
const openDeliveryModal = () => {
    if (!nextAction.value) return
    deliveryStatus.value = nextAction.value.status
    deliveryNotes.value  = ''
    deliveryModal.value  = true
}

const confirmDelivery = async () => {
    deliveryLoading.value = true
    try {
        const targetStatus = deliveryStatus.value
        const toAdvance = lines.value.filter((l: any) =>
            (targetStatus === 'SHIPPED'   && l.delivery_status === 'AWAITING_SHIPPING') ||
            (targetStatus === 'DELIVERED' && l.delivery_status === 'SHIPPED'),
        )
        if (!toAdvance.length) {
            toast.warning('Nenhuma linha elegível para avançar.')
            return
        }
        for (const l of toAdvance) {
            await adminService.updateCollectorDelivery(l.id, targetStatus, deliveryNotes.value || undefined)
        }
        toast.success(`${toAdvance.length} item(ns) atualizado(s).`)
        deliveryModal.value = false
        fetchSale()
    } catch (err: any) {
        toast.error(err?.response?.data?.message ?? 'Erro ao atualizar entrega.')
    } finally {
        deliveryLoading.value = false
    }
}

const openCancelModal = () => {
    cancelRefund.value = false
    cancelModal.value  = true
}

const confirmCancel = async () => {
    cancelLoading.value = true
    try {
        await adminService.cancelCollectorSale(sale.value.id, cancelRefund.value)
        toast.success(cancelRefund.value ? 'Pedido cancelado com reembolso.' : 'Pedido cancelado.')
        cancelModal.value = false
        fetchSale()
    } catch {
        toast.error('Erro ao cancelar pedido.')
    } finally {
        cancelLoading.value = false
    }
}

const openAsaasReceipt = async () => {
    if (!sale.value?.payment_id) {
        toast.warning('Pedido não possui cobrança Asaas vinculada.')
        return
    }
    fetchingReceipt.value = true
    try {
        const { data } = await adminService.getCollectorSaleAsaasPayment(route.params.uuid as string)
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

onMounted(fetchSale)
</script>

<template>
    <div class="view-wrap">
        <!-- Loading -->
        <div v-if="loading" class="loading-full">
            <Icon icon="mdi:loading" class="spin" />
            Carregando pedido...
        </div>

        <template v-else-if="sale">
            <!-- ── Page Header ──────────────────────────────────────────────── -->
            <header class="page-header">
                <div class="header-left">
                    <button class="btn-back" @click="router.push('/collector-orders')">
                        <Icon icon="mdi:arrow-left" />
                        Pedidos Collector
                    </button>
                    <div class="header-title-row">
                        <h1 class="page-title">{{ sale.order_number }}</h1>
                        <div class="header-badges">
                            <span class="status-badge" :class="paymentBadgeClass(sale.payment_status)">
                                {{ paymentLabel(sale.payment_status) }}
                            </span>
                            <span v-if="aggregateDeliveryStatus" class="status-badge" :class="deliveryBadgeClass(aggregateDeliveryStatus)">
                                {{ deliveryLabel(aggregateDeliveryStatus) }}
                            </span>
                        </div>
                    </div>
                    <p class="page-sub">Criado em {{ $dayjs(sale.created_at).format('DD/MM/YYYY [às] HH:mm:ss') }}</p>
                </div>
                <div class="header-actions">
                    <button
                        v-if="sale.payment_status === 'PAID'"
                        class="btn-action-main btn-neutral-soft"
                        :disabled="fetchingReceipt || !sale.payment_id"
                        :title="!sale.payment_id ? 'Pedido sem cobrança Asaas' : ''"
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
                        <span v-if="pendingLines.length > 1" class="btn-count">({{ pendingLines.length }})</span>
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

            <!-- ── Content grid ─────────────────────────────────────────────── -->
            <div class="content-grid">

                <!-- Coluna principal -->
                <div class="col-main">

                    <!-- Itens -->
                    <div class="card">
                        <div class="card-title-row">
                            <span class="card-title">Itens Collector ({{ lines.length }})</span>
                            <span v-if="sale.payment_status === 'PAID' && isPartiallyDelivered" class="delivery-partial-badge">
                                {{ deliveredCount }}/{{ lines.length }} entregues · {{ pendingLines.length }} pendente(s)
                            </span>
                            <span v-else-if="sale.payment_status === 'PAID' && aggregateDeliveryStatus === 'AWAITING_SHIPPING'" class="delivery-partial-badge delivery-partial-badge--warn">
                                {{ lines.length }} aguardando envio
                            </span>
                            <span v-else-if="sale.payment_status === 'PAID' && aggregateDeliveryStatus === 'SHIPPED'" class="delivery-partial-badge delivery-partial-badge--info">
                                {{ lines.filter((l: any) => l.delivery_status !== 'DELIVERED').length }} enviado(s) — aguardando confirmação
                            </span>
                        </div>
                        <template v-for="(sl, index) in lines" :key="sl.id">
                            <div class="item-row">
                                <img
                                    v-if="lineImage(sl)"
                                    :src="lineImage(sl) ?? ''"
                                    class="item-img"
                                    :alt="lineName(sl)"
                                />
                                <div v-else class="item-img-placeholder">
                                    <Icon icon="mdi:trophy-outline" />
                                </div>
                                <div class="item-info">
                                    <div class="item-name">{{ lineName(sl) }}</div>
                                    <div class="item-hash">{{ sl.snapshot_data?.market_hash_name }}</div>
                                    <div class="line-qty-row">
                                        <span>Qtd: {{ sl.quantity }}</span>
                                        <span>·</span>
                                        <span>{{ formatCurrency(sl.unit_price) }} un</span>
                                        <span>·</span>
                                        <span class="line-subtotal">{{ formatCurrency(sl.total_price) }}</span>
                                    </div>
                                </div>
                                <span v-if="sl.delivery_status" class="status-badge" :class="deliveryBadgeClass(sl.delivery_status)">
                                    {{ deliveryLabel(sl.delivery_status) }}
                                </span>
                            </div>
                            <div class="kv-grid line-meta-grid">
                                <div class="kv">
                                    <span class="kv-label">Steam ID</span>
                                    <span class="kv-value mono">{{ sl.snapshot_data?.steam_id ?? '-' }}</span>
                                </div>
                                <div class="kv">
                                    <span class="kv-label">Asset ID</span>
                                    <span class="kv-value mono">{{ sl.snapshot_data?.asset_id ?? '-' }}</span>
                                </div>
                                <div class="kv">
                                    <span class="kv-label">Collector UUID</span>
                                    <span class="kv-value mono small">{{ sl.collectors?.id ?? '-' }}</span>
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
                                <span class="kv-value">{{ formatCurrency(sale.subtotal_amount) }}</span>
                            </div>
                            <div class="kv">
                                <span class="kv-label">Desconto</span>
                                <span class="kv-value">{{ formatCurrency(sale.discount_amount) }}</span>
                            </div>
                            <div class="kv">
                                <span class="kv-label">Total</span>
                                <span class="kv-value price-highlight">{{ formatCurrency(sale.total_amount) }}</span>
                            </div>
                            <div class="kv">
                                <span class="kv-label">Método de Pagamento</span>
                                <span class="kv-value">{{ paymentMethodLabel(sale.payment_method) }}</span>
                            </div>
                            <div class="kv" style="grid-column: span 2">
                                <span class="kv-label">Asaas Payment ID</span>
                                <span class="kv-value mono">{{ sale.payment_id ?? '-' }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Notas -->
                    <div class="card" v-if="sale.notes">
                        <span class="card-title">Notas</span>
                        <p class="notes-text">{{ sale.notes }}</p>
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
                                <span class="kv-value">{{ sale.users?.username ?? '-' }}</span>
                            </div>
                            <div class="kv">
                                <span class="kv-label">E-mail</span>
                                <span class="kv-value">{{ sale.users?.email ?? '-' }}</span>
                            </div>
                            <div class="kv" v-if="sale.users?.id">
                                <span class="kv-label">UUID</span>
                                <span
                                    class="kv-value mono link"
                                    @click="router.push(`/users/${sale.users.id}`)"
                                >{{ sale.users.id }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Amizade Steam -->
                    <div class="card friendship-card" :class="`friendship-card--${friendshipTone()}`">
                        <div class="friendship-header">
                            <Icon
                                :icon="friendshipLoading
                                    ? 'mdi:loading'
                                    : (!friendship || !friendship.available || friendship.privacy_blocked)
                                        ? 'mdi:account-question-outline'
                                        : friendship.are_friends
                                            ? 'mdi:account-heart-outline'
                                            : 'mdi:account-off-outline'"
                                :class="{ spin: friendshipLoading }"
                            />
                            <div>
                                <span class="card-title">{{ friendshipTitle() }}</span>
                                <p class="friendship-desc">{{ friendshipDescription() }}</p>
                            </div>
                        </div>

                        <div v-if="friendship?.available && friendship.are_friends && friendship.friend_since_iso" class="kv-grid friendship-meta">
                            <div class="kv">
                                <span class="kv-label">Amigos desde</span>
                                <span class="kv-value">{{ $dayjs(friendship.friend_since_iso).format('DD/MM/YYYY') }}</span>
                            </div>
                            <div class="kv" v-if="friendship.friendship_age_days !== null">
                                <span class="kv-label">Tempo de amizade</span>
                                <span class="kv-value">{{ friendshipDuration(friendship.friendship_age_days) }}</span>
                            </div>
                        </div>

                        <div v-if="friendship?.available" class="kv-grid friendship-meta">
                            <div class="kv">
                                <span class="kv-label">Steam ID Bot</span>
                                <a
                                    :href="`https://steamcommunity.com/profiles/${friendship.bot_steamid}`"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="kv-value mono small steam-link"
                                >{{ friendship.bot_steamid }}</a>
                            </div>
                            <div class="kv">
                                <span class="kv-label">Steam ID Comprador</span>
                                <a
                                    :href="`https://steamcommunity.com/profiles/${friendship.buyer_steamid}`"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="kv-value mono small steam-link"
                                >{{ friendship.buyer_steamid }}</a>
                            </div>
                        </div>
                    </div>

                    <!-- Datas -->
                    <div class="card">
                        <span class="card-title">Linha do Tempo</span>
                        <div class="timeline">
                            <div class="timeline-item">
                                <Icon icon="mdi:plus-circle-outline" class="tl-icon tl-created" />
                                <div>
                                    <span class="tl-label">Criado</span>
                                    <span class="tl-date">{{ $dayjs(sale.created_at).format('DD/MM/YYYY HH:mm:ss') }}</span>
                                </div>
                            </div>
                            <div class="timeline-item" v-if="sale.reserved_at">
                                <Icon icon="mdi:lock-outline" class="tl-icon tl-reserved" />
                                <div>
                                    <span class="tl-label">Reservado</span>
                                    <span class="tl-date">{{ $dayjs(sale.reserved_at).format('DD/MM/YYYY HH:mm:ss') }}</span>
                                </div>
                            </div>
                            <div class="timeline-item" v-if="sale.expires_at && !sale.paid_at">
                                <Icon icon="mdi:clock-outline" class="tl-icon tl-expires" />
                                <div>
                                    <span class="tl-label">Expira em</span>
                                    <span class="tl-date">{{ $dayjs(sale.expires_at).format('DD/MM/YYYY HH:mm:ss') }}</span>
                                </div>
                            </div>
                            <div class="timeline-item" v-if="sale.paid_at">
                                <Icon icon="mdi:check-circle-outline" class="tl-icon tl-paid" />
                                <div>
                                    <span class="tl-label">Pago</span>
                                    <span class="tl-date">{{ $dayjs(sale.paid_at).format('DD/MM/YYYY HH:mm:ss') }}</span>
                                </div>
                            </div>
                            <div class="timeline-item" v-if="firstShippedAt">
                                <Icon icon="mdi:truck-outline" class="tl-icon tl-shipped" />
                                <div>
                                    <span class="tl-label">
                                        Enviado
                                        <span v-if="lines.length > 1" class="tl-count">
                                            ({{ lines.filter((l: any) => l.shipped_at).length }}/{{ lines.length }})
                                        </span>
                                    </span>
                                    <span class="tl-date">{{ $dayjs(firstShippedAt).format('DD/MM/YYYY HH:mm:ss') }}</span>
                                </div>
                            </div>
                            <!-- Entrega parcial: alguns entregues, mas não todos -->
                            <div class="timeline-item tl-partial-entry" v-if="isPartiallyDelivered">
                                <Icon icon="mdi:package-variant-closed-remove" class="tl-icon tl-partial" />
                                <div>
                                    <span class="tl-label">Entrega parcial</span>
                                    <span class="tl-date tl-date--warn">
                                        {{ deliveredCount }}/{{ lines.length }} entregues
                                        — falta {{ pendingLines.length }} item(ns)
                                    </span>
                                </div>
                            </div>
                            <!-- Todos entregues -->
                            <div class="timeline-item" v-if="lastDeliveredAt">
                                <Icon icon="mdi:package-variant-closed-check" class="tl-icon tl-delivered" />
                                <div>
                                    <span class="tl-label">Entregue</span>
                                    <span class="tl-date">{{ $dayjs(lastDeliveredAt).format('DD/MM/YYYY HH:mm:ss') }}</span>
                                </div>
                            </div>
                            <div class="timeline-item" v-if="sale.cancelled_at">
                                <Icon icon="mdi:close-circle-outline" class="tl-icon tl-cancelled" />
                                <div>
                                    <span class="tl-label">Cancelado</span>
                                    <span class="tl-date">{{ $dayjs(sale.cancelled_at).format('DD/MM/YYYY HH:mm:ss') }}</span>
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
                                <span class="kv-value mono small">{{ sale.id }}</span>
                            </div>
                            <div class="kv" v-if="sale.payment_id">
                                <span class="kv-label">ID Asaas</span>
                                <span class="kv-value mono small">{{ sale.payment_id }}</span>
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
                    {{ deliveryStatus === 'SHIPPED' ? 'Marcar como Enviado' : 'Marcar como Entregue' }}
                </h2>
                <p class="modal-sub">Pedido <strong>{{ sale?.order_number }}</strong></p>
                <div class="form-group">
                    <label class="form-label">Notas (opcional)</label>
                    <textarea v-model="deliveryNotes" class="form-textarea" rows="3" placeholder="Ex: enviado via Telegram, código de rastreio..." />
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
                <p class="modal-sub">Pedido <strong>{{ sale?.order_number }}</strong></p>
                <label v-if="sale?.payment_status === 'PAID'" class="refund-toggle">
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

// ── Header ────────────────────────────────────────────────────────────────────
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

// ── Content grid ──────────────────────────────────────────────────────────────
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

// ── Card ──────────────────────────────────────────────────────────────────────
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

.delivery-partial-badge
    display inline-flex
    align-items center
    padding 0.18rem 0.55rem
    border-radius 6px
    font-size 0.7rem
    font-weight 600
    background rgba(239,68,68,0.1)
    color #f87171
    border 1px solid rgba(239,68,68,0.2)
    white-space nowrap

    &--warn
        background rgba(245,158,11,0.1)
        color #fbbf24
        border-color rgba(245,158,11,0.2)

    &--info
        background rgba(59,130,246,0.1)
        color #60a5fa
        border-color rgba(59,130,246,0.2)

.btn-count
    font-size 0.75rem
    opacity 0.8

// ── Friendship card ───────────────────────────────────────────────────────────
.friendship-card
    display flex
    flex-direction column
    gap 0.85rem

    .card-title
        margin-bottom 0.25rem
        text-transform none
        letter-spacing 0
        font-size 0.9rem
        color #fff

    &--success
        border-color rgba(46,220,138,0.3)
        background linear-gradient(180deg, rgba(46,220,138,0.06), #1a1a1e)

        .friendship-header > .iconify
            color #2edc8a

    &--warning
        border-color rgba(245,158,11,0.3)
        background linear-gradient(180deg, rgba(245,158,11,0.06), #1a1a1e)

        .friendship-header > .iconify
            color #fbbf24

    &--neutral .friendship-header > .iconify
        color #64748b

.friendship-header
    display flex
    align-items flex-start
    gap 0.75rem

    > .iconify
        font-size 1.4rem
        flex-shrink 0
        margin-top 2px

.friendship-desc
    margin 0.35rem 0 0
    font-size 0.8rem
    line-height 1.45
    color #94a3b8

.friendship-meta
    padding-top 0.6rem
    border-top 1px dashed rgba(255,255,255,0.08)

// ── Item ──────────────────────────────────────────────────────────────────────
.item-row
    display flex
    align-items center
    gap 1rem
    margin-bottom 1.25rem

.item-img
    width 64px
    height 64px
    object-fit contain
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

.item-hash
    font-size 0.8rem
    color #64748b
    font-family monospace

.line-qty-row
    display flex
    align-items center
    gap 0.4rem
    margin-top 0.35rem
    font-size 0.78rem
    color #64748b

.line-subtotal
    color #4caf50
    font-weight 600

.line-meta-grid
    margin-top 0.6rem
    padding-top 0.6rem
    border-top 1px solid rgba(255,255,255,0.04)

.line-divider
    border none
    border-top 1px dashed rgba(255,255,255,0.08)
    margin 1rem 0

// ── KV ───────────────────────────────────────────────────────────────────────
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

.kv-value.link
    cursor pointer
    color #6366f1
    text-decoration underline
    font-size 0.8rem
    word-break break-all

    &:hover
        color #818cf8

.steam-link
    color #a5b4fc
    text-decoration none
    transition color 0.15s

    &:hover
        color #60a5fa
        text-decoration underline

// ── Notes ─────────────────────────────────────────────────────────────────────
.notes-text
    color #94a3b8
    font-size 0.875rem
    line-height 1.6
    margin 0

// ── History ───────────────────────────────────────────────────────────────────
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

// ── Timeline ──────────────────────────────────────────────────────────────────
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
.tl-partial   { color #f59e0b }
.tl-delivered { color #22c55e }
.tl-cancelled { color #ef4444 }

.tl-count
    font-size 0.7rem
    opacity 0.7
    font-weight 400

.tl-date--warn
    color #f59e0b

.tl-partial-entry
    .tl-label
        color #f59e0b

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

// ── Badges ────────────────────────────────────────────────────────────────────
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

// ── Modals ────────────────────────────────────────────────────────────────────
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

.form-textarea
    width 100%
    background #2a2a30
    border 1px solid rgba(255,255,255,0.08)
    color #e2e8f0
    border-radius 6px
    padding 0.6rem 0.75rem
    font-size 0.875rem
    resize vertical
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
