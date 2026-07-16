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

const renderChart = () => {
    if (!chartCanvas.value) return
    chartInstance?.destroy()
    if (points.value.length === 0) return

    const ctx = chartCanvas.value.getContext('2d')
    if (!ctx) return

    const labels = points.value.map(p => dayjs(p.day).format('DD/MM'))
    const series = (key: 'lowest_price' | 'median_price' | 'manual_price') =>
        points.value.map(p => (p[key] != null ? p[key]! / 100 : null))

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Catálogo', data: series('manual_price'), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.12)', tension: 0.25, spanGaps: true },
                { label: 'Mediano', data: series('median_price'), borderColor: '#4caf50', backgroundColor: 'rgba(76,175,80,0.12)', tension: 0.25, spanGaps: true },
                { label: 'Menor Preço', data: series('lowest_price'), borderColor: '#ff9800', backgroundColor: 'rgba(255,152,0,0.12)', tension: 0.25, spanGaps: true },
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
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="p in recentFirst" :key="p.day">
                                <td>{{ $dayjs(p.day).format('DD/MM/YYYY') }}</td>
                                <td class="price">{{ formatCurrency(p.lowest_price) }}</td>
                                <td class="price">{{ formatCurrency(p.median_price) }}</td>
                                <td class="price">{{ formatCurrency(p.manual_price) }}</td>
                            </tr>
                        </tbody>
                    </table>
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
    max-width 960px

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
</style>
