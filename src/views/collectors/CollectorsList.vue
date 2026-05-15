<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { adminService } from '@/services/admin/admin.service'
import {
    createNormalizedCollectorItem,
    getCollectorItemKey,
    readCollectorReviewSelection,
    saveCollectorReviewSelection,
    type CollectorInventoryItem,
    type CollectorInventoryPayload,
} from '@/utils/collectorsSelection'
import {
    DOTA2_RARITIES,
    getRarityFromType,
    isMythicalBundle,
    isMythicalWearable,
    type Dota2Rarity,
} from '@/utils/collectorsAllowlist'

type CollectorsCacheStore = {
    lastSteamId: string | null
    records: Record<string, CollectorInventoryPayload>
}

const STORAGE_KEY = 'secretshop-admin:collectors-cache:v1'
const MAX_CACHED_INVENTORIES = 2

const router = useRouter()
const steamIdInput = ref('')
const itemSearch = ref('')
const loading = ref(false)
const inventory = ref<CollectorInventoryPayload | null>(null)
const loadedFromCache = ref(false)
const lastError = ref('')
const selectedItemKeys = ref<string[]>([])
const cacheStore = ref<CollectorsCacheStore>(createEmptyCacheStore())
const selectedRarity = ref<Dota2Rarity | ''>('')
const onlyMythicalBundles = ref(false)
const onlyMythicalWearables = ref(false)
const onlyNotTradable = ref(false)

const normalizedSteamId = computed(() => steamIdInput.value.trim())
const hasValidSteamId = computed(() => /^\d{17}$/.test(normalizedSteamId.value))
const hasCachedCurrentSteamId = computed(
    () => !!cacheStore.value.records[normalizedSteamId.value],
)
const openCacheButtonLabel = computed(() => (hasCachedCurrentSteamId.value ? 'Abrir cache' : 'Buscar'))

const filteredItems = computed(() => {
    let source = inventory.value?.items ?? []

    if (selectedRarity.value) {
        source = source.filter((item) => getRarityFromType(item.type) === selectedRarity.value)
    }

    if (onlyMythicalBundles.value || onlyMythicalWearables.value) {
        source = source.filter((item) =>
            (onlyMythicalBundles.value && isMythicalBundle(item)) ||
            (onlyMythicalWearables.value && isMythicalWearable(item)),
        )
    }

    if (onlyNotTradable.value) {
        source = source.filter((item) => !item.tradable)
    }

    const query = itemSearch.value.trim().toLowerCase()
    if (!query) return source

    return source.filter((item) =>
        [
            item.name,
            item.marketHashName,
            item.assetId,
            item.classId,
            item.instanceId,
            item.type ?? '',
        ].some((value) => value.toLowerCase().includes(query)),
    )
})

const selectedItems = computed(() => {
    const items = inventory.value?.items ?? []
    const selectedSet = new Set(selectedItemKeys.value)
    return items.filter((item) => selectedSet.has(getCollectorItemKey(item)))
})

const hasSelectedItems = computed(() => selectedItems.value.length > 0)

const areAllVisibleSelected = computed(() => {
    if (filteredItems.value.length === 0) return false
    return filteredItems.value.every((item) =>
        selectedItemKeys.value.includes(getCollectorItemKey(item)),
    )
})

const formattedFetchedAt = computed(() => {
    if (!inventory.value?.fetchedAt) {
        return ''
    }

    return new Date(inventory.value.fetchedAt).toLocaleString('pt-BR')
})

function createEmptyCacheStore(): CollectorsCacheStore {
    return {
        lastSteamId: null,
        records: {},
    }
}

function sortAndTrimRecords(records: Record<string, CollectorInventoryPayload>) {
    return Object.fromEntries(
        Object.entries(records)
            .sort(([, left], [, right]) => {
                const leftTime = new Date(left.fetchedAt).getTime()
                const rightTime = new Date(right.fetchedAt).getTime()
                return rightTime - leftTime
            })
            .slice(0, MAX_CACHED_INVENTORIES),
    )
}

function readCacheStore(): CollectorsCacheStore {
    if (typeof window === 'undefined') {
        return createEmptyCacheStore()
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) {
            return createEmptyCacheStore()
        }

        const parsed = JSON.parse(raw) as Partial<CollectorsCacheStore>
        const records = parsed.records && typeof parsed.records === 'object'
            ? Object.fromEntries(
                Object.entries(parsed.records).filter(([steamId, value]) => {
                    return /^\d{17}$/.test(steamId) && !!value && typeof value === 'object'
                }),
            ) as Record<string, CollectorInventoryPayload>
            : {}

        return {
            lastSteamId: typeof parsed.lastSteamId === 'string' ? parsed.lastSteamId : null,
            records,
        }
    } catch {
        return createEmptyCacheStore()
    }
}

function saveCacheStore(nextStore: CollectorsCacheStore) {
    if (typeof window === 'undefined') {
        return
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStore))
    cacheStore.value = nextStore
}

function persistInventory(payload: CollectorInventoryPayload) {
    const nextStore = {
        lastSteamId: payload.steamId,
        records: sortAndTrimRecords({
            ...cacheStore.value.records,
            [payload.steamId]: payload,
        }),
    }

    try {
        saveCacheStore(nextStore)
    } catch {
        toast.error('Nao foi possivel salvar esse inventario no cache local.')
    }
}

function applyInventory(payload: CollectorInventoryPayload, fromCache: boolean) {
    inventory.value = payload
    steamIdInput.value = payload.steamId
    loadedFromCache.value = fromCache
    lastError.value = ''

    const storedSelection = readCollectorReviewSelection()
    selectedItemKeys.value =
        storedSelection?.steamId === payload.steamId
            ? storedSelection.items.map((item) => getCollectorItemKey(item))
            : []
}

function buildInventoryPayload(data: any, steamId: string): CollectorInventoryPayload {
    const items = Array.isArray(data?.items)
        ? data.items.map((item: any) => createNormalizedCollectorItem(item))
        : []

    return {
        steamId: typeof data?.steamId === 'string' ? data.steamId : steamId,
        total: typeof data?.total === 'number' ? data.total : items.length,
        totalInventoryCount:
            typeof data?.totalInventoryCount === 'number'
                ? data.totalInventoryCount
                : items.length,
        items,
        fetchedAt: new Date().toISOString(),
    }
}

function ensureValidSteamId() {
    if (hasValidSteamId.value) {
        return true
    }

    toast.error('Informe um SteamID64 valido com 17 digitos.')
    return false
}

function openCachedInventory() {
    if (!ensureValidSteamId()) {
        return
    }

    const cached = cacheStore.value.records[normalizedSteamId.value]

    if (!cached) {
        void fetchInventory()
        return
    }

    applyInventory(cached, true)
    toast.info('Inventario carregado do cache local.')
}

async function fetchInventory() {
    if (!ensureValidSteamId()) {
        return
    }

    loading.value = true
    lastError.value = ''

    try {
        const response = await adminService.getSteamInventoryBySteamId(normalizedSteamId.value)
        const payload = buildInventoryPayload(response.data, normalizedSteamId.value)
        persistInventory(payload)
        applyInventory(payload, false)
        toast.success('Inventario Steam atualizado.')
    } catch (error: any) {
        const message = error?.response?.data?.message ?? 'Erro ao buscar inventario Steam.'
        lastError.value = Array.isArray(message) ? message.join(', ') : String(message)
        toast.error(lastError.value)
    } finally {
        loading.value = false
    }
}

function isItemSelected(item: CollectorInventoryItem) {
    return selectedItemKeys.value.includes(getCollectorItemKey(item))
}

function toggleItemSelection(item: CollectorInventoryItem) {
    const itemKey = getCollectorItemKey(item)

    if (selectedItemKeys.value.includes(itemKey)) {
        selectedItemKeys.value = selectedItemKeys.value.filter((key) => key !== itemKey)
        return
    }

    selectedItemKeys.value = [...selectedItemKeys.value, itemKey]
}

function toggleVisibleSelection() {
    const visibleKeys = filteredItems.value.map((item) => getCollectorItemKey(item))

    if (areAllVisibleSelected.value) {
        selectedItemKeys.value = selectedItemKeys.value.filter((key) => !visibleKeys.includes(key))
        return
    }

    selectedItemKeys.value = [...new Set([...selectedItemKeys.value, ...visibleKeys])]
}

function proceedWithSelected() {
    saveCollectorReviewSelection({
        steamId: inventory.value?.steamId ?? normalizedSteamId.value,
        items: selectedItems.value,
        priceInputs: {},
        heroSelects: {},
    })

    router.push('/collectors/review')
}

onMounted(() => {
    cacheStore.value = readCacheStore()

    if (cacheStore.value.lastSteamId) {
        steamIdInput.value = cacheStore.value.lastSteamId
        const cached = cacheStore.value.records[cacheStore.value.lastSteamId]

        if (cached) {
            applyInventory(cached, true)
        }
    }
})
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">
                    <Icon icon="mdi:trophy-outline" class="title-icon" />
                    Collectors
                </h1>
                <p class="page-subtitle">
                    Consulte um inventario Steam
                </p>
            </div>
        </header>

        <section class="section section--hero">
            <div class="hero-controls">
                <div class="search-wrap" :class="{ invalid: steamIdInput && !hasValidSteamId }">
                    <Icon icon="mdi:steam" class="search-icon" />
                    <input
                        v-model="steamIdInput"
                        type="text"
                        inputmode="numeric"
                        placeholder="Digite o SteamID64 com 17 digitos"
                        class="search-input"
                        @keyup.enter="openCachedInventory"
                    />
                </div>

                <button class="btn-primary" :disabled="loading" @click="openCachedInventory">
                    <Icon icon="mdi:database-eye-outline" />
                    {{ openCacheButtonLabel }}
                </button>

                <button class="btn-secondary" :disabled="loading || !hasValidSteamId" @click="fetchInventory">
                    <Icon :icon="loading ? 'mdi:loading' : 'mdi:refresh'" :class="{ spinning: loading }" />
                    {{ loading ? 'Buscando...' : 'Buscar agora' }}
                </button>
            </div>

            <div v-if="inventory" class="hero-meta">
                <span class="meta-badge" :class="loadedFromCache ? 'meta-badge--cache' : 'meta-badge--live'">
                    {{ loadedFromCache ? 'Cache local' : 'Steam atualizada' }}
                </span>
                <span class="meta-copy">
                    SteamID64:
                    <code class="mono">{{ inventory.steamId }}</code>
                </span>
                <span class="meta-copy">Itens listados: <strong>{{ inventory.total }}</strong></span>
                <span class="meta-copy">Total Steam: <strong>{{ inventory.totalInventoryCount }}</strong></span>
                <span class="meta-copy">Atualizado em {{ formattedFetchedAt }}</span>
            </div>

            <p v-else class="helper-copy">
                Digite um SteamID64 para listar todas as skins da conta. Se ja existir cache local,
                a tela abre sem rebuscar a Steam.
            </p>

            <p v-if="lastError" class="error-copy">{{ lastError }}</p>
        </section>

        <div v-if="inventory" class="filters-row">
            <div class="search-wrap search-wrap--filter">
                <Icon icon="mdi:magnify" class="search-icon" />
                <input
                    v-model="itemSearch"
                    type="text"
                    placeholder="Filtrar itens carregados por nome, asset ou market hash"
                    class="search-input"
                />
            </div>

            <select v-model="selectedRarity" class="filter-select">
                <option value="">Todas raridades</option>
                <option v-for="rarity in DOTA2_RARITIES" :key="rarity" :value="rarity">
                    {{ rarity }}
                </option>
            </select>

            <label class="filter-toggle" :class="{ 'filter-toggle--active': onlyMythicalBundles }">
                <input v-model="onlyMythicalBundles" type="checkbox" class="filter-toggle-checkbox" />
                <Icon icon="mdi:package-variant-closed" />
                Mythical Bundle
            </label>

            <label class="filter-toggle" :class="{ 'filter-toggle--active': onlyMythicalWearables }">
                <input v-model="onlyMythicalWearables" type="checkbox" class="filter-toggle-checkbox" />
                <Icon icon="mdi:tshirt-crew-outline" />
                Mythical Wearable
            </label>

            <label class="filter-toggle" :class="{ 'filter-toggle--active': onlyNotTradable }">
                <input v-model="onlyNotTradable" type="checkbox" class="filter-toggle-checkbox" />
                <Icon icon="mdi:lock-outline" />
                Not Tradable
            </label>

        </div>

        <section class="section">
            <div v-if="loading" class="loading-state">
                <Icon icon="mdi:loading" class="spinning" />
                Buscando inventario Steam...
            </div>

            <div v-else-if="inventory">
                <div class="list-meta">
                    <span>
                        {{ filteredItems.length }} item{{ filteredItems.length !== 1 ? 's' : '' }}
                    </span>
                    <div class="list-actions">
                        <span>{{ selectedItems.length }} selecionado{{ selectedItems.length !== 1 ? 's' : '' }}</span>
                        <button
                            class="btn-secondary btn-secondary--compact"
                            :disabled="!hasSelectedItems"
                            @click="proceedWithSelected"
                        >
                            <Icon icon="mdi:arrow-right-bold-circle-outline" />
                            Prosseguir
                        </button>
                    </div>
                </div>

                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th class="checkbox-col">
                                    <input
                                        type="checkbox"
                                        :checked="areAllVisibleSelected"
                                        :disabled="filteredItems.length === 0"
                                        @change="toggleVisibleSelection"
                                    />
                                </th>
                                <th>Item</th>
                                <th>Market Hash</th>
                                <th>Asset ID</th>
                                <th>Class / Instance</th>
                                <th>Tipo</th>
                                <th>Flags</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="item in filteredItems"
                                :key="getCollectorItemKey(item)"
                                :class="{ 'row-selected': isItemSelected(item) }"
                            >
                                <td class="checkbox-col">
                                    <input
                                        type="checkbox"
                                        :checked="isItemSelected(item)"
                                        @change="toggleItemSelection(item)"
                                    />
                                </td>
                                <td>
                                    <div class="item-cell">
                                        <img
                                            v-if="item.iconUrlLarge || item.iconUrl"
                                            :src="item.iconUrlLarge || item.iconUrl || ''"
                                            class="item-thumb"
                                            alt=""
                                        />
                                        <div v-else class="item-thumb-placeholder">
                                            <Icon icon="mdi:trophy-variant-outline" />
                                        </div>

                                        <div>
                                            <span class="item-name">{{ item.name }}</span>
                                            <small class="item-subtitle">Quantidade: {{ item.amount }}</small>
                                        </div>
                                    </div>
                                </td>
                                <td class="market-cell">{{ item.marketHashName || '-' }}</td>
                                <td><code class="mono">{{ item.assetId }}</code></td>
                                <td>
                                    <div class="code-stack">
                                        <code class="mono">{{ item.classId }}</code>
                                        <code class="mono">{{ item.instanceId }}</code>
                                    </div>
                                </td>
                                <td>{{ item.type || '-' }}</td>
                                <td>
                                    <div class="flags">
                                        <span class="flag" :class="item.tradable ? 'flag--ok' : 'flag--no'">
                                            {{ item.tradable ? 'Tradable' : 'Non-Tradable' }}
                                        </span>
                                        <span class="flag" :class="item.marketable ? 'flag--ok' : 'flag--muted'">Marketable</span>
                                        <span class="flag" :class="item.commodity ? 'flag--warn' : 'flag--muted'">Commodity</span>
                                    </div>
                                </td>
                            </tr>

                            <tr v-if="filteredItems.length === 0">
                                <td colspan="7" class="empty-state">
                                    Nenhum item encontrado para esse filtro.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>


            </div>

            <div v-else class="empty-panel">
                <Icon icon="mdi:trophy-outline" class="empty-icon" />
                <p>Nenhum inventario carregado ainda.</p>
            </div>
        </section>
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
    margin-bottom 1.5rem

.page-title
    font-size 1.8rem
    font-weight 700
    margin-bottom 0.25rem
    display flex
    align-items center
    gap 0.5rem

.title-icon
    color #f59e0b
    font-size 1.6rem

.page-subtitle
    color #94a3b8
    font-size 0.9rem

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

    &--hero
        margin-bottom 1.25rem

.hero-controls
    display flex
    flex-wrap wrap
    gap 0.75rem
    align-items center

.hero-meta
    display flex
    flex-wrap wrap
    gap 0.75rem
    margin-top 1rem

.meta-badge
    display inline-flex
    align-items center
    padding 0.3rem 0.7rem
    border-radius 999px
    font-size 0.74rem
    font-weight 700
    text-transform uppercase
    letter-spacing 0.04em

    &--cache
        color #f59e0b
        background rgba(245,158,11,0.14)
        border 1px solid rgba(245,158,11,0.24)

    &--live
        color #22c55e
        background rgba(34,197,94,0.14)
        border 1px solid rgba(34,197,94,0.24)

.meta-copy
    color #cbd5e1
    font-size 0.84rem

.helper-copy
    margin 1rem 0 0
    color #94a3b8
    font-size 0.92rem

.error-copy
    margin 0.85rem 0 0
    color #fca5a5
    font-size 0.88rem

.search-wrap
    position relative
    flex 1
    min-width 300px

    &.invalid .search-input
        border-color rgba(248,113,113,0.5)

    &--filter
        min-width 240px

.search-icon
    position absolute
    left 0.75rem
    top 50%
    transform translateY(-50%)
    color #64748b
    font-size 1rem
    pointer-events none

.search-input
    width 100%
    background #151519
    border 1px solid rgba(255,255,255,0.08)
    border-radius 10px
    color #fff
    padding 0.75rem 0.9rem 0.75rem 2.45rem
    font-size 0.92rem
    outline none
    box-sizing border-box

    &::placeholder
        color #64748b

    &:focus
        border-color rgba(99,102,241,0.45)

.btn-primary,
.btn-secondary
    display inline-flex
    align-items center
    justify-content center
    gap 0.45rem
    min-width 150px
    border-radius 10px
    padding 0.72rem 1rem
    font-size 0.88rem
    font-weight 600
    cursor pointer
    transition all 0.2s
    border 1px solid transparent

    &:disabled
        opacity 0.6
        cursor not-allowed

.btn-primary
    background #6366f1
    color #fff

    &:hover:not(:disabled)
        background #5457de

.btn-secondary
    background rgba(99,102,241,0.12)
    color #c7d2fe
    border-color rgba(99,102,241,0.2)

    &:hover:not(:disabled)
        background rgba(99,102,241,0.2)

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

.filter-select
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.7rem 0.8rem
    font-size 0.88rem
    outline none
    cursor pointer

    option
        background #1a1a1e

.filter-toggle
    display inline-flex
    align-items center
    gap 0.4rem
    padding 0.65rem 0.9rem
    border-radius 8px
    border 1px solid rgba(255,255,255,0.08)
    background #1a1a1e
    color #94a3b8
    font-size 0.88rem
    cursor pointer
    user-select none
    transition all 0.18s

    &--active
        color #d97706
        background rgba(217,119,6,0.12)
        border-color rgba(217,119,6,0.3)

    &:hover
        border-color rgba(255,255,255,0.18)

.filter-toggle-checkbox
    display none

.loading-state
    padding 3rem
    color #94a3b8
    display flex
    align-items center
    justify-content center
    gap 0.5rem

.list-meta
    display flex
    justify-content space-between
    align-items center
    gap 1rem
    color #94a3b8
    font-size 0.85rem
    margin-bottom 1rem

.list-actions
    display flex
    align-items center
    gap 0.75rem

.btn-secondary--compact
    min-width auto
    padding 0.55rem 0.85rem

.checkbox-col
    width 42px
    text-align center

    input
        width 16px
        height 16px
        accent-color #6366f1
        cursor pointer

.table-wrapper
    overflow-x auto
    margin-bottom 1.25rem

table
    width 100%
    border-collapse collapse

    th
        text-align left
        color #94a3b8
        font-size 0.78rem
        font-weight 600
        padding 0.75rem
        border-bottom 1px solid rgba(255,255,255,0.05)
        white-space nowrap
        text-transform uppercase

    td
        padding 0.9rem 0.75rem
        font-size 0.875rem
        border-bottom 1px solid rgba(255,255,255,0.04)
        vertical-align middle

tr:hover td
    background rgba(255,255,255,0.02)

.row-selected td
    background rgba(99,102,241,0.08)

.item-cell
    display flex
    align-items center
    gap 0.7rem
    min-width 260px

.item-thumb
    width 44px
    height 44px
    object-fit contain
    border-radius 8px
    background rgba(255,255,255,0.04)
    flex-shrink 0

.item-thumb-placeholder
    width 44px
    height 44px
    border-radius 8px
    background rgba(255,255,255,0.05)
    display flex
    align-items center
    justify-content center
    color #64748b
    flex-shrink 0

.item-name
    display block
    font-weight 600
    color #f8fafc

.item-subtitle
    display block
    margin-top 0.2rem
    color #94a3b8
    font-size 0.75rem

.market-cell
    min-width 220px
    color #cbd5e1

.mono
    font-family monospace
    font-size 0.8rem
    color #cbd5e1

.code-stack
    display flex
    flex-direction column
    gap 0.3rem

.flags
    display flex
    flex-wrap wrap
    gap 0.45rem
    min-width 220px

.flag
    display inline-flex
    align-items center
    justify-content center
    padding 0.28rem 0.55rem
    border-radius 999px
    font-size 0.72rem
    font-weight 700
    text-transform uppercase
    letter-spacing 0.03em

    &--ok
        color #4ade80
        background rgba(74,222,128,0.1)
        border 1px solid rgba(74,222,128,0.2)

    &--warn
        color #f59e0b
        background rgba(245,158,11,0.12)
        border 1px solid rgba(245,158,11,0.2)

    &--no
        color #f87171
        background rgba(248,113,113,0.1)
        border 1px solid rgba(248,113,113,0.2)

    &--muted
        color #94a3b8
        background rgba(148,163,184,0.08)
        border 1px solid rgba(148,163,184,0.14)

.empty-state
    text-align center
    padding 3rem
    color #94a3b8

.empty-panel
    padding 3.5rem 1rem
    text-align center
    color #64748b

.empty-icon
    font-size 2.5rem
    margin-bottom 0.75rem
    color #f59e0b


@media (max-width: 900px)
    .hero-controls
        flex-direction column
        align-items stretch

    .search-wrap
        min-width 100%

    .btn-primary,
    .btn-secondary
        width 100%

    .hero-meta
        flex-direction column
        gap 0.45rem

    .filters-row
        flex-direction column
        align-items stretch
</style>
