<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { adminService, type InventoryFilters } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { entryVariationPct, floorPrice, floorStatus, marginLabel, marginTone } from '@/utils/priceFloor'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'

const router = useRouter()
const items = ref<any[]>([])
const bots = ref<any[]>([])
const loading = ref(true)
const syncing = ref(false)
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const limit = ref(24)
const loadingMore = ref(false)
const loadFailed = ref(false)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
const botFilter = ref('')
const statusFilter = ref('')
const searchQuery = ref('')
const sortFilter = ref('')
const minPriceInput = ref('')
const maxPriceInput = ref('')
let searchTimeout: ReturnType<typeof setTimeout> | null = null

// Os dois toggles da linha são a mesma dança (chama a API, espelha o campo,
// avisa) — só muda o endpoint e o texto. Um mapa evita duas cópias da função.
const SKIN_FLAGS = {
    price_locked: {
        save: (uuid: string, value: boolean) => adminService.toggleSkinPriceLock(uuid, value),
        on: 'Preço bloqueado para sync automático.',
        off: 'Preço desbloqueado.',
    },
    reward_blocked: {
        save: (uuid: string, value: boolean) => adminService.toggleSkinRewardBlock(uuid, value),
        on: 'Skin vetada — não sai mais como brinde.',
        off: 'Skin liberada para os brindes de nível.',
    },
} as const

type SkinFlag = keyof typeof SKIN_FLAGS

const toggling = ref<Set<string>>(new Set())

// Vem junto com a listagem; 0.7 só cobre o primeiro paint antes da resposta.
const protectedFloorPct = ref(0.7)

// Agrupado por padrão: 4276 unidades viram ~1000 skins, e estoque repetido
// (10 Demon Eater iguais) enchia a tela sem dizer nada de novo.
const groupBySkin = ref(true)

const toggleGrouping = () => {
    groupBySkin.value = !groupBySkin.value
    fetchInventory(1)
}

// No agrupado, o card resume as unidades: mostra faixa de preço e quantas estão
// sob o piso, em vez do estado de uma unidade só.
const groupFloor = (item: any) => {
    if (item.skins?.visibility_override === true) return { key: 'forced-visible', label: 'Forçada visível' }
    if (item.skins?.visibility_override === false) return { key: 'forced-hidden', label: 'Forçada oculta' }
    if (item.below_floor > 0) {
        return {
            key: item.below_floor === item.units ? 'below' : 'partial',
            label: `${item.below_floor} de ${item.units} travadas`,
        }
    }
    if (item.no_base === item.units) return { key: 'no-base', label: 'Sem piso' }

    return { key: 'ok', label: 'Acima do piso' }
}

const priceRange = (item: any) => {
    if (!item.price_max || item.price_max === item.price) return formatCurrency(item.price)

    return `${formatCurrency(item.price)} – ${formatCurrency(item.price_max)}`
}

// A tela de detalhe é por unidade, então o card agrupado abre a unidade mais
// nova da skin (`unit_uuid`). O `id` do grupo é o da skin e não serve pra rota.
const openCard = (item: any) => {
    const target = groupBySkin.value ? item.unit_uuid : item.id
    if (!target) return

    router.push(`/inventory/${target}`)
}

const itemFloor = (item: any) =>
    floorStatus(item.price, item.entry_steam_price, item.skins?.visibility_override, protectedFloorPct.value)

const itemFloorPrice = (item: any) => floorPrice(item.entry_steam_price, protectedFloorPct.value)

const itemVariation = (item: any) => entryVariationPct(item.price, item.entry_steam_price)

const variationLabel = (item: any) => {
    const pct = itemVariation(item)
    if (pct === null) return '—'

    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}

// Os três flags são da SKIN, não da unidade. No modo desagrupado as 10 unidades
// da mesma skin estão na tela juntas: sem espelhar em todas, nove cards seguem
// mostrando o estado velho de algo que já mudou no banco.
const applyToSkinCards = (skinUuid: string, field: string, value: unknown) => {
    items.value
        .filter((card) => card.skins?.id === skinUuid)
        .forEach((card) => { card.skins[field] = value })
}

// Ciclo igual ao do detalhe: automático -> oculta -> visível -> automático.
const nextOverride = (current: boolean | null | undefined) => {
    if (current === null || current === undefined) return false
    if (current === false) return true

    return null
}

const cyclingVisibility = ref<Set<string>>(new Set())

const isCycling = (item: any) => cyclingVisibility.value.has(item.skins?.id)

const cycleVisibility = async (item: any, event: MouseEvent) => {
    event.stopPropagation()

    const skinUuid = item.skins?.id
    if (!skinUuid || isCycling(item)) return

    const next = nextOverride(item.skins?.visibility_override)
    cyclingVisibility.value = new Set([...cyclingVisibility.value, skinUuid])
    try {
        await adminService.setSkinVisibilityOverride(skinUuid, next)
        applyToSkinCards(skinUuid, 'visibility_override', next)
        toast.success(
            next === true
                ? 'Forçada visível — ignora o piso protegido.'
                : next === false
                  ? 'Forçada oculta — ignora o preço.'
                  : 'Voltou pro automático — o piso decide.',
        )
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao alterar visibilidade.')
    } finally {
        cyclingVisibility.value = new Set([...cyclingVisibility.value].filter(k => k !== skinUuid))
    }
}

const visibilityIcon = (item: any) => {
    if (isCycling(item)) return 'mdi:loading'
    if (item.skins?.visibility_override === true) return 'mdi:eye-check'
    if (item.skins?.visibility_override === false) return 'mdi:eye-off'

    return 'mdi:eye-settings-outline'
}

const visibilityTitle = (item: any) => {
    const status = itemFloor(item)

    return `${status.label} — ${status.hint}\nClique pra alternar: automático → oculta → visível.`
}

const isToggling = (item: any, flag: SkinFlag) => toggling.value.has(`${item.skins?.id}:${flag}`)

const toggleSkinFlag = async (item: any, flag: SkinFlag, event: MouseEvent) => {
    event.stopPropagation()

    const skinUuid = item.skins?.id
    if (!skinUuid || isToggling(item, flag)) return

    const key = `${skinUuid}:${flag}`
    const value = !item.skins[flag]
    const { save, on, off } = SKIN_FLAGS[flag]

    toggling.value = new Set([...toggling.value, key])
    try {
        await save(skinUuid, value)
        applyToSkinCards(skinUuid, flag, value)
        toast.success(value ? on : off)
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao alterar a skin.')
    } finally {
        toggling.value = new Set([...toggling.value].filter(k => k !== key))
    }
}

const statusOptions = [
    { label: 'Todos', value: '' },
    { label: 'Disponível', value: 'available' },
    { label: 'Reservado', value: 'reserved' },
    { label: 'Vendido', value: 'sold' },
]

const sortOptions = [
    { label: 'Mais recente', value: '' },
    { label: 'Maior preço', value: 'price_desc' },
    { label: 'Menor preço', value: 'price_asc' },
    { label: 'Pior margem (prejuízo)', value: 'margin_asc' },
    { label: 'Melhor margem (lucro)', value: 'margin_desc' },
]

const marginFilter = ref('')
const marginOptions = [
    { label: 'Margem: todas', value: '' },
    { label: 'Só prejuízo', value: 'loss' },
    { label: 'Só lucro', value: 'profit' },
    { label: 'Empatadas', value: 'breakeven' },
    { label: 'Sem custo travado', value: 'unknown' },
]

// `margin_bps` é a margem da unidade no modo desagrupado e a da PIOR unidade da
// skin no agrupado (o backend manda o _min) — é o número que decide se tem
// dinheiro saindo, e casa com a ordenação por margin_asc.
// Cobertura de custo dentro do grupo: o _min do SQL ignora nulos, então uma skin
// com 1 unidade custeada entre 10 mostraria margem como se valesse pras 10.
const costCoverage = (item: any) => ({
    withCost: item.units_with_cost ?? 0,
    total: item.units_total ?? item.units ?? 0,
})

const isPartialCost = (item: any) => {
    if (!groupBySkin.value) return false
    const { withCost, total } = costCoverage(item)

    return withCost > 0 && withCost < total
}

const marginText = (item: any) => {
    const label = marginLabel(item.margin_bps)

    return isPartialCost(item) ? `${label}*` : label
}

const marginClass = (item: any) => `margin-${marginTone(item.margin_bps)}`

const marginTitle = (item: any) => {
    if (!groupBySkin.value) {
        return item.margin_bps == null
            ? 'Unidade sem cost_price travado — não dá pra calcular margem.'
            : 'Margem sobre o custo de aquisição desta unidade.'
    }

    const { withCost, total } = costCoverage(item)
    if (withCost === 0) return `Nenhuma das ${total} unidades tem custo travado — sem margem calculável.`

    const cobertura = withCost < total
        ? `\n* Margem cobre só ${withCost} de ${total} unidades — o resto não tem custo travado.`
        : ''
    const prejuizo = item.in_loss > 0 ? `\n${item.in_loss} unidade(s) no prejuízo.` : ''

    return `Margem da pior unidade da skin sobre o custo de aquisição.${prejuizo}${cobertura}`
}

// Filtro de margem filtra unidade e o agrupamento vem depois: sem isso o card
// diria que a skin tem 1 unidade quando ela tem 10 e só 1 casou com o filtro.
const unitsLabel = (item: any) => {
    const total = item.units_total ?? item.units
    const shown = item.units

    if (shown === total) return `${shown} ${shown === 1 ? 'unidade' : 'unidades'}`

    return `${shown} de ${total} unidades`
}

const rewardFilter = ref('')
const rewardOptions = [
    { label: 'Brinde: todas', value: '' },
    { label: 'Brinde: liberadas', value: 'false' },
    { label: 'Brinde: vetadas', value: 'true' },
]

const marketplaceFilter = ref('')
const marketplaceOptions = [
    { label: 'Todos os marketplaces', value: '' },
    { label: 'Buff163', value: 'buff' },
    { label: 'SkinBaron', value: 'skinbaron' },
    { label: 'Skinport', value: 'skinport' },
    { label: 'DMarket', value: 'dmarket' },
    { label: 'Waxpeer', value: 'waxpeer' },
    { label: 'BitSkins', value: 'bitskins' },
    { label: 'CS.Money', value: 'csgotm' },
    { label: 'Tradeit', value: 'tradeit' },
    { label: 'Skinbid', value: 'skinbid' },
]

// Filtro trocado no meio de um fetch antigo: a resposta atrasada chega depois e
// sobrescreveria a lista nova. A geração descarta quem não é mais a busca atual.
let fetchGeneration = 0

const fetchInventory = async (page: number, append = false) => {
    const generation = ++fetchGeneration
    if (append) loadingMore.value = true
    else loading.value = true
    try {
        const minPrice = minPriceInput.value ? Math.round(parseFloat(minPriceInput.value) * 100) : undefined
        const maxPrice = maxPriceInput.value ? Math.round(parseFloat(maxPriceInput.value) * 100) : undefined
        const response = await adminService.getInventory({
            page,
            limit: limit.value,
            botId: botFilter.value || undefined,
            status: statusFilter.value || undefined,
            search: searchQuery.value || undefined,
            sort: sortFilter.value || undefined,
            minPrice,
            maxPrice,
            marketplace: marketplaceFilter.value || undefined,
            rewardBlocked: rewardFilter.value === '' ? undefined : rewardFilter.value === 'true',
            group: groupBySkin.value ? 'skin' : undefined,
            margin: (marginFilter.value || undefined) as InventoryFilters['margin'],
        })
        if (generation !== fetchGeneration) return
        if (response.data) {
            items.value = append ? [...items.value, ...response.data.data] : response.data.data
            totalPages.value = response.data.pages
            totalItems.value = response.data.total
            currentPage.value = response.data.page
            protectedFloorPct.value = response.data.floors?.protectedFloorPct ?? protectedFloorPct.value
        }
        loadFailed.value = false
    } catch (error) {
        console.error('Erro ao buscar inventário:', error)
        if (generation === fetchGeneration) loadFailed.value = true
    } finally {
        if (generation === fetchGeneration) {
            // Zerar `loading` ANTES de rearmar: a sentinela mora dentro do
            // `v-else` do loading e só existe no DOM depois disso. Rearmar antes
            // pega `sentinel.value` null e o observer nunca chega a observar.
            loading.value = false
            loadingMore.value = false
            // Não rearma depois de falha: a sentinela continua visível, e rearmar
            // dispararia loadMore na hora — erro, rearme, erro, martelando a API
            // em loop. O botão "Tentar de novo" devolve o controle pro usuário.
            if (!loadFailed.value) await rearmSentinel()
        }
    }
}

const retryLoad = () => {
    loadFailed.value = false
    fetchInventory(currentPage.value + (items.value.length ? 1 : 0), items.value.length > 0)
}

// O observer só dispara quando a interseção MUDA. Se a página nova não encher a
// tela, a sentinela continua visível e nada mais acontece — desobservar e
// observar de novo força uma nova avaliação e a próxima página entra.
const rearmSentinel = async () => {
    await nextTick()
    if (!observer || !sentinel.value) return

    observer.unobserve(sentinel.value)
    observer.observe(sentinel.value)
}

const hasMore = computed(() => currentPage.value < totalPages.value)

const loadMore = () => {
    if (!hasMore.value || loading.value || loadingMore.value || loadFailed.value) return

    fetchInventory(currentPage.value + 1, true)
}

const fetchBots = async () => {
    try {
        const response = await adminService.getBots()
        if (response.data) bots.value = response.data
    } catch {}
}

const triggerSync = async () => {
    syncing.value = true
    try {
        await adminService.syncInventory()
        toast.success('Sync de inventário disparado!')
        setTimeout(() => fetchInventory(1), 2000)
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao sincronizar inventário.')
    } finally {
        syncing.value = false
    }
}

const onFilterChange = () => fetchInventory(1)
const onSearchInput = () => {
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => fetchInventory(1), 400)
}

const itemStatus = (item: any) => {
    if (item.is_sold) return { label: 'Vendido', cls: 'status-canceled' }
    if (item.is_reserved) return { label: 'Reservado', cls: 'status-pending' }
    return { label: 'Disponível', cls: 'status-completed' }
}

onMounted(() => {
    fetchBots()
    fetchInventory(1)

    // Mesmo esquema da vitrine: sentinela no fim do grid, 200px de antecedência
    // pra próxima página já estar carregando quando o usuário chega lá embaixo.
    observer = new IntersectionObserver(
        ([entry]) => { if (entry?.isIntersecting) loadMore() },
        { rootMargin: '200px' },
    )
    if (sentinel.value) observer.observe(sentinel.value)
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Inventário dos Bots</h1>
                <p class="page-subtitle">
                    {{ totalItems }} {{ groupBySkin ? 'skins distintas' : 'itens' }} no inventário
                </p>
            </div>
            <div class="header-actions">
                <button
                    class="group-toggle"
                    :class="{ 'group-toggle--on': groupBySkin }"
                    :title="groupBySkin ? 'Mostrando 1 card por skin — clique pra ver unidade por unidade' : 'Mostrando cada unidade — clique pra agrupar por skin'"
                    @click="toggleGrouping"
                >
                    <Icon :icon="groupBySkin ? 'mdi:layers' : 'mdi:layers-off-outline'" />
                    {{ groupBySkin ? 'Agrupado por skin' : 'Unidade por unidade' }}
                </button>
                <select v-model="botFilter" @change="onFilterChange" class="filter-select">
                    <option value="">Todos os bots</option>
                    <option v-for="bot in bots" :key="bot.id" :value="bot.id">{{ bot.name }}</option>
                </select>
                <select v-model="statusFilter" @change="onFilterChange" class="filter-select">
                    <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
                <button class="btn-sync" :disabled="syncing" @click="triggerSync">
                    <Icon :icon="syncing ? 'mdi:loading' : 'mdi:cloud-sync-outline'" :class="{ spinning: syncing }" />
                    {{ syncing ? 'Sincronizando...' : 'Sincronizar' }}
                </button>
                <router-link to="/products/create" class="btn-add">
                    <Icon icon="mdi:plus" /> Add Produto
                </router-link>
            </div>
        </header>

        <div class="filters-row">
            <div class="search-wrap">
                <Icon icon="mdi:magnify" class="search-icon" />
                <input
                    v-model="searchQuery"
                    @input="onSearchInput"
                    type="search"
                    placeholder="Buscar por nome..."
                    class="search-input"
                />
            </div>
            <select v-model="sortFilter" @change="onFilterChange" class="filter-select">
                <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <select v-model="marketplaceFilter" @change="onFilterChange" class="filter-select">
                <option v-for="opt in marketplaceOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <select v-model="rewardFilter" @change="onFilterChange" class="filter-select">
                <option v-for="opt in rewardOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <select v-model="marginFilter" @change="onFilterChange" class="filter-select">
                <option v-for="opt in marginOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <div class="price-range">
                <input
                    v-model="minPriceInput"
                    @change="onFilterChange"
                    type="number"
                    min="0"
                    placeholder="Preço mín (R$)"
                    class="price-input"
                />
                <span class="price-sep">—</span>
                <input
                    v-model="maxPriceInput"
                    @change="onFilterChange"
                    type="number"
                    min="0"
                    placeholder="Preço máx (R$)"
                    class="price-input"
                />
            </div>
        </div>

        <div class="section">
            <div v-if="loading" class="loading-state">Carregando inventário...</div>
            <div v-else>
                <div class="cards-grid">
                    <article
                        v-for="item in items"
                        :key="groupBySkin ? item.unit_uuid : item.id"
                        class="card"
                        :class="{ 'card--below': (groupBySkin ? groupFloor(item).key : itemFloor(item).key) === 'below' }"
                        @click="openCard(item)"
                    >
                        <div class="card-img-wrap">
                            <img
                                v-if="item.skins?.icon_url_large"
                                :src="`https://steamcommunity-a.akamaihd.net/economy/image/${item.skins.icon_url_large}/184fx184f`"
                                class="card-img"
                                alt=""
                                loading="lazy"
                            />
                            <div v-else class="card-img-placeholder"><Icon icon="mdi:sword" /></div>
                            <span v-if="groupBySkin" class="card-status card-status--units">
                                {{ unitsLabel(item) }}
                            </span>
                            <span v-else class="card-status" :class="itemStatus(item).cls">{{ itemStatus(item).label }}</span>
                            <span v-if="!groupBySkin && !item.tradable" class="card-untradable" title="Não tradável">
                                <Icon icon="mdi:swap-horizontal-off" />
                            </span>
                        </div>

                        <div class="card-body">
                            <h3 class="card-name" :title="item.skins?.name">{{ item.skins?.name || '—' }}</h3>
                            <div class="card-badges">
                                <span v-if="item.skins?.hero" class="badge badge-hero">{{ item.skins.hero }}</span>
                                <template v-if="groupBySkin">
                                    <span v-for="bot in item.bots" :key="bot" class="badge badge-bot">{{ bot }}</span>
                                </template>
                                <template v-else>
                                    <span class="badge badge-bot">{{ item.steam_bots?.name || 'sem bot' }}</span>
                                    <span v-if="item.skins?.item_count" class="badge badge-qty">{{ item.skins.item_count }}x</span>
                                </template>
                            </div>

                            <div class="card-prices">
                                <span class="card-price-row">
                                    <span class="card-price">{{ groupBySkin ? priceRange(item) : formatCurrency(item.price) }}</span>
                                    <span class="margin-badge" :class="marginClass(item)" :title="marginTitle(item)">
                                        {{ marginText(item) }}
                                    </span>
                                </span>
                                <span v-if="item.entry_steam_price" class="card-entry">
                                    entrada {{ formatCurrency(item.entry_steam_price) }}
                                    <small v-if="!groupBySkin" :class="(itemVariation(item) ?? 0) < 0 ? 'is-down' : 'is-up'">
                                        {{ variationLabel(item) }}
                                    </small>
                                </span>
                            </div>

                            <div v-if="groupBySkin" class="card-floor">
                                <span class="floor-badge" :class="`floor-${groupFloor(item).key}`">
                                    {{ groupFloor(item).label }}
                                </span>
                            </div>
                            <div v-else class="card-floor" :title="itemFloor(item).hint">
                                <span class="floor-badge" :class="`floor-${itemFloor(item).key}`">
                                    {{ itemFloor(item).label }}
                                </span>
                                <small v-if="itemFloorPrice(item)" class="floor-value">
                                    piso {{ formatCurrency(itemFloorPrice(item)!) }}
                                </small>
                            </div>

                            <div class="card-actions" @click.stop>
                                <button
                                    class="lock-btn"
                                    :class="{
                                        locked: item.skins?.visibility_override === false,
                                        forced: item.skins?.visibility_override === true,
                                    }"
                                    :disabled="isCycling(item)"
                                    :title="visibilityTitle(item)"
                                    @click="cycleVisibility(item, $event)"
                                >
                                    <Icon :icon="visibilityIcon(item)" :class="{ spinning: isCycling(item) }" />
                                </button>
                                <button
                                    class="lock-btn"
                                    :class="{ locked: item.skins?.price_locked }"
                                    :disabled="isToggling(item, 'price_locked')"
                                    :title="item.skins?.price_locked ? 'Preço bloqueado — clique para desbloquear' : 'Preço livre — clique para bloquear'"
                                    @click="toggleSkinFlag(item, 'price_locked', $event)"
                                >
                                    <Icon
                                        :icon="isToggling(item, 'price_locked') ? 'mdi:loading' : item.skins?.price_locked ? 'mdi:lock' : 'mdi:lock-open-outline'"
                                        :class="{ spinning: isToggling(item, 'price_locked') }"
                                    />
                                </button>
                                <button
                                    class="lock-btn"
                                    :class="{ locked: item.skins?.reward_blocked }"
                                    :disabled="isToggling(item, 'reward_blocked')"
                                    :title="item.skins?.reward_blocked ? 'Vetada dos brindes — clique para liberar' : 'Pode sair como brinde — clique para vetar'"
                                    @click="toggleSkinFlag(item, 'reward_blocked', $event)"
                                >
                                    <Icon
                                        :icon="isToggling(item, 'reward_blocked') ? 'mdi:loading' : item.skins?.reward_blocked ? 'mdi:gift-off-outline' : 'mdi:gift-outline'"
                                        :class="{ spinning: isToggling(item, 'reward_blocked') }"
                                    />
                                </button>
                                <small class="card-date">{{ $dayjs(item.created_at).format('DD/MM/YY') }}</small>
                            </div>
                        </div>
                    </article>

                    <div v-if="items.length === 0" class="empty-state">Nenhum item encontrado.</div>
                </div>

                <div ref="sentinel" class="scroll-sentinel" />

                <div v-if="loadingMore" class="loading-more">
                    <Icon icon="mdi:loading" class="spinning" />
                    Carregando mais...
                </div>
                <div v-else-if="loadFailed" class="load-failed">
                    <Icon icon="mdi:alert-circle-outline" />
                    Falha ao carregar.
                    <button class="retry-btn" @click="retryLoad">Tentar de novo</button>
                </div>
                <p v-else-if="items.length && !hasMore" class="list-end">
                    {{ items.length }} de {{ totalItems }} — fim da lista
                </p>
            </div>
        </div>
    </div>
</template>

<style lang="stylus" scoped>
.view-wrap
    padding 2rem
    color #fff
    background #121214
    min-height 100vh

.page-header
    display flex
    align-items flex-start
    justify-content space-between
    gap 1rem
    flex-wrap wrap
    margin-bottom 2rem

.page-title
    font-size 1.8rem
    font-weight 700
    margin-bottom 0.25rem

.page-subtitle
    color #94a3b8
    font-size 0.9rem

.header-actions
    display flex
    gap 0.75rem
    align-items center
    flex-wrap wrap

.filter-select
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.5rem 0.75rem
    font-size 0.875rem
    outline none
    cursor pointer

    option
        background #1a1a1e

.btn-sync
    display inline-flex
    align-items center
    gap 0.4rem
    background rgba(99,102,241,0.12)
    color #6366f1
    border 1px solid rgba(99,102,241,0.25)
    padding 0.5rem 1rem
    border-radius 8px
    font-size 0.875rem
    font-weight 500
    cursor pointer
    transition all 0.2s

    &:hover:not(:disabled)
        background rgba(99,102,241,0.22)

    &:disabled
        opacity 0.5
        cursor not-allowed

.btn-add
    display inline-flex
    align-items center
    gap 0.4rem
    background #6366f1
    color #fff
    text-decoration none
    padding 0.5rem 1rem
    border-radius 8px
    font-size 0.875rem
    font-weight 500
    transition all 0.2s

    &:hover
        background #4f52d4

.spinning
    animation spin 1s linear infinite

@keyframes spin
    from transform rotate(0deg)
    to transform rotate(360deg)

.filters-row
    display flex
    align-items center
    gap 0.75rem
    flex-wrap wrap
    margin-bottom 1.25rem

.search-wrap
    position relative
    flex 1
    min-width 200px

.search-icon
    position absolute
    left 0.65rem
    top 50%
    transform translateY(-50%)
    color #64748b
    font-size 1rem
    pointer-events none

.search-input
    width 100%
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.5rem 0.75rem 0.5rem 2.1rem
    font-size 0.875rem
    outline none
    box-sizing border-box

    &::placeholder
        color #64748b

    &:focus
        border-color rgba(99,102,241,0.4)

.price-range
    display flex
    align-items center
    gap 0.4rem

.price-input
    width 130px
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.5rem 0.75rem
    font-size 0.875rem
    outline none

    &::placeholder
        color #64748b

    &:focus
        border-color rgba(99,102,241,0.4)

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button
        -webkit-appearance none

.price-sep
    color #64748b
    font-size 0.875rem

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.loading-state
    padding 3rem
    text-align center
    color #94a3b8

.cards-grid
    display grid
    grid-template-columns repeat(auto-fill, minmax(215px, 1fr))
    gap 1rem
    margin-bottom 1.5rem

.card
    position relative
    background #121214
    border 1px solid rgba(255,255,255,0.06)
    border-radius 10px
    overflow hidden
    cursor pointer
    transition all 0.15s
    display flex
    flex-direction column

    &:hover
        border-color rgba(99,102,241,0.4)
        transform translateY(-2px)

    // Travada pelo piso: some da vitrine, então precisa saltar aos olhos aqui.
    &--below
        border-color rgba(244,67,54,0.35)


.card-img-wrap
    position relative
    aspect-ratio 4 / 3
    background rgba(255,255,255,0.03)
    display flex
    align-items center
    justify-content center

.card-img
    width 100%
    height 100%
    object-fit contain

.card-img-placeholder
    color #3f3f46
    font-size 2rem

.group-toggle
    display inline-flex
    align-items center
    gap 0.4rem
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.1)
    border-radius 8px
    color #94a3b8
    padding 0.5rem 0.75rem
    font-size 0.82rem
    cursor pointer
    transition all 0.15s

    &:hover
        border-color rgba(99,102,241,0.4)

    &--on
        border-color rgba(99,102,241,0.5)
        background rgba(99,102,241,0.1)
        color #a5b4fc

.card-status
    position absolute
    top 6px
    left 6px
    padding 3px 8px
    border-radius 5px
    font-size 0.65rem
    font-weight 700
    text-transform uppercase
    backdrop-filter blur(4px)

    &--units
        background rgba(99,102,241,0.22)
        color #c7d2fe

.card-untradable
    position absolute
    top 6px
    right 6px
    width 24px
    height 24px
    border-radius 6px
    background rgba(0,0,0,0.55)
    color #f87171
    display flex
    align-items center
    justify-content center
    font-size 0.9rem

.card-body
    padding 0.7rem
    display flex
    flex-direction column
    gap 0.45rem
    flex 1

.card-name
    font-size 0.82rem
    font-weight 600
    line-height 1.25
    display -webkit-box
    -webkit-line-clamp 2
    -webkit-box-orient vertical
    overflow hidden
    min-height 2.05rem

.card-badges
    display flex
    flex-wrap wrap
    gap 0.25rem

.badge
    padding 2px 7px
    border-radius 5px
    font-size 0.66rem
    font-weight 600

.badge-hero
    background rgba(76,175,80,0.12)
    color #86efac

.badge-bot
    background rgba(255,255,255,0.07)
    color #cbd5e1

.badge-qty
    background rgba(99,102,241,0.15)
    color #a5b4fc

.card-prices
    display flex
    flex-direction column
    gap 0.1rem

.card-price
    font-weight 700
    font-size 0.95rem
    color #4caf50

.card-price-row
    display flex
    align-items baseline
    justify-content space-between
    gap 0.4rem

.margin-badge
    padding 2px 6px
    border-radius 5px
    font-size 0.68rem
    font-weight 700
    white-space nowrap

.margin-profit
    background rgba(76,175,80,0.14)
    color #4caf50

.margin-loss
    background rgba(244,67,54,0.16)
    color #f44336

.margin-even
    background rgba(255,152,0,0.14)
    color #ff9800

.margin-unknown
    background rgba(100,116,139,0.15)
    color #64748b

.card-entry
    font-size 0.72rem
    color #94a3b8

    small
        font-weight 700
        margin-left 0.25rem

        &.is-down
            color #f44336

        &.is-up
            color #4caf50

.card-floor
    display flex
    align-items center
    gap 0.4rem
    flex-wrap wrap

.card-actions
    display flex
    align-items center
    gap 0.35rem
    margin-top auto
    padding-top 0.5rem
    border-top 1px solid rgba(255,255,255,0.05)

.card-date
    margin-left auto
    color #475569
    font-size 0.7rem

.status-badge
    padding 3px 8px
    border-radius 5px
    font-size 0.72rem
    font-weight 600
    text-transform uppercase

.status-completed
    background rgba(76,175,80,0.14)
    color #4caf50

.status-pending
    background rgba(255,152,0,0.16)
    color #ff9800

.status-canceled
    background rgba(244,67,54,0.16)
    color #f44336

.floor-badge
    display inline-block
    padding 3px 8px
    border-radius 5px
    font-size 0.68rem
    font-weight 600
    text-transform uppercase

.floor-ok
    background rgba(76,175,80,0.1)
    color #4caf50

.floor-below
    background rgba(244,67,54,0.12)
    color #f44336

.floor-no-base
    background rgba(100,116,139,0.15)
    color #94a3b8

.floor-forced-visible
    background rgba(99,102,241,0.15)
    color #818cf8

.floor-forced-hidden
    background rgba(255,152,0,0.12)
    color #ff9800

// Agrupado: parte das unidades sob o piso — a skin ainda aparece no site.
.floor-partial
    background rgba(255,152,0,0.14)
    color #fbbf24

.floor-value
    color #64748b
    font-size 0.72rem

.lock-btn
    background transparent
    border 1px solid rgba(255,255,255,0.1)
    border-radius 6px
    color #64748b
    padding 0.3rem 0.5rem
    cursor pointer
    font-size 1rem
    display inline-flex
    align-items center
    transition all 0.2s

    &:hover:not(:disabled)
        border-color rgba(255,152,0,0.4)
        color #ff9800

    &.locked
        border-color rgba(244,67,54,0.3)
        color #f44336
        background rgba(244,67,54,0.06)

        &:hover:not(:disabled)
            border-color rgba(76,175,80,0.4)
            color #4caf50
            background rgba(76,175,80,0.06)

    &.forced
        border-color rgba(99,102,241,0.4)
        color #818cf8
        background rgba(99,102,241,0.08)

    &:disabled
        opacity 0.4
        cursor not-allowed

.empty-state
    text-align center
    padding 3rem
    color #94a3b8

.scroll-sentinel
    height 1px

.loading-more
    display flex
    align-items center
    justify-content center
    gap 0.5rem
    padding 1.5rem
    color #94a3b8
    font-size 0.85rem

.list-end
    text-align center
    padding 1.5rem
    color #475569
    font-size 0.8rem

.load-failed
    display flex
    align-items center
    justify-content center
    gap 0.5rem
    padding 1.5rem
    color #f87171
    font-size 0.85rem

.retry-btn
    background #2a2a30
    color #fff
    border 1px solid rgba(255,255,255,0.1)
    padding 0.35rem 0.8rem
    border-radius 6px
    cursor pointer
    font-size 0.8rem

    &:hover
        background #3a3a42
</style>
