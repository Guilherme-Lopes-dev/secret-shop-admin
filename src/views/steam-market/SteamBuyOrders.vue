<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import ConfirmActionModal from '@/components/common/ConfirmActionModal.vue'
import InfoTip from '@/components/common/InfoTip.vue'
import SortableTh from '@/components/common/SortableTh.vue'
import { adminService } from '@/services/admin/admin.service'
import type { SteamOpenBuyOrder, SteamSellListing } from '@/services/admin/types'
import { buildSteamImageUrl } from '@/utils/steamImage'
import { nextSort, sortRows, type SortGetters, type SortState } from '@/utils/tableSort'
import { formatMoney } from './marketMath'
import { useSteamBotWallet } from './useSteamBotWallet'

const TIP =
    'Compras (buy orders) e vendas abertas na conta Steam do bot, lidas direto da Steam (inclui as criadas fora do admin). ' +
    'Buy order que já executou por inteiro some daqui; o item cai no inventário do bot com 7 dias de trava. ' +
    'Venda concluída também some; o dinheiro cai na carteira.'

const LISTING_STATUS: Record<SteamSellListing['status'], string> = {
    active: 'À venda',
    awaiting_confirmation: 'Falta confirmar no celular',
    on_hold: 'Segurada pela Steam',
}

const { bots, botId, botName, botsReady, wallet, walletError, walletLoading } = useSteamBotWallet()

const orders = ref<SteamOpenBuyOrder[]>([])
const listings = ref<SteamSellListing[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
const fetchedAt = ref<string | null>(null)
const toCancel = ref<SteamOpenBuyOrder | null>(null)
const listingToCancel = ref<SteamSellListing | null>(null)
const cancelling = ref(false)

const errorMessage = (error: unknown, fallback: string) =>
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback

const load = async () => {
    const id = botId.value
    orders.value = []
    listings.value = []
    loadError.value = null
    if (!id) return

    loading.value = true
    try {
        const { data } = await adminService.getSteamBuyOrders(id)
        if (id !== botId.value) return
        orders.value = data.orders
        listings.value = data.listings ?? []
        fetchedAt.value = new Date().toISOString()
    } catch (error) {
        if (id === botId.value) loadError.value = errorMessage(error, 'Não deu pra ler as buy orders do bot.')
    } finally {
        // Trocou de bot no meio: quem desliga o loading é a consulta nova.
        if (id === botId.value) loading.value = false
    }
}

// Espera conferir o bot lembrado: senão lê as ordens (1 consulta à Steam) do bot velho e do certo.
watch([botId, botsReady], () => {
    if (botsReady.value) load()
}, { immediate: true })

const closeCancelModal = (open: boolean) => {
    if (!open) toCancel.value = null
}

const currency = computed(() =>
    wallet.value?.currency ?? orders.value[0]?.currency ?? listings.value[0]?.currency ?? 'BRL',
)
const committedCents = (order: SteamOpenBuyOrder) => order.priceCents * order.quantityRemaining

const SORTS: SortGetters<SteamOpenBuyOrder> = {
    priceCents: order => order.priceCents,
    quantityRemaining: order => order.quantityRemaining,
    committedCents,
}

const sort = ref<SortState>()
const sortedOrders = computed(() => sortRows(orders.value, SORTS, sort.value))
const toggleSort = (column: string) => {
    sort.value = nextSort(sort.value, column)
}
const totalCommitted = computed(() => orders.value.reduce((sum, order) => sum + committedCents(order), 0))
const pendingItems = computed(() => orders.value.reduce((sum, order) => sum + order.quantityRemaining, 0))
const overBalance = computed(() => wallet.value != null && totalCommitted.value > wallet.value.balanceCents)

const itemImage = (row: { icon: string | null }) => buildSteamImageUrl(row.icon, '64fx64f')
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

// ── Vendas ──
const LISTING_SORTS: SortGetters<SteamSellListing> = {
    buyerPaysCents: listing => listing.buyerPaysCents,
    receiveCents: listing => listing.receiveCents,
    createdAt: listing => (listing.createdAt ? Date.parse(listing.createdAt) : null),
}

const listingSort = ref<SortState>()
const sortedListings = computed(() => sortRows(listings.value, LISTING_SORTS, listingSort.value))
const toggleListingSort = (column: string) => {
    listingSort.value = nextSort(listingSort.value, column)
}
const totalReceive = computed(() => listings.value.reduce((sum, listing) => sum + listing.receiveCents, 0))

const closeListingModal = (open: boolean) => {
    if (!open) listingToCancel.value = null
}

const listingDescription = computed(() => {
    const listing = listingToCancel.value
    if (!listing) return ''
    return `Retirar "${listing.name ?? listing.marketHashName}" (${formatMoney(listing.buyerPaysCents, listing.currency)}) ` +
        `da venda, na conta ${botName.value}? O item volta pro inventário do bot.`
})

const confirmCancelListing = async () => {
    const listing = listingToCancel.value
    if (!listing || cancelling.value) return

    cancelling.value = true
    try {
        await adminService.cancelSteamSellListing(botId.value, listing.listingId)
        listings.value = listings.value.filter(item => item.listingId !== listing.listingId)
        toast.success(`Venda ${listing.listingId} retirada.`)
        listingToCancel.value = null
    } catch (error) {
        toast.error(errorMessage(error, 'Não deu pra retirar a venda.'))
    } finally {
        cancelling.value = false
    }
}
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Minhas ordens <InfoTip :text="TIP" align="left" /></h1>
                <p class="page-sub">Compras e vendas abertas no Steam Market, por conta.</p>
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
            <div class="kpi">
                <span class="kpi-label">À venda</span>
                <span class="kpi-value">{{ listings.length }}</span>
                <span class="kpi-sub">bot recebe {{ formatMoney(totalReceive, currency) }} se vender tudo</span>
            </div>
        </section>

        <p v-if="loadError" class="panel-error">{{ loadError }}</p>

        <div v-else-if="loading && !orders.length && !listings.length" class="empty-state">Consultando a Steam...</div>

        <template v-else>
            <h2 class="section-heading"><Icon icon="mdi:cart-arrow-down" /> Compras (buy orders)</h2>

            <div v-if="!orders.length" class="empty-state">
                <Icon icon="mdi:cart-off" class="empty-icon" />
                <p>Nenhuma buy order aberta nessa conta.</p>
            </div>

            <section v-else class="section">
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Item</th>
                                <SortableTh class="num" column="priceCents" label="Preço/un (com taxa)" :sort="sort" @toggle="toggleSort" />
                                <SortableTh class="num" column="quantityRemaining" label="Restante" :sort="sort" @toggle="toggleSort" />
                                <SortableTh class="num" column="committedCents" label="Comprometido" :sort="sort" @toggle="toggleSort" />
                                <th>buy_orderid</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="order in sortedOrders" :key="order.buyOrderId">
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

            <h2 class="section-heading"><Icon icon="mdi:tag-outline" /> Vendas</h2>

            <div v-if="!listings.length" class="empty-state">
                <Icon icon="mdi:tag-off-outline" class="empty-icon" />
                <p>Nenhum item à venda nessa conta.</p>
            </div>

            <section v-else class="section">
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Item</th>
                                <SortableTh class="num" column="buyerPaysCents" label="Comprador paga" :sort="listingSort" @toggle="toggleListingSort" />
                                <SortableTh class="num" column="receiveCents" label="Bot recebe" :sort="listingSort" @toggle="toggleListingSort" />
                                <th>Status</th>
                                <SortableTh column="createdAt" label="Criada" :sort="listingSort" @toggle="toggleListingSort" />
                                <th>listingid</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="listing in sortedListings" :key="listing.listingId">
                                <td>
                                    <div class="item">
                                        <img v-if="itemImage(listing)" :src="itemImage(listing)!" alt="" />
                                        <span class="item-name">{{ listing.name ?? listing.marketHashName ?? '—' }}</span>
                                    </div>
                                </td>
                                <td class="num strong">{{ formatMoney(listing.buyerPaysCents, listing.currency) }}</td>
                                <td class="num">{{ formatMoney(listing.receiveCents, listing.currency) }}</td>
                                <td><span class="status" :class="listing.status">{{ LISTING_STATUS[listing.status] }}</span></td>
                                <td class="muted">{{ listing.createdAt ? dayjs(listing.createdAt).format('DD/MM HH:mm') : '—' }}</td>
                                <td class="mono muted">{{ listing.listingId }}</td>
                                <td class="actions">
                                    <RouterLink v-if="listing.marketHashName" :to="{ name: 'steam-market', query: { name: listing.marketHashName } }" class="btn btn-small">
                                        <Icon icon="mdi:chart-timeline-variant" /> Mercado
                                    </RouterLink>
                                    <button class="btn btn-small btn-danger" :disabled="cancelling" @click="listingToCancel = listing">
                                        Retirar
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </template>

        <ConfirmActionModal
            :open="listingToCancel !== null"
            title="Retirar da venda"
            :description="listingDescription"
            confirm-label="Retirar"
            loading-label="Retirando..."
            icon="mdi:tag-remove-outline"
            variant="danger"
            :delay-seconds="0"
            :loading="cancelling"
            @update:open="closeListingModal"
            @confirm="confirmCancelListing"
        />

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

.section-heading
    display flex
    align-items center
    gap 0.4rem
    font-size 1rem
    font-weight 600
    color #e2e8f0
    margin 1.5rem 0 0.75rem

.status
    padding 2px 8px
    border-radius 6px
    font-size 0.75rem
    font-weight 600
    background rgba(74,222,128,0.12)
    color #86efac

    &.awaiting_confirmation
        background rgba(255,152,0,0.12)
        color #fdba74

    &.on_hold
        background rgba(248,113,113,0.12)
        color #fca5a5

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
