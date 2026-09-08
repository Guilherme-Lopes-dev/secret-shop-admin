<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import Papa from 'papaparse'
import { Icon } from '@iconify/vue'
import Chart from 'chart.js/auto'
import { adminService } from '@/services/admin/admin.service'
import type { SkinSalesRow } from '@/services/admin/types'
import { formatCurrency } from '@/utils/formatCurrency'
import { buildSteamImageUrl } from '@/utils/steamImage'
import { persistedRef } from '@/utils/persistedRef'
import { DATE_PRESETS, DATE_RANGE_BUILDERS, type DatePreset } from '@/utils/datePresets'

type SortKey =
    | 'name'
    | 'quantity'
    | 'orders'
    | 'revenue'
    | 'avgPrice'
    | 'profit'
    | 'margin'
    | 'stock'
    | 'lastSale'

/** Linha do ranking já com as métricas derivadas que a tela mostra. */
type SkinRow = SkinSalesRow & {
    profit: number
    margin: number
    avgPrice: number
    revenueShare: number
    perDay: number
    daysSinceLastSale: number | null
    coverageDays: number | null
    hasFullCost: boolean
    imageUrl: string | null
}

const timestampOf = (value: string | null) => (value ? dayjs(value).valueOf() : 0)

const SORTERS: Record<SortKey, (a: SkinRow, b: SkinRow) => number> = {
    name: (a, b) => b.skin_name.localeCompare(a.skin_name),
    quantity: (a, b) => a.quantity - b.quantity,
    orders: (a, b) => a.orders - b.orders,
    revenue: (a, b) => a.revenue - b.revenue,
    avgPrice: (a, b) => a.avgPrice - b.avgPrice,
    profit: (a, b) => a.profit - b.profit,
    margin: (a, b) => a.margin - b.margin,
    stock: (a, b) => a.stock_available - b.stock_available,
    lastSale: (a, b) => timestampOf(a.last_sale_at) - timestampOf(b.last_sale_at),
}

const COLUMNS: { key: SortKey; label: string; hint?: string }[] = [
    { key: 'name', label: 'Skin' },
    { key: 'quantity', label: 'Unid.', hint: 'Unidades vendidas no período' },
    { key: 'orders', label: 'Pedidos', hint: 'Pedidos distintos que levaram esta skin' },
    { key: 'revenue', label: 'Receita', hint: 'Soma dos itens, antes dos descontos do pedido' },
    { key: 'avgPrice', label: 'Preço médio' },
    { key: 'profit', label: 'Lucro', hint: 'Receita menos o custo de entrada do inventário' },
    { key: 'margin', label: 'Margem', hint: 'Lucro sobre o custo' },
    { key: 'stock', label: 'Estoque', hint: 'Disponível agora, + bloqueado (reserva/escrow/cooldown), + dias de cobertura no giro atual' },
    { key: 'lastSale', label: 'Última venda' },
]

const percent = (value: number) => `${value.toFixed(1)}%`

const activePreset = ref<DatePreset | null>('30d')
const dateFrom = ref('')
const dateTo = ref('')
const paymentStatus = persistedRef('sales-by-skin:payment-status', 'PAID')
const includeIdle = persistedRef('sales-by-skin:include-idle', false)
const sortKey = persistedRef<SortKey>('sales-by-skin:sort-key', 'quantity')
const sortDesc = ref(true)
const search = ref('')
const chartMetric = ref<'quantity' | 'revenue'>('quantity')

const loading = ref(false)
const errorMessage = ref('')
const rows = ref<SkinSalesRow[]>([])
const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

/** Sem status = pedido pendente/expirado entra: o ranking vira intenção de compra. */
const showsIntent = computed(() => !paymentStatus.value)

const periodDays = computed(() => {
    if (!dateFrom.value || !dateTo.value) return 1

    return Math.max(1, dayjs(dateTo.value).diff(dayjs(dateFrom.value), 'day') + 1)
})

const totals = computed(() => {
    const revenue = rows.value.reduce((acc, row) => acc + row.revenue, 0)
    const cost = rows.value.reduce((acc, row) => acc + row.cost, 0)

    return {
        revenue,
        cost,
        profit: revenue - cost,
        quantity: rows.value.reduce((acc, row) => acc + row.quantity, 0),
        skinsSold: rows.value.filter(row => row.quantity > 0).length,
        idleSkins: rows.value.filter(row => row.quantity === 0 && row.stock_available > 0).length,
        stockUnits: rows.value.reduce((acc, row) => acc + row.stock_available, 0),
        stockValue: rows.value.reduce((acc, row) => acc + row.stock_value, 0),
    }
})

const buildRow = (row: SkinSalesRow, totalRevenue: number, days: number): SkinRow => {
    const profit = row.revenue - row.cost
    const perDay = row.quantity / days

    return {
        ...row,
        profit,
        margin: row.cost ? (profit / row.cost) * 100 : 0,
        avgPrice: row.quantity ? row.revenue / row.quantity : 0,
        revenueShare: totalRevenue ? (row.revenue / totalRevenue) * 100 : 0,
        perDay,
        daysSinceLastSale: row.last_sale_at ? dayjs().diff(dayjs(row.last_sale_at), 'day') : null,
        coverageDays: perDay ? Math.round(row.stock_available / perDay) : null,
        hasFullCost: row.items > 0 && row.cost_items === row.items,
        imageUrl: buildSteamImageUrl(row.skin_image),
    }
}

const enriched = computed<SkinRow[]>(() =>
    rows.value.map(row => buildRow(row, totals.value.revenue, periodDays.value)),
)

const filtered = computed(() => {
    const term = search.value.trim().toLowerCase()
    const visible = includeIdle.value ? enriched.value : enriched.value.filter(row => row.quantity > 0)
    if (!term) return visible

    return visible.filter(row => row.skin_name.toLowerCase().includes(term))
})

const sorted = computed(() => {
    const direction = sortDesc.value ? -1 : 1
    const sorter = SORTERS[sortKey.value] ?? SORTERS.quantity

    return [...filtered.value].sort((a, b) => sorter(a, b) * direction)
})

const topRows = computed(() =>
    [...enriched.value]
        .filter(row => row.quantity > 0)
        .sort((a, b) => b[chartMetric.value] - a[chartMetric.value])
        .slice(0, 10),
)

// Trocar de preset dispara duas buscas; só a resposta do último pedido pode escrever na tela.
let requestToken = 0

const fetchReport = async () => {
    if (!dateFrom.value || !dateTo.value) return

    const token = ++requestToken
    loading.value = true
    errorMessage.value = ''

    try {
        const { data } = await adminService.getSalesBySkinReport({
            from: dateFrom.value,
            to: dateTo.value,
            paymentStatus: paymentStatus.value || undefined,
        })
        if (token !== requestToken) return

        rows.value = data?.data ?? []
    } catch (requestError: any) {
        if (token !== requestToken) return

        errorMessage.value =
            requestError?.response?.data?.message ?? 'Não foi possível carregar o relatório por skin.'
        rows.value = []
    } finally {
        if (token === requestToken) loading.value = false
    }
}

const applyPreset = (key: DatePreset) => {
    activePreset.value = key
    const [from, to] = DATE_RANGE_BUILDERS[key]()
    dateFrom.value = from
    dateTo.value = to
    fetchReport()
}

const onManualDateChange = () => {
    activePreset.value = null
    fetchReport()
}

const toggleSort = (key: SortKey) => {
    if (sortKey.value === key) {
        sortDesc.value = !sortDesc.value
        return
    }

    sortKey.value = key
    sortDesc.value = true
}

const renderChart = () => {
    chartInstance?.destroy()
    chartInstance = null
    if (!chartCanvas.value) return
    if (!topRows.value.length) return

    const context = chartCanvas.value.getContext('2d')
    if (!context) return

    const isRevenue = chartMetric.value === 'revenue'

    chartInstance = new Chart(context, {
        type: 'bar',
        data: {
            labels: topRows.value.map(row => row.skin_name),
            datasets: [{
                label: isRevenue ? 'Receita' : 'Unidades',
                data: topRows.value.map(row => (isRevenue ? row.revenue / 100 : row.quantity)),
                backgroundColor: 'rgba(99,102,241,0.5)',
                borderColor: '#6366f1',
                borderWidth: 1,
                borderRadius: 4,
            }],
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (item) =>
                            isRevenue ? formatCurrency(Number(item.raw) * 100) : `${item.raw} un.`,
                    },
                },
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.06)' },
                    ticks: { color: '#94a3b8', callback: (value) => (isRevenue ? `R$ ${value}` : value) },
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { size: 10 } },
                },
            },
        },
    })
}

/** Excel pt-BR: separador `;` e vírgula decimal, senão tudo cai numa coluna só. */
const toCsv = (list: SkinRow[]) =>
    Papa.unparse(
        list.map(row => ({
            skin: row.skin_name,
            unidades: row.quantity,
            pedidos: row.orders,
            compradores: row.buyers,
            receita: (row.revenue / 100).toFixed(2).replace('.', ','),
            preco_medio: (row.avgPrice / 100).toFixed(2).replace('.', ','),
            custo: (row.cost / 100).toFixed(2).replace('.', ','),
            lucro: (row.profit / 100).toFixed(2).replace('.', ','),
            margem: row.margin.toFixed(1).replace('.', ','),
            share_receita: row.revenueShare.toFixed(1).replace('.', ','),
            giro_dia: row.perDay.toFixed(2).replace('.', ','),
            estoque_disponivel: row.stock_available,
            estoque_bloqueado: row.stock_blocked,
            valor_estoque: (row.stock_value / 100).toFixed(2).replace('.', ','),
            cobertura_dias: row.coverageDays ?? '',
            primeira_venda: row.first_sale_at ? dayjs(row.first_sale_at).format('DD/MM/YYYY') : '',
            ultima_venda: row.last_sale_at ? dayjs(row.last_sale_at).format('DD/MM/YYYY') : '',
        })),
        { delimiter: ';' },
    )

const exportCsv = () => {
    // BOM na frente: sem ele o Excel come os acentos dos nomes.
    const blob = new Blob([`﻿${toCsv(sorted.value)}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `vendas-por-skin-${dateFrom.value}-a-${dateTo.value}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
}

watch([topRows, chartMetric], renderChart, { flush: 'post' })

onMounted(() => applyPreset('30d'))
onUnmounted(() => chartInstance?.destroy())
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Vendas por Skin</h1>
                <p class="page-subtitle">O que mais e o que menos sai, com custo, lucro e estoque atual</p>
            </div>
            <button class="ghost-btn" :disabled="!sorted.length" @click="exportCsv">
                <Icon icon="mdi:file-delimited-outline" width="18" />
                Exportar CSV
            </button>
        </header>

        <div class="section filters-section">
            <div class="preset-row">
                <button
                    v-for="preset in DATE_PRESETS"
                    :key="preset.key"
                    class="preset-btn"
                    :class="{ active: activePreset === preset.key }"
                    @click="applyPreset(preset.key)"
                >
                    {{ preset.label }}
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
                    <label>Status do pagamento</label>
                    <select v-model="paymentStatus" @change="fetchReport">
                        <option value="PAID">Pago</option>
                        <option value="APPROVED">Aprovado</option>
                        <option value="COMPLETED">Concluído</option>
                        <option value="">Todos (inclui não pagos)</option>
                    </select>
                </div>
                <div class="filter-field">
                    <label>Buscar skin</label>
                    <input type="text" v-model="search" placeholder="Nome da skin" />
                </div>
                <div class="filter-field">
                    <label>Estoque parado</label>
                    <select v-model="includeIdle">
                        <option :value="false">Só skins vendidas</option>
                        <option :value="true">Incluir skins sem venda</option>
                    </select>
                </div>
            </div>

            <p v-if="showsIntent" class="intent-note">
                <Icon icon="mdi:information-outline" width="16" />
                Status "Todos": pedidos pendentes e expirados entram na conta — o ranking mostra
                intenção de compra, não faturamento.
            </p>
        </div>

        <div v-if="errorMessage" class="error-banner">
            <Icon icon="mdi:alert-circle-outline" width="20" />
            {{ errorMessage }}
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
                        <span class="stat-label">Receita no período</span>
                        <span class="stat-value">{{ formatCurrency(totals.revenue) }}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:rgba(99,102,241,0.12);color:#6366f1">
                        <Icon icon="mdi:sword" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Unidades vendidas</span>
                        <span class="stat-value">{{ totals.quantity }}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:rgba(255,152,0,0.12);color:#ff9800">
                        <Icon icon="mdi:trending-up" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Lucro estimado</span>
                        <span class="stat-value">{{ formatCurrency(totals.profit) }}</span>
                        <span class="stat-sub">custo {{ formatCurrency(totals.cost) }}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:rgba(14,165,233,0.12);color:#0ea5e9">
                        <Icon icon="mdi:tag-multiple-outline" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Skins com venda</span>
                        <span class="stat-value">{{ totals.skinsSold }}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:rgba(244,63,94,0.12);color:#f43f5e">
                        <Icon icon="mdi:package-variant" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Skins paradas em estoque</span>
                        <span class="stat-value">{{ totals.idleSkins }}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:rgba(148,163,184,0.12);color:#94a3b8">
                        <Icon icon="mdi:warehouse" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Estoque disponível</span>
                        <span class="stat-value">{{ totals.stockUnits }} un.</span>
                        <span class="stat-sub">{{ formatCurrency(totals.stockValue) }}</span>
                    </div>
                </div>
            </div>

            <div v-if="topRows.length" class="section">
                <div class="section-head">
                    <h2 class="section-title">Top 10 skins</h2>
                    <div class="metric-toggle">
                        <button
                            :class="{ active: chartMetric === 'quantity' }"
                            @click="chartMetric = 'quantity'"
                        >
                            Unidades
                        </button>
                        <button
                            :class="{ active: chartMetric === 'revenue' }"
                            @click="chartMetric = 'revenue'"
                        >
                            Receita
                        </button>
                    </div>
                </div>
                <div class="canvas-wrap">
                    <canvas ref="chartCanvas" />
                </div>
            </div>

            <div v-if="sorted.length" class="section">
                <div class="section-head">
                    <h2 class="section-title">Detalhamento por skin ({{ sorted.length }})</h2>
                    <span class="section-hint">
                        Clique no cabeçalho para ordenar — inverte entre mais e menos vendidas
                    </span>
                </div>

                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th class="rank-col">#</th>
                                <th
                                    v-for="column in COLUMNS"
                                    :key="column.key"
                                    :title="column.hint"
                                    class="sortable"
                                    :class="{ active: sortKey === column.key }"
                                    @click="toggleSort(column.key)"
                                >
                                    {{ column.label }}
                                    <Icon
                                        v-if="sortKey === column.key"
                                        :icon="sortDesc ? 'mdi:arrow-down' : 'mdi:arrow-up'"
                                        width="12"
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="(row, index) in sorted"
                                :key="row.skin_name"
                                :class="{ idle: row.quantity === 0 }"
                            >
                                <td class="rank-col">{{ index + 1 }}</td>
                                <td>
                                    <div class="skin-cell">
                                        <img v-if="row.imageUrl" :src="row.imageUrl" :alt="row.skin_name" />
                                        <div class="skin-meta">
                                            <span class="skin-name">{{ row.skin_name }}</span>
                                            <span class="skin-sub">
                                                {{ percent(row.revenueShare) }} da receita ·
                                                {{ row.perDay.toFixed(2) }} un./dia
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                <td class="fw">{{ row.quantity }}</td>
                                <td>
                                    {{ row.orders }}
                                    <span class="muted">/ {{ row.buyers }} clientes</span>
                                </td>
                                <td class="green">{{ formatCurrency(row.revenue) }}</td>
                                <td>{{ formatCurrency(row.avgPrice) }}</td>
                                <td :class="row.profit >= 0 ? 'green' : 'red'">
                                    {{ row.cost ? formatCurrency(row.profit) : '—' }}
                                    <span
                                        v-if="row.cost && !row.hasFullCost"
                                        class="muted"
                                        title="Parte dos itens é dropship e não tem custo registrado"
                                    >*</span>
                                </td>
                                <td :class="row.margin >= 0 ? 'green' : 'red'">
                                    {{ row.cost ? percent(row.margin) : '—' }}
                                    <span
                                        v-if="row.cost && !row.hasFullCost"
                                        class="muted"
                                        title="Parte dos itens é dropship e não tem custo registrado"
                                    >*</span>
                                </td>
                                <td>
                                    {{ row.stock_available }}
                                    <span
                                        v-if="row.stock_blocked"
                                        class="muted"
                                        title="Não vendido, mas fora de venda agora: reserva, escrow de swap ou cooldown de troca"
                                    >
                                        +{{ row.stock_blocked }} bloq.
                                    </span>
                                    <span v-if="row.coverageDays !== null" class="muted">
                                        · {{ row.coverageDays }}d
                                    </span>
                                </td>
                                <td>
                                    <template v-if="row.last_sale_at">
                                        {{ dayjs(row.last_sale_at).format('DD/MM/YY') }}
                                        <span class="muted">({{ row.daysSinceLastSale }}d)</span>
                                    </template>
                                    <span v-else class="muted">nunca</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div v-else class="empty-state">
                <Icon icon="mdi:chart-bar" width="40" />
                <p>Nenhuma skin vendida no período</p>
            </div>
        </template>
    </div>
</template>

<style lang="stylus" scoped>
@import '../../styles/report-view.styl'

.intent-note
    display flex
    align-items center
    gap 0.4rem
    margin 1rem 0 0
    color #fbbf24
    font-size 0.78rem

tr.idle td
    opacity 0.6

.skin-cell
    display flex
    align-items center
    gap 0.6rem

    img
        width 40px
        height 30px
        object-fit contain
        background rgba(255,255,255,0.04)
        border-radius 4px

.skin-meta
    display flex
    flex-direction column

.skin-name
    font-weight 600
    max-width 280px
    overflow hidden
    text-overflow ellipsis

.skin-sub
    font-size 0.72rem
    color #64748b

.red
    font-weight 600
</style>
