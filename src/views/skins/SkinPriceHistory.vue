<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import Chart from 'chart.js/auto'
import { Icon } from '@iconify/vue'
import SortableTh from '@/components/common/SortableTh.vue'
import {
    adminService,
    type MarketPriceHistoryResponse,
    type SkinPriceHistoryResponse,
    type SkinUnitTracking,
} from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { nextSort, sortRows, type SortGetters, type SortState } from '@/utils/tableSort'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const result = ref<SkinPriceHistoryResponse | null>(null)
const marketResult = ref<MarketPriceHistoryResponse | null>(null)
const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

// Duas fontes pro mesmo gráfico: item do catálogo (com unidades, preço de venda e
// vendas recentes) e item que só existe no market (só a série de preço).
const skin = computed(() => {
    const catalog = result.value?.skin
    if (catalog) return { ...catalog, image_url: null as string | null }

    const item = marketResult.value?.item
    if (!item) return null

    return { ...item, latest_10_sales: null as unknown[] | null }
})
const points = computed(() => result.value?.points ?? marketResult.value?.points ?? [])
const recentFirst = computed(() => [...points.value].reverse())
const units = computed(() => result.value?.units ?? [])

type PricePoint = (typeof points.value)[number]

const POINT_SORTS: SortGetters<PricePoint> = {
    lowest_price: point => point.lowest_price,
    median_price: point => point.median_price,
    manual_price: point => point.manual_price,
    price_avg: point => point.price_avg,
    price_avg_24h: point => point.price_avg_24h,
    price_avg_7d: point => point.price_avg_7d,
    price_avg_30d: point => point.price_avg_30d,
    price_avg_90d: point => point.price_avg_90d,
}

const UNIT_SORTS: SortGetters<SkinUnitTracking> = {
    cost_price: unit => unit.cost_price,
    entry_market_price: unit => unit.entry_market_price,
    exit_market_price: unit => unit.exit_market_price,
    market_variation_pct: unit => unit.market_variation_pct,
    sale_price: unit => unit.sale_price,
    margin_pct: unit => unit.margin_pct,
    protected_floor: unit => unit.protected_floor,
}

const pointSort = ref<SortState>()
const unitSort = ref<SortState>()
const sortedPoints = computed(() => sortRows(recentFirst.value, POINT_SORTS, pointSort.value))
const sortedUnits = computed(() => sortRows(units.value, UNIT_SORTS, unitSort.value))
const togglePointSort = (column: string) => {
    pointSort.value = nextSort(pointSort.value, column)
}
const toggleUnitSort = (column: string) => {
    unitSort.value = nextSort(unitSort.value, column)
}
const hasManualPrice = computed(() => points.value.some(p => typeof p.manual_price === 'number'))

// preço atual = último ponto registrado (catálogo, com fallback pro mediano)
const currentPrice = computed(() => {
    const latest = points.value[points.value.length - 1]
    return latest?.manual_price ?? latest?.median_price ?? null
})
const estimatedEntryCost = computed(() =>
    currentPrice.value == null ? null : Math.round(currentPrice.value * 0.55),
)

const formatCurrencyOrDash = (v: number | null) => (v == null ? '—' : formatCurrency(v))
const formatDateOrDash = (v: string | null) => (v == null ? '—' : dayjs(v).format('DD/MM/YYYY'))
const formatPctOrDash = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`)
const pctClass = (v: number | null) => (v == null || v === 0 ? '' : v > 0 ? 'pct-up' : 'pct-down')

// Pior caso primeiro: prejuízo > abaixo do piso > sem referência (estoque legado) > protegido.
const floorStatus = (u: SkinUnitTracking) => {
    if (u.protected_floor == null) return { label: 'Sem referência', cls: 'status-neutral' }
    if (u.is_below_absolute_floor) return { label: 'Prejuízo', cls: 'status-canceled' }
    if (u.is_below_protected_floor) return { label: 'Abaixo do piso', cls: 'status-pending' }
    return { label: 'Protegido', cls: 'status-completed' }
}

const previewImageUrl = (hash: string | null) => {
    if (!hash) return ''
    return `https://steamcommunity-a.akamaihd.net/economy/image/${hash}/280fx280f`
}

// latest_10_sales vem como tupla [data, preço, quantidade] — confirmado na doc
// oficial da steamwebapi (GET /steam/api/items), não objeto com chaves nomeadas.
// Ex: ["2025-10-24", 1372.29, 5]
type SteamSaleTuple = [string, number, number]

const isSaleTuple = (s: unknown): s is SteamSaleTuple =>
    Array.isArray(s) && typeof s[0] === 'string' && typeof s[1] === 'number'

const sales = computed<SteamSaleTuple[]>(() =>
    (skin.value?.latest_10_sales ?? []).filter(isSaleTuple),
)
const maxSaleQty = computed(() => Math.max(1, ...sales.value.map(s => s[2] ?? 0)))

const SALE_SORTS: SortGetters<SteamSaleTuple> = {
    price: sale => sale[1],
    quantity: sale => sale[2],
}

const saleSort = ref<SortState>()
const sortedSales = computed(() => sortRows(sales.value, SALE_SORTS, saleSort.value))
const toggleSaleSort = (column: string) => {
    saleSort.value = nextSort(saleSort.value, column)
}
// px fixo (não %) — largura em % dentro de inline-flex é ambígua entre navegadores
const qtyBarWidth = (qty: number) => `${Math.max(3, Math.round((qty / maxSaleQty.value) * 48))}px`

const formatSaleDate = (d: string) => {
    const parsed = dayjs(d)
    return parsed.isValid() ? parsed.format('DD/MM/YYYY') : d
}
// preço cru do steamwebapi vem em unidade decimal (ex: 1372.29), não em centavos
const formatSalePrice = (p: number) => formatCurrency(Math.round(p * 100))

const renderChart = () => {
    if (!chartCanvas.value) return
    chartInstance?.destroy()
    if (points.value.length === 0) return

    const ctx = chartCanvas.value.getContext('2d')
    if (!ctx) return

    const labels = points.value.map(p => dayjs(p.day).format('DD/MM'))
    const series = (key: keyof (typeof points.value)[number]) =>
        points.value.map(p => (typeof p[key] === 'number' ? (p[key] as number) / 100 : null))

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                // Preço de venda só existe pra item do catálogo — fora dele a linha
                // seria vazia com legenda enganosa.
                ...(hasManualPrice.value
                    ? [{ label: 'Catálogo', data: series('manual_price'), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.12)', tension: 0.25, spanGaps: true }]
                    : []),
                { label: 'Mediano', data: series('median_price'), borderColor: '#4caf50', backgroundColor: 'rgba(76,175,80,0.12)', tension: 0.25, spanGaps: true },
                { label: 'Menor Preço', data: series('lowest_price'), borderColor: '#ff9800', backgroundColor: 'rgba(255,152,0,0.12)', tension: 0.25, spanGaps: true },
                { label: 'Média', data: series('price_avg'), borderColor: '#22d3ee', backgroundColor: 'rgba(34,211,238,0.1)', tension: 0.25, spanGaps: true, hidden: true },
                { label: 'Média 24h', data: series('price_avg_24h'), borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.1)', tension: 0.25, spanGaps: true, hidden: true },
                { label: 'Média 7d', data: series('price_avg_7d'), borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.1)', tension: 0.25, spanGaps: true, hidden: true },
                { label: 'Média 30d', data: series('price_avg_30d'), borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.1)', tension: 0.25, spanGaps: true, hidden: true },
                { label: 'Média 90d', data: series('price_avg_90d'), borderColor: '#e879f9', backgroundColor: 'rgba(232,121,249,0.1)', tension: 0.25, spanGaps: true, hidden: true },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#cbd5e1' } },
                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(Number(ctx.raw) * 100)}` } },
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(255,255,255,0.06)' },
                    ticks: { color: '#94a3b8', callback: (v) => `R$ ${v}` },
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' },
                },
            },
        },
    })
}

const fetchHistory = async () => {
    loading.value = true
    result.value = null
    marketResult.value = null
    const uuid = route.params.uuid as string | undefined
    const marketHashName = route.params.name as string | undefined
    try {
        if (uuid) result.value = (await adminService.getSkinPriceHistory(uuid)).data
        else if (marketHashName) marketResult.value = (await adminService.getMarketPriceHistory(marketHashName)).data
    } catch (error) {
        console.error('Erro ao buscar histórico de preço:', error)
    } finally {
        loading.value = false
    }
    // canvas só monta depois de loading=false — renderizar antes acha chartCanvas null
    await nextTick()
    renderChart()
}

watch(
    () => [route.params.uuid, route.params.name],
    () => fetchHistory(),
    { immediate: true },
)

onUnmounted(() => chartInstance?.destroy())
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <button class="btn-back" @click="router.push('/skins/prices')">
                <Icon icon="mdi:arrow-left" /> Evolução de Preços
            </button>
        </header>

        <div v-if="loading" class="loading-state">Carregando histórico...</div>

        <template v-else-if="skin">
            <div class="item-hero-row">
                <div class="item-thumb-wrap">
                    <img v-if="skin.icon_url_large" :src="previewImageUrl(skin.icon_url_large)" class="item-hero-img" alt="" />
                    <img v-else-if="skin.image_url" :src="skin.image_url" class="item-hero-img" alt="" />
                    <div v-else class="item-hero-placeholder"><Icon icon="mdi:sword" /></div>
                </div>
                <div class="item-hero-info">
                    <h1 class="page-title">{{ skin.name }}</h1>
                    <p class="item-hash">{{ skin.hero || '—' }}</p>
                </div>
                <span v-if="skin.price_locked" class="lock-badge" title="Sync automático e piso de proteção não se aplicam — preço só muda por edição manual.">
                    <Icon icon="mdi:lock" /> Travado manualmente
                </span>
            </div>

            <div class="history-grid">
            <div class="section">
                <h2 class="section-title">Evolução</h2>
                <div v-if="points.length === 0" class="empty-state">
                    Sem histórico ainda — uma linha é gravada aqui na próxima vez que o preço mudar.
                </div>
                <div v-else class="chart-wrap">
                    <canvas ref="chartCanvas"></canvas>
                </div>
            </div>

            <div v-if="points.length > 0" class="section">
                <h2 class="section-title">Pontos registrados</h2>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Data</th>
                                <SortableTh column="lowest_price" label="Menor Preço" :sort="pointSort" @toggle="togglePointSort" />
                                <SortableTh column="median_price" label="Preço Mediano" :sort="pointSort" @toggle="togglePointSort" />
                                <SortableTh column="manual_price" label="Preço Catálogo" :sort="pointSort" @toggle="togglePointSort" />
                                <SortableTh class="col-avg" column="price_avg" label="Média" :sort="pointSort" @toggle="togglePointSort" />
                                <SortableTh class="col-avg-24h" column="price_avg_24h" label="24h" :sort="pointSort" @toggle="togglePointSort" />
                                <SortableTh class="col-avg-7d" column="price_avg_7d" label="7d" :sort="pointSort" @toggle="togglePointSort" />
                                <SortableTh class="col-avg-30d" column="price_avg_30d" label="30d" :sort="pointSort" @toggle="togglePointSort" />
                                <SortableTh class="col-avg-90d" column="price_avg_90d" label="90d" :sort="pointSort" @toggle="togglePointSort" />
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="p in sortedPoints" :key="p.day">
                                <td>{{ $dayjs(p.day).format('DD/MM/YYYY') }}</td>
                                <td class="price">{{ formatCurrency(p.lowest_price) }}</td>
                                <td class="price">{{ formatCurrency(p.median_price) }}</td>
                                <td class="price">{{ formatCurrency(p.manual_price) }}</td>
                                <td class="price col-avg">{{ formatCurrency(p.price_avg) }}</td>
                                <td class="price col-avg-24h">{{ formatCurrency(p.price_avg_24h) }}</td>
                                <td class="price col-avg-7d">{{ formatCurrency(p.price_avg_7d) }}</td>
                                <td class="price col-avg-30d">{{ formatCurrency(p.price_avg_30d) }}</td>
                                <td class="price col-avg-90d">{{ formatCurrency(p.price_avg_90d) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            </div>

            <div v-if="units.length > 0" class="section">
                <h2 class="section-title">Rastreio por unidade (entrada/saída do bot)</h2>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Bot</th>
                                <th>Entrada</th>
                                <th>Saída</th>
                                <SortableTh column="cost_price" label="Custo pago (entrada)" :sort="unitSort" @toggle="toggleUnitSort" />
                                <th class="col-estimated">Custo estimado</th>
                                <SortableTh column="entry_market_price" label="Mercado (entrada)" :sort="unitSort" @toggle="toggleUnitSort" />
                                <SortableTh column="exit_market_price" label="Mercado (saída)" :sort="unitSort" @toggle="toggleUnitSort" />
                                <SortableTh column="market_variation_pct" label="Var. mercado" :sort="unitSort" @toggle="toggleUnitSort" />
                                <SortableTh column="sale_price" label="Venda" :sort="unitSort" @toggle="toggleUnitSort" />
                                <SortableTh column="margin_pct" label="Margem" :sort="unitSort" @toggle="toggleUnitSort" />
                                <SortableTh
                                    class="col-group-start"
                                    column="protected_floor"
                                    label="Piso protegido"
                                    :sort="unitSort"
                                    @toggle="toggleUnitSort"
                                />
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="u in sortedUnits" :key="u.id">
                                <td>{{ u.bot_name || '—' }}</td>
                                <td>{{ formatDateOrDash(u.entered_at) }}</td>
                                <td>{{ u.exited_at ? formatDateOrDash(u.exited_at) : (u.is_sold ? 'Vendida' : 'Ativa') }}</td>
                                <td class="price">{{ formatCurrencyOrDash(u.cost_price) }}</td>
                                <td class="price col-estimated">{{ formatCurrencyOrDash(estimatedEntryCost) }}</td>
                                <td class="price">{{ formatCurrencyOrDash(u.entry_market_price) }}</td>
                                <td class="price">{{ formatCurrencyOrDash(u.exit_market_price) }}</td>
                                <td :class="pctClass(u.market_variation_pct)">{{ formatPctOrDash(u.market_variation_pct) }}</td>
                                <td class="price">{{ formatCurrencyOrDash(u.sale_price) }}</td>
                                <td :class="pctClass(u.margin_pct)">{{ formatPctOrDash(u.margin_pct) }}</td>
                                <td class="price col-group-start" :title="u.absolute_floor != null ? `Piso absoluto: ${formatCurrency(u.absolute_floor)}` : ''">
                                    {{ formatCurrencyOrDash(u.protected_floor) }}
                                </td>
                                <td>
                                    <span class="status-badge" :class="floorStatus(u).cls">{{ floorStatus(u).label }}</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div v-if="sales.length > 0" class="section">
                <h2 class="section-title">Últimas vendas registradas (Steam)</h2>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th class="col-index">#</th>
                                <th>Data</th>
                                <SortableTh column="price" label="Preço" :sort="saleSort" @toggle="toggleSaleSort" />
                                <SortableTh column="quantity" label="Qtd. vendida" :sort="saleSort" @toggle="toggleSaleSort" />
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(sale, i) in sortedSales" :key="i">
                                <td class="col-index">{{ i + 1 }}</td>
                                <td>{{ formatSaleDate(sale[0]) }}</td>
                                <td class="price">{{ formatSalePrice(sale[1]) }}</td>
                                <td class="col-qty">
                                    <span class="qty-wrap">
                                        <span class="qty-bar" :style="{ width: qtyBarWidth(sale[2]) }"></span>
                                        <span class="qty-value">{{ sale[2] }}</span>
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>

        <div v-else class="empty-state">
            Item não encontrado. Ele pode ter saído do market — o espelho é atualizado a cada sync de preços.
        </div>
    </div>
</template>

<style lang="stylus" scoped>
.view-wrap
    padding 2rem
    color #fff
    background #121214
    min-height 100vh
    max-width 1720px

// ultra wide: gráfico e tabela lado a lado; telas menores empilham
.history-grid
    display grid
    grid-template-columns 1fr
    gap 1.5rem
    align-items start
    margin-bottom 1.5rem

    .section
        margin-bottom 0

    @media (min-width: 1400px)
        grid-template-columns 3fr 2fr

        .chart-wrap
            height 420px

        .table-wrapper
            max-height 480px
            overflow-y auto

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

.loading-state
    padding 4rem
    text-align center
    color #94a3b8

.item-hero-row
    display flex
    align-items center
    gap 1.5rem
    margin-bottom 2rem
    padding 1.5rem
    background #1a1a1e
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.item-hero-info
    flex 1

.item-hero-img
    width 140px
    height 140px
    object-fit contain
    border-radius 12px
    background rgba(255,255,255,0.04)

.item-hero-placeholder
    width 140px
    height 140px
    border-radius 12px
    background rgba(255,255,255,0.05)
    display flex
    align-items center
    justify-content center
    color #64748b
    font-size 3rem

.page-title
    font-size 1.5rem
    font-weight 700
    margin-bottom 0.25rem

.item-hash
    font-size 0.85rem
    color #64748b

.lock-badge
    display inline-flex
    align-items center
    gap 0.35rem
    padding 0.4rem 0.75rem
    border-radius 6px
    background rgba(255,152,0,0.1)
    color #ff9800
    font-size 0.8rem
    font-weight 600
    white-space nowrap

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)
    margin-bottom 1.5rem

.section-title
    font-size 1rem
    font-weight 600
    color #cbd5e1
    margin-bottom 1.25rem

.chart-wrap
    height 320px
    position relative

.empty-state
    text-align center
    padding 3rem
    color #94a3b8

.table-wrapper
    overflow-x auto

table
    width 100%
    border-collapse collapse

    th
        position sticky
        top 0
        background #1a1a1e
        text-align left
        color #94a3b8
        font-size 0.78rem
        font-weight 500
        padding 0.75rem 1rem
        border-bottom 1px solid rgba(255,255,255,0.05)
        white-space nowrap
        text-transform uppercase

        &.col-group-start
            border-left 1px solid rgba(255,255,255,0.08)
            padding-left 1.25rem

    td
        padding 0.85rem 1rem
        font-size 0.875rem
        border-bottom 1px solid rgba(255,255,255,0.04)

        &.price
            font-weight 600
            color #4caf50

        // Separa visualmente o veredito de piso (2 últimas colunas) do rastreio
        // histórico — sem isso as 12 colunas viram uma parede só de números.
        &.col-group-start
            border-left 1px solid rgba(255,255,255,0.08)
            padding-left 1.25rem

        &.col-avg
            color #22d3ee

        &.col-estimated
            color #fbbf24

        &.col-avg-24h
            color #38bdf8

        &.col-avg-7d
            color #60a5fa

        &.col-avg-30d
            color #a78bfa

        &.col-avg-90d
            color #e879f9

        &.pct-up
            font-weight 600
            color #4caf50

        &.pct-down
            font-weight 600
            color #f87171

.status-badge
    padding 3px 8px
    border-radius 5px
    font-size 0.72rem
    font-weight 600
    text-transform uppercase
    white-space nowrap

.status-completed
    background rgba(76,175,80,0.1)
    color #4caf50

.status-pending
    background rgba(255,152,0,0.1)
    color #ff9800

.status-canceled
    background rgba(244,67,54,0.1)
    color #f44336

.status-neutral
    background rgba(148,163,184,0.1)
    color #64748b

.col-index
    width 2.5rem
    color #64748b
    font-weight 600

.qty-wrap
    display inline-flex
    align-items center
    gap 0.6rem

.qty-bar
    display inline-block
    height 5px
    background #6366f1
    border-radius 3px

.qty-value
    color #cbd5e1
    font-weight 600
</style>
