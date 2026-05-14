<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'

type DotaHero = { id: string; slug: string; name: string; image: string | null }

type CollectorItem = {
    id: string
    steam_id: string
    asset_id: string
    class_id: string | null
    instance_id: string | null
    name: string
    market_hash_name: string
    type: string | null
    icon_url: string | null
    icon_url_large: string | null
    amount: number
    tradable: boolean
    marketable: boolean
    commodity: boolean
    price: number | null
    bot_id: number | null
    dota_heroes: DotaHero | null
    created_at: string
}

const items = ref<CollectorItem[]>([])
const total = ref(0)
const page = ref(1)
const limit = ref(20)
const loading = ref(false)

const search = ref('')
const steamIdFilter = ref('')
const minPriceInput = ref('')
const maxPriceInput = ref('')
const noPriceOnly = ref(false)
const noHeroOnly = ref(false)

const bulkPriceInput = ref('')
const bulkSaving = ref(false)

const bulkHeroSlug = ref('')
const bulkHeroSaving = ref(false)

const heroes = ref<DotaHero[]>([])
const heroValues = ref<Record<string, string>>({})
const heroSavingKeys = ref<Set<string>>(new Set())

const editingValues = ref<Record<string, string>>({})
const savingKeys = ref<Set<string>>(new Set())
const deletingUuid = ref<string | null>(null)
const confirmDeleteUuid = ref<string | null>(null)

const itemKey = (item: CollectorItem) => `${item.steam_id}__${item.asset_id}`
const isEditing = (item: CollectorItem) => itemKey(item) in editingValues.value
const isSaving = (item: CollectorItem) => savingKeys.value.has(itemKey(item))

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))

const pageSizeOptions = [20, 50, 100]

async function load() {
    loading.value = true
    try {
        const params: Record<string, any> = { page: page.value, limit: limit.value }
        if (search.value.trim()) params.search = search.value.trim()
        if (steamIdFilter.value.trim()) params.steamId = steamIdFilter.value.trim()
        const min = parseInt(minPriceInput.value, 10)
        const max = parseInt(maxPriceInput.value, 10)
        if (!isNaN(min) && min >= 0) params.minPrice = min
        if (!isNaN(max) && max >= 0) params.maxPrice = max
        if (noPriceOnly.value) params.noPrice = true
        if (noHeroOnly.value) params.noHero = true

        const res = await adminService.getCollectors(params)
        const data = (res as any).data ?? res
        items.value = (data.data ?? []).map((item: any) => ({
            ...item,
            amount: Number(item.amount ?? 1),
            bot_id: item.bot_id != null ? Number(item.bot_id) : null,
        }))
        total.value = data.total ?? 0
        heroValues.value = {}
        for (const item of items.value) {
            heroValues.value[itemKey(item)] = item.dota_heroes?.slug ?? ''
        }
    } catch {
        toast.error('Erro ao carregar collectors.')
    } finally {
        loading.value = false
    }
}

function startEdit(item: CollectorItem) {
    editingValues.value[itemKey(item)] = item.price != null ? String(item.price) : ''
}

function cancelEdit(item: CollectorItem) {
    delete editingValues.value[itemKey(item)]
}

async function savePrice(item: CollectorItem) {
    const key = itemKey(item)
    const raw = (editingValues.value[key] ?? '').trim()
    const price = raw === '' ? null : parseInt(raw, 10)

    if (raw !== '' && (isNaN(price!) || price! < 0)) {
        toast.error('Preço inválido.')
        return
    }

    savingKeys.value = new Set([...savingKeys.value, key])
    try {
        await adminService.updateCollectorPrice(item.id, price)
        item.price = price
        toast.success('Preço atualizado.')
        delete editingValues.value[key]
    } catch {
        toast.error('Erro ao salvar preço.')
    } finally {
        const next = new Set(savingKeys.value)
        next.delete(key)
        savingKeys.value = next
    }
}

function askDelete(uuid: string) {
    confirmDeleteUuid.value = uuid
}

function cancelDelete() {
    confirmDeleteUuid.value = null
}

async function confirmDelete(uuid: string) {
    deletingUuid.value = uuid
    try {
        await adminService.deleteCollector(uuid)
        items.value = items.value.filter(i => i.id !== uuid)
        total.value = Math.max(0, total.value - 1)
        toast.success('Item removido.')
    } catch {
        toast.error('Erro ao remover item.')
    } finally {
        deletingUuid.value = null
        confirmDeleteUuid.value = null
    }
}

async function saveHero(item: CollectorItem) {
    const key = itemKey(item)
    const slug = heroValues.value[key] || null
    heroSavingKeys.value = new Set([...heroSavingKeys.value, key])
    try {
        await adminService.updateCollectorHero(item.id, slug)
        toast.success('Hero atualizado.')
    } catch {
        toast.error('Erro ao salvar hero.')
    } finally {
        const next = new Set(heroSavingKeys.value)
        next.delete(key)
        heroSavingKeys.value = next
    }
}

async function bulkApplyHero() {
    const slug = bulkHeroSlug.value || null
    bulkHeroSaving.value = true
    try {
        const results = await Promise.allSettled(
            items.value.map((item, idx) =>
                adminService.updateCollectorHero(item.id, slug).then(() => {
                    if (items.value[idx]) {
                        heroValues.value[itemKey(items.value[idx]!)] = slug ?? ''
                    }
                })
            )
        )
        const ok = results.filter(r => r.status === 'fulfilled').length
        const fail = results.filter(r => r.status === 'rejected').length
        if (ok > 0) toast.success(`Hero aplicado em ${ok} iten${ok !== 1 ? 's' : ''}.`)
        if (fail > 0) toast.error(`${fail} iten${fail !== 1 ? 's' : ''} falharam.`)
    } finally {
        bulkHeroSaving.value = false
    }
}

async function bulkApplyPrice() {
    const raw = String(bulkPriceInput.value ?? '').trim()
    const price = parseInt(raw, 10)
    if (!raw || isNaN(price) || price < 0) {
        toast.error('Preço inválido.')
        return
    }
    bulkSaving.value = true
    try {
        const results = await Promise.allSettled(
            items.value.map((item, idx) =>
                adminService.updateCollectorPrice(item.id, price).then(() => {
                    if (items.value[idx]) items.value[idx]!.price = price
                })
            )
        )
        const ok = results.filter(r => r.status === 'fulfilled').length
        const fail = results.filter(r => r.status === 'rejected').length
        if (ok > 0) {
            toast.success(`Preço aplicado em ${ok} iten${ok !== 1 ? 's' : ''}.`)
            bulkPriceInput.value = ''
        }
        if (fail > 0) toast.error(`${fail} iten${fail !== 1 ? 's' : ''} falharam.`)
    } finally {
        bulkSaving.value = false
    }
}

function applyFilters() {
    page.value = 1
    load()
}

watch([page, limit], load)

onMounted(async () => {
    try {
        const res = await adminService.getDotaHeroes()
        heroes.value = ((res as any).data ?? res) as DotaHero[]
    } catch {
        toast.error('Erro ao carregar heróis.')
    }
    load()
})
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">
                    <Icon icon="mdi:trophy-outline" class="title-icon" />
                    Catálogo Collectors
                </h1>
                <p class="page-subtitle">Liste e edite todos os collectors cadastrados</p>
            </div>
        </header>

        <section class="filters-section">
            <div class="filters-row">
                <div class="search-wrap">
                    <Icon icon="mdi:magnify" class="search-icon" />
                    <input
                        v-model="search"
                        type="text"
                        placeholder="Buscar por nome ou market hash"
                        class="search-input"
                        @keyup.enter="applyFilters"
                    />
                </div>

                <div class="search-wrap search-wrap--sm">
                    <Icon icon="mdi:steam" class="search-icon" />
                    <input
                        v-model="steamIdFilter"
                        type="text"
                        inputmode="numeric"
                        placeholder="SteamID64"
                        class="search-input"
                        @keyup.enter="applyFilters"
                    />
                </div>

                <input
                    v-model="minPriceInput"
                    type="number"
                    min="0"
                    placeholder="Preço mín (centavos)"
                    class="price-input"
                    @keyup.enter="applyFilters"
                />
                <input
                    v-model="maxPriceInput"
                    type="number"
                    min="0"
                    placeholder="Preço máx (centavos)"
                    class="price-input"
                    @keyup.enter="applyFilters"
                />

                <button class="btn-primary" :disabled="loading" @click="applyFilters">
                    <Icon :icon="loading ? 'mdi:loading' : 'mdi:filter-outline'" :class="{ spinning: loading }" />
                    Filtrar
                </button>

                <label class="filter-checkbox">
                    <input type="checkbox" v-model="noPriceOnly" @change="applyFilters" />
                    Sem preço
                </label>

                <label class="filter-checkbox">
                    <input type="checkbox" v-model="noHeroOnly" @change="applyFilters" />
                    Sem hero
                </label>

                <select v-model.number="limit" class="filter-select">
                    <option v-for="s in pageSizeOptions" :key="s" :value="s">{{ s }} por página</option>
                </select>
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
                    @keyup.enter="bulkApplyPrice"
                />
                <span v-if="bulkPriceInput && !isNaN(parseInt(bulkPriceInput, 10))" class="bulk-preview">
                    {{ formatCurrency(parseInt(bulkPriceInput, 10)) }}
                </span>
                <button
                    class="btn-primary btn-primary--bulk"
                    :disabled="bulkSaving || !bulkPriceInput || items.length === 0"
                    @click="bulkApplyPrice"
                >
                    <Icon :icon="bulkSaving ? 'mdi:loading' : 'mdi:tag-check-outline'" :class="{ spinning: bulkSaving }" />
                    Aplicar em {{ items.length }} iten{{ items.length !== 1 ? 's' : '' }}
                </button>
            </div>

            <div class="bulk-price-row">
                <Icon icon="mdi:sword" class="bulk-icon" />
                <span class="bulk-label">Hero em bulk:</span>
                <select v-model="bulkHeroSlug" class="hero-select hero-select--bulk">
                    <option value="">— sem hero —</option>
                    <option v-for="hero in heroes" :key="hero.id" :value="hero.slug">
                        {{ hero.name }}
                    </option>
                </select>
                <button
                    class="btn-primary btn-primary--bulk-hero"
                    :disabled="bulkHeroSaving || items.length === 0"
                    @click="bulkApplyHero"
                >
                    <Icon :icon="bulkHeroSaving ? 'mdi:loading' : 'mdi:sword-cross'" :class="{ spinning: bulkHeroSaving }" />
                    Aplicar em {{ items.length }} iten{{ items.length !== 1 ? 's' : '' }}
                </button>
            </div>

            <p class="results-meta" v-if="!loading">
                {{ total }} resultado{{ total !== 1 ? 's' : '' }}
            </p>
        </section>

        <section class="section">
            <div v-if="loading" class="loading-state">
                <Icon icon="mdi:loading" class="spinning" />
                Carregando...
            </div>

            <div v-else-if="items.length === 0" class="empty-panel">
                <Icon icon="mdi:trophy-outline" class="empty-icon" />
                <p>Nenhum collector encontrado.</p>
            </div>

            <div v-else>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Steam ID</th>
                                <th>Asset ID</th>
                                <th>Tipo</th>
                                <th>Flags</th>
                                <th>Hero</th>
                                <th>Preço</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="item in items" :key="itemKey(item)">
                                <td>
                                    <div class="item-cell">
                                        <img
                                            v-if="item.icon_url_large || item.icon_url"
                                            :src="item.icon_url_large || item.icon_url || ''"
                                            class="item-thumb"
                                            alt=""
                                        />
                                        <div v-else class="item-thumb-placeholder">
                                            <Icon icon="mdi:trophy-variant-outline" />
                                        </div>
                                        <div>
                                            <span class="item-name">{{ item.name }}</span>
                                            <small class="item-subtitle">{{ item.market_hash_name }}</small>
                                        </div>
                                    </div>
                                </td>
                                <td><code class="mono">{{ item.steam_id }}</code></td>
                                <td><code class="mono">{{ item.asset_id }}</code></td>
                                <td>{{ item.type || '-' }}</td>
                                <td>
                                    <div class="flags">
                                        <span class="flag" :class="item.tradable ? 'flag--ok' : 'flag--muted'">Tradable</span>
                                        <span class="flag" :class="item.marketable ? 'flag--ok' : 'flag--muted'">Marketable</span>
                                    </div>
                                </td>
                                <td class="hero-cell">
                                    <div class="hero-select-wrap">
                                        <select
                                            v-model="heroValues[itemKey(item)]"
                                            class="hero-select"
                                            :disabled="heroSavingKeys.has(itemKey(item))"
                                            @change="saveHero(item)"
                                        >
                                            <option value="">— sem hero —</option>
                                            <option v-for="hero in heroes" :key="hero.id" :value="hero.slug">
                                                {{ hero.name }}
                                            </option>
                                        </select>
                                        <Icon
                                            v-if="heroSavingKeys.has(itemKey(item))"
                                            icon="mdi:loading"
                                            class="hero-saving spinning"
                                        />
                                    </div>
                                </td>
                                <td class="price-cell">
                                    <template v-if="isEditing(item)">
                                        <div class="price-edit-row">
                                            <input
                                                :value="editingValues[itemKey(item)]"
                                                type="number"
                                                min="0"
                                                class="price-edit-input"
                                                placeholder="centavos"
                                                autofocus
                                                @input="editingValues[itemKey(item)] = ($event.target as HTMLInputElement).value"
                                                @keyup.enter="savePrice(item)"
                                                @keyup.esc="cancelEdit(item)"
                                            />
                                            <button
                                                class="btn-icon btn-icon--ok"
                                                :disabled="isSaving(item)"
                                                @click="savePrice(item)"
                                            >
                                                <Icon :icon="isSaving(item) ? 'mdi:loading' : 'mdi:check'" :class="{ spinning: isSaving(item) }" />
                                            </button>
                                            <button class="btn-icon btn-icon--cancel" @click="cancelEdit(item)">
                                                <Icon icon="mdi:close" />
                                            </button>
                                        </div>
                                        <small v-if="editingValues[itemKey(item)]" class="price-preview">
                                            {{ formatCurrency(parseInt(editingValues[itemKey(item)]!, 10)) }}
                                        </small>
                                    </template>
                                    <template v-else>
                                        <button class="price-display" @click="startEdit(item)">
                                            <span :class="item.price != null ? 'price-value' : 'price-empty'">
                                                {{ item.price != null ? formatCurrency(item.price) : '— sem preço —' }}
                                            </span>
                                            <Icon icon="mdi:pencil-outline" class="price-edit-icon" />
                                        </button>
                                    </template>
                                </td>
                                <td class="actions-col">
                                    <template v-if="confirmDeleteUuid === item.id">
                                        <div class="confirm-delete-row">
                                            <span class="confirm-text">Remover?</span>
                                            <button
                                                class="btn-icon btn-icon--danger"
                                                :disabled="deletingUuid === item.id"
                                                @click="confirmDelete(item.id)"
                                            >
                                                <Icon :icon="deletingUuid === item.id ? 'mdi:loading' : 'mdi:check'" :class="{ spinning: deletingUuid === item.id }" />
                                            </button>
                                            <button class="btn-icon btn-icon--cancel" @click="cancelDelete">
                                                <Icon icon="mdi:close" />
                                            </button>
                                        </div>
                                    </template>
                                    <template v-else>
                                        <button class="btn-remove" @click="askDelete(item.id)">
                                            <Icon icon="mdi:trash-can-outline" />
                                        </button>
                                    </template>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="pagination" v-if="totalPages > 1">
                    <button class="page-btn" :disabled="page === 1" @click="page--">Anterior</button>
                    <span class="page-info">Página {{ page }} de {{ totalPages }}</span>
                    <button class="page-btn" :disabled="page === totalPages" @click="page++">Próxima</button>
                </div>
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
    min-width 220px

    &--sm
        flex 0 0 auto
        min-width 200px

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

.price-input
    width 180px
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

.price-input--sm
    width 160px

.btn-primary--bulk
    background #f59e0b
    color #000

    &:hover:not(:disabled)
        background #d97706

.btn-primary--bulk-hero
    background #6366f1
    color #fff

    &:hover:not(:disabled)
        background #5457de

.hero-select--bulk
    max-width 220px
    padding 0.62rem 0.75rem
    font-size 0.88rem

.results-meta
    margin-top 0.75rem
    font-size 0.82rem
    color #64748b

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

.mono
    font-family monospace
    font-size 0.8rem
    color #cbd5e1

.flags
    display flex
    flex-wrap wrap
    gap 0.45rem

.flag
    display inline-flex
    align-items center
    padding 0.25rem 0.5rem
    border-radius 999px
    font-size 0.72rem
    font-weight 700
    text-transform uppercase
    letter-spacing 0.03em

    &--ok
        color #4ade80
        background rgba(74,222,128,0.1)
        border 1px solid rgba(74,222,128,0.2)

    &--muted
        color #94a3b8
        background rgba(148,163,184,0.08)
        border 1px solid rgba(148,163,184,0.14)

.hero-cell
    min-width 180px

.hero-select-wrap
    display flex
    align-items center
    gap 0.4rem

.hero-select
    background #121214
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.45rem 0.6rem
    font-size 0.82rem
    outline none
    cursor pointer
    width 100%
    max-width 180px

    option
        background #1a1a1e

    &:focus
        border-color rgba(99,102,241,0.45)

    &:disabled
        opacity 0.6
        cursor not-allowed

.hero-saving
    font-size 1rem
    color #6366f1
    flex-shrink 0

.price-cell
    min-width 200px

.price-display
    display inline-flex
    align-items center
    gap 0.4rem
    background transparent
    border 1px solid rgba(255,255,255,0.06)
    border-radius 6px
    padding 0.35rem 0.6rem
    cursor pointer
    transition all 0.15s
    color inherit

    &:hover
        border-color rgba(99,102,241,0.4)
        background rgba(99,102,241,0.05)

        .price-edit-icon
            opacity 1

.price-value
    font-weight 600
    color #4ade80

.price-empty
    color #64748b
    font-style italic
    font-size 0.8rem

.price-edit-icon
    font-size 0.8rem
    color #94a3b8
    opacity 0
    transition opacity 0.15s

.price-edit-row
    display flex
    align-items center
    gap 0.35rem

.price-edit-input
    width 110px
    background #121214
    border 1px solid rgba(99,102,241,0.4)
    border-radius 6px
    color #fff
    padding 0.4rem 0.6rem
    font-size 0.9rem
    font-weight 600
    color #4caf50
    outline none

.price-preview
    display block
    margin-top 0.3rem
    font-size 0.75rem
    color #4ade80

.btn-icon
    display inline-flex
    align-items center
    justify-content center
    width 28px
    height 28px
    border-radius 6px
    border none
    cursor pointer
    transition all 0.15s
    flex-shrink 0

    &--ok
        background rgba(74,222,128,0.12)
        color #4ade80
        border 1px solid rgba(74,222,128,0.2)

        &:hover:not(:disabled)
            background rgba(74,222,128,0.22)

    &--cancel
        background rgba(148,163,184,0.08)
        color #94a3b8
        border 1px solid rgba(148,163,184,0.14)

        &:hover
            background rgba(148,163,184,0.15)

    &--danger
        background rgba(239,68,68,0.12)
        color #f87171
        border 1px solid rgba(248,113,113,0.2)

        &:hover:not(:disabled)
            background rgba(239,68,68,0.22)

    &:disabled
        opacity 0.5
        cursor not-allowed

.actions-col
    width 60px
    text-align right

.btn-remove
    display inline-flex
    align-items center
    justify-content center
    width 34px
    height 34px
    background rgba(239,68,68,0.08)
    color #f87171
    border 1px solid rgba(248,113,113,0.12)
    border-radius 8px
    cursor pointer
    transition all 0.2s

    &:hover
        background rgba(239,68,68,0.18)

.confirm-delete-row
    display flex
    align-items center
    gap 0.35rem

.confirm-text
    font-size 0.75rem
    color #fca5a5
    white-space nowrap

.spinning
    animation spin 1s linear infinite

@keyframes spin
    from transform rotate(0deg)
    to transform rotate(360deg)

.pagination
    display flex
    justify-content flex-end
    align-items center
    gap 1rem
    padding-top 1rem
    border-top 1px solid rgba(255,255,255,0.05)

.page-btn
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

.page-info
    color #94a3b8
    font-size 0.85rem
</style>
