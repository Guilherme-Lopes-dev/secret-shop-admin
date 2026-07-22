<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import Chart from 'chart.js/auto'
import { Icon } from '@iconify/vue'
import { adminService, type SkinPriceHistoryResponse } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const result = ref<SkinPriceHistoryResponse | null>(null)
const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

const skin = computed(() => result.value?.skin ?? null)
const points = computed(() => result.value?.points ?? [])
const recentFirst = computed(() => [...points.value].reverse())

const previewImageUrl = (hash: string | null) => {
    if (!hash) return ''
    return `https://steamcommunity-a.akamaihd.net/economy/image/${hash}/184fx184f`
}

// latest_10_sales não tem shape documentado pelo steamwebapi — lista os campos crus
// que vierem, em vez de assumir nomes que podem não bater com a resposta real.
const saleEntries = (sale: unknown): [string, unknown][] => {
    if (!sale || typeof sale !== 'object') return [['valor', sale]]
    return Object.entries(sale as Record<string, unknown>)
}
const formatSaleValue = (v: unknown): string => {
    if (v == null) return '—'
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
}

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
                { label: 'Catálogo', data: series('manual_price'), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.12)', tension: 0.25, spanGaps: true },
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

const fetchHistory = async (uuid: string) => {
    loading.value = true
    try {
        const response = await adminService.getSkinPriceHistory(uuid)
        result.value = response.data
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
    () => route.params.uuid as string,
    (uuid) => fetchHistory(uuid),
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
                    <div v-else class="item-hero-placeholder"><Icon icon="mdi:sword" /></div>
                </div>
                <div class="item-hero-info">
                    <h1 class="page-title">{{ skin.name }}</h1>
                    <p class="item-hash">{{ skin.hero || '—' }}</p>
                </div>
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
                                <th>Menor Preço</th>
                                <th>Preço Mediano</th>
                                <th>Preço Catálogo</th>
                                <th class="col-avg">Média</th>
                                <th class="col-avg-24h">24h</th>
                                <th class="col-avg-7d">7d</th>
                                <th class="col-avg-30d">30d</th>
                                <th class="col-avg-90d">90d</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="p in recentFirst" :key="p.day">
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

            <div v-if="skin.latest_10_sales?.length" class="section sales-section">
                <h2 class="section-title">Últimas vendas registradas</h2>
                <div class="sales-list">
                    <div v-for="(sale, i) in skin.latest_10_sales" :key="i" class="sale-row">
                        <span class="sale-index">#{{ i + 1 }}</span>
                        <span v-for="[key, value] in saleEntries(sale)" :key="key" class="sale-field">
                            <span class="sale-field-label">{{ key }}</span>
                            <span class="sale-field-value">{{ formatSaleValue(value) }}</span>
                        </span>
                    </div>
                </div>
            </div>
        </template>
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

.item-hero-img
    width 80px
    height 80px
    object-fit contain
    border-radius 8px
    background rgba(255,255,255,0.04)

.item-hero-placeholder
    width 80px
    height 80px
    border-radius 8px
    background rgba(255,255,255,0.05)
    display flex
    align-items center
    justify-content center
    color #64748b
    font-size 2rem

.page-title
    font-size 1.5rem
    font-weight 700
    margin-bottom 0.25rem

.item-hash
    font-size 0.85rem
    color #64748b

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
        padding 0.75rem
        border-bottom 1px solid rgba(255,255,255,0.05)
        white-space nowrap
        text-transform uppercase

    td
        padding 0.85rem 0.75rem
        font-size 0.875rem
        border-bottom 1px solid rgba(255,255,255,0.04)

        &.price
            font-weight 600
            color #4caf50

        &.col-avg
            color #22d3ee

        &.col-avg-24h
            color #38bdf8

        &.col-avg-7d
            color #60a5fa

        &.col-avg-30d
            color #a78bfa

        &.col-avg-90d
            color #e879f9

.sales-list
    display flex
    flex-direction column
    gap 0.5rem

.sale-row
    display flex
    align-items center
    flex-wrap wrap
    gap 0.75rem
    padding 0.6rem 0.75rem
    background rgba(255,255,255,0.03)
    border-radius 8px
    border 1px solid rgba(255,255,255,0.05)

.sale-index
    font-size 0.75rem
    font-weight 700
    color #64748b
    min-width 1.75rem

.sale-field
    display flex
    align-items baseline
    gap 0.3rem

.sale-field-label
    font-size 0.68rem
    text-transform uppercase
    color #64748b

.sale-field-value
    font-size 0.82rem
    font-weight 600
    color #cbd5e1
</style>
