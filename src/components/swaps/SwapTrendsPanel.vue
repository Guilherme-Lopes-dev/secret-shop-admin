<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import { Icon } from '@iconify/vue'
import InfoTip from '@/components/common/InfoTip.vue'
import Sparkline from '@/components/common/Sparkline.vue'
import { adminService } from '@/services/admin/admin.service'
import type { SwapTrendItem, SwapTrendSignal, SwapTrendsResponse } from '@/services/admin/types'
import { formatCurrency } from '@/utils/formatCurrency'
import { buildSteamImageUrl } from '@/utils/steamImage'
import { persistedRef } from '@/utils/persistedRef'
import { formatPct, signalStyle, SWAP_TREND_SIGNALS } from './swapTrendSignals'

const FILTERS: ('todos' | SwapTrendSignal)[] = ['todos', 'pico', 'alta', 'estavel', 'baixa', 'fundo', 'iliquido']

const data = ref<SwapTrendsResponse | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const signalFilter = persistedRef<'todos' | SwapTrendSignal>('swap-trends:signal', 'todos')
const search = ref('')
const brokenImages = ref(new Set<string>())

const share = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0)

const countOf = (filter: 'todos' | SwapTrendSignal) => {
    const items = data.value?.items ?? []
    if (filter === 'todos') return items.length

    return items.filter((item) => item.signal === filter).length
}

const matchesSearch = (item: SwapTrendItem) =>
    !search.value || item.name.toLowerCase().includes(search.value.trim().toLowerCase())

const visibleItems = computed(() =>
    (data.value?.items ?? [])
        .filter((item) => signalFilter.value === 'todos' || item.signal === signalFilter.value)
        .filter(matchesSearch),
)

// Números ao vivo entram no texto; o resto é a medição de 14/10/2026 (swap-trends.ts no backend).
const considerations = computed(() => {
    if (!data.value) return []

    const { market, exposure } = data.value

    return [
        {
            title: 'Alta não é motivo pra pagar mais',
            body: 'Skin mais de 15% acima do normal (já descontado o mercado) devolveu em média 8% na semana seguinte; só 1 em 4 continuou acima do mercado. Skin mais de 15% abaixo recuperou ~4%. Mas o trocador paga sobre o pricesafe, que no pico já fica no preço normal e no fundo já embute a recuperação: só a alta ainda pede desconto (Ajuste por tendência).',
        },
        {
            title: 'O mercado inteiro se move junto',
            body: `Entre 08 e 11/10 o Dota caiu ~22% em uma semana. Hoje o item líquido típico está ${formatPct(market.deviationPct)} contra a própria mediana de 21 dias. O preço da troca vem da SteamWebAPI no dia em que o usuário atualiza o inventário, então a queda geral já está nele; o sinal da tabela mede só o quanto a skin se descolou do mercado.`,
        },
        {
            title: 'O preço fica congelado por até 7 dias',
            body: `O inventário do trocador só atualiza a cada 7 dias, e a troca usa o preço do snapshot. Em 7 dias uma skin líquida anda 9% (mediana) e 29% em 1 a cada 10 casos. Hoje ${exposure.frozenAbove.toLocaleString('pt-BR')} itens nos snapshots (${share(exposure.frozenAbove, exposure.items)}%) estão com preço mais de 10% acima do de hoje: se virarem troca, a loja paga o preço velho.`,
        },
        {
            title: 'Liquidez pesa mais que tendência',
            body: `${share(exposure.illiquid, exposure.items)}% dos itens nos snapshots vendem menos de 10 por semana na Steam. Neles a maior ordem de compra fica em ~28% do preço (nos líquidos, ~85%): é preço de vitrine, não de venda, e o multiplicador de 0,65 não cobre essa diferença.`,
        },
        {
            title: 'As médias 30d/90d da SteamWebAPI não servem pro Dota',
            body: 'Em 73% dos itens líquidos a média de 30 dias vem igual à de 90 dias (campo preenchido com o último preço). Por isso a tendência sai do nosso histórico diário: consenso de menor preço, mediana e média 24h, o mesmo da tela de Tendências.',
        },
        {
            title: 'Um dia sozinho não diz nada',
            body: 'A variação diária típica de um item líquido é 0,5%, mas 1 dia em cada 10 passa de 13%. Por isso o sinal compara com a mediana de 3 semanas, não com ontem.',
        },
    ]
})

const load = async () => {
    loading.value = true
    errorMessage.value = ''
    try {
        const res = await adminService.getSwapTrends()
        data.value = res.data
    } catch (err: any) {
        errorMessage.value = err.response?.data?.message ?? 'Falha ao carregar a tendência.'
    } finally {
        loading.value = false
    }
}

const money = (cents: number | null) => (cents === null ? '—' : formatCurrency(cents))

const changeClass = (value: number | null) => {
    if (!value) return ''

    return value > 0 ? 'up' : 'down'
}

// Congelado acima de hoje = loja paga caro; abaixo é a favor da loja.
const frozenClass = (value: number | null) => {
    if (value === null || Math.abs(value) < 10) return ''

    return value > 0 ? 'down' : 'up'
}

const showsImage = (item: SwapTrendItem) => Boolean(item.image) && !brokenImages.value.has(item.marketHashName)

const itemTags = (item: SwapTrendItem) => [item.hero, item.rarity].filter(Boolean).join(' · ')

const relativeTip = (item: SwapTrendItem) =>
    `Skin ${formatPct(item.deviationPct)} contra a mediana de 21 dias · mercado ${formatPct(data.value?.market.deviationPct ?? null)}`

onMounted(load)
</script>

<template>
    <section class="section">
        <div class="section-head">
            <div>
                <h2 class="section-title">Tendência dos itens do trocador</h2>
                <p class="section-hint">
                    Preço de hoje contra a mediana dos últimos 21 dias, descontado o mercado.
                    <template v-if="data">Sync de {{ dayjs(data.day).format('DD/MM/YYYY') }}.</template>
                </p>
            </div>
            <button class="ghost-btn" :disabled="loading" @click="load">
                <Icon icon="mdi:refresh" :class="{ spin: loading }" /> Atualizar
            </button>
        </div>

        <div v-if="errorMessage" class="error-banner">
            <Icon icon="mdi:alert-circle-outline" /> {{ errorMessage }}
        </div>

        <div v-if="loading && !data" class="loading-state">
            <Icon icon="mdi:loading" class="spin" /> Calculando tendência…
        </div>

        <template v-if="data">
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-info">
                        <span class="stat-label">
                            Mercado Dota vs normal
                            <InfoTip text="Mediana, entre os itens com 10+ vendas na semana, do preço de hoje contra a mediana dos 21 dias anteriores." align="left" />
                        </span>
                        <span class="stat-value" :class="changeClass(data.market.deviationPct)">{{ formatPct(data.market.deviationPct) }}</span>
                        <span class="stat-sub">{{ data.market.liquidItems.toLocaleString('pt-BR') }} itens líquidos</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-info">
                        <span class="stat-label">Itens nos inventários do trocador</span>
                        <span class="stat-value">{{ data.exposure.items.toLocaleString('pt-BR') }}</span>
                        <span class="stat-sub">snapshots salvos dos usuários</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-info">
                        <span class="stat-label">Ilíquidos</span>
                        <span class="stat-value">{{ share(data.exposure.illiquid, data.exposure.items) }}%</span>
                        <span class="stat-sub">{{ data.exposure.illiquid.toLocaleString('pt-BR') }} itens com &lt;10 vendas/semana</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-info">
                        <span class="stat-label">
                            Preço congelado caro
                            <InfoTip text="Item líquido cujo preço salvo no snapshot do usuário está mais de 10% acima do preço de hoje." align="right" />
                        </span>
                        <span class="stat-value down">{{ share(data.exposure.frozenAbove, data.exposure.items) }}%</span>
                        <span class="stat-sub">{{ data.exposure.frozenAbove.toLocaleString('pt-BR') }} itens &gt;10% acima de hoje</span>
                    </div>
                </div>
            </div>

            <div class="considerations">
                <h3>Pontos de consideração</h3>
                <ol>
                    <li v-for="point in considerations" :key="point.title">
                        <strong>{{ point.title }}.</strong> {{ point.body }}
                    </li>
                </ol>
                <p class="muted">
                    Medido no banco em 14/10/2026: 37 dias de histórico, 26 mil amostras de ~3 mil itens com 10+ vendas por semana.
                    Vale refazer quando o histórico passar de 3 meses.
                </p>
            </div>

            <div class="toolbar">
                <div class="preset-row">
                    <button
                        v-for="filter in FILTERS"
                        :key="filter"
                        class="preset-btn"
                        :class="{ active: signalFilter === filter }"
                        @click="signalFilter = filter"
                    >
                        {{ filter === 'todos' ? 'Todos' : SWAP_TREND_SIGNALS[filter].label }} ({{ countOf(filter) }})
                    </button>
                </div>
                <div class="filter-field">
                    <input v-model="search" type="search" placeholder="Buscar item…" />
                </div>
            </div>

            <p class="section-hint list-hint">
                {{ data.items.length }} itens com mais peso no trocador: primeiro os que estão em troca aberta, depois os de maior valor nos inventários.
            </p>

            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Sinal</th>
                            <th>Vs normal <InfoTip text="Desvio contra a mediana de 21 dias, já descontado o mercado. É o que decide o sinal." /></th>
                            <th>7 dias</th>
                            <th>Hoje / normal</th>
                            <th>21 dias</th>
                            <th>Vendas 7d</th>
                            <th>Congelado <InfoTip text="Preço médio salvo nos snapshots dos usuários contra o preço de hoje. Positivo = a troca pagaria acima de hoje." align="right" /></th>
                            <th>No trocador</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in visibleItems" :key="item.marketHashName">
                            <td>
                                <div class="item-cell">
                                    <img
                                        v-if="showsImage(item)"
                                        :src="buildSteamImageUrl(item.image) ?? ''"
                                        alt=""
                                        loading="lazy"
                                        @error="brokenImages.add(item.marketHashName)"
                                    />
                                    <div class="item-meta">
                                        <router-link
                                            class="item-name"
                                            :to="{ name: 'market-price-history', params: { name: item.marketHashName } }"
                                            :title="item.name"
                                        >
                                            {{ item.name }}
                                        </router-link>
                                        <span v-if="itemTags(item)" class="muted">{{ itemTags(item) }}</span>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span class="signal-tag" :style="signalStyle(item.signal)" :title="SWAP_TREND_SIGNALS[item.signal].advice">
                                    {{ SWAP_TREND_SIGNALS[item.signal].label }}
                                </span>
                            </td>
                            <td :class="changeClass(item.relativePct)" :title="relativeTip(item)">{{ formatPct(item.relativePct) }}</td>
                            <td :class="changeClass(item.change7Pct)">{{ formatPct(item.change7Pct) }}</td>
                            <td>
                                {{ money(item.priceNow) }}
                                <span class="muted">/ {{ money(item.baseMedian) }}</span>
                            </td>
                            <td><Sparkline :values="item.history" /></td>
                            <td>{{ item.sold7d?.toLocaleString('pt-BR') ?? '—' }}</td>
                            <td :class="frozenClass(item.frozenVsNowPct)">{{ formatPct(item.frozenVsNowPct) }}</td>
                            <td>
                                {{ item.offered }} un · {{ item.owners }} usuário(s)
                                <span v-if="item.inOpenSwaps" class="open-pill">{{ item.inOpenSwaps }} em troca aberta</span>
                            </td>
                        </tr>
                        <tr v-if="!visibleItems.length">
                            <td colspan="9" class="muted empty-row">Nenhum item nesse filtro.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </template>
    </section>
</template>

<style lang="stylus" scoped>
@import '../../styles/report-view.styl'

.section-hint
    margin 0.2rem 0 0

.stat-label
    display inline-flex
    align-items center
    gap 0.3rem

.stat-value
    &.up
        color #22c55e

    &.down
        color #f43f5e

.considerations
    background rgba(99,102,241,0.06)
    border 1px solid rgba(99,102,241,0.18)
    border-radius 10px
    padding 1rem 1.25rem
    margin-bottom 1.25rem

    h3
        font-size 0.9rem
        font-weight 600
        margin 0 0 0.6rem

    ol
        margin 0 0 0.6rem
        padding-left 1.2rem
        display flex
        flex-direction column
        gap 0.45rem

    li
        font-size 0.84rem
        line-height 1.5
        color #cbd5e1

        strong
            color #fff

.toolbar
    display flex
    align-items flex-start
    justify-content space-between
    gap 1rem
    flex-wrap wrap

    .preset-row
        margin-bottom 0.5rem

.list-hint
    margin 0 0 0.75rem

th
    .info-tip
        vertical-align middle

td.up
    color #22c55e

td.down
    color #f43f5e

.item-cell
    display flex
    align-items center
    gap 0.6rem
    max-width 300px

    img
        width 44px
        height 30px
        object-fit contain
        flex-shrink 0

.item-meta
    display flex
    flex-direction column
    min-width 0

.item-name
    color #e2e8f0
    text-decoration none
    overflow hidden
    text-overflow ellipsis

    &:hover
        color #a5b4fc

.signal-tag
    display inline-block
    padding 2px 10px
    border 1px solid
    border-radius 999px
    font-size 0.75rem
    font-weight 600
    cursor help

.open-pill
    display inline-block
    margin-left 0.4rem
    padding 1px 8px
    border-radius 999px
    background rgba(251,191,36,0.12)
    color #fbbf24
    font-size 0.72rem

.empty-row
    text-align center
    padding 2rem
</style>
