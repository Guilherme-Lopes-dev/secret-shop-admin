<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import Papa from 'papaparse'
import { Icon } from '@iconify/vue'
import Chart from 'chart.js/auto'
import { adminService } from '@/services/admin/admin.service'
import type { DemandRow } from '@/services/admin/types'
import { formatCurrency } from '@/utils/formatCurrency'
import { buildSteamImageUrl } from '@/utils/steamImage'
import { persistedRef } from '@/utils/persistedRef'
import { DATE_PRESETS, DATE_RANGE_BUILDERS, type DatePreset } from '@/utils/datePresets'

type SortKey =
    | 'name'
    | 'favorites'
    | 'cart'
    | 'demand'
    | 'missing'
    | 'stock'
    | 'price'
    | 'potential'
    | 'lastInterest'

type KindFilter = 'all' | 'skin' | 'collector' | 'physical'
type SourceFilter = 'all' | 'favorites' | 'cart'

/** Linha de demanda já com o que a tela deriva: interesse total, falta e valor parado. */
type DemandItem = DemandRow & {
    demand: number
    missing: number
    /** Demanda filtrada × preço. As parcelas ficam separadas: carrinho é bem mais quente que desejo. */
    potential: number
    potentialCart: number
    potentialWishlist: number
    lastInterestAt: string | null
    daysSinceInterest: number | null
    imageUrl: string | null
}

const KIND_LABELS: Record<DemandRow['kind'], string> = {
    skin: 'Skin',
    collector: 'Collector',
    physical: 'Físico',
}

const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
    { value: 'all', label: 'Todos os catálogos' },
    { value: 'skin', label: 'Skins' },
    { value: 'collector', label: 'Collectors' },
    { value: 'physical', label: 'Físicos' },
]

const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
    { value: 'all', label: 'Desejo + carrinho' },
    { value: 'favorites', label: 'Só lista de desejos' },
    { value: 'cart', label: 'Só carrinho' },
]

const timestampOf = (value: string | null) => (value ? dayjs(value).valueOf() : 0)

const SORTERS: Record<SortKey, (a: DemandItem, b: DemandItem) => number> = {
    name: (a, b) => b.name.localeCompare(a.name),
    favorites: (a, b) => a.favorites - b.favorites,
    cart: (a, b) => a.cart_quantity - b.cart_quantity,
    demand: (a, b) => a.demand - b.demand,
    missing: (a, b) => a.missing - b.missing,
    stock: (a, b) => a.stock_available - b.stock_available,
    price: (a, b) => (a.price ?? 0) - (b.price ?? 0),
    potential: (a, b) => a.potential - b.potential,
    lastInterest: (a, b) => timestampOf(a.lastInterestAt) - timestampOf(b.lastInterestAt),
}

const COLUMNS: { key: SortKey; label: string; hint?: string }[] = [
    { key: 'name', label: 'Item' },
    { key: 'favorites', label: 'Desejos', hint: 'Usuários distintos com o item na lista de desejos' },
    { key: 'cart', label: 'Carrinho', hint: 'Unidades no carrinho / usuários distintos' },
    { key: 'demand', label: 'Demanda', hint: 'Desejos + unidades no carrinho' },
    { key: 'stock', label: 'Estoque', hint: 'Disponível para venda agora; "excl." é unidade em linha excluída do catálogo' },
    { key: 'missing', label: 'Falta', hint: 'Demanda que o estoque atual não cobre' },
    { key: 'price', label: 'Preço' },
    { key: 'potential', label: 'Potencial', hint: 'Demanda × preço, com a parcela do carrinho ao lado — desejo esquenta bem menos que carrinho' },
    { key: 'lastInterest', label: 'Último interesse' },
]

const activePreset = ref<DatePreset | null>(null)
const dateFrom = ref('')
const dateTo = ref('')
const kindFilter = persistedRef<KindFilter>('demand:kind', 'all')
const sourceFilter = persistedRef<SourceFilter>('demand:source', 'all')
const onlyMissing = persistedRef('demand:only-missing', false)
const sortKey = persistedRef<SortKey>('demand:sort-key', 'demand')
const sortDesc = ref(true)
const search = ref('')
const chartMetric = ref<'demand' | 'missing'>('demand')

const loading = ref(false)
const errorMessage = ref('')
const rows = ref<DemandRow[]>([])
const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

// Mídia de produto físico é URL solta no banco — se não carregar, cai no placeholder
// em vez de deixar o ícone quebrado do navegador na tabela.
const brokenImages = ref(new Set<string>())
const rowId = (item: DemandItem) => `${item.kind}:${item.key}`
const showsImage = (item: DemandItem) => Boolean(item.imageUrl) && !brokenImages.value.has(rowId(item))

const isAllTime = computed(() => !dateFrom.value && !dateTo.value)

const periodLabel = computed(() => {
    if (isAllTime.value) return 'Tudo que está salvo hoje'

    return `Salvos entre ${dayjs(dateFrom.value).format('DD/MM/YY')} e ${dayjs(dateTo.value).format('DD/MM/YY')}`
})

/** Desejo e carrinho contam junto; o filtro de fonte zera o lado que o admin não quer ver. */
const demandOf = (row: DemandRow) => {
    if (sourceFilter.value === 'favorites') return row.favorites
    if (sourceFilter.value === 'cart') return row.cart_quantity

    return row.favorites + row.cart_quantity
}

const buildItem = (row: DemandRow): DemandItem => {
    const demand = demandOf(row)
    const price = row.price ?? 0
    const lastInterestAt =
        timestampOf(row.last_carted_at) > timestampOf(row.last_favorited_at)
            ? row.last_carted_at
            : row.last_favorited_at

    return {
        ...row,
        demand,
        missing: Math.max(0, demand - row.stock_available),
        potential: demand * price,
        potentialCart: row.cart_quantity * price,
        potentialWishlist: row.favorites * price,
        lastInterestAt,
        daysSinceInterest: lastInterestAt ? dayjs().diff(dayjs(lastInterestAt), 'day') : null,
        imageUrl: row.kind === 'physical' ? row.image : buildSteamImageUrl(row.image),
    }
}

const enriched = computed<DemandItem[]>(() => rows.value.map(buildItem))

const filtered = computed(() => {
    const term = search.value.trim().toLowerCase()

    return enriched.value.filter(item => {
        if (item.demand === 0) return false
        if (kindFilter.value !== 'all' && item.kind !== kindFilter.value) return false
        if (onlyMissing.value && item.missing === 0) return false
        if (term && !item.name.toLowerCase().includes(term)) return false

        return true
    })
})

const sorted = computed(() => {
    const direction = sortDesc.value ? -1 : 1
    const sorter = SORTERS[sortKey.value] ?? SORTERS.demand

    return [...filtered.value].sort((a, b) => sorter(a, b) * direction)
})

const totals = computed(() => ({
    items: filtered.value.length,
    favorites: filtered.value.reduce((acc, item) => acc + item.favorites, 0),
    cartUnits: filtered.value.reduce((acc, item) => acc + item.cart_quantity, 0),
    cartUsers: filtered.value.reduce((acc, item) => acc + item.cart_users, 0),
    missingItems: filtered.value.filter(item => item.missing > 0).length,
    missingUnits: filtered.value.reduce((acc, item) => acc + item.missing, 0),
    potential: filtered.value.reduce((acc, item) => acc + item.potential, 0),
    potentialCart: filtered.value.reduce((acc, item) => acc + item.potentialCart, 0),
    outOfStock: filtered.value.filter(item => item.stock_available === 0).length,
}))

const topRows = computed(() =>
    [...filtered.value]
        .filter(item => item[chartMetric.value] > 0)
        .sort((a, b) => b[chartMetric.value] - a[chartMetric.value])
        .slice(0, 10),
)

// Trocar de preset dispara duas buscas; só a resposta do último pedido pode escrever na tela.
let requestToken = 0

const fetchDemand = async () => {
    const token = ++requestToken
    loading.value = true
    errorMessage.value = ''

    try {
        const { data } = await adminService.getDemandSummary({
            from: dateFrom.value || undefined,
            to: dateTo.value || undefined,
        })
        if (token !== requestToken) return

        rows.value = data?.data ?? []
    } catch (requestError: any) {
        if (token !== requestToken) return

        errorMessage.value =
            requestError?.response?.data?.message ?? 'Não foi possível carregar a demanda.'
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
    fetchDemand()
}

const clearPeriod = () => {
    activePreset.value = null
    dateFrom.value = ''
    dateTo.value = ''
    fetchDemand()
}

const onManualDateChange = () => {
    activePreset.value = null
    fetchDemand()
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

    const isMissing = chartMetric.value === 'missing'

    chartInstance = new Chart(context, {
        type: 'bar',
        data: {
            labels: topRows.value.map(item => item.name),
            datasets: [{
                label: isMissing ? 'Falta' : 'Demanda',
                data: topRows.value.map(item => item[chartMetric.value]),
                backgroundColor: isMissing ? 'rgba(244,63,94,0.45)' : 'rgba(99,102,241,0.5)',
                borderColor: isMissing ? '#f43f5e' : '#6366f1',
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
                    callbacks: { label: (item) => `${item.raw} un.` },
                },
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.06)' },
                    ticks: { color: '#94a3b8' },
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
const toCsv = (list: DemandItem[]) =>
    Papa.unparse(
        list.map(item => ({
            catalogo: KIND_LABELS[item.kind],
            item: item.name,
            heroi: item.hero ?? '',
            desejos: item.favorites,
            carrinho_unidades: item.cart_quantity,
            carrinho_usuarios: item.cart_users,
            demanda: item.demand,
            estoque: item.stock_available,
            estoque_excluido: item.stock_deleted,
            falta: item.missing,
            preco: ((item.price ?? 0) / 100).toFixed(2).replace('.', ','),
            potencial: (item.potential / 100).toFixed(2).replace('.', ','),
            potencial_carrinho: (item.potentialCart / 100).toFixed(2).replace('.', ','),
            potencial_desejos: (item.potentialWishlist / 100).toFixed(2).replace('.', ','),
            dropship: item.is_dropship ? 'sim' : 'nao',
            ultimo_interesse: item.lastInterestAt ? dayjs(item.lastInterestAt).format('DD/MM/YYYY') : '',
        })),
        { delimiter: ';' },
    )

const exportCsv = () => {
    // BOM na frente: sem ele o Excel come os acentos dos nomes.
    const blob = new Blob([`﻿${toCsv(sorted.value)}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `demanda-${dateFrom.value || 'tudo'}-${dateTo.value || 'hoje'}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
}

watch([topRows, chartMetric], renderChart, { flush: 'post' })

onMounted(fetchDemand)
onUnmounted(() => chartInstance?.destroy())
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Demanda</h1>
                <p class="page-subtitle">
                    Lista de desejos e carrinho contra o estoque — o que está em alta e o que falta comprar
                </p>
            </div>
            <button class="ghost-btn" :disabled="!sorted.length" @click="exportCsv">
                <Icon icon="mdi:file-delimited-outline" width="18" />
                Exportar CSV
            </button>
        </header>

        <div class="section filters-section">
            <div class="preset-row">
                <button
                    class="preset-btn"
                    :class="{ active: isAllTime }"
                    @click="clearPeriod"
                >
                    Tudo
                </button>
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
                    <label>Catálogo</label>
                    <select v-model="kindFilter">
                        <option v-for="option in KIND_OPTIONS" :key="option.value" :value="option.value">
                            {{ option.label }}
                        </option>
                    </select>
                </div>
                <div class="filter-field">
                    <label>Fonte</label>
                    <select v-model="sourceFilter">
                        <option v-for="option in SOURCE_OPTIONS" :key="option.value" :value="option.value">
                            {{ option.label }}
                        </option>
                    </select>
                </div>
                <div class="filter-field">
                    <label>Buscar item</label>
                    <input type="text" v-model="search" placeholder="Nome do item" />
                </div>
                <div class="filter-field">
                    <label>Reposição</label>
                    <select v-model="onlyMissing">
                        <option :value="false">Tudo com demanda</option>
                        <option :value="true">Só o que falta estocar</option>
                    </select>
                </div>
            </div>

            <p class="period-note">
                <Icon icon="mdi:information-outline" width="16" />
                {{ periodLabel }} — o período filtra quando o item entrou na lista ou no carrinho.
                Estoque e preço são sempre de agora.
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
                    <div class="stat-icon" style="background:rgba(99,102,241,0.12);color:#6366f1">
                        <Icon icon="mdi:heart-multiple-outline" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Itens desejados</span>
                        <span class="stat-value">{{ totals.items }}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:rgba(236,72,153,0.12);color:#ec4899">
                        <Icon icon="mdi:heart-outline" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Na lista de desejos</span>
                        <span class="stat-value">{{ totals.favorites }}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:rgba(14,165,233,0.12);color:#0ea5e9">
                        <Icon icon="mdi:cart-outline" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">No carrinho</span>
                        <span class="stat-value">{{ totals.cartUnits }} un.</span>
                        <span class="stat-sub">{{ totals.cartUsers }} clientes</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:rgba(244,63,94,0.12);color:#f43f5e">
                        <Icon icon="mdi:package-variant-closed-remove" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Precisa estocar</span>
                        <span class="stat-value">{{ totals.missingItems }} itens</span>
                        <span class="stat-sub">{{ totals.missingUnits }} un. faltando</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:rgba(148,163,184,0.12);color:#94a3b8">
                        <Icon icon="mdi:alert-circle-outline" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Sem estoque nenhum</span>
                        <span class="stat-value">{{ totals.outOfStock }}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:rgba(76,175,80,0.12);color:#4caf50">
                        <Icon icon="mdi:cash-multiple" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Potencial em jogo</span>
                        <span class="stat-value">{{ formatCurrency(totals.potential) }}</span>
                        <span class="stat-sub">carrinho {{ formatCurrency(totals.potentialCart) }}</span>
                    </div>
                </div>
            </div>

            <div v-if="topRows.length" class="section">
                <div class="section-head">
                    <h2 class="section-title">Top 10</h2>
                    <div class="metric-toggle">
                        <button :class="{ active: chartMetric === 'demand' }" @click="chartMetric = 'demand'">
                            Demanda
                        </button>
                        <button :class="{ active: chartMetric === 'missing' }" @click="chartMetric = 'missing'">
                            Falta estoque
                        </button>
                    </div>
                </div>
                <div class="canvas-wrap">
                    <canvas ref="chartCanvas" />
                </div>
            </div>

            <div v-if="sorted.length" class="section">
                <div class="section-head">
                    <h2 class="section-title">Itens com demanda ({{ sorted.length }})</h2>
                    <span class="section-hint">
                        Clique no cabeçalho para ordenar — inverte entre mais e menos desejados
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
                                v-for="(item, index) in sorted"
                                :key="`${item.kind}:${item.key}`"
                                :class="{ missing: item.missing > 0 }"
                            >
                                <td class="rank-col">{{ index + 1 }}</td>
                                <td>
                                    <div class="item-cell">
                                        <img
                                            v-if="showsImage(item)"
                                            :src="item.imageUrl ?? ''"
                                            :alt="item.name"
                                            @error="brokenImages.add(rowId(item))"
                                        />
                                        <span v-else class="image-fallback">
                                            <Icon icon="mdi:image-off-outline" width="16" />
                                        </span>
                                        <div class="item-meta">
                                            <span class="item-name">{{ item.name }}</span>
                                            <span class="item-sub">
                                                <span class="kind-badge" :class="item.kind">
                                                    {{ KIND_LABELS[item.kind] }}
                                                </span>
                                                <span v-if="item.hero">{{ item.hero }}</span>
                                                <span v-if="item.is_dropship" class="dropship">dropship</span>
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                <td class="fw">{{ item.favorites }}</td>
                                <td>
                                    {{ item.cart_quantity }}
                                    <span class="muted">/ {{ item.cart_users }} clientes</span>
                                </td>
                                <td class="fw blue">{{ item.demand }}</td>
                                <td :class="{ red: item.stock_available === 0 }">
                                    {{ item.stock_available }}
                                    <span
                                        v-if="item.stock_deleted"
                                        class="muted"
                                        title="Unidades em linha excluída do catálogo — não estão à venda"
                                    >
                                        +{{ item.stock_deleted }} excl.
                                    </span>
                                </td>
                                <td :class="item.missing ? 'red fw' : 'muted'">
                                    {{ item.missing || '—' }}
                                </td>
                                <td>{{ item.price ? formatCurrency(item.price) : '—' }}</td>
                                <td>
                                    <span class="green">{{ formatCurrency(item.potential) }}</span>
                                    <span v-if="item.potentialCart && item.potentialWishlist" class="muted">
                                        (carrinho {{ formatCurrency(item.potentialCart) }})
                                    </span>
                                </td>
                                <td>
                                    <template v-if="item.lastInterestAt">
                                        {{ dayjs(item.lastInterestAt).format('DD/MM/YY') }}
                                        <span class="muted">({{ item.daysSinceInterest }}d)</span>
                                    </template>
                                    <span v-else class="muted">—</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div v-else class="empty-state">
                <Icon icon="mdi:heart-off-outline" width="40" />
                <p>Nenhum item desejado com esses filtros</p>
            </div>
        </template>
    </div>
</template>

<style lang="stylus" scoped>
@import '../../styles/report-view.styl'

.period-note
    display flex
    align-items center
    gap 0.4rem
    margin 1rem 0 0
    color #64748b
    font-size 0.78rem

tr.missing td
    background rgba(244,63,94,0.04)

.item-cell
    display flex
    align-items center
    gap 0.6rem

    img
        width 40px
        height 30px
        object-fit contain
        background rgba(255,255,255,0.04)
        border-radius 4px

.image-fallback
    width 40px
    height 30px
    display flex
    align-items center
    justify-content center
    background rgba(255,255,255,0.04)
    border-radius 4px
    color #475569
    flex-shrink 0

.item-meta
    display flex
    flex-direction column
    gap 0.15rem

.item-name
    font-weight 600
    max-width 280px
    overflow hidden
    text-overflow ellipsis

.item-sub
    display flex
    align-items center
    gap 0.4rem
    font-size 0.72rem
    color #64748b

.kind-badge
    padding 0.05rem 0.4rem
    border-radius 4px
    font-size 0.68rem
    text-transform uppercase
    letter-spacing 0.02em

    &.skin
        background rgba(99,102,241,0.15)
        color #a5b4fc

    &.collector
        background rgba(255,152,0,0.15)
        color #ffb74d

    &.physical
        background rgba(76,175,80,0.15)
        color #81c784

.dropship
    color #94a3b8

.blue
    color #a5b4fc
</style>
