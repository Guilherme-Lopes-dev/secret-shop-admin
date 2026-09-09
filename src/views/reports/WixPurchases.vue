<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import Papa from 'papaparse'
import { Icon } from '@iconify/vue'
import Chart from 'chart.js/auto'
import { formatCurrency } from '@/utils/formatCurrency'
import { persistedRef } from '@/utils/persistedRef'
import defaultCsv from './data/compras-wix.csv?raw'

type SortKey =
    | 'name'
    | 'variant'
    | 'quantity'
    | 'gross'
    | 'discount'
    | 'discountRate'
    | 'net'
    | 'avgPrice'
    | 'share'

type ChartMetric = 'net' | 'gross' | 'quantity' | 'discount'

type Curve = 'A' | 'B' | 'C'

/** Linha do export da Wix já normalizada: dinheiro em centavos e métricas derivadas. */
type WixRow = {
    name: string
    variant: string | null
    quantity: number
    gross: number
    discount: number
    net: number
    discountRate: number
    avgPrice: number
    share: number
    cumulativeShare: number
    curve: Curve
}

const COLUMNS: { key: SortKey; label: string; hint: string }[] = [
    {
        key: 'name',
        label: 'Produto',
        hint: 'Nome do produto como estava cadastrado na Wix. Nome repetido vira linha separada: o export não junta duplicados.',
    },
    {
        key: 'variant',
        label: 'Variante',
        hint: 'Variação do produto (modelo, herói). O export quase sempre traz "Desconhecido", e aí a coluna mostra "—".',
    },
    {
        key: 'quantity',
        label: 'Unid.',
        hint: 'Unidades vendidas do produto em todo o período do arquivo, somando todos os pedidos.',
    },
    {
        key: 'gross',
        label: 'Bruto',
        hint: 'Vendas brutas: preço cheio dos itens vendidos, antes de qualquer cupom ou promoção.',
    },
    {
        key: 'discount',
        label: 'Desconto',
        hint: 'Quanto foi abatido do preço cheio em cupom ou promoção neste produto.',
    },
    {
        key: 'discountRate',
        label: '% Desc',
        hint: 'Desconto dividido pelo bruto. Fica vermelho a partir de 50%: preço de tabela alto demais ou promoção agressiva.',
    },
    {
        key: 'net',
        label: 'Líquido',
        hint: 'Coluna "Total de itens" do export: bruto menos desconto. É o dinheiro que entrou de fato.',
    },
    {
        key: 'avgPrice',
        label: 'Preço médio',
        hint: 'Líquido dividido pelas unidades: quanto o produto vendeu, em média, por unidade já com desconto.',
    },
    {
        key: 'share',
        label: 'Share',
        hint: 'Fatia deste produto no líquido total filtrado. Embaixo, o acumulado dele e de todos os produtos com líquido maior.',
    },
]

const CURVE_HINT =
    'Curva ABC pelo líquido acumulado: A até 80% do faturamento, B até 95%, C o resto (cauda longa).'

const RANK_HINT = 'Posição na ordenação atual da tabela.'

const SORTERS: Record<SortKey, (a: WixRow, b: WixRow) => number> = {
    name: (a, b) => b.name.localeCompare(a.name),
    variant: (a, b) => (b.variant ?? '').localeCompare(a.variant ?? ''),
    quantity: (a, b) => a.quantity - b.quantity,
    gross: (a, b) => a.gross - b.gross,
    discount: (a, b) => a.discount - b.discount,
    discountRate: (a, b) => a.discountRate - b.discountRate,
    net: (a, b) => a.net - b.net,
    avgPrice: (a, b) => a.avgPrice - b.avgPrice,
    share: (a, b) => a.net - b.net,
}

const DISCOUNT_FILTERS: Record<string, (row: WixRow) => boolean> = {
    none: row => row.discount === 0,
    any: row => row.discount > 0,
    high: row => row.discountRate >= 50,
}

const CHART_METRICS: { key: ChartMetric; label: string }[] = [
    { key: 'net', label: 'Líquido' },
    { key: 'gross', label: 'Bruto' },
    { key: 'quantity', label: 'Unidades' },
    { key: 'discount', label: 'Desconto' },
]

const PAGE_SIZES = [50, 100, 500, 0]

/** "R$ 6.344,42" vira 634442. Campo vazio ou "Desconhecido" vira zero. */
const toCents = (value: string | undefined) => {
    if (!value) return 0

    const digits = value.replace(/[^\d,-]/g, '').replace(',', '.')
    const parsed = Number(digits)

    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

const toNumber = (value: string) => {
    const parsed = Number(value.replace(',', '.'))

    return value.trim() && Number.isFinite(parsed) ? parsed : null
}

const known = (value: string | undefined) => {
    if (!value) return null
    if (value === 'Desconhecido') return null

    return value
}

const curveOf = (cumulativeShare: number): Curve => {
    if (cumulativeShare <= 80) return 'A'
    if (cumulativeShare <= 95) return 'B'

    return 'C'
}

/** Ranking por líquido: share individual, acumulado e curva ABC (A até 80%, B até 95%). */
const withRanking = (rows: Omit<WixRow, 'share' | 'cumulativeShare' | 'curve'>[]): WixRow[] => {
    const totalNet = rows.reduce((accumulated, row) => accumulated + row.net, 0)
    let running = 0

    return [...rows]
        .sort((a, b) => b.net - a.net)
        .map(row => {
            const share = totalNet ? (row.net / totalNet) * 100 : 0
            running += share

            return { ...row, share, cumulativeShare: running, curve: curveOf(running) }
        })
}

const csvText = ref(defaultCsv)
const sourceName = ref('store-items')
const errorMessage = ref('')

const search = ref('')
const minQuantity = ref('')
const maxQuantity = ref('')
const minNet = ref('')
const maxNet = ref('')
const discountFilter = persistedRef('wix-purchases:discount', '')
const curveFilter = persistedRef('wix-purchases:curve', '')
const sortKey = persistedRef<SortKey>('wix-purchases:sort-key', 'net')
const sortDesc = ref(true)
const pageSize = persistedRef('wix-purchases:page-size', 100)
const page = ref(1)
const chartMetric = ref<ChartMetric>('net')

const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

const parsed = computed(() => {
    const result = Papa.parse<Record<string, string>>(csvText.value, {
        header: true,
        skipEmptyLines: true,
    })

    return result.data.filter(line => line['Nome do produto'])
})

const baseRows = computed<WixRow[]>(() => {
    const rows = parsed.value.map(line => {
        const gross = toCents(line['Vendas brutas'])
        const discount = toCents(line['Descontos'])
        const quantity = Number(line['Quantidade']) || 0
        const net = toCents(line['Total de itens'])

        return {
            name: (line['Nome do produto'] ?? '').trim(),
            variant: known(line['Variante de produto']),
            quantity,
            gross,
            discount,
            net,
            discountRate: gross ? (discount / gross) * 100 : 0,
            avgPrice: quantity ? Math.round(net / quantity) : 0,
        }
    })

    return withRanking(rows)
})

const activeFilters = computed(() => {
    const term = search.value.trim().toLowerCase()
    const quantityFrom = toNumber(minQuantity.value)
    const quantityTo = toNumber(maxQuantity.value)
    const netFrom = toNumber(minNet.value)
    const netTo = toNumber(maxNet.value)
    const byDiscount = DISCOUNT_FILTERS[discountFilter.value]
    const curve = curveFilter.value
    const filters: ((row: WixRow) => boolean)[] = []

    if (term) filters.push(row => row.name.toLowerCase().includes(term))
    if (quantityFrom !== null) filters.push(row => row.quantity >= quantityFrom)
    if (quantityTo !== null) filters.push(row => row.quantity <= quantityTo)
    if (netFrom !== null) filters.push(row => row.net >= netFrom * 100)
    if (netTo !== null) filters.push(row => row.net <= netTo * 100)
    if (byDiscount) filters.push(byDiscount)
    if (curve) filters.push(row => row.curve === curve)

    return filters
})

const filtered = computed(() =>
    baseRows.value.filter(row => activeFilters.value.every(matches => matches(row))),
)

const sorted = computed(() => {
    const direction = sortDesc.value ? -1 : 1
    const sorter = SORTERS[sortKey.value] ?? SORTERS.net

    return [...filtered.value].sort((a, b) => sorter(a, b) * direction)
})

// localStorage devolve o que gravaram lá: só número entra na conta da paginação.
const rowsPerPage = computed(() => {
    const stored = Number(pageSize.value)

    return PAGE_SIZES.includes(stored) ? stored : 100
})

const totalPages = computed(() => {
    if (!rowsPerPage.value) return 1

    return Math.max(1, Math.ceil(sorted.value.length / rowsPerPage.value))
})

const paginated = computed(() => {
    if (!rowsPerPage.value) return sorted.value

    const start = (page.value - 1) * rowsPerPage.value

    return sorted.value.slice(start, start + rowsPerPage.value)
})

const totals = computed(() => {
    const rows = filtered.value
    const gross = rows.reduce((accumulated, row) => accumulated + row.gross, 0)
    const net = rows.reduce((accumulated, row) => accumulated + row.net, 0)
    const quantity = rows.reduce((accumulated, row) => accumulated + row.quantity, 0)
    const discount = rows.reduce((accumulated, row) => accumulated + row.discount, 0)
    const topTenNet = [...rows]
        .sort((a, b) => b.net - a.net)
        .slice(0, 10)
        .reduce((accumulated, row) => accumulated + row.net, 0)

    return {
        gross,
        net,
        quantity,
        discount,
        discountRate: gross ? (discount / gross) * 100 : 0,
        products: rows.length,
        avgTicket: quantity ? Math.round(net / quantity) : 0,
        curveA: rows.filter(row => row.curve === 'A').length,
        discounted: rows.filter(row => row.discount > 0).length,
        topTenShare: net ? (topTenNet / net) * 100 : 0,
    }
})

const topRows = computed(() =>
    [...filtered.value]
        .sort((a, b) => b[chartMetric.value] - a[chartMetric.value])
        .slice(0, 10),
)

const percent = (value: number) => `${value.toFixed(1)}%`

const rankOf = (index: number) => (page.value - 1) * rowsPerPage.value + index + 1

const toggleSort = (key: SortKey) => {
    if (sortKey.value === key) {
        sortDesc.value = !sortDesc.value
        return
    }

    sortKey.value = key
    sortDesc.value = true
}

const clearFilters = () => {
    search.value = ''
    minQuantity.value = ''
    maxQuantity.value = ''
    minNet.value = ''
    maxNet.value = ''
    discountFilter.value = ''
    curveFilter.value = ''
}

/** CSV de outra origem entra só se tiver as colunas do export da Wix. */
const applyCsv = (text: string, name: string) => {
    const { meta } = Papa.parse<Record<string, string>>(text, {
        header: true,
        preview: 1,
        skipEmptyLines: true,
    })

    if (!meta.fields?.includes('Nome do produto')) {
        errorMessage.value = `${name} não tem a coluna "Nome do produto" — não parece um export de itens da Wix.`
        return
    }

    errorMessage.value = ''
    csvText.value = text
    sourceName.value = name
}

const loadFile = (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    // Limpa antes de ler: senão escolher o mesmo arquivo de novo não dispara `change`.
    input.value = ''
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => applyCsv(String(reader.result ?? ''), file.name)
    reader.onerror = () => {
        errorMessage.value = `Não foi possível ler ${file.name}.`
    }
    reader.readAsText(file, 'utf-8')
}

const chartValue = (row: WixRow) =>
    chartMetric.value === 'quantity' ? row.quantity : row[chartMetric.value] / 100

const renderChart = () => {
    chartInstance?.destroy()
    chartInstance = null
    if (!chartCanvas.value) return
    if (!topRows.value.length) return

    const context = chartCanvas.value.getContext('2d')
    if (!context) return

    const isMoney = chartMetric.value !== 'quantity'

    chartInstance = new Chart(context, {
        type: 'bar',
        data: {
            labels: topRows.value.map(row => row.name),
            datasets: [{
                label: CHART_METRICS.find(metric => metric.key === chartMetric.value)?.label ?? '',
                data: topRows.value.map(chartValue),
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
                            isMoney ? formatCurrency(Number(item.raw) * 100) : `${item.raw} un.`,
                    },
                },
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.06)' },
                    ticks: { color: '#94a3b8', callback: (value) => (isMoney ? `R$ ${value}` : value) },
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
const toCsv = (list: WixRow[]) =>
    Papa.unparse(
        list.map(row => ({
            produto: row.name,
            variante: row.variant ?? '',
            unidades: row.quantity,
            bruto: (row.gross / 100).toFixed(2).replace('.', ','),
            desconto: (row.discount / 100).toFixed(2).replace('.', ','),
            desconto_percentual: row.discountRate.toFixed(1).replace('.', ','),
            liquido: (row.net / 100).toFixed(2).replace('.', ','),
            preco_medio: (row.avgPrice / 100).toFixed(2).replace('.', ','),
            share: row.share.toFixed(2).replace('.', ','),
            acumulado: row.cumulativeShare.toFixed(2).replace('.', ','),
            curva: row.curve,
        })),
        { delimiter: ';' },
    )

const exportCsv = () => {
    // BOM na frente: sem ele o Excel come os acentos dos nomes.
    const blob = new Blob([`﻿${toCsv(sorted.value)}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'compras-wix.csv'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
}

// Filtro novo pode deixar a página atual fora do fim da lista.
watch([filtered, pageSize], () => {
    page.value = 1
})

// Dado vem do import, não de request: sem o onMounted o canvas ainda não existe
// quando o watcher rodaria pela primeira vez e o gráfico nunca desenha.
watch([topRows, chartMetric], renderChart, { flush: 'post' })

onMounted(renderChart)
onUnmounted(() => chartInstance?.destroy())
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Compras Wix</h1>
                <p class="page-subtitle">
                    Export de itens da loja Wix — {{ sourceName }}. SKU, preço unitário e impostos vêm
                    vazios no arquivo, então a tela trabalha com quantidade, bruto, desconto e líquido.
                </p>
            </div>
            <div class="header-actions">
                <label class="ghost-btn">
                    <Icon icon="mdi:upload-outline" width="18" />
                    Trocar CSV
                    <input type="file" accept=".csv,text/csv" hidden @change="loadFile" />
                </label>
                <button class="ghost-btn" :disabled="!sorted.length" @click="exportCsv">
                    <Icon icon="mdi:file-delimited-outline" width="18" />
                    Exportar CSV
                </button>
            </div>
        </header>

        <div v-if="errorMessage" class="error-banner">
            <Icon icon="mdi:alert-circle-outline" width="20" />
            {{ errorMessage }}
        </div>

        <div class="section filters-section">
            <div class="filter-grid">
                <div class="filter-field">
                    <label>Buscar produto</label>
                    <input type="text" v-model="search" placeholder="Nome do produto" />
                </div>
                <div class="filter-field">
                    <label>Unidades mín.</label>
                    <input type="number" min="0" v-model="minQuantity" placeholder="0" />
                </div>
                <div class="filter-field">
                    <label>Unidades máx.</label>
                    <input type="number" min="0" v-model="maxQuantity" placeholder="sem limite" />
                </div>
                <div class="filter-field">
                    <label>Líquido mín. (R$)</label>
                    <input type="number" min="0" v-model="minNet" placeholder="0" />
                </div>
                <div class="filter-field">
                    <label>Líquido máx. (R$)</label>
                    <input type="number" min="0" v-model="maxNet" placeholder="sem limite" />
                </div>
                <div class="filter-field">
                    <label>Desconto</label>
                    <select v-model="discountFilter">
                        <option value="">Todos</option>
                        <option value="none">Sem desconto</option>
                        <option value="any">Com desconto</option>
                        <option value="high">Desconto alto (50% ou mais)</option>
                    </select>
                </div>
                <div class="filter-field">
                    <label>Curva ABC</label>
                    <select v-model="curveFilter">
                        <option value="">Todas</option>
                        <option value="A">A — até 80% do líquido</option>
                        <option value="B">B — até 95%</option>
                        <option value="C">C — cauda longa</option>
                    </select>
                </div>
                <div class="filter-field">
                    <label>Linhas por página</label>
                    <select v-model.number="pageSize">
                        <option v-for="size in PAGE_SIZES" :key="size" :value="size">
                            {{ size || 'Todas' }}
                        </option>
                    </select>
                </div>
            </div>

            <button class="ghost-btn clear-btn" @click="clearFilters">
                <Icon icon="mdi:filter-remove-outline" width="16" />
                Limpar filtros
            </button>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon" style="background:rgba(76,175,80,0.12);color:#4caf50">
                    <Icon icon="mdi:currency-usd" width="22" />
                </div>
                <div class="stat-info">
                    <span class="stat-label">Líquido</span>
                    <span class="stat-value">{{ formatCurrency(totals.net) }}</span>
                    <span class="stat-sub">bruto {{ formatCurrency(totals.gross) }}</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:rgba(244,63,94,0.12);color:#f43f5e">
                    <Icon icon="mdi:sale" width="22" />
                </div>
                <div class="stat-info">
                    <span class="stat-label">Descontos</span>
                    <span class="stat-value">{{ formatCurrency(totals.discount) }}</span>
                    <span class="stat-sub">
                        {{ percent(totals.discountRate) }} do bruto · {{ totals.discounted }} produtos
                    </span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:rgba(99,102,241,0.12);color:#6366f1">
                    <Icon icon="mdi:sword" width="22" />
                </div>
                <div class="stat-info">
                    <span class="stat-label">Unidades</span>
                    <span class="stat-value">{{ totals.quantity }}</span>
                    <span class="stat-sub">preço médio {{ formatCurrency(totals.avgTicket) }}</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:rgba(14,165,233,0.12);color:#0ea5e9">
                    <Icon icon="mdi:tag-multiple-outline" width="22" />
                </div>
                <div class="stat-info">
                    <span class="stat-label">Produtos</span>
                    <span class="stat-value">{{ totals.products }}</span>
                    <span class="stat-sub">{{ totals.curveA }} na curva A</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background:rgba(255,152,0,0.12);color:#ff9800">
                    <Icon icon="mdi:podium-gold" width="22" />
                </div>
                <div class="stat-info">
                    <span class="stat-label">Concentração top 10</span>
                    <span class="stat-value">{{ percent(totals.topTenShare) }}</span>
                    <span class="stat-sub">do líquido filtrado</span>
                </div>
            </div>
        </div>

        <div v-if="topRows.length" class="section">
            <div class="section-head">
                <h2 class="section-title">Top 10 produtos</h2>
                <div class="metric-toggle">
                    <button
                        v-for="metric in CHART_METRICS"
                        :key="metric.key"
                        :class="{ active: chartMetric === metric.key }"
                        @click="chartMetric = metric.key"
                    >
                        {{ metric.label }}
                    </button>
                </div>
            </div>
            <div class="canvas-wrap">
                <canvas ref="chartCanvas" />
            </div>
        </div>

        <div v-if="sorted.length" class="section">
            <div class="section-head">
                <h2 class="section-title">Produtos ({{ sorted.length }})</h2>
                <span class="section-hint">Clique no cabeçalho para ordenar</span>
            </div>

            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th class="rank-col">
                                #
                                <span class="col-info" @click.stop>
                                    <Icon icon="mdi:information-outline" width="13" />
                                    <span class="col-tip">{{ RANK_HINT }}</span>
                                </span>
                            </th>
                            <th
                                v-for="column in COLUMNS"
                                :key="column.key"
                                class="sortable"
                                :class="{ active: sortKey === column.key }"
                                @click="toggleSort(column.key)"
                            >
                                {{ column.label }}
                                <span class="col-info" @click.stop>
                                    <Icon icon="mdi:information-outline" width="13" />
                                    <span class="col-tip">{{ column.hint }}</span>
                                </span>
                                <span v-if="sortKey === column.key">{{ sortDesc ? '▼' : '▲' }}</span>
                            </th>
                            <th>
                                Curva
                                <span class="col-info" @click.stop>
                                    <Icon icon="mdi:information-outline" width="13" />
                                    <span class="col-tip">{{ CURVE_HINT }}</span>
                                </span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(row, index) in paginated" :key="`${row.name}-${index}`">
                            <td class="rank-col">{{ rankOf(index) }}</td>
                            <td>
                                <span class="product-name" :title="row.name">{{ row.name }}</span>
                            </td>
                            <td class="muted">{{ row.variant ?? '—' }}</td>
                            <td class="fw">{{ row.quantity }}</td>
                            <td>{{ formatCurrency(row.gross) }}</td>
                            <td :class="{ red: row.discount > 0 }">{{ formatCurrency(row.discount) }}</td>
                            <td :class="{ red: row.discountRate >= 50 }">{{ percent(row.discountRate) }}</td>
                            <td class="green">{{ formatCurrency(row.net) }}</td>
                            <td>{{ formatCurrency(row.avgPrice) }}</td>
                            <td>
                                {{ percent(row.share) }}
                                <span class="muted">acum. {{ percent(row.cumulativeShare) }}</span>
                            </td>
                            <td>
                                <span class="curve-tag" :class="`curve-${row.curve}`">{{ row.curve }}</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div v-if="totalPages > 1" class="pager">
                <button class="ghost-btn" :disabled="page === 1" @click="page -= 1">Anterior</button>
                <span class="muted">Página {{ page }} de {{ totalPages }}</span>
                <button class="ghost-btn" :disabled="page === totalPages" @click="page += 1">Próxima</button>
            </div>
        </div>

        <div v-else class="empty-state">
            <Icon icon="mdi:filter-off-outline" width="32" />
            <p>Nenhum produto bate com os filtros.</p>
        </div>
    </div>
</template>

<style lang="stylus" scoped>
@import '../../styles/report-view.styl'

.header-actions
    display flex
    align-items center
    gap 0.5rem

    label.ghost-btn
        cursor pointer

.clear-btn
    margin-top 1rem

.product-name
    font-weight 600
    display inline-block
    max-width 320px
    overflow hidden
    text-overflow ellipsis
    vertical-align bottom

// Balão de ajuda do cabeçalho: só CSS, some junto com o hover.
.col-info
    position relative
    display inline-flex
    align-items center
    margin-left 0.2rem
    color #64748b
    cursor help
    vertical-align middle

    &:hover
        color #a5b4fc

    &:hover .col-tip
        opacity 1
        visibility visible

.col-tip
    position absolute
    top calc(100% + 6px)
    left 0
    width 240px
    padding 0.55rem 0.65rem
    background #0f0f12
    border 1px solid rgba(255,255,255,0.1)
    border-radius 6px
    box-shadow 0 8px 20px rgba(0,0,0,0.45)
    color #cbd5e1
    font-size 0.72rem
    font-weight 400
    line-height 1.4
    letter-spacing 0
    text-transform none
    white-space normal
    opacity 0
    visibility hidden
    transition opacity 0.12s
    z-index 5

// Últimas colunas: balão ancorado à direita, senão estoura a largura da tabela.
th:last-child .col-tip,
th:nth-last-child(2) .col-tip
    left auto
    right 0

.curve-tag
    display inline-block
    min-width 22px
    text-align center
    padding 0.15rem 0.4rem
    border-radius 5px
    font-size 0.72rem
    font-weight 600

.curve-A
    background rgba(76,175,80,0.16)
    color #4caf50

.curve-B
    background rgba(255,152,0,0.16)
    color #ff9800

.curve-C
    background rgba(148,163,184,0.14)
    color #94a3b8

.pager
    display flex
    align-items center
    justify-content center
    gap 1rem
    margin-top 1rem

td .muted
    display block
    font-size 0.72rem
</style>
