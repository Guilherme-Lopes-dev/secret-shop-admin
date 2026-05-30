<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import { Icon } from '@iconify/vue'
import Chart from 'chart.js/auto'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'

type Preset = 'today' | '7d' | 'month' | 'lastMonth'

const PRESETS: { key: Preset; label: string }[] = [
    { key: 'today', label: 'Hoje' },
    { key: '7d', label: '7 dias' },
    { key: 'month', label: 'Mês atual' },
    { key: 'lastMonth', label: 'Mês passado' },
]

const activePreset = ref<Preset>('today')
const dateFrom = ref('')
const dateTo = ref('')
const paymentStatus = ref('PAID')
const loading = ref(false)
const sales = ref<any[]>([])
const chartCanvas = ref<HTMLCanvasElement | null>(null)
const chartInstance = ref<Chart | null>(null)

const applyPreset = (key: Preset) => {
    activePreset.value = key
    const now = dayjs()

    const presets: Record<Preset, () => void> = {
        today: () => {
            dateFrom.value = now.format('YYYY-MM-DD')
            dateTo.value = now.format('YYYY-MM-DD')
        },
        '7d': () => {
            dateFrom.value = now.subtract(6, 'day').format('YYYY-MM-DD')
            dateTo.value = now.format('YYYY-MM-DD')
        },
        month: () => {
            dateFrom.value = now.startOf('month').format('YYYY-MM-DD')
            dateTo.value = now.format('YYYY-MM-DD')
        },
        lastMonth: () => {
            const last = now.subtract(1, 'month')
            dateFrom.value = last.startOf('month').format('YYYY-MM-DD')
            dateTo.value = last.endOf('month').format('YYYY-MM-DD')
        },
    }

    presets[key]()
    fetch()
}

const onManualDateChange = () => {
    activePreset.value = null as any
    fetch()
}

const fetch = async () => {
    if (!dateFrom.value || !dateTo.value) return
    loading.value = true
    try {
        const { data } = await adminService.exportSalesReport({
            from: dateFrom.value,
            to: dateTo.value,
            paymentStatus: paymentStatus.value || undefined,
        })
        sales.value = data?.data ?? []
        renderChart()
    } catch (err) {
        console.error('Erro ao carregar resumo:', err)
    } finally {
        loading.value = false
    }
}

const grouped = computed(() => {
    const map = new Map<string, { date: string; count: number; total: number }>()

    for (const sale of sales.value) {
        const day = dayjs(sale.created_at).format('YYYY-MM-DD')
        const entry = map.get(day) ?? { date: day, count: 0, total: 0 }
        entry.count++
        entry.total += sale.total_amount ?? 0
        map.set(day, entry)
    }

    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
})

const totals = computed(() => {
    const count = sales.value.length
    const total = sales.value.reduce((acc, s) => acc + (s.total_amount ?? 0), 0)
    return {
        count,
        total,
        avg: count ? total / count : 0,
    }
})

const renderChart = () => {
    if (!chartCanvas.value) return

    chartInstance.value?.destroy()

    const rows = grouped.value
    const labels = rows.map(r => dayjs(r.date).format('DD/MM'))
    const values = rows.map(r => r.total / 100)

    const ctx = chartCanvas.value.getContext('2d')
    if (!ctx) return

    chartInstance.value = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Receita',
                data: values,
                backgroundColor: 'rgba(99,102,241,0.5)',
                borderColor: '#6366f1',
                borderWidth: 1,
                borderRadius: 4,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => formatCurrency(Number(ctx.raw) * 100),
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
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

onMounted(() => applyPreset('today'))
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <h1 class="page-title">Resumo de Vendas</h1>
            <p class="page-subtitle">Visão agregada por período</p>
        </header>

        <div class="section filters-section">
            <div class="preset-row">
                <button
                    v-for="p in PRESETS"
                    :key="p.key"
                    class="preset-btn"
                    :class="{ active: activePreset === p.key }"
                    @click="applyPreset(p.key)"
                >
                    {{ p.label }}
                </button>
            </div>

            <div class="filter-grid">
                <div class="filter-field">
                    <label>De</label>
                    <input type="date" v-model="dateFrom" @change="onManualDateChange" />
                </div>
                <div class="filter-field">
                    <label>Até</label>
                    <input type="date" v-model="dateTo" @change="onManualDateChange" />
                </div>
                <div class="filter-field">
                    <label>Status</label>
                    <select v-model="paymentStatus" @change="fetch">
                        <option value="PAID">Pago</option>
                        <option value="APPROVED">Aprovado</option>
                        <option value="COMPLETED">Concluído</option>
                        <option value="">Todos</option>
                    </select>
                </div>
            </div>
        </div>

        <div v-if="loading" class="loading-state">
            <Icon icon="mdi:loading" class="spin" width="28" />
            Carregando...
        </div>

        <template v-else>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon" style="background:rgba(76,175,80,0.12);color:#4caf50">
                        <Icon icon="mdi:currency-usd" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Receita total</span>
                        <span class="stat-value">{{ formatCurrency(totals.total) }}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:rgba(99,102,241,0.12);color:#6366f1">
                        <Icon icon="mdi:cart-outline" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Pedidos</span>
                        <span class="stat-value">{{ totals.count }}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:rgba(255,152,0,0.12);color:#ff9800">
                        <Icon icon="mdi:chart-line" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Ticket médio</span>
                        <span class="stat-value">{{ formatCurrency(totals.avg) }}</span>
                    </div>
                </div>
            </div>

            <div v-if="grouped.length" class="section chart-section">
                <h2 class="section-title">Receita por dia</h2>
                <div class="canvas-wrap">
                    <canvas ref="chartCanvas" />
                </div>
            </div>

            <div v-if="grouped.length" class="section">
                <h2 class="section-title">Detalhamento diário</h2>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Pedidos</th>
                                <th>Receita</th>
                                <th>Ticket médio</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="row in grouped" :key="row.date">
                                <td class="fw">{{ dayjs(row.date).format('DD/MM/YYYY') }}</td>
                                <td>{{ row.count }}</td>
                                <td class="green">{{ formatCurrency(row.total) }}</td>
                                <td>{{ formatCurrency(row.count ? row.total / row.count : 0) }}</td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td class="fw">Total</td>
                                <td>{{ totals.count }}</td>
                                <td class="green">{{ formatCurrency(totals.total) }}</td>
                                <td>{{ formatCurrency(totals.avg) }}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <div v-else-if="!loading" class="empty-state">
                <Icon icon="mdi:chart-bar" width="40" />
                <p>Nenhuma venda no período</p>
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

.page-header
    margin-bottom 1.5rem

.page-title
    font-size 1.8rem
    font-weight 700
    margin-bottom 0.25rem

.page-subtitle
    color #94a3b8
    font-size 0.9rem

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)
    margin-bottom 1.25rem

.section-title
    font-size 1rem
    font-weight 600
    margin-bottom 1rem
    padding-bottom 0.6rem
    border-bottom 1px solid rgba(255,255,255,0.05)

.filters-section
    margin-bottom 1.5rem

.preset-row
    display flex
    flex-wrap wrap
    gap 0.5rem
    margin-bottom 1rem

.preset-btn
    background rgba(255,255,255,0.05)
    color #94a3b8
    border 1px solid rgba(255,255,255,0.08)
    padding 0.4rem 1rem
    border-radius 6px
    font-size 0.82rem
    cursor pointer
    transition all 0.15s

    &:hover
        color #fff
        background rgba(255,255,255,0.09)

    &.active
        background rgba(99,102,241,0.2)
        color #a5b4fc
        border-color rgba(99,102,241,0.4)

.filter-grid
    display grid
    grid-template-columns repeat(auto-fit, minmax(160px, 1fr))
    gap 1rem

.filter-field
    display flex
    flex-direction column
    gap 0.35rem

    label
        font-size 0.78rem
        color #94a3b8

    input,
    select
        background #2a2a30
        border 1px solid rgba(255,255,255,0.08)
        border-radius 6px
        color #fff
        padding 0.5rem 0.7rem
        font-size 0.875rem
        outline none

        &:focus
            border-color rgba(99,102,241,0.4)

.stats-grid
    display grid
    grid-template-columns repeat(auto-fit, minmax(200px, 1fr))
    gap 1.25rem
    margin-bottom 1.25rem

.stat-card
    background #1a1a1e
    padding 1.25rem
    border-radius 12px
    display flex
    align-items center
    gap 1rem
    border 1px solid rgba(255,255,255,0.05)

.stat-icon
    width 44px
    height 44px
    border-radius 10px
    display flex
    align-items center
    justify-content center
    flex-shrink 0

.stat-info
    display flex
    flex-direction column

.stat-label
    font-size 0.8rem
    color #94a3b8
    margin-bottom 0.2rem

.stat-value
    font-size 1.25rem
    font-weight 700

.chart-section .canvas-wrap
    height 260px
    position relative

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
        border-bottom 1px solid rgba(255,255,255,0.06)
        text-transform uppercase

    td
        padding 0.65rem 0.5rem
        font-size 0.875rem
        border-bottom 1px solid rgba(255,255,255,0.04)

.fw
    font-weight 600

.green
    color #4caf50
    font-weight 600

.total-row td
    border-top 1px solid rgba(255,255,255,0.1)
    border-bottom none
    font-weight 700
    color #e2e8f0

.loading-state
    display flex
    align-items center
    gap 0.75rem
    color #64748b
    padding 3rem
    justify-content center

.spin
    animation spin 0.8s linear infinite

@keyframes spin
    from transform rotate(0deg)
    to transform rotate(360deg)

.empty-state
    display flex
    flex-direction column
    align-items center
    gap 0.75rem
    color #475569
    padding 3rem
    text-align center

    p
        margin 0
        font-size 0.9rem
</style>
