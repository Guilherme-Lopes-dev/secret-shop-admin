<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { buildSteamImageUrl } from '@/utils/steamImage'
import type { ItemSet } from '@/services/admin/admin.service'

const sets = ref<ItemSet[]>([])
const loading = ref(false)
const saving = ref(false)

const search = ref('')
const cacheFilter = ref('')
const heroFilter = ref('')
const rarityFilter = ref('')
const typeFilter = ref('')
const onlyInStock = ref(false)
const onlyWithoutPrice = ref(false)

/** Ordem de raridade da Valve — alfabético aqui não diz nada. */
const RARITY_ORDER = ['Regular', 'Rare', 'Very Rare', 'Ultra Rare']

/** defindex -> preço em centavos digitado. Só entra aqui o que foi editado. */
const edits = ref<Record<string, string>>({})
const selected = ref<string[]>([])
const bulkPriceInput = ref('')

const caches = computed(() => {
    const map = new Map<string, { id: string; name: string; year: number }>()
    for (const s of sets.value) {
        if (!map.has(s.cache_id)) {
            map.set(s.cache_id, { id: s.cache_id, name: s.cache_name, year: s.year })
        }
    }
    return [...map.values()].sort((a, b) => b.year - a.year || a.name.localeCompare(b.name))
})

const heroOptions = computed(() =>
    [...new Set(sets.value.map((s) => s.hero_name).filter((n): n is string => !!n))].sort((a, b) =>
        a.localeCompare(b),
    ),
)

const rarityOptions = computed(() => {
    const present = new Set(sets.value.map((s) => s.rarity))
    return RARITY_ORDER.filter((r) => present.has(r))
})

const typeOptions = computed(() => [...new Set(sets.value.map((s) => s.treasure_type))].sort())

const hasActiveFilters = computed(
    () =>
        !!search.value ||
        !!cacheFilter.value ||
        !!heroFilter.value ||
        !!rarityFilter.value ||
        !!typeFilter.value ||
        onlyInStock.value ||
        onlyWithoutPrice.value,
)

const filtered = computed(() => {
    let list = sets.value

    if (cacheFilter.value) list = list.filter((s) => s.cache_id === cacheFilter.value)
    if (heroFilter.value) list = list.filter((s) => s.hero_name === heroFilter.value)
    if (rarityFilter.value) list = list.filter((s) => s.rarity === rarityFilter.value)
    if (typeFilter.value) list = list.filter((s) => s.treasure_type === typeFilter.value)
    if (onlyInStock.value) list = list.filter((s) => s.available > 0)
    if (onlyWithoutPrice.value) list = list.filter((s) => !s.price)

    const q = search.value.trim().toLowerCase()
    if (!q) return list

    return list.filter((s) =>
        [s.set_name, s.market_hash_name, s.hero_name ?? '', s.cache_name].some((v) =>
            v.toLowerCase().includes(q),
        ),
    )
})

const stats = computed(() => ({
    comEstoque: sets.value.filter((s) => s.available > 0).length,
    unidades: sets.value.reduce((sum, s) => sum + s.available, 0),
    semPreco: sets.value.filter((s) => !s.price).length,
}))

const dirtyCount = computed(() => Object.keys(edits.value).length)

const allFilteredSelected = computed(
    () =>
        filtered.value.length > 0 &&
        filtered.value.every((s) => selected.value.includes(s.defindex)),
)

const parseCents = (value: string): number | null => {
    if (!value.trim()) return null
    const n = parseInt(value, 10)
    return isNaN(n) || n < 0 ? null : n
}

const bulkPreview = computed(() => parseCents(bulkPriceInput.value))

// `!= null` e não truthy: preço 0 legado renderizaria como campo vazio.
const currentPrice = (set: ItemSet): string => (set.price != null ? String(set.price) : '')

const priceInput = (set: ItemSet): string => edits.value[set.defindex] ?? currentPrice(set)

const isDirty = (set: ItemSet) => set.defindex in edits.value

const rarityClass = (rarity: string) => `rarity--${rarity.replace(/\s+/g, '-').toLowerCase()}`

function updatePrice(set: ItemSet, value: string) {
    const current = currentPrice(set)
    const next = { ...edits.value }

    // Voltou pro valor original -> deixa de ser alteração pendente.
    if (value === current) delete next[set.defindex]
    else next[set.defindex] = value

    edits.value = next
}

function toggleSelectAll() {
    if (allFilteredSelected.value) {
        const visible = new Set(filtered.value.map((s) => s.defindex))
        selected.value = selected.value.filter((d) => !visible.has(d))
        return
    }
    selected.value = [...new Set([...selected.value, ...filtered.value.map((s) => s.defindex)])]
}

function applyBulkPrice() {
    const cents = bulkPreview.value
    if (cents === null) {
        toast.error('Informe um preço válido em centavos.')
        return
    }
    if (selected.value.length === 0) {
        toast.error('Selecione pelo menos um set.')
        return
    }

    const selectedSet = new Set(selected.value)
    for (const set of sets.value) {
        if (selectedSet.has(set.defindex)) updatePrice(set, String(cents))
    }

    toast.success(`Preço aplicado a ${selected.value.length} set(s). Falta salvar.`)
}

async function loadSets() {
    loading.value = true
    try {
        const { data } = await adminService.getItemSets()
        sets.value = data
    } catch {
        toast.error('Erro ao carregar o catálogo de sets.')
    } finally {
        loading.value = false
    }
}

async function saveEdits() {
    const parsed = Object.entries(edits.value).map(([defindex, raw]) => ({
        defindex,
        price: parseCents(raw),
    }))

    const items = parsed.filter(
        (i): i is { defindex: string; price: number } => i.price !== null && i.price > 0,
    )
    const ignorados = parsed.length - items.length

    // Campo vazio não apaga preço — despublicar é remover a unidade em
    // Catálogo Collectors. Avisa em vez de descartar calado.
    if (ignorados > 0) {
        toast.warning(
            `${ignorados} campo(s) vazio(s) ou zerado(s) ignorado(s) — para tirar da vitrine, remova a unidade em Catálogo Collectors.`,
        )
    }

    if (items.length === 0) {
        saving.value = false
        return
    }

    saving.value = true
    try {
        const { data } = await adminService.updateItemSetPrices(items)
        toast.success(
            `${data.sets} set(s) precificado(s) — ${data.collectors} iten(s) do estoque atualizado(s).`,
        )
        // Só limpa o que entrou; campo ignorado continua marcado como pendente.
        const salvos = new Set(items.map((i) => i.defindex))
        edits.value = Object.fromEntries(
            Object.entries(edits.value).filter(([defindex]) => !salvos.has(defindex)),
        )
        selected.value = []
        bulkPriceInput.value = ''
        await loadSets()
    } catch {
        toast.error('Erro ao salvar preços.')
    } finally {
        saving.value = false
    }
}

function discardEdits() {
    edits.value = {}
}

function clearFilters() {
    search.value = ''
    cacheFilter.value = ''
    heroFilter.value = ''
    rarityFilter.value = ''
    typeFilter.value = ''
    onlyInStock.value = false
    onlyWithoutPrice.value = false
}

onMounted(loadSets)
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">
                    <Icon icon="mdi:treasure-chest" class="title-icon" />
                    Preços por Set
                </h1>
                <p class="page-subtitle">
                    Catálogo completo das Collector's Caches e Heroes' Hoards. Mudou o preço aqui,
                    muda em todas as unidades do estoque — e todo item importado desse set já nasce
                    com esse preço.
                </p>
            </div>
        </header>

        <section class="stats-row">
            <div class="stat-card">
                <Icon icon="mdi:treasure-chest-outline" class="stat-icon" />
                <div>
                    <span class="stat-value">{{ sets.length }}</span>
                    <span class="stat-label">sets no catálogo</span>
                </div>
            </div>
            <div class="stat-card">
                <Icon icon="mdi:package-variant-closed" class="stat-icon stat-icon--ok" />
                <div>
                    <span class="stat-value">{{ stats.comEstoque }}</span>
                    <span class="stat-label">com estoque</span>
                </div>
            </div>
            <div class="stat-card">
                <Icon icon="mdi:counter" class="stat-icon stat-icon--ok" />
                <div>
                    <span class="stat-value">{{ stats.unidades }}</span>
                    <span class="stat-label">unidades disponíveis</span>
                </div>
            </div>
            <div class="stat-card">
                <Icon icon="mdi:tag-off-outline" class="stat-icon stat-icon--warn" />
                <div>
                    <span class="stat-value stat-value--warn">{{ stats.semPreco }}</span>
                    <span class="stat-label">sem preço</span>
                </div>
            </div>
        </section>

        <section class="filters-section">
            <div class="filters-row">
                <div class="search-wrap">
                    <Icon icon="mdi:magnify" class="search-icon" />
                    <input
                        v-model="search"
                        type="search"
                        placeholder="Buscar por set, herói ou baú"
                        class="search-input"
                    />
                </div>

                <select v-model="cacheFilter" class="filter-select">
                    <option value="">Todos os baús</option>
                    <option v-for="c in caches" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>

                <select v-model="heroFilter" class="filter-select filter-select--sm">
                    <option value="">Todos os heróis</option>
                    <option v-for="h in heroOptions" :key="h" :value="h">{{ h }}</option>
                </select>

                <select v-model="rarityFilter" class="filter-select filter-select--sm">
                    <option value="">Todas as raridades</option>
                    <option v-for="r in rarityOptions" :key="r" :value="r">{{ r }}</option>
                </select>

                <select v-model="typeFilter" class="filter-select filter-select--sm">
                    <option value="">Todos os tipos</option>
                    <option v-for="t in typeOptions" :key="t" :value="t">{{ t }}</option>
                </select>

                <label class="filter-checkbox">
                    <input type="checkbox" v-model="onlyInStock" />
                    Só com estoque
                </label>

                <label class="filter-checkbox">
                    <input type="checkbox" v-model="onlyWithoutPrice" />
                    Só sem preço
                </label>

                <button v-if="hasActiveFilters" class="page-btn" @click="clearFilters">
                    <Icon icon="mdi:filter-remove-outline" />
                    Limpar
                </button>
            </div>

            <div class="bulk-price-row">
                <Icon icon="mdi:tag-multiple-outline" class="bulk-icon" />
                <span class="bulk-label">Preço em bulk:</span>
                <input
                    v-model="bulkPriceInput"
                    type="number"
                    min="0"
                    placeholder="centavos"
                    class="price-input price-input--sm"
                    @keyup.enter="applyBulkPrice"
                />
                <span v-if="bulkPreview !== null" class="bulk-preview">
                    {{ formatCurrency(bulkPreview as number) }}
                </span>
                <button
                    class="btn-primary btn-primary--bulk"
                    :disabled="!selected.length || bulkPreview === null"
                    @click="applyBulkPrice"
                >
                    <Icon icon="mdi:tag-check-outline" />
                    Aplicar em {{ selected.length }} set{{ selected.length !== 1 ? 's' : '' }}
                </button>
            </div>

            <p class="results-meta" v-if="!loading">
                {{ filtered.length }} set{{ filtered.length !== 1 ? 's' : '' }} exibido{{ filtered.length !== 1 ? 's' : '' }}
                <template v-if="hasActiveFilters"> de {{ sets.length }}</template>
            </p>
        </section>

        <div class="save-bar" v-if="dirtyCount > 0">
            <span class="save-bar__text">
                <Icon icon="mdi:pencil-outline" />
                {{ dirtyCount }} preço{{ dirtyCount !== 1 ? 's' : '' }} alterado{{ dirtyCount !== 1 ? 's' : '' }} — ainda não salvo
            </span>
            <div class="save-bar__actions">
                <button class="page-btn" :disabled="saving" @click="discardEdits">Descartar</button>
                <button class="btn-primary" :disabled="saving" @click="saveEdits">
                    <Icon
                        :icon="saving ? 'mdi:loading' : 'mdi:content-save-outline'"
                        :class="{ spinning: saving }"
                    />
                    {{ saving ? 'Salvando...' : 'Salvar alterações' }}
                </button>
            </div>
        </div>

        <section class="section">
            <div v-if="loading" class="loading-state">
                <Icon icon="mdi:loading" class="spinning" />
                Carregando...
            </div>

            <div v-else-if="filtered.length === 0" class="empty-panel">
                <Icon icon="mdi:treasure-chest-outline" class="empty-icon" />
                <p>Nenhum set com esses filtros.</p>
            </div>

            <div v-else class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th class="check-col">
                                <input
                                    type="checkbox"
                                    :checked="allFilteredSelected"
                                    @change="toggleSelectAll"
                                />
                            </th>
                            <th>Set</th>
                            <th>Herói</th>
                            <th>Baú</th>
                            <th>Raridade</th>
                            <th class="num-col">Estoque</th>
                            <th class="price-col">Preço (centavos)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="set in filtered"
                            :key="set.defindex"
                            :class="{ 'row-dirty': isDirty(set) }"
                        >
                            <td class="check-col">
                                <input type="checkbox" v-model="selected" :value="set.defindex" />
                            </td>
                            <td>
                                <div class="set-cell">
                                    <img
                                        v-if="set.icon_url"
                                        :src="buildSteamImageUrl(set.icon_url) ?? ''"
                                        :alt="set.set_name"
                                        class="item-thumb"
                                        loading="lazy"
                                    />
                                    <div v-else class="item-thumb item-thumb--empty">
                                        <Icon icon="mdi:image-off-outline" />
                                    </div>
                                    <div class="item-cell">
                                        <span class="item-name">{{ set.set_name }}</span>
                                        <span class="item-sub">#{{ set.defindex }}</span>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <div class="hero-cell" v-if="set.hero_name">
                                    <img
                                        v-if="set.hero_image"
                                        :src="set.hero_image"
                                        :alt="set.hero_name"
                                        class="hero-img"
                                    />
                                    <span>{{ set.hero_name }}</span>
                                </div>
                                <span class="muted" v-else>—</span>
                            </td>
                            <td>
                                <div class="item-cell">
                                    <span class="cache-name">{{ set.cache_name }}</span>
                                    <span class="item-sub">{{ set.year }}</span>
                                </div>
                            </td>
                            <td>
                                <span class="badge" :class="rarityClass(set.rarity)">
                                    {{ set.rarity }}
                                </span>
                            </td>
                            <td class="num-col">
                                <span v-if="set.available > 0" class="stock-value">
                                    {{ set.available }}
                                    <span class="muted">/ {{ set.total }}</span>
                                </span>
                                <span class="muted" v-else>0</span>
                            </td>
                            <td class="price-col">
                                <input
                                    class="price-edit-input"
                                    type="number"
                                    min="0"
                                    placeholder="—"
                                    :value="priceInput(set)"
                                    @input="updatePrice(set, ($event.target as HTMLInputElement).value)"
                                />
                                <span class="price-preview" v-if="parseCents(priceInput(set)) !== null">
                                    {{ formatCurrency(parseCents(priceInput(set)) as number) }}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
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
    max-width 780px
    line-height 1.5

.stats-row
    display grid
    grid-template-columns repeat(auto-fit, minmax(200px, 1fr))
    gap 0.75rem
    margin-bottom 1.25rem

.stat-card
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 12px
    padding 1rem 1.25rem
    display flex
    align-items center
    gap 0.85rem

.stat-icon
    font-size 1.5rem
    color #6366f1
    flex-shrink 0

    &--ok
        color #4ade80

    &--warn
        color #f59e0b

.stat-value
    display block
    font-size 1.4rem
    font-weight 700
    line-height 1.2

    &--warn
        color #f59e0b

.stat-label
    display block
    color #94a3b8
    font-size 0.8rem

.filters-section
    background #1a1a1e
    padding 1.25rem 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)
    margin-bottom 1.25rem

.filters-row
    display flex
    flex-wrap wrap
    gap 0.75rem
    align-items center

.search-wrap
    position relative
    flex 1
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
    background #121214
    border 1px solid rgba(255,255,255,0.08)
    border-radius 10px
    color #fff
    padding 0.7rem 0.9rem 0.7rem 2.4rem
    font-size 0.9rem
    outline none
    box-sizing border-box

    &::placeholder
        color #64748b

    &:focus
        border-color rgba(99,102,241,0.45)

.filter-select
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.7rem 0.8rem
    font-size 0.88rem
    outline none
    cursor pointer
    min-width 240px

    option
        background #1a1a1e

    &--sm
        min-width 170px
        max-width 200px

.filter-checkbox
    display flex
    align-items center
    gap 0.4rem
    color #94a3b8
    font-size 0.88rem
    cursor pointer
    white-space nowrap
    user-select none

    input[type="checkbox"]
        accent-color #6366f1
        width 16px
        height 16px
        cursor pointer

.price-input
    background #121214
    border 1px solid rgba(255,255,255,0.08)
    border-radius 10px
    color #fff
    padding 0.7rem 0.9rem
    font-size 0.9rem
    outline none

    &::placeholder
        color #64748b

    &:focus
        border-color rgba(99,102,241,0.45)

    &--sm
        width 160px

.btn-primary
    display inline-flex
    align-items center
    gap 0.4rem
    background #6366f1
    color #fff
    border none
    border-radius 10px
    padding 0.72rem 1rem
    font-size 0.88rem
    font-weight 600
    cursor pointer
    transition all 0.2s

    &:hover:not(:disabled)
        background #5457de

    &:disabled
        opacity 0.6
        cursor not-allowed

    &--bulk
        background #f59e0b
        color #000

        &:hover:not(:disabled)
            background #d97706

.bulk-price-row
    display flex
    align-items center
    gap 0.75rem
    margin-top 0.75rem
    padding-top 0.75rem
    border-top 1px solid rgba(255,255,255,0.05)
    flex-wrap wrap

.bulk-icon
    color #f59e0b
    font-size 1.1rem
    flex-shrink 0

.bulk-label
    color #94a3b8
    font-size 0.88rem
    white-space nowrap

.bulk-preview
    color #4ade80
    font-size 0.82rem
    font-weight 700
    white-space nowrap

.results-meta
    margin-top 0.75rem
    font-size 0.82rem
    color #64748b

.save-bar
    position sticky
    top 0
    z-index 5
    display flex
    align-items center
    justify-content space-between
    flex-wrap wrap
    gap 1rem
    background rgba(99,102,241,0.1)
    border 1px solid rgba(99,102,241,0.3)
    border-radius 12px
    padding 0.85rem 1.25rem
    margin-bottom 1.25rem

    &__text
        display flex
        align-items center
        gap 0.45rem
        font-size 0.88rem
        color #c7d2fe

    &__actions
        display flex
        gap 0.5rem

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.loading-state
    padding 3rem
    color #94a3b8
    display flex
    align-items center
    justify-content center
    gap 0.5rem

.empty-panel
    padding 3.5rem 1rem
    text-align center
    color #64748b

.empty-icon
    font-size 2.5rem
    margin-bottom 0.75rem
    color #f59e0b

.table-wrapper
    overflow-x auto

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

tr.row-dirty td
    background rgba(99,102,241,0.07)

.check-col
    width 42px

    input[type="checkbox"]
        accent-color #6366f1
        width 16px
        height 16px
        cursor pointer

.set-cell
    display flex
    align-items center
    gap 0.7rem

.item-thumb
    width 100px
    height 100px
    object-fit contain
    border-radius 8px
    background rgba(255,255,255,0.04)
    flex-shrink 0

    &--empty
        display flex
        align-items center
        justify-content center
        color #3f3f46
        font-size 2rem

.item-cell
    display flex
    flex-direction column
    gap 0.15rem

.item-name
    font-weight 600
    color #fff

.cache-name
    color #cbd5e1
    font-size 0.82rem

.item-sub
    color #64748b
    font-size 0.72rem

.hero-cell
    display flex
    align-items center
    gap 0.5rem
    white-space nowrap

.hero-img
    width 28px
    height 28px
    border-radius 6px
    object-fit cover
    flex-shrink 0

.muted
    color #64748b

.num-col
    text-align right
    white-space nowrap

.stock-value
    font-weight 700
    color #4ade80

.badge
    display inline-block
    padding 0.22rem 0.55rem
    border-radius 6px
    font-size 0.72rem
    font-weight 600
    white-space nowrap
    background rgba(148,163,184,0.1)
    color #94a3b8
    border 1px solid rgba(148,163,184,0.16)

    &.rarity--rare
        background rgba(59,130,246,0.12)
        color #60a5fa
        border-color rgba(96,165,250,0.22)

    &.rarity--very-rare
        background rgba(168,85,247,0.12)
        color #c084fc
        border-color rgba(192,132,252,0.22)

    &.rarity--ultra-rare
        background rgba(245,158,11,0.12)
        color #fbbf24
        border-color rgba(251,191,36,0.24)

.price-col
    width 200px

.price-edit-input
    width 130px
    background #121214
    border 1px solid rgba(255,255,255,0.08)
    border-radius 6px
    color #4ade80
    padding 0.45rem 0.6rem
    font-size 0.9rem
    font-weight 600
    outline none

    &::placeholder
        color #64748b
        font-weight 400

    &:focus
        border-color rgba(99,102,241,0.45)

.price-preview
    display block
    margin-top 0.3rem
    font-size 0.75rem
    color #4ade80

.page-btn
    display inline-flex
    align-items center
    gap 0.35rem
    background #2a2a30
    color #fff
    border 1px solid rgba(255,255,255,0.1)
    padding 0.45rem 1rem
    border-radius 6px
    cursor pointer
    font-size 0.85rem
    transition all 0.2s

    &:hover:not(:disabled)
        background #3a3a42

    &:disabled
        opacity 0.4
        cursor not-allowed

.spinning
    animation spin 1s linear infinite

@keyframes spin
    from
        transform rotate(0deg)
    to
        transform rotate(360deg)
</style>
