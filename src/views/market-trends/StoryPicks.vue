<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { Icon } from '@iconify/vue'
import InfoTip from '@/components/common/InfoTip.vue'
import StoryCard from '@/components/market-trends/StoryCard.vue'
import { adminService } from '@/services/admin/admin.service'
import type { MarketStoriesResponse } from '@/services/admin/types'
import { persistedRef } from '@/utils/persistedRef'
import {
    applyStoryFilters,
    DEFAULT_FILTERS,
    heroesOf,
    SIGNAL_OPTIONS,
    SORT_OPTIONS,
    type StorySignal,
} from './storyFilters'

type Period = 1 | 7 | 30

const PERIODS: { value: Period; label: string }[] = [
    { value: 1, label: 'Dia' },
    { value: 7, label: 'Semana' },
    { value: 30, label: 'Mês' },
]
const LIQUIDITY_OPTIONS = [3, 10, 30, 100]
const LIMIT_OPTIONS = [15, 30, 60, 0]
const PER_HERO_OPTIONS = [1, 2, 3, 0]

const TIPS = {
    page:
        'Todo item do seu estoque que dá lucro, ranqueado por quanto lucro um story pode empurrar. A conta da ' +
        'recomendação: lucro por unidade (preço da vitrine − custo de entrada) × interesse de quem já quer o item ' +
        'agora (carrinho pesa o dobro da lista de desejos, vendas recentes e buscas também contam) × bônus se a loja ' +
        'está abaixo da Steam ou se o item está valorizando. Só entra skin com custo registrado e lucro de pelo ' +
        'menos R$ 5. "Criar story" abre o Instagram com o item e a frase já preenchidos.',
    period:
        'Janela das vendas e buscas do site e da variação na Steam. Carrinho, lista de desejos e estoque são ' +
        'sempre os de agora.',
    liquidity:
        'Vendas na Steam nos últimos 7 dias pra variação de preço contar. Item que quase não vende muda de preço ' +
        'com uma venda só — abaixo disso, "valorizando" é ignorado.',
    signals: 'Marque pra mostrar só itens que têm todos os sinais marcados.',
    perHero: 'Corta itens do mesmo herói depois dos N primeiros, pra variar os stories.',
}

const period = persistedRef<Period>('stories:period', 7)
const minSold7d = persistedRef('stories:min-sold-7d', 10)
const filters = persistedRef('stories:filters', { ...DEFAULT_FILTERS })
// Filtro salvo antes de um campo novo existir: completa com o padrão.
filters.value = { ...DEFAULT_FILTERS, ...filters.value }

const loading = ref(false)
const errorMessage = ref('')
const data = ref<MarketStoriesResponse | null>(null)

const picks = computed(() => data.value?.picks ?? [])
const heroes = computed(() => heroesOf(picks.value))
const result = computed(() => applyStoryFilters(picks.value, filters.value))
const hasActiveFilters = computed(
    () => JSON.stringify(filters.value) !== JSON.stringify(DEFAULT_FILTERS),
)

// Input numérico vazio vira '' no v-model.number; volta pra 0 pra não contar como filtro.
const clearBlank = (key: 'minProfit' | 'minMarginPct') => {
    filters.value[key] = Number(filters.value[key]) || 0
}

// Herói salvo que saiu do estoque deixaria o select em branco e a lista vazia.
const dropMissingHero = () => {
    if (!data.value) return
    if (!filters.value.hero || heroes.value.includes(filters.value.hero)) return

    filters.value.hero = ''
}

const formatDay = (value: string) => dayjs(value).format('DD/MM/YYYY')

const limitLabel = (limit: number) => (limit ? `${limit} itens` : 'Todos')
const perHeroLabel = (max: number) => (max ? `Até ${max} por herói` : 'Sem limite')

const toggleSignal = (signal: StorySignal) => {
    const signals = filters.value.signals
    filters.value.signals = signals.includes(signal)
        ? signals.filter(active => active !== signal)
        : [...signals, signal]
}

const resetFilters = () => {
    filters.value = { ...DEFAULT_FILTERS }
}

// Trocar período rápido dispara várias buscas; só a última pode escrever na tela.
let requestToken = 0

const fetchPicks = async () => {
    const token = ++requestToken
    loading.value = true
    errorMessage.value = ''

    try {
        const response = await adminService.getMarketStories({ period: period.value, minSold7d: minSold7d.value })
        if (token !== requestToken) return

        data.value = response.data
    } catch (requestError: any) {
        if (token !== requestToken) return

        errorMessage.value = requestError?.code === 'ECONNABORTED'
            ? 'O servidor ainda está calculando este período. Tente de novo em 1 minuto.'
            : requestError?.response?.data?.message ?? 'Não foi possível carregar as recomendações.'
        data.value = null
    } finally {
        if (token === requestToken) loading.value = false
    }
}

watch([period, minSold7d], fetchPicks)
watch(heroes, dropMissingHero)
onMounted(fetchPicks)
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">
                    Recomendados pra story
                    <InfoTip :text="TIPS.page" align="left" />
                </h1>
                <p class="page-subtitle">
                    Estoque com lucro, do que mais rende num story pro que menos rende
                    <template v-if="data"> — {{ formatDay(data.fromDay) }} a {{ formatDay(data.day) }}</template>
                </p>
            </div>
            <button class="ghost-btn" :disabled="loading" @click="fetchPicks">
                <Icon icon="mdi:refresh" width="18" :class="{ spin: loading }" />
                Atualizar
            </button>
        </header>

        <div class="section filters-section">
            <div class="preset-row">
                <button
                    v-for="option in PERIODS"
                    :key="option.value"
                    class="preset-btn"
                    :class="{ active: period === option.value }"
                    @click="period = option.value"
                >
                    {{ option.label }}
                </button>
                <InfoTip :text="TIPS.period" align="left" />
            </div>

            <div class="filter-grid">
                <div class="filter-field">
                    <label>Buscar</label>
                    <input v-model="filters.search" type="search" placeholder="Nome, herói ou raridade" />
                </div>
                <div class="filter-field">
                    <label>Herói</label>
                    <select v-model="filters.hero">
                        <option value="">Todos</option>
                        <option v-for="hero in heroes" :key="hero" :value="hero">{{ hero }}</option>
                    </select>
                </div>
                <div class="filter-field">
                    <label>Lucro mínimo por unidade (R$)</label>
                    <input
                        v-model.number="filters.minProfit"
                        type="number"
                        min="0"
                        step="5"
                        @change="clearBlank('minProfit')"
                    />
                </div>
                <div class="filter-field">
                    <label>Margem mínima (%)</label>
                    <input
                        v-model.number="filters.minMarginPct"
                        type="number"
                        min="0"
                        max="100"
                        step="5"
                        @change="clearBlank('minMarginPct')"
                    />
                </div>
                <div class="filter-field">
                    <label>Ordenar por</label>
                    <select v-model="filters.sortBy">
                        <option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">
                            {{ option.label }}
                        </option>
                    </select>
                </div>
                <div class="filter-field">
                    <label>Variar heróis <InfoTip :text="TIPS.perHero" /></label>
                    <select v-model="filters.maxPerHero">
                        <option v-for="option in PER_HERO_OPTIONS" :key="option" :value="option">
                            {{ perHeroLabel(option) }}
                        </option>
                    </select>
                </div>
                <div class="filter-field">
                    <label>Mostrar</label>
                    <select v-model="filters.limit">
                        <option v-for="option in LIMIT_OPTIONS" :key="option" :value="option">
                            {{ limitLabel(option) }}
                        </option>
                    </select>
                </div>
                <div class="filter-field">
                    <label>Liquidez mínima na Steam <InfoTip :text="TIPS.liquidity" align="right" /></label>
                    <select v-model="minSold7d">
                        <option v-for="option in LIQUIDITY_OPTIONS" :key="option" :value="option">
                            {{ option }}+ vendas na semana
                        </option>
                    </select>
                </div>
            </div>

            <div class="signal-row">
                <span class="signal-label">Só com <InfoTip :text="TIPS.signals" align="left" /></span>
                <button
                    v-for="option in SIGNAL_OPTIONS"
                    :key="option.value"
                    class="preset-btn"
                    :class="{ active: filters.signals.includes(option.value) }"
                    @click="toggleSignal(option.value)"
                >
                    <Icon :icon="option.icon" width="15" />
                    {{ option.label }}
                </button>
            </div>

            <p v-if="data" class="result-note">
                Mostrando {{ result.visible.length }} de {{ result.matching }} que passam nos filtros
                ({{ picks.length }} itens com lucro no estoque).
                <button v-if="hasActiveFilters" class="link-btn" @click="resetFilters">Limpar filtros</button>
            </p>
        </div>

        <div v-if="errorMessage" class="error-banner">
            <Icon icon="mdi:alert-circle-outline" width="20" />
            {{ errorMessage }}
        </div>

        <div v-if="loading && !data" class="loading-state">
            <Icon icon="mdi:loading" class="spin" width="28" />
            Carregando...
        </div>

        <template v-if="data">
            <div v-if="result.visible.length" class="stories-grid" :class="{ stale: loading }">
                <StoryCard
                    v-for="(pick, index) in result.visible"
                    :key="pick.skinId"
                    :pick="pick"
                    :rank="index + 1"
                />
            </div>
            <p v-else-if="picks.length" class="section section-empty">
                Nenhum item passa nesses filtros.
                <button class="link-btn" @click="resetFilters">Limpar filtros</button>
            </p>
            <p v-else class="section section-empty">
                Nenhum item do estoque com custo registrado e lucro acima de R$ 5 agora.
            </p>
        </template>
    </div>
</template>

<style lang="stylus" scoped>
@import '../../styles/report-view.styl'

.page-title
    display flex
    align-items center
    gap 0.5rem

.preset-row
    align-items center

.filter-field label, .signal-label
    display inline-flex
    align-items center
    gap 0.35rem

.signal-row
    display flex
    flex-wrap wrap
    align-items center
    gap 0.5rem
    margin-top 1rem

    .preset-btn
        display inline-flex
        align-items center
        gap 0.3rem

.signal-label
    color #94a3b8
    font-size 0.82rem

.result-note
    display flex
    flex-wrap wrap
    align-items center
    gap 0.5rem
    margin 1rem 0 0
    color #64748b
    font-size 0.8rem

.stories-grid
    display grid
    // unquote: o Stylus tem min() próprio e reduzia isto a "100%" (uma coluna só).
    grid-template-columns repeat(auto-fit, minmax(unquote('min(220px, 100%)'), 1fr))
    gap 1rem

.stale
    opacity 0.55
    transition opacity 0.15s

.section-empty
    display flex
    flex-wrap wrap
    align-items center
    gap 0.5rem
    color #64748b
    font-size 0.85rem
</style>
