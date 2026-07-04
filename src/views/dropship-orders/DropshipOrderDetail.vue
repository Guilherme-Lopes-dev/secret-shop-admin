<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { adminService } from '@/services/admin/admin.service'
import type {
    DropshipNotificationDto,
    DropshipNotificationItem,
} from '@/services/admin/types'
import { formatCurrency } from '@/utils/formatCurrency'
import { countryName } from '@/utils/countries'
import { buildSteamImageUrl } from '@/utils/steamImage'

interface DropshipSnapshotItem {
    inventory_uuid?: string | null
    skin_name?: string
    unit_price?: number
    quantity?: number
    subtotal?: number
    is_dropship?: boolean
    market_hash_name?: string
    steam_market_url?: string
}

interface OperationItem extends DropshipSnapshotItem {
    notificationItem?: DropshipNotificationItem
    saleItem?: Record<string, any>
}

const route = useRoute()
const router = useRouter()
const sale = ref<Record<string, any> | null>(null)
const notification = ref<DropshipNotificationDto | null>(null)
const loading = ref(true)
const error = ref('')
const resolving = ref(false)
const copiedKey = ref('')
let copyTimer: ReturnType<typeof setTimeout> | null = null

const metadata = computed(() => notification.value?.metadata ?? null)
const snapshot = computed<Record<string, any>>(() => {
    const data = sale.value?.snapshot_data
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
})

const snapshotDropshipItems = computed<DropshipSnapshotItem[]>(() => {
    const items = Array.isArray(snapshot.value.items) ? snapshot.value.items : []
    return items.filter((item: DropshipSnapshotItem) => item?.is_dropship === true)
})

const operationItems = computed<OperationItem[]>(() => {
    const snapshotItems = snapshotDropshipItems.value
    const notificationItems = metadata.value?.items ?? []
    const saleItems = Array.isArray(sale.value?.sale_items) ? sale.value.sale_items : []

    if (snapshotItems.length) {
        return snapshotItems.map((item, index) => ({
            ...item,
            // Nome primeiro: índices desalinham quando a venda mistura dropship e estoque.
            notificationItem: notificationItems.find(candidate => candidate.name === item.skin_name)
                ?? notificationItems[index],
            saleItem: saleItems.find((candidate: any) => candidate.skin_name === item.skin_name),
        }))
    }

    return notificationItems.map((item) => ({
        skin_name: item.name,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.unitPrice * item.quantity,
        steam_market_url: item.steamMarketUrl ?? undefined,
        notificationItem: item,
        saleItem: saleItems.find((candidate: any) => candidate.skin_name === item.name),
    }))
})

const isResolved = computed(() => notification.value?.is_read === true)
const orderNumber = computed(() =>
    sale.value?.order_number ?? metadata.value?.orderNumber ?? 'Pedido dropship',
)
const tradeLink = computed(() =>
    sale.value?.users?.trade_link ?? metadata.value?.tradeLink ?? null,
)
const safeTradeLink = computed(() => {
    const value = tradeLink.value
    return typeof value === 'string' && /^https:\/\/steamcommunity\.com\//i.test(value)
        ? value
        : null
})
const whatsappLink = computed(() => {
    const contact = String(sale.value?.users?.contact ?? metadata.value?.contact ?? '')
    const digits = contact.replace(/\D/g, '')
    return digits ? `https://wa.me/${digits}` : null
})
const rawTechnicalData = computed(() => JSON.stringify({
    sale: sale.value,
    notification: notification.value,
}, null, 2))

const findNotification = async (saleUuid: string) => {
    // Vinda da listagem: o alerta chega pelo history state, sem busca extra.
    const fromState = history.state?.dropshipNotification as DropshipNotificationDto | undefined
    if (fromState?.metadata?.saleUuid === saleUuid) return fromState

    // ponytail: acesso direto por URL varre até 500 alertas; criar GET /admin/notifications/:id se a fila crescer.
    const notificationId = String(route.query.notification ?? '')
    const response = await adminService.getDropshipNotifications(1, 500, false)
    const entries = response.data.data

    return entries.find(entry => entry.id === notificationId)
        ?? entries.find(entry => entry.metadata?.saleUuid === saleUuid)
        ?? null
}

const fetchDetail = async () => {
    loading.value = true
    error.value = ''
    const saleUuid = route.params.uuid as string

    try {
        const [saleResponse, foundNotification] = await Promise.all([
            adminService.getSaleById(saleUuid),
            findNotification(saleUuid),
        ])

        sale.value = saleResponse.data
        notification.value = foundNotification
    } catch (requestError: any) {
        console.error('Erro ao carregar envio dropship:', requestError)
        error.value = requestError?.response?.data?.message || 'Não foi possível carregar o pedido.'
    } finally {
        loading.value = false
    }
}

const itemImage = (item: OperationItem) =>
    buildSteamImageUrl(item.saleItem?.skin_image ?? item.saleItem?.bot_inventory?.skins?.icon_url_large)
const itemName = (item: OperationItem) =>
    item.skin_name ?? item.notificationItem?.name ?? item.saleItem?.skin_name ?? 'Item dropship'
const itemQuantity = (item: OperationItem) =>
    item.quantity ?? item.notificationItem?.quantity ?? item.saleItem?.quantity ?? 1
const itemUnitPrice = (item: OperationItem) =>
    item.unit_price ?? item.notificationItem?.unitPrice ?? item.saleItem?.unit_price ?? 0
const itemSubtotal = (item: OperationItem) =>
    item.subtotal ?? item.saleItem?.price ?? itemUnitPrice(item) * itemQuantity(item)
const itemMarketUrl = (item: OperationItem) =>
    item.steam_market_url ?? item.notificationItem?.steamMarketUrl ?? null

const paymentStatusLabel = (status: string | null | undefined) => ({
    PENDING: 'Pendente',
    AWAITING_PAYMENT: 'Aguardando pagamento',
    PAID: 'Pago',
    COMPLETED: 'Concluído',
    APPROVED: 'Aprovado',
    EXPIRED: 'Expirado',
    CANCELLED: 'Cancelado',
    CANCELED: 'Cancelado',
    REFUNDED: 'Reembolsado',
    FAILED: 'Falhou',
}[String(status ?? '').toUpperCase()] ?? status ?? '-')
const paymentMethodLabel = (method: string | null | undefined) => ({
    PIX: 'PIX',
    BOLETO: 'Boleto',
    CREDIT_CARD: 'Cartão de crédito',
    PAYMENT_LINK: 'Link de pagamento',
}[String(method ?? '').toUpperCase()] ?? method ?? '-')

const copyValue = async (value: string | null | undefined, key: string) => {
    if (!value) return
    try {
        await navigator.clipboard.writeText(value)
        copiedKey.value = key
        if (copyTimer) clearTimeout(copyTimer)
        copyTimer = setTimeout(() => {
            copiedKey.value = ''
        }, 1800)
    } catch {
        toast.error('Não foi possível copiar.')
    }
}

const markResolved = async () => {
    if (!notification.value || notification.value.is_read) return
    resolving.value = true
    try {
        await adminService.markDropshipNotificationRead(notification.value.id)
        notification.value = {
            ...notification.value,
            is_read: true,
            read_at: new Date().toISOString(),
        }
        toast.success('Envio removido da fila pendente.')
    } catch (requestError) {
        console.error('Erro ao resolver envio dropship:', requestError)
        toast.error('Não foi possível resolver este envio.')
    } finally {
        resolving.value = false
    }
}

onMounted(fetchDetail)
onUnmounted(() => {
    if (copyTimer) clearTimeout(copyTimer)
})
</script>

<template>
    <div class="view-wrap">
        <button class="back-btn" @click="router.push('/dropship-orders')">
            <Icon icon="mdi:arrow-left" />
            Fila de envios
        </button>

        <div v-if="loading" class="state-card">
            <Icon icon="mdi:loading" class="spin" />
            Carregando todos os dados do pedido...
        </div>

        <div v-else-if="error" class="state-card state-card--error">
            <Icon icon="mdi:alert-circle-outline" />
            <div>
                <strong>Falha ao carregar o pedido</strong>
                <p>{{ error }}</p>
            </div>
        </div>

        <template v-else-if="sale">
            <header class="detail-header">
                <div>
                    <div class="eyebrow">Operação manual · Dropship</div>
                    <div class="heading-row">
                        <h1>{{ orderNumber }}</h1>
                        <span class="queue-badge" :class="{ resolved: isResolved }">
                            <span></span>
                            {{ isResolved ? 'Resolvido' : 'Pendente de envio' }}
                        </span>
                    </div>
                    <p>
                        Compra confirmada em
                        {{ $dayjs(notification?.created_at ?? sale.created_at).format('DD/MM/YYYY [às] HH:mm') }}
                    </p>
                </div>

                <button
                    v-if="notification && !isResolved"
                    class="complete-btn"
                    :disabled="resolving"
                    @click="markResolved"
                >
                    <Icon :icon="resolving ? 'mdi:loading' : 'mdi:check-circle-outline'" :class="{ spin: resolving }" />
                    {{ resolving ? 'Concluindo...' : 'Marcar como resolvido' }}
                </button>
            </header>

            <section class="workflow-card">
                <div class="workflow-step done">
                    <span><Icon icon="mdi:credit-card-check-outline" /></span>
                    <div>
                        <strong>Pagamento confirmado</strong>
                        <small>{{ paymentStatusLabel(sale.payment_status) }}</small>
                    </div>
                </div>
                <Icon icon="mdi:chevron-right" class="workflow-arrow" />
                <div class="workflow-step active">
                    <span><Icon icon="mdi:steam" /></span>
                    <div>
                        <strong>Comprar no Market</strong>
                        <small>{{ operationItems.length }} item{{ operationItems.length === 1 ? '' : 's' }}</small>
                    </div>
                </div>
                <Icon icon="mdi:chevron-right" class="workflow-arrow" />
                <div class="workflow-step" :class="{ done: isResolved }">
                    <span><Icon icon="mdi:swap-horizontal" /></span>
                    <div>
                        <strong>Enviar ao cliente</strong>
                        <small>{{ isResolved ? 'Operação resolvida' : 'Aguardando envio manual' }}</small>
                    </div>
                </div>
            </section>

            <div class="content-grid">
                <main class="main-column">
                    <section class="section">
                        <div class="section-heading">
                            <div>
                                <span class="section-kicker">Ação necessária</span>
                                <h2>Produtos para comprar e enviar</h2>
                            </div>
                            <span class="item-count">{{ operationItems.length }}</span>
                        </div>

                        <div class="operation-list">
                            <article
                                v-for="(item, index) in operationItems"
                                :key="`${itemName(item)}-${index}`"
                                class="operation-item"
                            >
                                <div class="item-visual">
                                    <img
                                        v-if="itemImage(item)"
                                        :src="itemImage(item)!"
                                        :alt="itemName(item)"
                                    />
                                    <Icon v-else icon="mdi:sword-cross" />
                                </div>

                                <div class="item-body">
                                    <div class="item-topline">
                                        <div>
                                            <h3>{{ itemName(item) }}</h3>
                                            <code v-if="item.market_hash_name">{{ item.market_hash_name }}</code>
                                        </div>
                                        <div class="item-price">
                                            <strong>{{ formatCurrency(itemSubtotal(item)) }}</strong>
                                            <small>{{ itemQuantity(item) }} × {{ formatCurrency(itemUnitPrice(item)) }}</small>
                                        </div>
                                    </div>

                                    <div class="item-meta">
                                        <span>
                                            <small>Quantidade</small>
                                            <strong>{{ itemQuantity(item) }}</strong>
                                        </span>
                                        <span>
                                            <small>ID da linha</small>
                                            <code>{{ item.saleItem?.uuid ?? '-' }}</code>
                                        </span>
                                        <span>
                                            <small>Inventário</small>
                                            <strong class="dropship-value">Manual · sem asset</strong>
                                        </span>
                                    </div>

                                    <div class="item-actions">
                                        <a
                                            v-if="itemMarketUrl(item)"
                                            :href="itemMarketUrl(item)!"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="market-btn"
                                        >
                                            <Icon icon="mdi:steam" />
                                            Comprar no Steam Market
                                            <Icon icon="mdi:open-in-new" />
                                        </a>
                                        <span v-else class="missing-link">
                                            <Icon icon="mdi:link-off" />
                                            Link do Market indisponível
                                        </span>

                                        <button
                                            v-if="itemMarketUrl(item)"
                                            class="copy-btn"
                                            @click="copyValue(itemMarketUrl(item), `market-${index}`)"
                                        >
                                            <Icon :icon="copiedKey === `market-${index}` ? 'mdi:check' : 'mdi:content-copy'" />
                                            {{ copiedKey === `market-${index}` ? 'Copiado' : 'Copiar link' }}
                                        </button>
                                    </div>
                                </div>
                            </article>

                            <div v-if="operationItems.length === 0" class="empty-items">
                                Nenhum item dropship foi encontrado no snapshot da venda.
                            </div>
                        </div>
                    </section>

                    <section class="section">
                        <div class="section-heading">
                            <div>
                                <span class="section-kicker">Financeiro</span>
                                <h2>Resumo da venda</h2>
                            </div>
                        </div>

                        <div class="summary-grid">
                            <div class="summary-card">
                                <span>Subtotal</span>
                                <strong>{{ formatCurrency(sale.subtotal_amount) }}</strong>
                            </div>
                            <div class="summary-card">
                                <span>Descontos</span>
                                <strong>{{ formatCurrency(sale.discount_amount) }}</strong>
                            </div>
                            <div class="summary-card summary-card--total">
                                <span>Total pago</span>
                                <strong>{{ formatCurrency(sale.total_amount) }}</strong>
                            </div>
                            <div class="summary-card">
                                <span>Método</span>
                                <strong>{{ paymentMethodLabel(snapshot.payment_method) }}</strong>
                            </div>
                        </div>

                        <div class="detail-list">
                            <div>
                                <span>Status do pagamento</span>
                                <strong>{{ paymentStatusLabel(sale.payment_status) }}</strong>
                            </div>
                            <div>
                                <span>Status de fulfillment</span>
                                <strong>{{ sale.fulfillment_status ?? '-' }}</strong>
                            </div>
                            <div>
                                <span>Provedor</span>
                                <strong>{{ sale.payment_provider ?? '-' }}</strong>
                            </div>
                            <div>
                                <span>ID do pagamento</span>
                                <code>{{ sale.payment_id ?? '-' }}</code>
                            </div>
                            <div>
                                <span>Desconto Secret Pass</span>
                                <strong>{{ formatCurrency(sale.pass_discount_amount ?? 0) }}</strong>
                            </div>
                            <div>
                                <span>Desconto de cupom</span>
                                <strong>{{ formatCurrency(sale.coupon_discount_amount ?? 0) }}</strong>
                            </div>
                            <div>
                                <span>Cashback usado</span>
                                <strong>{{ formatCurrency(sale.cashback_used ?? 0) }}</strong>
                            </div>
                            <div v-if="sale.coupon">
                                <span>Cupom</span>
                                <strong>{{ sale.coupon.code }}</strong>
                            </div>
                        </div>
                    </section>

                    <section class="section">
                        <details class="technical-details">
                            <summary>
                                <span>
                                    <Icon icon="mdi:code-json" />
                                    Dados técnicos completos
                                </span>
                                <Icon icon="mdi:chevron-down" class="details-chevron" />
                            </summary>
                            <p>Snapshot, antifraude, históricos, eventos de pagamento e trades.</p>
                            <pre>{{ rawTechnicalData }}</pre>
                        </details>
                    </section>
                </main>

                <aside class="side-column">
                    <section class="section sticky-section">
                        <div class="section-heading">
                            <div>
                                <span class="section-kicker">Entrega</span>
                                <h2>Cliente e Trade</h2>
                            </div>
                        </div>

                        <div class="customer-profile">
                            <span class="customer-avatar">
                                <Icon icon="mdi:account" />
                            </span>
                            <div>
                                <strong>{{ sale.users?.username ?? metadata?.userName ?? 'Cliente' }}</strong>
                                <small>{{ sale.users?.email ?? metadata?.email ?? 'Sem e-mail' }}</small>
                            </div>
                        </div>

                        <a
                            v-if="safeTradeLink"
                            :href="safeTradeLink"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="primary-trade-btn"
                        >
                            <Icon icon="mdi:swap-horizontal" />
                            Abrir trade link
                            <Icon icon="mdi:open-in-new" />
                        </a>

                        <div v-else class="trade-warning">
                            <Icon icon="mdi:alert-outline" />
                            Trade link ausente ou inválido
                        </div>

                        <button
                            v-if="tradeLink"
                            class="secondary-action"
                            @click="copyValue(tradeLink, 'trade')"
                        >
                            <Icon :icon="copiedKey === 'trade' ? 'mdi:check' : 'mdi:content-copy'" />
                            {{ copiedKey === 'trade' ? 'Trade link copiado' : 'Copiar trade link' }}
                        </button>

                        <a
                            v-if="whatsappLink"
                            :href="whatsappLink"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="secondary-action whatsapp-action"
                        >
                            <Icon icon="mdi:whatsapp" />
                            Chamar no WhatsApp
                        </a>

                        <div class="detail-list side-list">
                            <div>
                                <span>Steam ID</span>
                                <div class="copyable-value">
                                    <code>{{ metadata?.steamId ?? '-' }}</code>
                                    <button
                                        v-if="metadata?.steamId"
                                        @click="copyValue(metadata.steamId, 'steam-id')"
                                    >
                                        <Icon :icon="copiedKey === 'steam-id' ? 'mdi:check' : 'mdi:content-copy'" />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <span>Contato</span>
                                <strong>{{ sale.users?.contact ?? metadata?.contact ?? '-' }}</strong>
                            </div>
                            <div>
                                <span>UUID do cliente</span>
                                <code>{{ sale.users?.uuid ?? '-' }}</code>
                            </div>
                            <div>
                                <span>IP</span>
                                <code>{{ sale.ip_address ?? '-' }}</code>
                            </div>
                            <div>
                                <span>País do IP</span>
                                <strong>
                                    {{ sale.ip_country
                                        ? `${sale.ip_country} · ${countryName(sale.ip_country)}`
                                        : '-' }}
                                </strong>
                            </div>
                            <div>
                                <span>Score antifraude</span>
                                <strong>{{ sale.anti_fraud_score ?? '-' }}</strong>
                            </div>
                        </div>
                    </section>

                    <section class="section">
                        <div class="section-heading">
                            <div>
                                <span class="section-kicker">Registro</span>
                                <h2>Pedido e sistema</h2>
                            </div>
                        </div>

                        <div class="detail-list side-list">
                            <div>
                                <span>Número do pedido</span>
                                <code>{{ orderNumber }}</code>
                            </div>
                            <div>
                                <span>UUID da venda</span>
                                <code>{{ sale.uuid }}</code>
                            </div>
                            <div>
                                <span>ID interno</span>
                                <code>{{ sale.id }}</code>
                            </div>
                            <div>
                                <span>ID do alerta</span>
                                <code>{{ notification?.id ?? '-' }}</code>
                            </div>
                            <div>
                                <span>Criado em</span>
                                <strong>{{ $dayjs(sale.created_at).format('DD/MM/YYYY HH:mm:ss') }}</strong>
                            </div>
                            <div>
                                <span>Atualizado em</span>
                                <strong>{{ $dayjs(sale.updated_at).format('DD/MM/YYYY HH:mm:ss') }}</strong>
                            </div>
                            <div>
                                <span>Expira em</span>
                                <strong>
                                    {{ sale.expires_at
                                        ? $dayjs(sale.expires_at).format('DD/MM/YYYY HH:mm:ss')
                                        : '-' }}
                                </strong>
                            </div>
                            <div>
                                <span>Resolvido em</span>
                                <strong>
                                    {{ notification?.read_at
                                        ? $dayjs(notification.read_at).format('DD/MM/YYYY HH:mm:ss')
                                        : '-' }}
                                </strong>
                            </div>
                            <div>
                                <span>Idempotência</span>
                                <code>{{ sale.idempotency_key ?? '-' }}</code>
                            </div>
                            <div>
                                <span>Fingerprint</span>
                                <code>{{ sale.device_fingerprint ?? '-' }}</code>
                            </div>
                        </div>
                    </section>
                </aside>
            </div>
        </template>
    </div>
</template>

<style lang="stylus" scoped>
.view-wrap
    min-height 100vh
    padding 2rem
    color #f8fafc
    background #121214

.back-btn
    display inline-flex
    align-items center
    gap 0.4rem
    margin-bottom 1.25rem
    padding 0.4rem 0
    border 0
    color #94a3b8
    background transparent
    cursor pointer
    font-size 0.82rem

    &:hover
        color #fff

.state-card
    min-height 320px
    display flex
    align-items center
    justify-content center
    gap 0.65rem
    border 1px solid rgba(255,255,255,0.06)
    border-radius 12px
    color #94a3b8
    background #1a1a1e

    &--error
        color #fca5a5

        p
            margin 0.2rem 0 0
            color #94a3b8

.detail-header
    display flex
    align-items flex-end
    justify-content space-between
    gap 1.25rem
    margin-bottom 1.25rem

    h1
        margin 0
        font-size 1.9rem

    p
        margin 0.35rem 0 0
        color #64748b
        font-size 0.82rem

.eyebrow,
.section-kicker
    display block
    margin-bottom 0.35rem
    color #f59e0b
    font-size 0.68rem
    font-weight 700
    text-transform uppercase
    letter-spacing 0.08em

.heading-row
    display flex
    align-items center
    gap 0.8rem
    flex-wrap wrap

.queue-badge
    display inline-flex
    align-items center
    gap 0.4rem
    padding 0.3rem 0.65rem
    border 1px solid rgba(245,158,11,0.22)
    border-radius 999px
    color #fbbf24
    background rgba(245,158,11,0.1)
    font-size 0.7rem
    font-weight 650

    span
        width 6px
        height 6px
        border-radius 50%
        background currentColor

    &.resolved
        border-color rgba(34,197,94,0.22)
        color #4ade80
        background rgba(34,197,94,0.1)

.complete-btn
    height 42px
    display inline-flex
    align-items center
    gap 0.45rem
    padding 0 1rem
    border 1px solid rgba(34,197,94,0.22)
    border-radius 9px
    color #dcfce7
    background rgba(22,163,74,0.85)
    cursor pointer
    font-size 0.8rem
    font-weight 650

    &:hover:not(:disabled)
        background rgba(22,163,74,1)

    &:disabled
        opacity 0.55

.workflow-card
    display flex
    align-items center
    justify-content center
    gap 1.2rem
    margin-bottom 1.25rem
    padding 1rem 1.2rem
    border 1px solid rgba(255,255,255,0.06)
    border-radius 12px
    background #18181c

.workflow-step
    display flex
    align-items center
    gap 0.65rem
    color #64748b

    > span
        width 34px
        height 34px
        display grid
        place-items center
        border 1px solid rgba(255,255,255,0.08)
        border-radius 50%
        background rgba(255,255,255,0.03)

    div
        display flex
        flex-direction column
        gap 0.12rem

    strong
        color #94a3b8
        font-size 0.78rem

    small
        font-size 0.68rem

    &.active
        color #f59e0b

        > span
            border-color rgba(245,158,11,0.25)
            background rgba(245,158,11,0.1)

        strong
            color #fbbf24

    &.done
        color #4ade80

        > span
            border-color rgba(34,197,94,0.22)
            background rgba(34,197,94,0.09)

        strong
            color #86efac

.workflow-arrow
    color #334155

.content-grid
    display grid
    grid-template-columns minmax(0, 1.65fr) minmax(310px, 0.8fr)
    gap 1.1rem
    align-items start

.main-column,
.side-column
    min-width 0
    display flex
    flex-direction column
    gap 1.1rem

.section
    padding 1.25rem
    border 1px solid rgba(255,255,255,0.06)
    border-radius 12px
    background #1a1a1e

.sticky-section
    position sticky
    top 1rem

.section-heading
    display flex
    align-items center
    justify-content space-between
    gap 1rem
    margin-bottom 1rem

    h2
        margin 0
        color #e2e8f0
        font-size 1rem

.item-count
    min-width 28px
    height 28px
    display grid
    place-items center
    border-radius 8px
    color #a5b4fc
    background rgba(99,102,241,0.1)
    font-size 0.75rem
    font-weight 700

.operation-list
    display flex
    flex-direction column
    gap 0.75rem

.operation-item
    display flex
    gap 1rem
    padding 1rem
    border 1px solid rgba(255,255,255,0.06)
    border-radius 11px
    background rgba(255,255,255,0.018)

.item-visual
    width 88px
    height 88px
    flex-shrink 0
    display grid
    place-items center
    overflow hidden
    border 1px solid rgba(99,102,241,0.14)
    border-radius 10px
    color #818cf8
    background radial-gradient(circle, rgba(99,102,241,0.12), rgba(99,102,241,0.02))
    font-size 1.8rem

    img
        width 100%
        height 100%
        object-fit contain

.item-body
    min-width 0
    flex 1

.item-topline
    display flex
    align-items flex-start
    justify-content space-between
    gap 1rem

    h3
        margin 0 0 0.25rem
        color #f1f5f9
        font-size 0.95rem

    code
        display block
        max-width 460px
        color #64748b
        font-size 0.67rem
        white-space nowrap
        overflow hidden
        text-overflow ellipsis

.item-price
    flex-shrink 0
    display flex
    flex-direction column
    align-items flex-end

    strong
        color #4ade80
        font-size 0.95rem

    small
        margin-top 0.15rem
        color #64748b
        font-size 0.68rem

.item-meta
    display grid
    grid-template-columns repeat(3, minmax(0, 1fr))
    gap 0.75rem
    margin-top 0.75rem
    padding 0.65rem 0
    border-top 1px solid rgba(255,255,255,0.04)
    border-bottom 1px solid rgba(255,255,255,0.04)

    span
        min-width 0
        display flex
        flex-direction column
        gap 0.15rem

    small
        color #64748b
        font-size 0.63rem
        text-transform uppercase

    strong,
    code
        color #cbd5e1
        font-size 0.73rem
        overflow hidden
        text-overflow ellipsis

    .dropship-value
        color #fbbf24

.item-actions
    display flex
    align-items center
    gap 0.5rem
    margin-top 0.75rem
    flex-wrap wrap

.market-btn,
.copy-btn,
.secondary-action,
.primary-trade-btn
    height 36px
    display inline-flex
    align-items center
    justify-content center
    gap 0.4rem
    border-radius 8px
    text-decoration none
    font-size 0.74rem
    font-weight 650

.market-btn
    padding 0 0.75rem
    color #fff
    background #2563eb

    &:hover
        background #1d4ed8

.copy-btn
    padding 0 0.7rem
    border 1px solid rgba(255,255,255,0.08)
    color #94a3b8
    background rgba(255,255,255,0.03)
    cursor pointer

    &:hover
        color #e2e8f0

.missing-link
    display inline-flex
    align-items center
    gap 0.4rem
    color #fca5a5
    font-size 0.74rem

.empty-items
    padding 2rem
    border 1px dashed rgba(255,255,255,0.08)
    border-radius 9px
    color #64748b
    text-align center
    font-size 0.8rem

.summary-grid
    display grid
    grid-template-columns repeat(4, minmax(0, 1fr))
    gap 0.65rem
    margin-bottom 1rem

.summary-card
    display flex
    flex-direction column
    gap 0.3rem
    padding 0.75rem
    border 1px solid rgba(255,255,255,0.05)
    border-radius 9px
    background rgba(255,255,255,0.02)

    span
        color #64748b
        font-size 0.66rem
        text-transform uppercase

    strong
        color #cbd5e1
        font-size 0.84rem

    &--total
        border-color rgba(34,197,94,0.14)
        background rgba(34,197,94,0.05)

        strong
            color #4ade80

.detail-list
    display grid
    grid-template-columns repeat(2, minmax(0, 1fr))
    gap 0
    border-top 1px solid rgba(255,255,255,0.05)

    > div
        min-width 0
        display flex
        flex-direction column
        gap 0.25rem
        padding 0.75rem 0
        border-bottom 1px solid rgba(255,255,255,0.04)

        &:nth-child(odd)
            padding-right 1rem

    span
        color #64748b
        font-size 0.67rem
        text-transform uppercase
        letter-spacing 0.03em

    strong,
    code
        color #cbd5e1
        font-size 0.78rem
        word-break break-all

.side-list
    grid-template-columns 1fr
    margin-top 1rem

    > div:nth-child(odd)
        padding-right 0

.customer-profile
    display flex
    align-items center
    gap 0.7rem
    margin-bottom 0.9rem

    > div
        min-width 0
        display flex
        flex-direction column

    strong
        color #e2e8f0
        font-size 0.86rem

    small
        color #64748b
        font-size 0.72rem
        white-space nowrap
        overflow hidden
        text-overflow ellipsis

.customer-avatar
    width 38px
    height 38px
    flex-shrink 0
    display grid
    place-items center
    border-radius 50%
    color #a5b4fc
    background rgba(99,102,241,0.12)

.primary-trade-btn
    width 100%
    height 42px
    color #fff
    background #4f46e5

    &:hover
        background #4338ca

.secondary-action
    width 100%
    margin-top 0.5rem
    border 1px solid rgba(255,255,255,0.08)
    color #cbd5e1
    background rgba(255,255,255,0.03)
    cursor pointer

    &:hover
        background rgba(255,255,255,0.06)

.whatsapp-action
    color #86efac
    border-color rgba(34,197,94,0.16)
    background rgba(34,197,94,0.06)

.trade-warning
    display flex
    align-items center
    gap 0.45rem
    padding 0.75rem
    border 1px solid rgba(239,68,68,0.16)
    border-radius 8px
    color #fca5a5
    background rgba(239,68,68,0.06)
    font-size 0.75rem

.copyable-value
    display flex
    align-items center
    gap 0.35rem

    button
        padding 0
        border 0
        color #64748b
        background transparent
        cursor pointer

        &:hover
            color #cbd5e1

.technical-details
    summary
        display flex
        align-items center
        justify-content space-between
        color #cbd5e1
        cursor pointer
        list-style none

        span
            display flex
            align-items center
            gap 0.45rem
            font-size 0.82rem
            font-weight 650

    &[open] .details-chevron
        transform rotate(180deg)

    p
        margin 0.75rem 0
        color #64748b
        font-size 0.74rem

    pre
        max-height 520px
        overflow auto
        margin 0
        padding 0.9rem
        border-radius 8px
        color #a5b4fc
        background #111114
        font-size 0.69rem
        line-height 1.55
        white-space pre-wrap
        word-break break-word

.details-chevron
    transition transform 0.2s ease

.spin
    animation spin 0.85s linear infinite

@keyframes spin
    from
        transform rotate(0deg)
    to
        transform rotate(360deg)

@media (max-width: 1100px)
    .content-grid
        grid-template-columns 1fr

    .sticky-section
        position static

@media (max-width: 760px)
    .view-wrap
        padding 1.2rem

    .detail-header
        align-items flex-start
        flex-direction column

    .workflow-card
        align-items stretch
        flex-direction column
        gap 0.7rem

    .workflow-arrow
        display none

    .operation-item
        flex-direction column

    .item-visual
        width 72px
        height 72px

    .item-topline
        flex-direction column

    .item-price
        align-items flex-start

    .item-meta,
    .summary-grid,
    .detail-list
        grid-template-columns 1fr

    .detail-list > div:nth-child(odd)
        padding-right 0
</style>
