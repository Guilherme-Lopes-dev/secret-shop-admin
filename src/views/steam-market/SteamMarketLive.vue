<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import InfoTip from '@/components/common/InfoTip.vue'
import SortableTh from '@/components/common/SortableTh.vue'
import { adminService, type MarketPriceHistoryResponse } from '@/services/admin/admin.service'
import type { SteamListing, SteamListingsPage, SteamMarketSource, SteamOrderbook } from '@/services/admin/types'
import { buildSteamImageUrl } from '@/utils/steamImage'
import { nextSort, sortRows, type SortGetters, type SortState } from '@/utils/tableSort'
import BuyOrderPanel from './BuyOrderPanel.vue'
import MarketItemSearch from './MarketItemSearch.vue'
import OrderbookSide from './OrderbookSide.vue'
import { consensusCents, formatMoney, formatPct, pctChange } from './marketMath'

const TIPS = {
    page:
        'Dados ao vivo do Steam Market (Dota 2), buscados na hora em que você consulta. ' +
        'Não fica salvo nada: atualize pra ver o mercado de novo. Base pro mini trader.',
    minSell: 'Listing mais barata agora, com as taxas: é o que sai da carteira pra comprar na hora.',
    maxBuy:
        'Maior buy order aberta (com taxa): o máximo que alguém aceita pagar agora. ' +
        'Quem vende pra ela recebe esse valor menos as taxas (~13%).',
    spread: 'Distância entre quem vende e quem compra. Spread alto = espaço pra lucrar, mas item menos líquido.',
    margin:
        'Comprar com buy order no topo do livro e revender no menor preço atual: quanto sobra depois das taxas da Steam (5%) e do Dota (10%). ' +
        'Não conta a trava de troca nem o preço mudar até a revenda.',
    depth: 'Quantos itens estão à venda e quantos pedidos de compra existem na Steam agora.',
    reference:
        'Preço de referência do nosso banco no último sync (mesmo consenso da tela de Tendências: mediana de menor preço, mediano e média 24h). ' +
        'Embaixo: quanto a listing mais barata está acima (+) ou abaixo (−) dele.',
    sell: 'Listings agrupadas por preço, da mais barata pra mais cara. Acumulado = quantos itens você compraria até aquele preço.',
    buy: 'Buy orders agrupadas por preço, do maior lance pro menor. Acumulado = quantos itens dá pra vender até aquele preço.',
    listings:
        'Cada linha é um item à venda, que pode ser comprado individualmente pelo listing ID. ' +
        'Taxa Steam = 5%, taxa Dota = 10%, cobradas em cima do que o vendedor recebe.',
}

const route = useRoute()
const router = useRouter()

const marketHashName = computed(() => String(route.query.name ?? '').trim())

const listings = ref<SteamListingsPage | null>(null)
const orderbook = ref<SteamOrderbook | null>(null)
const history = ref<MarketPriceHistoryResponse | null>(null)
const listingsError = ref<string | null>(null)
const orderbookError = ref<string | null>(null)
const loading = ref(false)
const loadingMore = ref(false)
const showBuyOrder = ref(false)

const errorMessage = (reason: unknown, fallback: string) =>
    (reason as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback

const valueOf = <T,>(result: PromiseSettledResult<{ data: T }>) =>
    result.status === 'fulfilled' ? result.value.data : null

const reasonOf = (result: PromiseSettledResult<unknown>, fallback: string) =>
    result.status === 'rejected' ? errorMessage(result.reason, fallback) : null

const reset = () => {
    loading.value = false
    showBuyOrder.value = false
    listings.value = null
    orderbook.value = null
    history.value = null
    listingsError.value = null
    orderbookError.value = null
}

// O histórico do banco dá 404 pra item que nunca foi sincronizado: só fica sem referência.
const load = async (name: string) => {
    loading.value = true
    const [listingsResult, orderbookResult, historyResult] = await Promise.allSettled([
        adminService.getSteamListings(name),
        adminService.getSteamOrderbook(name),
        adminService.getMarketPriceHistory(name),
    ])
    if (name !== marketHashName.value) return

    listings.value = valueOf(listingsResult)
    orderbook.value = valueOf(orderbookResult)
    history.value = valueOf(historyResult)
    listingsError.value = reasonOf(listingsResult, 'Erro ao buscar as listings.')
    orderbookError.value = reasonOf(orderbookResult, 'Erro ao buscar o livro de ofertas.')
    loading.value = false
}

const loadMore = async () => {
    const page = listings.value
    if (!page?.more || loadingMore.value) return

    loadingMore.value = true
    try {
        const { data } = await adminService.getSteamListings(page.marketHashName, page.listings.length)
        if (data.marketHashName !== marketHashName.value) return
        // Cada página é uma leitura: se esta caiu no anônimo (USD) e a 1ª veio pelo bot (BRL),
        // juntar formataria as linhas em BRL como dólar.
        if (page.currency && data.currency && data.currency !== page.currency) {
            toast.error(`A próxima página veio em ${data.currency}, não em ${page.currency}. Clique em Atualizar.`)
            return
        }
        listings.value = { ...data, item: page.item ?? data.item, listings: [...page.listings, ...data.listings] }
    } catch (error) {
        toast.error(errorMessage(error, 'Erro ao carregar mais listings.'))
    } finally {
        loadingMore.value = false
    }
}

const refresh = () => marketHashName.value && load(marketHashName.value)
// Mesmo item de novo não muda a query, então o watch não dispararia.
const selectItem = (name: string) => {
    if (name === marketHashName.value) return refresh()
    router.replace({ query: { name } })
}

// `?buy=1` (vindo de Tendências) já abre o painel. Ele só monta depois que o livro chega,
// então o preço nasce preenchido no topo do livro.
watch(marketHashName, name => {
    reset()
    showBuyOrder.value = Boolean(name) && route.query.buy === '1'
    if (name) load(name)
}, { immediate: true })

const currency = computed(() => orderbook.value?.currency ?? listings.value?.currency ?? null)
const isForeignCurrency = computed(() => currency.value != null && currency.value !== 'BRL')
// Listings e livro são leituras separadas: uma pode vir pelo bot (BRL) e a outra cair no
// anônimo (USD). Aí margem (listing − livro) e comparação misturariam moedas.
const currencyConflict = computed(() => {
    const listingsCurrency = listings.value?.currency
    const bookCurrency = orderbook.value?.currency
    return Boolean(listingsCurrency && bookCurrency && listingsCurrency !== bookCurrency)
})

// Produção roda fora do Brasil: anônima, a Steam responde na moeda do IP (USD). Pela conta
// do bot vem na moeda da carteira — o backend só cai no anônimo se o TradeBot falhar.
const SOURCE_LABEL: Record<SteamMarketSource, string> = {
    bot: 'pela conta do bot',
    anonymous: 'sem login (moeda pelo IP do servidor)',
}
const source = computed(() => orderbook.value?.source ?? listings.value?.source ?? null)
// Hora em que o dado saiu da Steam: o backend guarda 30s, então "Atualizar" logo em
// seguida mostra o mesmo horário (sem gastar o limite de consultas do servidor).
const fetchedAt = computed(() => orderbook.value?.fetchedAt ?? listings.value?.fetchedAt ?? null)
const foreignCurrencyReason = computed(() =>
    source.value === 'anonymous'
        ? 'A leitura pela conta do bot falhou (TradeBot fora do ar ou sem bot ativo), então a Steam respondeu pelo IP do servidor.'
        : 'A carteira do bot que fez a leitura não está em BRL.',
)
const notFound = computed(() =>
    !loading.value && listings.value?.totalCount === 0 && !orderbook.value && !history.value,
)

const item = computed(() => listings.value?.item ?? null)
const itemName = computed(() => item.value?.name ?? history.value?.item.name ?? marketHashName.value)
const itemImage = computed(() =>
    buildSteamImageUrl(item.value?.icon ?? history.value?.item.icon_url_large ?? history.value?.item.image_url, '128fx128f'),
)
const steamUrl = computed(() => `https://steamcommunity.com/market/listings/570/${encodeURIComponent(marketHashName.value)}`)
const evolutionRoute = computed(() => {
    const id = history.value?.item.id
    if (id) return { name: 'skin-price-history', params: { uuid: id } }
    return { name: 'market-price-history', params: { name: marketHashName.value } }
})

const cheapest = computed(() => listings.value?.listings[0] ?? null)
const minSell = computed(() => orderbook.value?.minSellCents ?? cheapest.value?.totalCents ?? null)
const maxBuy = computed(() => orderbook.value?.maxBuyCents ?? null)
const spread = computed(() => (minSell.value != null && maxBuy.value != null ? minSell.value - maxBuy.value : null))
const spreadPct = computed(() => (spread.value != null && minSell.value ? (spread.value / minSell.value) * 100 : null))
const margin = computed(() =>
    cheapest.value && maxBuy.value != null && !currencyConflict.value
        ? cheapest.value.sellerReceivesCents - maxBuy.value
        : null,
)
const marginPct = computed(() => (margin.value != null && maxBuy.value ? (margin.value / maxBuy.value) * 100 : null))

const latestPoint = computed(() => {
    const points = history.value?.points ?? []
    return points[points.length - 1] ?? null
})
const reference = computed(() => (latestPoint.value ? consensusCents(latestPoint.value) : null))
// A referência do banco é BRL: só compara valor que também está em BRL.
const vsReference = (cents: number | null | undefined, valueCurrency: string | null | undefined) =>
    valueCurrency === 'BRL' ? pctChange(cents, reference.value) : null

const signClass = (value: number | null) => {
    if (value == null || value === 0) return ''
    return value > 0 ? 'up' : 'down'
}

const LISTING_SORTS: SortGetters<SteamListing> = {
    totalCents: listing => listing.totalCents,
    sellerReceivesCents: listing => listing.sellerReceivesCents,
    steamFeeCents: listing => listing.steamFeeCents,
    publisherFeeCents: listing => listing.publisherFeeCents,
    vsReference: listing => vsReference(listing.totalCents, listings.value?.currency),
}

const listingSort = ref<SortState>()
const sortedListings = computed(() => sortRows(listings.value?.listings ?? [], LISTING_SORTS, listingSort.value))
const toggleListingSort = (column: string) => {
    listingSort.value = nextSort(listingSort.value, column)
}
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Market ao vivo <InfoTip :text="TIPS.page" align="left" /></h1>
                <p class="page-sub">Listings, livro de ofertas e taxas direto da Steam.</p>
            </div>
            <div class="header-actions">
                <span v-if="fetchedAt && marketHashName" class="fetched">
                    Consultado às {{ dayjs(fetchedAt).format('HH:mm:ss') }}<template v-if="source"> · {{ SOURCE_LABEL[source] }}</template>
                </span>
                <router-link :to="{ name: 'steam-buy-orders' }" class="btn">
                    <Icon icon="mdi:cart-arrow-down" /> Minhas buy orders
                </router-link>
                <button class="btn" :disabled="!marketHashName || loading" @click="refresh">
                    <Icon icon="mdi:refresh" :class="{ spin: loading }" /> Atualizar
                </button>
            </div>
        </header>

        <MarketItemSearch class="search" @select="selectItem" />

        <div v-if="!marketHashName" class="empty-state">
            <Icon icon="mdi:chart-timeline-variant" class="empty-icon" />
            <p>Busque um item pra ver quem está vendendo, quem está comprando e por quanto.</p>
        </div>

        <div v-else-if="loading && !listings && !orderbook" class="empty-state">Consultando a Steam...</div>

        <div v-else-if="notFound" class="empty-state">
            <p>Nada no Market pra <strong>{{ marketHashName }}</strong>.</p>
            <p class="muted">O nome precisa ser o market_hash_name exato (maiúsculas e acentos contam).</p>
        </div>

        <template v-else>
            <p v-if="currencyConflict" class="banner">
                <Icon icon="mdi:alert-outline" /> As listings vieram em {{ listings?.currency }} e o livro em {{ orderbook?.currency }}:
                uma das leituras pela conta do bot falhou. A margem ficou desligada — clique em Atualizar.
            </p>
            <p v-if="isForeignCurrency" class="banner">
                <Icon icon="mdi:alert-outline" /> A Steam respondeu em {{ currency }}, não em BRL. {{ foreignCurrencyReason }}
                A comparação com o banco e a buy order ficam desligadas.
            </p>

            <section class="item-header">
                <img v-if="itemImage" :src="itemImage" class="item-img" alt="" />
                <div class="item-info">
                    <h2 class="item-title">{{ itemName }}</h2>
                    <p class="item-sub mono">{{ marketHashName }}</p>
                    <div class="badges">
                        <span v-if="item?.type" class="badge">{{ item.type }}</span>
                        <span v-if="item?.tradableAfterDays" class="badge badge-warn">
                            <Icon icon="mdi:lock-clock" /> Comprou → {{ item.tradableAfterDays }} dias sem poder trocar
                        </span>
                        <a :href="steamUrl" target="_blank" rel="noopener" class="badge badge-link">
                            <Icon icon="mdi:steam" /> Ver na Steam
                        </a>
                        <router-link v-if="history" :to="evolutionRoute" class="badge badge-link">
                            <Icon icon="mdi:chart-line" /> Evolução de preços
                        </router-link>
                    </div>
                </div>
                <button class="btn btn-buy" :class="{ active: showBuyOrder }" @click="showBuyOrder = !showBuyOrder">
                    <Icon icon="mdi:cart-arrow-down" /> {{ showBuyOrder ? 'Fechar buy order' : 'Criar buy order' }}
                </button>
            </section>

            <BuyOrderPanel
                v-if="showBuyOrder"
                :key="marketHashName"
                :market-hash-name="marketHashName"
                :item-name="itemName"
                :currency="currency"
                :min-sell-cents="minSell"
                :max-buy-cents="maxBuy"
                :reference-cents="reference"
                :tradable-after-days="item?.tradableAfterDays ?? 0"
            />

            <section class="kpis">
                <div class="kpi">
                    <span class="kpi-label">Comprar agora <InfoTip :text="TIPS.minSell" /></span>
                    <span class="kpi-value sell">{{ formatMoney(minSell, currency) }}</span>
                </div>
                <div class="kpi">
                    <span class="kpi-label">Maior buy order <InfoTip :text="TIPS.maxBuy" /></span>
                    <span class="kpi-value buy">{{ formatMoney(maxBuy, currency) }}</span>
                </div>
                <div class="kpi">
                    <span class="kpi-label">Spread <InfoTip :text="TIPS.spread" /></span>
                    <span class="kpi-value">{{ formatMoney(spread, currency) }}</span>
                    <span class="kpi-sub">{{ formatPct(spreadPct) }} do menor preço</span>
                </div>
                <div class="kpi">
                    <span class="kpi-label">Margem buy order → revenda <InfoTip :text="TIPS.margin" /></span>
                    <span class="kpi-value" :class="signClass(margin)">{{ formatMoney(margin, currency) }}</span>
                    <span class="kpi-sub" :class="signClass(marginPct)">{{ formatPct(marginPct) }} sobre o custo</span>
                </div>
                <div class="kpi">
                    <span class="kpi-label">Oferta × demanda <InfoTip :text="TIPS.depth" /></span>
                    <span class="kpi-value">{{ orderbook?.sellCount.toLocaleString('pt-BR') ?? '—' }} <small>à venda</small></span>
                    <span class="kpi-sub">{{ orderbook?.buyCount.toLocaleString('pt-BR') ?? '—' }} pedidos de compra</span>
                </div>
                <div class="kpi">
                    <span class="kpi-label">Referência do banco <InfoTip :text="TIPS.reference" align="right" /></span>
                    <template v-if="reference != null">
                        <span class="kpi-value">{{ formatMoney(reference, 'BRL') }}</span>
                        <span class="kpi-sub">
                            <span :class="signClass(vsReference(minSell, currency))">{{ formatPct(vsReference(minSell, currency)) }}</span>
                            · sync de {{ dayjs(latestPoint!.day).format('DD/MM') }}
                        </span>
                        <span class="kpi-sub">
                            média 7d {{ formatMoney(latestPoint!.price_avg_7d, 'BRL') }} · 30d {{ formatMoney(latestPoint!.price_avg_30d, 'BRL') }}
                        </span>
                    </template>
                    <span v-else class="kpi-sub">Item sem histórico no banco.</span>
                </div>
            </section>

            <p v-if="orderbookError" class="panel-error">{{ orderbookError }}</p>
            <section v-if="orderbook" class="book">
                <OrderbookSide
                    title="Vendendo"
                    tone="sell"
                    :tip="TIPS.sell"
                    :levels="orderbook.sell"
                    :count="orderbook.sellCount"
                    :currency="orderbook.currency"
                />
                <OrderbookSide
                    title="Comprando (buy orders)"
                    tone="buy"
                    :tip="TIPS.buy"
                    :levels="orderbook.buy"
                    :count="orderbook.buyCount"
                    :currency="orderbook.currency"
                />
            </section>

            <section class="section">
                <h2 class="section-title">
                    Listings
                    <small v-if="listings">{{ listings.listings.length }} de {{ listings.totalCount }}</small>
                    <InfoTip :text="TIPS.listings" align="left" />
                </h2>

                <p v-if="listingsError" class="panel-error">{{ listingsError }}</p>
                <p v-else-if="!listings?.listings.length" class="muted">Ninguém vendendo agora.</p>

                <div v-else class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th class="num">#</th>
                                <SortableTh class="num" column="totalCents" label="Comprador paga" :sort="listingSort" @toggle="toggleListingSort" />
                                <SortableTh class="num" column="sellerReceivesCents" label="Vendedor recebe" :sort="listingSort" @toggle="toggleListingSort" />
                                <SortableTh class="num" column="steamFeeCents" label="Taxa Steam" :sort="listingSort" @toggle="toggleListingSort" />
                                <SortableTh class="num" column="publisherFeeCents" label="Taxa Dota" :sort="listingSort" @toggle="toggleListingSort" />
                                <SortableTh class="num" column="vsReference" label="vs referência" :sort="listingSort" @toggle="toggleListingSort" />
                                <th>Listing ID</th>
                                <th>Asset ID</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(listing, index) in sortedListings" :key="listing.listingId">
                                <td class="num muted">{{ index + 1 }}</td>
                                <td class="num strong">{{ formatMoney(listing.totalCents, listings.currency) }}</td>
                                <td class="num">{{ formatMoney(listing.sellerReceivesCents, listings.currency) }}</td>
                                <td class="num muted">{{ formatMoney(listing.steamFeeCents, listings.currency) }}</td>
                                <td class="num muted">{{ formatMoney(listing.publisherFeeCents, listings.currency) }}</td>
                                <td class="num" :class="signClass(vsReference(listing.totalCents, listings.currency))">
                                    {{ formatPct(vsReference(listing.totalCents, listings.currency)) }}
                                </td>
                                <td class="mono muted">{{ listing.listingId }}</td>
                                <td class="mono muted">{{ listing.assetId ?? '—' }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <button v-if="listings?.more" class="btn btn-more" :disabled="loadingMore" @click="loadMore">
                    {{ loadingMore ? 'Carregando...' : 'Carregar mais 20' }}
                </button>
            </section>
        </template>
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

    &:hover:not(:disabled)
        background #2a2a30

    &:disabled
        opacity 0.5
        cursor default

.spin
    animation spin 0.9s linear infinite

@keyframes spin
    to
        transform rotate(360deg)

.search
    margin-bottom 1.5rem

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

.muted
    color #64748b

.banner
    display flex
    align-items center
    gap 0.5rem
    background rgba(255,152,0,0.1)
    border 1px solid rgba(255,152,0,0.3)
    color #fdba74
    border-radius 10px
    padding 0.75rem 1rem
    font-size 0.85rem
    margin-bottom 1rem

.item-header
    display flex
    gap 1.25rem
    align-items center
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 12px
    padding 1.25rem
    margin-bottom 1rem

.item-img
    width 88px
    height 88px
    object-fit contain
    border-radius 8px
    background rgba(255,255,255,0.04)

.item-info
    min-width 0
    flex 1

.btn-buy
    align-self flex-start
    background rgba(99,102,241,0.15)
    border-color rgba(99,102,241,0.4)
    color #c7d2fe
    white-space nowrap

    &.active, &:hover:not(:disabled)
        background rgba(99,102,241,0.28)

.item-title
    font-size 1.3rem
    font-weight 700

.item-sub
    color #94a3b8
    font-size 0.8rem
    margin 0.2rem 0 0.6rem

.badges
    display flex
    gap 0.5rem
    flex-wrap wrap

.badge
    display inline-flex
    align-items center
    gap 0.3rem
    padding 3px 10px
    border-radius 6px
    font-size 0.75rem
    font-weight 600
    background rgba(99,102,241,0.12)
    color #a5b4fc

.badge-warn
    background rgba(255,152,0,0.12)
    color #fdba74

.badge-link
    background rgba(255,255,255,0.06)
    color #cbd5e1
    text-decoration none

    &:hover
        background rgba(255,255,255,0.12)

.kpis
    display grid
    grid-template-columns repeat(auto-fill, minmax(200px, 1fr))
    gap 0.75rem
    margin-bottom 1rem

.kpi
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 12px
    padding 1rem 1.1rem
    display flex
    flex-direction column
    gap 0.25rem

.kpi-label
    color #94a3b8
    font-size 0.78rem
    display inline-flex
    align-items center
    gap 0.3rem

.kpi-value
    font-size 1.35rem
    font-weight 700
    font-variant-numeric tabular-nums
    color #e2e8f0

    small
        font-size 0.75rem
        font-weight 500
        color #94a3b8

    &.sell
        color #fca5a5

    &.buy
        color #86efac

.kpi-sub
    color #64748b
    font-size 0.75rem
    font-variant-numeric tabular-nums

.up
    color #86efac

.down
    color #fca5a5

.panel-error
    background rgba(248,113,113,0.08)
    border 1px solid rgba(248,113,113,0.25)
    color #fca5a5
    border-radius 10px
    padding 0.75rem 1rem
    font-size 0.85rem
    margin-bottom 1rem

.book
    display grid
    grid-template-columns repeat(auto-fit, minmax(300px, 1fr))
    gap 0.75rem
    margin-bottom 1rem

.section
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 12px
    padding 1.25rem

.section-title
    font-size 0.95rem
    font-weight 600
    color #e2e8f0
    margin-bottom 0.85rem
    display flex
    align-items center
    gap 0.5rem

    small
        color #64748b
        font-weight 500

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
    padding 0.45rem 0.6rem
    color #cbd5e1
    border-bottom 1px solid rgba(255,255,255,0.03)
    white-space nowrap

.num
    text-align right
    font-variant-numeric tabular-nums

.strong
    color #fff
    font-weight 600

.mono
    font-family monospace
    font-size 0.78rem

.btn-more
    margin-top 1rem
</style>
