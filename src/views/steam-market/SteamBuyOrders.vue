<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import ConfirmActionModal from '@/components/common/ConfirmActionModal.vue'
import InfoTip from '@/components/common/InfoTip.vue'
import { adminService } from '@/services/admin/admin.service'
import type { SteamOpenBuyOrder } from '@/services/admin/types'
import { buildSteamImageUrl } from '@/utils/steamImage'
import { formatMoney } from './marketMath'
import { useSteamBotWallet } from './useSteamBotWallet'

const TIP =
    'Buy orders abertas na conta Steam do bot, lidas direto da Steam (inclui as criadas fora do admin). ' +
    'Ordem que já executou por inteiro some daqui; o item cai no inventário do bot com 7 dias de trava.'

const { bots, botId, botName, wallet, walletError, walletLoading } = useSteamBotWallet()

const orders = ref<SteamOpenBuyOrder[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
const fetchedAt = ref<string | null>(null)
const toCancel = ref<SteamOpenBuyOrder | null>(null)
const cancelling = ref(false)

const errorMessage = (error: unknown, fallback: string) =>
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback

const load = async () => {
    const id = botId.value
    orders.value = []
    loadError.value = null
    if (!id) return

    loading.value = true
    try {
        const { data } = await adminService.getSteamBuyOrders(id)
        if (id !== botId.value) return
        orders.value = data.orders
        fetchedAt.value = new Date().toISOString()
    } catch (error) {
        if (id === botId.value) loadError.value = errorMessage(error, 'Não deu pra ler as buy orders do bot.')
    } finally {
        // Trocou de bot no meio: quem desliga o loading é a consulta nova.
        if (id === botId.value) loading.value = false
    }
}

watch(botId, load, { immediate: true })

const closeCancelModal = (open: boolean) => {
    if (!open) toCancel.value = null
}

const currency = computed(() => wallet.value?.currency ?? orders.value[0]?.currency ?? 'BRL')
const committedCents = (order: SteamOpenBuyOrder) => order.priceCents * order.quantityRemaining
const totalCommitted = computed(() => orders.value.reduce((sum, order) => sum + committedCents(order), 0))
const pendingItems = computed(() => orders.value.reduce((sum, order) => sum + order.quantityRemaining, 0))
const overBalance = computed(() => wallet.value != null && totalCommitted.value > wallet.value.balanceCents)

const itemImage = (order: SteamOpenBuyOrder) => buildSteamImageUrl(order.icon, '64fx64f')
const liveRoute = (order: SteamOpenBuyOrder) => ({ name: 'steam-market', query: { name: order.marketHashName } })

const cancelDescription = computed(() => {
    const order = toCancel.value
    if (!order) return ''
    return `Cancelar a ordem de ${order.quantityRemaining}× "${order.name ?? order.marketHashName}" a ` +
        `${formatMoney(order.priceCents, order.currency)} cada, na conta ${botName.value}?`
})

const confirmCancel = async () => {
    const order = toCancel.value
    if (!order || cancelling.value) return

    cancelling.value = true
    try {
        await adminService.cancelSteamBuyOrder(botId.value, order.buyOrderId)
        orders.value = orders.value.filter(item => item.buyOrderId !== order.buyOrderId)
        toast.success(`Buy order ${order.buyOrderId} cancelada.`)
        toCancel.value = null
    } catch (error) {
        toast.error(errorMessage(error, 'Não deu pra cancelar a buy order.'))
    } finally {
        cancelling.value = false
    }
}
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Buy orders <InfoTip :text="TIP" align="left" /></h1>
                <p class="page-sub">Ordens de compra abertas no Steam Market, por conta.</p>
            </div>
            <div class="header-actions">
                <span v-if="fetchedAt" class="fetched">Consultado às {{ dayjs(fetchedAt).format('HH:mm:ss') }}</span>
                <RouterLink :to="{ name: 'steam-market' }" class="btn">
                    <Icon icon="mdi:chart-timeline-variant" /> Market ao vivo
                </RouterLink>
                <button class="btn" :disabled="!botId || loading" @click="load">
                    <Icon icon="mdi:refresh" :class="{ spin: loading }" /> Atualizar
                </button>
            </div>
        </header>

        <section class="toolbar">
            <label class="field">
                <span class="field-label">Conta (bot)</span>
                <select v-model="botId" :disabled="loading">
                    <option v-if="!bots.length" value="">Nenhum bot ativo</option>
                    <option v-for="bot in bots" :key="bot.id" :value="bot.id">{{ bot.name }}</option>
                </select>
            </label>

            <div class="kpi">
                <span class="kpi-label">Saldo da carteira</span>
                <span v-if="walletLoading" class="kpi-sub">Lendo...</span>
                <span v-else-if="wallet" class="kpi-value">{{ formatMoney(wallet.balanceCents, wallet.currency) }}</span>
                <span v-else class="kpi-sub error">{{ walletError ?? '—' }}</span>
            </div>
            <div class="kpi">
                <span class="kpi-label">Comprometido nas ordens</span>
                <span class="kpi-value" :class="{ danger: overBalance }">{{ formatMoney(totalCommitted, currency) }}</span>
                <span v-if="overBalance" class="kpi-sub error">Acima do saldo</span>
            </div>
            <div class="kpi">
                <span class="kpi-label">Ordens · itens pendentes</span>
                <span class="kpi-value">{{ orders.length }} · {{ pendingItems }}</span>
            </div>
        </section>

        <p v-if="loadError" class="panel-error">{{ loadError }}</p>

        <div v-else-if="loading && !orders.length" class="empty-state">Consultando a Steam...</div>

        <div v-else-if="!orders.length" class="empty-state">
            <Icon icon="mdi:cart-off" class="empty-icon" />
            <p>Nenhuma buy order aberta nessa conta.</p>
        </div>

        <section v-else class="section">
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th class="num">Preço/un (com taxa)</th>
                            <th class="num">Restante</th>
                            <th class="num">Comprometido</th>
                            <th>buy_orderid</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="order in orders" :key="order.buyOrderId">
                            <td>
                                <div class="item">
                                    <img v-if="itemImage(order)" :src="itemImage(order)!" alt="" />
                                    <span class="item-name">{{ order.name ?? order.marketHashName ?? '—' }}</span>
                                </div>
                            </td>
                            <td class="num strong">{{ formatMoney(order.priceCents, order.currency) }}</td>
                            <td class="num">{{ order.quantityRemaining }} / {{ order.quantity }}</td>
                            <td class="num">{{ formatMoney(committedCents(order), order.currency) }}</td>
                            <td class="mono muted">{{ order.buyOrderId }}</td>
                            <td class="actions">
                                <RouterLink v-if="order.marketHashName" :to="liveRoute(order)" class="btn btn-small">
                                    <Icon icon="mdi:chart-timeline-variant" /> Mercado
                                </RouterLink>
                                <button class="btn btn-small btn-danger" :disabled="cancelling" @click="toCancel = order">
                                    Cancelar
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <ConfirmActionModal
            :open="toCancel !== null"
            title="Cancelar buy order"
            :description="cancelDescription"
            confirm-label="Cancelar ordem"
            loading-label="Cancelando..."
            icon="mdi:cart-remove"
            variant="danger"
            :delay-seconds="0"
            :loading="cancelling"
            @update:open="closeCancelModal"
            @confirm="confirmCancel"
        />
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
    justify-content space-between
    align-items flex-start
    flex-wrap wrap
    gap 1rem
    margin-bottom 1.25rem

.page-title
    font-size 1.5rem
    font-weight 700
    display flex
    align-items center
    gap 0.5rem

.page-sub
    color #94a3b8
    font-size 0.9rem
    margin-top 0.25rem

.header-actions
    display flex
    align-items center
    gap 0.75rem
    flex-wrap wrap

.fetched
    color #64748b
    font-size 0.8rem

.btn
    display inline-flex
    align-items center
    gap 0.4rem
    background #1a1a1e
    color #cbd5e1
    border 1px solid rgba(255,255,255,0.1)
    padding 0.5rem 1rem
    border-radius 8px
    font-size 0.875rem
    cursor pointer
    text-decoration none
    white-space nowrap

    &:hover:not(:disabled)
        background #2a2a30

    &:disabled
        opacity 0.5
        cursor default

.btn-small
    padding 0.3rem 0.7rem
    font-size 0.78rem

.btn-danger
    color #fca5a5
    border-color rgba(248,113,113,0.3)

    &:hover:not(:disabled)
        background rgba(248,113,113,0.12)

.spin
    animation spin 0.9s linear infinite

@keyframes spin
    to
        transform rotate(360deg)

.toolbar
    display grid
    grid-template-columns repeat(auto-fit, minmax(200px, 1fr))
    gap 0.75rem
    margin-bottom 1rem

.field, .kpi
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 12px
    padding 0.9rem 1.1rem
    display flex
    flex-direction column
    gap 0.3rem

.field select
    background #121214
    border 1px solid rgba(255,255,255,0.1)
    border-radius 8px
    color #fff
    padding 0.5rem 0.7rem
    font-size 0.9rem
    outline none

    &:focus
        border-color #6366f1

.field-label, .kpi-label
    color #94a3b8
    font-size 0.78rem

.kpi-value
    font-size 1.3rem
    font-weight 700
    font-variant-numeric tabular-nums
    color #e2e8f0

    &.danger
        color #fca5a5

.kpi-sub
    color #64748b
    font-size 0.78rem

.error
    color #fca5a5

.panel-error
    background rgba(248,113,113,0.08)
    border 1px solid rgba(248,113,113,0.25)
    color #fca5a5
    border-radius 10px
    padding 0.75rem 1rem
    font-size 0.85rem

.empty-state
    background #1a1a1e
    border 1px dashed rgba(255,255,255,0.08)
    border-radius 12px
    padding 3rem 1.5rem
    text-align center
    color #94a3b8
    display flex
    flex-direction column
    align-items center
    gap 0.5rem

.empty-icon
    font-size 2.5rem
    color #475569

.section
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 12px
    padding 1.25rem

.table-wrap
    overflow-x auto

table
    width 100%
    border-collapse collapse
    font-size 0.85rem

th
    text-align left
    color #64748b
    font-weight 500
    font-size 0.72rem
    padding 0.45rem 0.6rem
    border-bottom 1px solid rgba(255,255,255,0.06)
    white-space nowrap

td
    padding 0.5rem 0.6rem
    color #cbd5e1
    border-bottom 1px solid rgba(255,255,255,0.03)
    white-space nowrap

.item
    display flex
    align-items center
    gap 0.6rem

    img
        width 40px
        height 40px
        object-fit contain
        border-radius 6px
        background rgba(255,255,255,0.04)

.item-name
    color #e2e8f0

.num
    text-align right
    font-variant-numeric tabular-nums

.strong
    color #fff
    font-weight 600

.mono
    font-family monospace
    font-size 0.78rem

.muted
    color #64748b

.actions
    display flex
    gap 0.4rem
    justify-content flex-end
</style>
