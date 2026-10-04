<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { Icon } from '@iconify/vue'
import InfoTip from '@/components/common/InfoTip.vue'
import Sparkline from '@/components/common/Sparkline.vue'
import { adminService } from '@/services/admin/admin.service'
import type {
    MarketTrendItem,
    MarketTrendSearch,
    MarketTrendStoryPick,
    MarketTrendsResponse,
} from '@/services/admin/types'
import { formatCurrency } from '@/utils/formatCurrency'
import { buildSteamImageUrl } from '@/utils/steamImage'
import { persistedRef } from '@/utils/persistedRef'

type Period = 1 | 7 | 30
type ItemListKey = 'gainers' | 'losers' | 'volumeSpikes' | 'mostTraded' | 'topSold' | 'mostWanted'
type SearchListKey = 'searches' | 'missedSearches'
type Section<K> = { key: K; title: string; icon: string; color: string; hint: string; tip: string }

const COLLAPSED_ROWS = 10
const SPIKE_HIGHLIGHT = 1.5
const DOTA_APP_ID = 570

const PERIODS: { value: Period; label: string; hint: string }[] = [
    { value: 1, label: 'Dia', hint: 'contra o dia anterior com dados' },
    { value: 7, label: 'Semana', hint: 'contra a mediana dos 7 dias anteriores' },
    { value: 30, label: 'Mês', hint: 'contra a mediana dos 30 dias anteriores' },
]

const LIQUIDITY_OPTIONS = [3, 10, 30, 100]

const TIPS = {
    page:
        'Cruza o mercado da Steam com o comportamento da sua loja pra mostrar o que está esquentando. ' +
        'Serve pra decidir o que comprar pro estoque, o que reajustar de preço e o que está faltando no catálogo.',
    period:
        'Dia: compara com o último dia anterior que tem dado. Semana/Mês: compara com a mediana dos 7/30 dias ' +
        'anteriores — mostra tendência sem ser enganado por um dia fora da curva. No lado do site, define a ' +
        'janela de vendas, desejos e buscas.',
    day:
        'Qual dia analisar. Vazio = o mais recente (o sync de preços grava um retrato por dia). ' +
        'Use pra rever como o mercado estava numa data específica.',
    liquidity:
        'Quantas vendas na Steam o item precisa ter nos últimos 7 dias pra entrar nas listas. ' +
        'Item que quase não vende muda de preço com uma venda só — subir esse número deixa só movimento confiável.',
    scope:
        'Todo o market: o que se mexe no Dota inteiro (bom pra achar oportunidade de compra). ' +
        'Só estoque: as listas da Steam mostram só o que você tem pra vender — o que está valorizando ou ' +
        'desvalorizando nas suas mãos. O termômetro do mercado continua sendo do market inteiro.',
    market:
        'Variação mediana do preço dos itens líquidos do Dota no período. É o termômetro geral: se o mercado ' +
        'todo caiu 3%, um item seu caindo 3% não é problema do item, é o mercado.',
    rising: 'Quantos itens líquidos subiram no período. Comparado com "Caindo", mostra se o mercado está aquecendo ou esfriando.',
    falling: 'Quantos itens líquidos caíram no período.',
    missed:
        'Termos que clientes buscaram na loja e não encontraram nada. É demanda declarada que você ' +
        'não está atendendo — candidato direto a compra pro estoque.',
    price:
        'Preço de referência: mediana entre última venda, mediana e média 24h da Steam. Uma listagem absurda ' +
        'sozinha não move o número. "antes" = referência do período de comparação; embaixo, a diferença em R$.',
    change:
        'Quanto o preço de referência mudou contra o período de comparação. O mini-gráfico mostra o preço dia a dia ' +
        '(pelo menos as últimas 2 semanas) — dá pra ver se é tendência ou um salto isolado.',
    volume:
        'Vendas na Steam nas últimas 24h / nos últimos 7 dias. O selo laranja (ex.: 3×) aparece quando as 24h ' +
        'venderam bem acima da média diária da semana.',
    supply:
        'Oferta e demanda na Steam agora. "à venda" = anúncios abertos (muita oferta segura o preço). ' +
        '"compra" = maior pedido de compra (buy order): o quanto alguém já aceita pagar na hora.',
    sitePrice:
        'Preço que a sua vitrine mostra agora e a diferença pro preço de referência da Steam. ' +
        'Negativo = loja mais barata que a Steam. "fora da loja" = você não está vendendo esse item.',
    siteSide: 'Vendas pagas (com faturamento), entradas na lista de desejos e em carrinhos no período.',
    stock: 'Unidades disponíveis pra venda agora (skins + collectors). "sem" = esgotado.',
    zeroRate: 'Fatia das buscas por esse termo que não encontrou nenhum item. 100% = ninguém achou nada.',
    stories:
        'Os 5 itens do seu estoque que mais dão lucro se um story empurrar a venda. A conta: lucro por unidade ' +
        '(preço da vitrine − custo de entrada) × interesse de quem já quer o item agora (carrinho pesa o dobro da ' +
        'lista de desejos, vendas recentes e buscas também contam) × bônus se a loja está abaixo da Steam ou se o ' +
        'item está valorizando. No máximo 2 do mesmo herói pra variar os stories. Só entra skin com custo ' +
        'registrado e lucro de pelo menos R$ 5. "Criar story" abre o Instagram com o item e a frase já preenchidos.',
}

const STEAM_SECTIONS: Section<ItemListKey>[] = [
    {
        key: 'gainers',
        title: 'Subiram',
        icon: 'mdi:trending-up',
        color: '#22c55e',
        hint: 'Maior alta do preço de referência',
        tip:
            'Maiores altas no período, só entre itens com liquidez. Use pra comprar antes que suba mais ou ' +
            'reajustar o preço do que você já tem. Os selos mostram estoque e interesse no site.',
    },
    {
        key: 'losers',
        title: 'Caíram',
        icon: 'mdi:trending-down',
        color: '#f43f5e',
        hint: 'Maior queda — atenção ao estoque desses',
        tip:
            'Maiores quedas no período. Se tem o selo "em estoque", esse item está perdendo valor nas suas mãos — ' +
            'considere girar mais rápido ou promover. Também evita comprar algo em queda.',
    },
    {
        key: 'volumeSpikes',
        title: 'Pico de volume',
        icon: 'mdi:fire',
        color: '#f97316',
        hint: 'Vendas 24h acima da média diária da semana',
        tip:
            'Itens vendendo nas últimas 24h bem acima do normal da semana (3× = o triplo). Costuma ser o sinal ' +
            'mais cedo de hype — patch, evento, streamer — antes do preço reagir.',
    },
    {
        key: 'mostTraded',
        title: 'Mais negociados',
        icon: 'mdi:swap-vertical-bold',
        color: '#0ea5e9',
        hint: 'Giro em R$ nas últimas 24h (vendas × preço)',
        tip:
            'Onde mais gira dinheiro na Steam nas últimas 24h (vendas × preço). Itens com demanda constante ' +
            'e alta liquidez — os mais fáceis de revender.',
    },
]

const SITE_SECTIONS: Section<ItemListKey>[] = [
    {
        key: 'topSold',
        title: 'Mais vendidos',
        icon: 'mdi:cart-check',
        color: '#22c55e',
        hint: 'Pagos no período — loja + collectors',
        tip:
            'O que mais saiu na sua loja no período (pedidos pagos, loja + collectors). A coluna Steam mostra se ' +
            'está subindo lá fora: vendendo bem e subindo na Steam = reponha antes que encareça.',
    },
    {
        key: 'mostWanted',
        title: 'Mais desejados',
        icon: 'mdi:heart-multiple-outline',
        color: '#ec4899',
        hint: 'Entraram na lista de desejos ou no carrinho no período',
        tip:
            'Itens que entraram em listas de desejos ou carrinhos no período. É intenção de compra: ' +
            'se o estoque está "sem", é venda esperando acontecer.',
    },
]

const SEARCH_SECTIONS: Section<SearchListKey>[] = [
    {
        key: 'searches',
        title: 'Mais buscados',
        icon: 'mdi:magnify',
        color: '#a5b4fc',
        hint: 'Termos digitados na busca da vitrine',
        tip:
            'O que os clientes digitaram na busca da loja, contando cada visitante uma vez por dia. Mostra o que ' +
            'as pessoas procuram — inclusive o que você ainda não vende. Prefixos de digitação ("pud" → "pudge") são juntados.',
    },
    {
        key: 'missedSearches',
        title: 'Buscaram e não acharam',
        icon: 'mdi:magnify-close',
        color: '#f43f5e',
        hint: 'Busca que voltou vazia — demanda sem estoque',
        tip: 'Buscas que voltaram sem nenhum resultado. É a lista mais direta de "o que comprar": alguém quis e você não tinha.',
    },
]

const router = useRouter()

const period = persistedRef<Period>('trends:period', 1)
const minSold7d = persistedRef('trends:min-sold-7d', 10)
const onlyStock = persistedRef('trends:only-stock', false)
const day = ref('')
const today = dayjs().format('YYYY-MM-DD')

const loading = ref(false)
const errorMessage = ref('')
const data = ref<MarketTrendsResponse | null>(null)
const expanded = ref(new Set<string>())
const brokenImages = ref(new Set<string>())

const itemLists = computed(() => ({ ...data.value?.steam, ...data.value?.site }))
const periodHint = computed(() => PERIODS.find(option => option.value === period.value)?.hint ?? '')
/** missing = nenhum volume gravado ainda; borrowed = dia antigo, liquidez veio de outro dia. */
const volumeNotice = computed(() => {
    if (!data.value?.hasSnapshot) return null
    if (!data.value.liquidityDay) return 'missing'
    if (data.value.liquidityDay !== data.value.day) return 'borrowed'

    return null
})

const itemsOf = (key: ItemListKey): MarketTrendItem[] => itemLists.value[key] ?? []
const searchesOf = (key: SearchListKey): MarketTrendSearch[] => data.value?.site[key] ?? []

const visibleRows = <T,>(key: string, rows: T[]) =>
    expanded.value.has(key) ? rows : rows.slice(0, COLLAPSED_ROWS)

const toggleExpanded = (key: string) => {
    if (expanded.value.has(key)) {
        expanded.value.delete(key)
        return
    }

    expanded.value.add(key)
}

const formatChange = (value: number | null) => {
    if (value == null) return '—'
    if (value > 0) return `+${value.toLocaleString('pt-BR')}%`

    return `${value.toLocaleString('pt-BR')}%`
}

const changeClass = (value: number | null) => {
    if (!value) return 'flat'

    return value > 0 ? 'up' : 'down'
}

const formatDay = (value: string) => dayjs(value).format('DD/MM/YYYY')

const formatCount = (value: number | null) => (value == null ? '—' : value.toLocaleString('pt-BR'))

const formatSignedCurrency = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatCurrency(Math.abs(value))}`

const priceDelta = (item: MarketTrendItem) => {
    if (item.priceNow == null || item.priceBefore == null) return null

    return item.priceNow - item.priceBefore
}

/** Loja contra a referência da Steam, em %. Negativo = loja mais barata. */
const siteVsSteam = (item: MarketTrendItem) => {
    if (!item.sitePrice || !item.priceNow) return null

    return Math.round(((item.sitePrice - item.priceNow) / item.priceNow) * 1000) / 10
}

// "Standard" é a qualidade padrão de quase todo item — só polui a linha.
const itemTags = (item: MarketTrendItem) =>
    [item.hero, item.rarity, item.quality === 'Standard' ? null : item.quality].filter(Boolean).join(' · ')

const steamUrl = (item: MarketTrendItem) =>
    `https://steamcommunity.com/market/listings/${DOTA_APP_ID}/${encodeURIComponent(item.marketHashName)}`

const zeroRate = (search: MarketTrendSearch) => (search.hits ? Math.round((search.zeroHits / search.hits) * 100) : 0)

const showsImage = (item: MarketTrendItem) => Boolean(item.image) && !brokenImages.value.has(item.marketHashName)

const openHistory = (item: MarketTrendItem) =>
    router.push({ name: 'market-price-history', params: { name: item.marketHashName } })

// O composer do Instagram lê esses parâmetros e já abre em modo story com o item e a frase.
const createStory = (pick: MarketTrendStoryPick) =>
    router.push({
        name: 'instagram',
        query: { skin: pick.skinId, name: pick.name, hero: pick.hero ?? undefined, message: pick.hook },
    })

// Trocar filtro rápido dispara várias buscas; só a última pode escrever na tela.
let requestToken = 0

const fetchTrends = async () => {
    const token = ++requestToken
    loading.value = true
    errorMessage.value = ''

    try {
        const response = await adminService.getMarketTrends({
            day: day.value || undefined,
            period: period.value,
            minSold7d: minSold7d.value,
            onlyStock: onlyStock.value,
        })
        if (token !== requestToken) return

        data.value = response.data
    } catch (requestError: any) {
        if (token !== requestToken) return

        errorMessage.value = requestError?.response?.data?.message ?? 'Não foi possível carregar as tendências.'
        data.value = null
    } finally {
        if (token === requestToken) loading.value = false
    }
}

watch([period, minSold7d, onlyStock, day], fetchTrends)
onMounted(fetchTrends)
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">
                    Tendências
                    <InfoTip :text="TIPS.page" align="left" />
                </h1>
                <p class="page-subtitle">
                    O que subiu, caiu e esquentou na Steam e no site
                    <template v-if="data"> — {{ formatDay(data.day) }}</template>
                </p>
            </div>
            <button class="ghost-btn" :disabled="loading" @click="fetchTrends">
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
                    :title="option.hint"
                    @click="period = option.value"
                >
                    {{ option.label }}
                </button>
                <InfoTip :text="TIPS.period" align="left" />
            </div>

            <div class="filter-grid">
                <div class="filter-field">
                    <label>Dia de referência <InfoTip :text="TIPS.day" align="left" /></label>
                    <input v-model="day" type="date" :max="today" />
                    <button v-if="day" class="link-btn" @click="day = ''">usar o mais recente</button>
                </div>
                <div class="filter-field">
                    <label>Liquidez mínima na Steam <InfoTip :text="TIPS.liquidity" /></label>
                    <select v-model="minSold7d">
                        <option v-for="option in LIQUIDITY_OPTIONS" :key="option" :value="option">
                            {{ option }}+ vendas na semana
                        </option>
                    </select>
                </div>
                <div class="filter-field">
                    <label>Itens da Steam <InfoTip :text="TIPS.scope" align="right" /></label>
                    <select v-model="onlyStock">
                        <option :value="false">Todo o market</option>
                        <option :value="true">Só o que tenho em estoque</option>
                    </select>
                </div>
            </div>

            <p v-if="data" class="period-note">
                <Icon icon="mdi:information-outline" width="16" />
                Steam: {{ formatDay(data.day) }} {{ periodHint }}. Site: {{ formatDay(data.fromDay) }} a
                {{ formatDay(data.day) }}. Preço de referência = mediana entre última venda, mediana e média 24h
                — uma listagem absurda sozinha não move o número.
            </p>
        </div>

        <div v-if="errorMessage" class="error-banner">
            <Icon icon="mdi:alert-circle-outline" width="20" />
            {{ errorMessage }}
        </div>

        <div v-if="data && !data.hasSnapshot" class="warning-banner">
            <Icon icon="mdi:calendar-remove-outline" width="20" />
            Sem dados da Steam para {{ formatDay(data.day) }} — o sync de preços não rodou nesse dia (ou é uma data
            futura). Escolha outro dia ou use o mais recente.
        </div>

        <div v-if="volumeNotice === 'missing'" class="warning-banner">
            <Icon icon="mdi:alert-outline" width="20" />
            Aguardando o primeiro sync de preços com volume da Steam. Até lá as listas da Steam ficam vazias de
            propósito: sem volume, item que vendeu uma vez parece ter subido 30.000%. Rode o sync de preços ou
            aguarde o próximo automático.
        </div>

        <div v-if="volumeNotice === 'borrowed' && data" class="info-banner">
            <Icon icon="mdi:information-outline" width="20" />
            Esse dia é anterior ao registro de volume. O filtro de liquidez usa o volume de
            {{ formatDay(data.liquidityDay ?? '') }}, e "Pico de volume" e "Mais negociados" ficam vazios
            (precisam do volume do próprio dia).
        </div>

        <div v-if="loading && !data" class="loading-state">
            <Icon icon="mdi:loading" class="spin" width="28" />
            Carregando...
        </div>

        <template v-if="data">
            <div class="stats-grid" :class="{ stale: loading }">
                <div class="stat-card">
                    <div class="stat-icon" style="background:rgba(99,102,241,0.12);color:#6366f1">
                        <Icon icon="mdi:chart-line-variant" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Mercado Dota (mediana) <InfoTip :text="TIPS.market" align="left" /></span>
                        <span class="stat-value change" :class="changeClass(data.market.medianChangePct)">
                            {{ formatChange(data.market.medianChangePct) }}
                        </span>
                        <span class="stat-sub">{{ data.market.liquidItems }} itens líquidos</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:rgba(34,197,94,0.12);color:#22c55e">
                        <Icon icon="mdi:trending-up" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Subindo <InfoTip :text="TIPS.rising" /></span>
                        <span class="stat-value">{{ data.market.rising }}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:rgba(244,63,94,0.12);color:#f43f5e">
                        <Icon icon="mdi:trending-down" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Caindo <InfoTip :text="TIPS.falling" /></span>
                        <span class="stat-value">{{ data.market.falling }}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background:rgba(244,63,94,0.12);color:#f43f5e">
                        <Icon icon="mdi:magnify-close" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Buscas sem resultado <InfoTip :text="TIPS.missed" align="right" /></span>
                        <span class="stat-value">{{ data.site.missedTotal }}</span>
                        <span class="stat-sub">termos no período</span>
                    </div>
                </div>
            </div>

            <h2 class="group-title">
                <Icon icon="mdi:instagram" width="20" /> Recomendados pra story
                <InfoTip :text="TIPS.stories" align="left" />
            </h2>
            <div v-if="data.stories.length" class="stories-grid" :class="{ stale: loading }">
                <article v-for="(pick, index) in data.stories" :key="pick.skinId" class="story-card">
                    <header class="story-head">
                        <span class="story-rank">{{ index + 1 }}</span>
                        <img
                            v-if="pick.image && !brokenImages.has(pick.marketHashName)"
                            :src="buildSteamImageUrl(pick.image) ?? ''"
                            :alt="pick.name"
                            class="story-image"
                            @error="brokenImages.add(pick.marketHashName)"
                        />
                        <span v-else class="story-image image-fallback">
                            <Icon icon="mdi:image-off-outline" width="20" />
                        </span>
                    </header>

                    <h3 class="story-name" :title="pick.name">{{ pick.name }}</h3>
                    <p class="story-tags">{{ [pick.hero, pick.rarity].filter(Boolean).join(' · ') }}</p>

                    <div class="story-profit" title="Preço da vitrine − custo de entrada, por unidade">
                        <span class="story-profit-value">{{ formatCurrency(pick.profit) }}</span>
                        <span class="muted">de lucro/un. · {{ pick.marginPct }}%</span>
                    </div>

                    <dl class="story-prices">
                        <div><dt>Loja</dt><dd>{{ formatCurrency(pick.sitePrice) }}</dd></div>
                        <div><dt>Custo</dt><dd>{{ formatCurrency(pick.avgCost) }}</dd></div>
                        <div><dt>Steam</dt><dd>{{ pick.steamPrice != null ? formatCurrency(pick.steamPrice) : '—' }}</dd></div>
                        <div><dt>Estoque</dt><dd>{{ pick.stock }}</dd></div>
                    </dl>

                    <p class="story-hook" title="Frase sugerida pro story — vai pronta pro composer do Instagram">
                        <Icon icon="mdi:format-quote-open" width="16" />
                        {{ pick.hook }}
                    </p>

                    <ul class="story-reasons">
                        <li v-for="reason in pick.reasons" :key="reason">{{ reason }}</li>
                    </ul>

                    <button class="story-btn" @click="createStory(pick)">
                        <Icon icon="mdi:plus-box-outline" width="16" />
                        Criar story
                    </button>
                </article>
            </div>
            <p v-else class="section section-empty">
                Nenhum item do estoque com custo registrado e lucro acima de R$ 5 agora.
            </p>

            <h2 class="group-title"><Icon icon="mdi:steam" width="20" /> Steam</h2>
            <div class="sections-stack" :class="{ stale: loading }">
                <div v-for="section in STEAM_SECTIONS" :key="section.key" class="section">
                    <div class="section-head">
                        <h3 class="section-title">
                            <Icon :icon="section.icon" width="18" :style="{ color: section.color }" />
                            {{ section.title }}
                            <InfoTip :text="section.tip" align="left" />
                        </h3>
                        <span class="section-hint">{{ section.hint }}</span>
                    </div>
                    <template v-if="itemsOf(section.key).length">
                        <div class="table-wrapper">
                            <table class="trend-table">
                                <thead>
                                    <tr>
                                        <th class="rank-col">#</th>
                                        <th title="Clique na linha pra ver o histórico de preço">Item</th>
                                        <th :title="TIPS.price">Preço Steam</th>
                                        <th :title="TIPS.change">Variação</th>
                                        <th :title="TIPS.volume">Vendas 24h / 7d</th>
                                        <th :title="TIPS.supply">Mercado</th>
                                        <th :title="TIPS.sitePrice">Na loja</th>
                                        <th class="link-col" />
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr
                                        v-for="(item, index) in visibleRows(section.key, itemsOf(section.key))"
                                        :key="item.marketHashName"
                                        class="clickable"
                                        title="Ver histórico de preço"
                                        @click="openHistory(item)"
                                    >
                                        <td class="rank-col">{{ index + 1 }}</td>
                                        <td>
                                            <div class="item-cell">
                                                <img
                                                    v-if="showsImage(item)"
                                                    :src="buildSteamImageUrl(item.image) ?? ''"
                                                    :alt="item.name"
                                                    @error="brokenImages.add(item.marketHashName)"
                                                />
                                                <span v-else class="image-fallback">
                                                    <Icon icon="mdi:image-off-outline" width="16" />
                                                </span>
                                                <div class="item-meta">
                                                    <span class="item-name" :title="item.name">{{ item.name }}</span>
                                                    <span v-if="itemTags(item)" class="item-tags">{{ itemTags(item) }}</span>
                                                    <span class="item-sub">
                                                        <span v-if="item.stock" class="chip stock" title="Unidades disponíveis pra venda agora">
                                                            {{ item.stock }} em estoque
                                                        </span>
                                                        <span v-if="item.siteSold" class="chip sold" title="Vendidas na sua loja no período">
                                                            {{ item.siteSold }} vend. no site
                                                        </span>
                                                        <span v-if="item.favorites" class="chip fav" title="Entraram na lista de desejos no período">
                                                            <Icon icon="mdi:heart" width="11" /> {{ item.favorites }}
                                                        </span>
                                                        <span v-if="item.inCarts" class="chip cart" title="Entraram em carrinhos no período">
                                                            <Icon icon="mdi:cart" width="11" /> {{ item.inCarts }}
                                                        </span>
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="nowrap">
                                            <span class="fw">{{ item.priceNow != null ? formatCurrency(item.priceNow) : '—' }}</span>
                                            <span v-if="item.priceBefore != null" class="muted block">
                                                antes {{ formatCurrency(item.priceBefore) }}
                                            </span>
                                            <span
                                                v-if="priceDelta(item)"
                                                class="block change"
                                                :class="changeClass(priceDelta(item))"
                                            >
                                                {{ formatSignedCurrency(priceDelta(item) ?? 0) }}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="change" :class="changeClass(item.changePct)">
                                                {{ formatChange(item.changePct) }}
                                            </span>
                                            <Sparkline :values="item.history" class="spark" />
                                        </td>
                                        <td class="nowrap">
                                            <span class="fw">{{ formatCount(item.sold24h) }}</span>
                                            <span class="muted"> / {{ formatCount(item.sold7d) }}</span>
                                            <span
                                                v-if="(item.volumeSpike ?? 0) >= SPIKE_HIGHLIGHT"
                                                class="chip spike"
                                                title="Vendas 24h ÷ média diária da semana — 3× = o triplo do normal"
                                            >
                                                {{ item.volumeSpike }}×
                                            </span>
                                        </td>
                                        <td class="nowrap">
                                            <span class="block">{{ formatCount(item.offerVolume) }} <span class="muted">à venda</span></span>
                                            <span class="block muted">
                                                compra {{ item.buyOrderPrice != null ? formatCurrency(item.buyOrderPrice) : '—' }}
                                            </span>
                                        </td>
                                        <td class="nowrap">
                                            <template v-if="item.sitePrice != null">
                                                <span class="fw">{{ formatCurrency(item.sitePrice) }}</span>
                                                <span v-if="siteVsSteam(item) != null" class="block muted">
                                                    {{ formatChange(siteVsSteam(item)) }} vs Steam
                                                </span>
                                            </template>
                                            <span v-else class="muted">fora da loja</span>
                                        </td>
                                        <td class="link-col">
                                            <a
                                                :href="steamUrl(item)"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="steam-link"
                                                title="Abrir no Steam Market"
                                                :aria-label="`Abrir ${item.name} no Steam Market`"
                                                @click.stop
                                            >
                                                <Icon icon="mdi:open-in-new" width="16" />
                                            </a>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <button
                            v-if="itemsOf(section.key).length > COLLAPSED_ROWS"
                            class="link-btn expand-btn"
                            @click="toggleExpanded(section.key)"
                        >
                            {{ expanded.has(section.key) ? 'Mostrar menos' : `Ver todos (${itemsOf(section.key).length})` }}
                        </button>
                    </template>
                    <p v-else class="section-empty">Nada nesse filtro.</p>
                </div>
            </div>

            <h2 class="group-title"><Icon icon="mdi:storefront-outline" width="20" /> Site</h2>
            <div class="sections-stack" :class="{ stale: loading }">
                <div v-for="section in SITE_SECTIONS" :key="section.key" class="section">
                    <div class="section-head">
                        <h3 class="section-title">
                            <Icon :icon="section.icon" width="18" :style="{ color: section.color }" />
                            {{ section.title }}
                            <InfoTip :text="section.tip" align="left" />
                        </h3>
                        <span class="section-hint">{{ section.hint }}</span>
                    </div>
                    <template v-if="itemsOf(section.key).length">
                        <div class="table-wrapper">
                            <table class="trend-table">
                                <thead>
                                    <tr>
                                        <th class="rank-col">#</th>
                                        <th title="Clique na linha pra ver o histórico de preço">Item</th>
                                        <th :title="TIPS.siteSide">No site</th>
                                        <th :title="TIPS.sitePrice">Na loja</th>
                                        <th :title="TIPS.price">Preço Steam</th>
                                        <th :title="TIPS.change">Variação Steam</th>
                                        <th :title="TIPS.volume">Vendas Steam 24h / 7d</th>
                                        <th :title="TIPS.stock">Estoque</th>
                                        <th class="link-col" />
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr
                                        v-for="(item, index) in visibleRows(section.key, itemsOf(section.key))"
                                        :key="item.marketHashName"
                                        class="clickable"
                                        title="Ver histórico de preço"
                                        @click="openHistory(item)"
                                    >
                                        <td class="rank-col">{{ index + 1 }}</td>
                                        <td>
                                            <div class="item-cell">
                                                <img
                                                    v-if="showsImage(item)"
                                                    :src="buildSteamImageUrl(item.image) ?? ''"
                                                    :alt="item.name"
                                                    @error="brokenImages.add(item.marketHashName)"
                                                />
                                                <span v-else class="image-fallback">
                                                    <Icon icon="mdi:image-off-outline" width="16" />
                                                </span>
                                                <div class="item-meta">
                                                    <span class="item-name" :title="item.name">{{ item.name }}</span>
                                                    <span v-if="itemTags(item)" class="item-tags">{{ itemTags(item) }}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="nowrap">
                                            <span v-if="item.siteSold" class="block">
                                                <span class="fw">{{ item.siteSold }} vend.</span>
                                                <span class="muted"> · {{ formatCurrency(item.siteRevenue) }}</span>
                                            </span>
                                            <span v-if="item.favorites" class="chip fav" title="Entraram na lista de desejos no período">
                                                <Icon icon="mdi:heart" width="11" /> {{ item.favorites }}
                                            </span>
                                            <span v-if="item.inCarts" class="chip cart" title="Entraram em carrinhos no período">
                                                <Icon icon="mdi:cart" width="11" /> {{ item.inCarts }}
                                            </span>
                                        </td>
                                        <td class="nowrap">
                                            <template v-if="item.sitePrice != null">
                                                <span class="fw">{{ formatCurrency(item.sitePrice) }}</span>
                                                <span v-if="siteVsSteam(item) != null" class="block muted">
                                                    {{ formatChange(siteVsSteam(item)) }} vs Steam
                                                </span>
                                            </template>
                                            <span v-else class="muted">fora da loja</span>
                                        </td>
                                        <td class="nowrap">
                                            {{ item.priceNow != null ? formatCurrency(item.priceNow) : '—' }}
                                            <span
                                                v-if="priceDelta(item)"
                                                class="block change"
                                                :class="changeClass(priceDelta(item))"
                                            >
                                                {{ formatSignedCurrency(priceDelta(item) ?? 0) }}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="change" :class="changeClass(item.changePct)">
                                                {{ formatChange(item.changePct) }}
                                            </span>
                                            <Sparkline :values="item.history" class="spark" />
                                        </td>
                                        <td class="nowrap">
                                            <span class="fw">{{ formatCount(item.sold24h) }}</span>
                                            <span class="muted"> / {{ formatCount(item.sold7d) }}</span>
                                        </td>
                                        <td :class="item.stock ? 'fw' : 'red'">{{ item.stock || 'sem' }}</td>
                                        <td class="link-col">
                                            <a
                                                :href="steamUrl(item)"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="steam-link"
                                                title="Abrir no Steam Market"
                                                :aria-label="`Abrir ${item.name} no Steam Market`"
                                                @click.stop
                                            >
                                                <Icon icon="mdi:open-in-new" width="16" />
                                            </a>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <button
                            v-if="itemsOf(section.key).length > COLLAPSED_ROWS"
                            class="link-btn expand-btn"
                            @click="toggleExpanded(section.key)"
                        >
                            {{ expanded.has(section.key) ? 'Mostrar menos' : `Ver todos (${itemsOf(section.key).length})` }}
                        </button>
                    </template>
                    <p v-else class="section-empty">Nada no período.</p>
                </div>
            </div>

            <div class="sections-grid" :class="{ stale: loading }">
                <div v-for="section in SEARCH_SECTIONS" :key="section.key" class="section">
                    <div class="section-head">
                        <h3 class="section-title">
                            <Icon :icon="section.icon" width="18" :style="{ color: section.color }" />
                            {{ section.title }}
                            <InfoTip :text="section.tip" align="left" />
                        </h3>
                        <span class="section-hint">{{ section.hint }}</span>
                    </div>
                    <template v-if="searchesOf(section.key).length">
                        <div class="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th class="rank-col">#</th>
                                        <th>Termo</th>
                                        <th title="Visitantes distintos que buscaram o termo (cada um conta 1x por dia)">Buscas</th>
                                        <th title="Quantos desses não encontraram nenhum item">Sem resultado</th>
                                        <th :title="TIPS.zeroRate">% vazias</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr
                                        v-for="(search, index) in visibleRows(section.key, searchesOf(section.key))"
                                        :key="search.term"
                                    >
                                        <td class="rank-col">{{ index + 1 }}</td>
                                        <td class="fw">{{ search.term }}</td>
                                        <td>{{ search.hits }}</td>
                                        <td :class="search.zeroHits ? 'red' : 'muted'">{{ search.zeroHits || '—' }}</td>
                                        <td>
                                            <div class="rate-cell">
                                                <span class="rate-bar">
                                                    <span class="rate-fill" :style="{ width: `${zeroRate(search)}%` }" />
                                                </span>
                                                <span :class="zeroRate(search) ? 'red' : 'muted'">{{ zeroRate(search) }}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <button
                            v-if="searchesOf(section.key).length > COLLAPSED_ROWS"
                            class="link-btn expand-btn"
                            @click="toggleExpanded(section.key)"
                        >
                            {{ expanded.has(section.key) ? 'Mostrar menos' : `Ver todos (${searchesOf(section.key).length})` }}
                        </button>
                    </template>
                    <p v-else class="section-empty">Nenhuma busca registrada no período.</p>
                </div>
            </div>
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

.filter-field label
    display inline-flex
    align-items center
    gap 0.35rem

.stat-label
    display inline-flex
    align-items center
    gap 0.3rem

.period-note
    display flex
    align-items center
    gap 0.4rem
    margin 1rem 0 0
    color #64748b
    font-size 0.78rem

.warning-banner, .info-banner
    display flex
    align-items center
    gap 0.6rem
    background rgba(249,115,22,0.1)
    border 1px solid rgba(249,115,22,0.3)
    color #fdba74
    padding 0.8rem 1rem
    border-radius 8px
    margin-bottom 1.25rem
    font-size 0.85rem

.info-banner
    background rgba(99,102,241,0.1)
    border-color rgba(99,102,241,0.3)
    color #a5b4fc

.group-title
    display flex
    align-items center
    gap 0.5rem
    font-size 1.1rem
    font-weight 700
    margin 1.5rem 0 0.75rem
    color #e2e8f0

.sections-grid
    display grid
    // unquote: o Stylus tem min() próprio e reduzia isto a "100%" (uma coluna só).
    grid-template-columns repeat(auto-fit, minmax(unquote('min(560px, 100%)'), 1fr))
    gap 1.25rem
    margin-top 1.25rem

    .section
        margin-bottom 0

.stories-grid
    display grid
    grid-template-columns repeat(auto-fit, minmax(unquote('min(220px, 100%)'), 1fr))
    gap 1rem

.story-card
    display flex
    flex-direction column
    gap 0.6rem
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 12px
    padding 1rem

.story-head
    position relative
    display flex
    justify-content center
    background rgba(255,255,255,0.03)
    border-radius 8px
    padding 0.75rem

.story-rank
    position absolute
    top 0.5rem
    left 0.5rem
    width 24px
    height 24px
    display flex
    align-items center
    justify-content center
    border-radius 999px
    background rgba(225,48,108,0.2)
    color #f9a8d4
    font-size 0.78rem
    font-weight 700

.story-image
    width 120px
    height 80px
    object-fit contain

    &.image-fallback
        width 120px
        height 80px

.story-name
    font-size 0.92rem
    font-weight 700
    line-height 1.3
    overflow hidden
    text-overflow ellipsis
    white-space nowrap

.story-tags
    margin-top -0.4rem
    font-size 0.72rem
    color #94a3b8

.story-profit
    display flex
    align-items baseline
    gap 0.4rem
    font-size 0.78rem

.story-profit-value
    font-size 1.25rem
    font-weight 800
    color #22c55e

.story-prices
    display grid
    grid-template-columns repeat(2, 1fr)
    gap 0.3rem 0.75rem
    margin 0
    font-size 0.76rem

    div
        display flex
        justify-content space-between

    dt
        color #64748b

    dd
        margin 0
        font-weight 600

.story-hook
    display flex
    gap 0.35rem
    padding 0.55rem 0.65rem
    border-left 3px solid #e1306c
    background rgba(225,48,108,0.08)
    border-radius 0 6px 6px 0
    font-size 0.82rem
    font-weight 600
    color #fce7f3

.story-reasons
    margin 0
    padding-left 1rem
    display flex
    flex-direction column
    gap 0.3rem
    font-size 0.74rem
    color #cbd5e1
    line-height 1.4
    flex 1

.story-btn
    display flex
    align-items center
    justify-content center
    gap 0.4rem
    margin-top 0.25rem
    padding 0.5rem
    border-radius 8px
    border 1px solid rgba(225,48,108,0.4)
    background rgba(225,48,108,0.15)
    color #f9a8d4
    font-size 0.82rem
    font-weight 600
    cursor pointer

    &:hover, &:focus-visible
        background rgba(225,48,108,0.25)

// Listas de item ocupam a largura toda: são 8–9 colunas, lado a lado não cabe.
.sections-stack
    display grid
    gap 1.25rem

    .section
        margin-bottom 0

// Abaixo disso a tabela rola na horizontal (.table-wrapper) em vez de espremer.
.trend-table
    min-width 980px

    td
        vertical-align middle

.link-col
    width 32px
    text-align center

.steam-link
    display inline-flex
    padding 0.3rem
    border-radius 6px
    color #64748b

    &:hover, &:focus-visible
        color #a5b4fc
        background rgba(255,255,255,0.06)

.spark
    margin-top 0.3rem

.item-tags
    font-size 0.72rem
    color #94a3b8

.rate-cell
    display flex
    align-items center
    gap 0.5rem

.rate-bar
    width 60px
    height 6px
    border-radius 999px
    background rgba(255,255,255,0.06)
    overflow hidden

.rate-fill
    display block
    height 100%
    background #f43f5e

.section-title
    display flex
    align-items center
    gap 0.4rem

.stale
    opacity 0.55
    transition opacity 0.15s

.clickable
    cursor pointer

    &:hover td
        background rgba(255,255,255,0.03)

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
        flex-shrink 0

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
    gap 0.2rem
    min-width 0

.item-name
    font-weight 600
    max-width 260px
    overflow hidden
    text-overflow ellipsis
    white-space nowrap

.item-sub
    display flex
    flex-wrap wrap
    gap 0.3rem

.chip
    display inline-flex
    align-items center
    gap 0.2rem
    padding 0.05rem 0.4rem
    border-radius 4px
    font-size 0.68rem
    margin-right 0.25rem

    &.stock
        background rgba(99,102,241,0.15)
        color #a5b4fc

    &.sold
        background rgba(34,197,94,0.15)
        color #86efac

    &.fav
        background rgba(236,72,153,0.15)
        color #f9a8d4

    &.cart
        background rgba(14,165,233,0.15)
        color #7dd3fc

    &.spike
        background rgba(249,115,22,0.18)
        color #fdba74
        margin-left 0.35rem

.change
    font-weight 700
    font-variant-numeric tabular-nums

    &.up
        color #22c55e

    &.down
        color #f43f5e

    &.flat
        color #94a3b8

.nowrap
    white-space nowrap

.block
    display block
    font-size 0.72rem

.link-btn
    align-self flex-start
    background none
    border none
    color #a5b4fc
    font-size 0.78rem
    cursor pointer
    padding 0

    &:hover
        text-decoration underline

.expand-btn
    margin-top 0.75rem

.section-empty
    color #64748b
    font-size 0.85rem
    padding 1rem 0
</style>
