<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import FilterField from '@/components/common/FilterField.vue'
import { adminService } from '@/services/admin/admin.service'
import type { Kit, StoreSkin } from '@/services/admin/types'
import { formatCurrency } from '@/utils/formatCurrency'
import { toCents } from '@/utils/toCents'
import { buildSteamImageUrl } from '@/utils/steamImage'
import {
    QUALITY_OPTIONS,
    RARITY_OPTIONS,
    SLOT_OPTIONS,
    SORT_OPTIONS,
    TYPE_OPTIONS,
    type FacetOption,
} from '@/utils/dotaFacets'

type FacetKey = 'slot' | 'type' | 'quality'
type DraftItem = Pick<StoreSkin, 'id' | 'name' | 'hero' | 'icon_url_large'> & { price: number }

const PAGE_SIZE = 40

const FACETS: { key: FacetKey; label: string; options: FacetOption[] }[] = [
    { key: 'slot', label: 'Slot', options: SLOT_OPTIONS },
    { key: 'type', label: 'Tipo', options: TYPE_OPTIONS },
    { key: 'quality', label: 'Qualidade', options: QUALITY_OPTIONS },
]

const KIT_STATUS = {
    paused: { label: 'Pausado', badge: 'badge-paused' },
    soldOut: { label: 'Esgotado', badge: 'badge-sold-out' },
    live: { label: 'No ar', badge: 'badge-live' },
}

const emptyFilters = () => ({
    search: '',
    hero: '',
    rarity: '',
    tradable: '',
    sort: '',
    min_price: '',
    max_price: '',
    slot: [] as string[],
    type: [] as string[],
    quality: [] as string[],
})

const emptyDraft = () => ({
    id: null as string | null,
    name: '',
    price: '',
    is_active: true,
    items: [] as DraftItem[],
})

const filters = reactive(emptyFilters())
const heroes = ref<{ id: string; name: string }[]>([])
const results = ref<StoreSkin[]>([])
const total = ref(0)
const page = ref(1)
const searching = ref(false)

const kits = ref<Kit[]>([])
const loadingKits = ref(true)
const saving = ref(false)
const draft = reactive(emptyDraft())

const draftSkinIds = computed(() => new Set(draft.items.map((item) => item.id)))
const itemsTotal = computed(() => draft.items.reduce((sum, item) => sum + item.price, 0))
const draftPrice = computed(() => toCents(draft.price) ?? 0)
const discountPct = computed(() => Math.round((1 - draftPrice.value / itemsTotal.value) * 100))

// Prévia enquanto digita: mostra como o valor foi lido antes de salvar ("1,234" vira R$ 1,23).
const pricePreview = computed(() => {
    if (!draft.price.trim()) return null
    if (draftPrice.value <= 0) return { text: 'Valor inválido', invalid: true }

    return { text: formatCurrency(draftPrice.value), invalid: false }
})
const hasMore = computed(() => results.value.length < total.value)

const thumb = (icon: string | null) => buildSteamImageUrl(icon, '96fx96f') ?? ''

const errorMessage = (error: any, fallback: string) =>
    [error?.response?.data?.message].flat().filter(Boolean).join(', ') || fallback

const kitStatus = (kit: Kit) => {
    if (!kit.is_active) return KIT_STATUS.paused
    if (!kit.is_available) return KIT_STATUS.soldOut

    return KIT_STATUS.live
}

// Mesmo contrato da vitrine: facetas em CSV, TradeLock só quando escolhido, preço em centavos.
const searchParams = () => {
    const params = {
        page: page.value,
        limit: PAGE_SIZE,
        search: filters.search.trim(),
        hero: filters.hero,
        rarity: filters.rarity,
        sort: filters.sort,
        is_tradable: filters.tradable,
        slot: filters.slot.join(','),
        type: filters.type.join(','),
        quality: filters.quality.join(','),
        min_price: toCents(filters.min_price),
        max_price: toCents(filters.max_price),
    }

    return Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== '' && value !== undefined),
    ) as Record<string, string | number>
}

// Filtro muda a cada tecla: só a resposta da busca mais nova vale.
let searchSeq = 0

const fetchSkins = async () => {
    const seq = ++searchSeq
    searching.value = true
    try {
        const { data } = await adminService.searchStoreSkins(searchParams())
        if (seq !== searchSeq) return
        results.value = page.value === 1 ? data.data : [...results.value, ...data.data]
        total.value = data.meta.total
    } catch (error) {
        if (seq !== searchSeq) return
        // "Carregar mais" que falhou não pode pular a página no próximo clique.
        if (page.value > 1) page.value--
        toast.error(errorMessage(error, 'Erro ao buscar skins.'))
    } finally {
        if (seq === searchSeq) searching.value = false
    }
}

const searchFromStart = () => {
    page.value = 1
    fetchSkins()
}

const loadMore = () => {
    page.value++
    fetchSkins()
}

let searchDebounce: ReturnType<typeof setTimeout> | undefined
watch(filters, () => {
    clearTimeout(searchDebounce)
    searchDebounce = setTimeout(searchFromStart, 400)
}, { deep: true })

const toggleFacet = (key: FacetKey, value: string) => {
    const values = filters[key]
    filters[key] = values.includes(value) ? values.filter((current) => current !== value) : [...values, value]
}

const clearFilters = () => Object.assign(filters, emptyFilters())

const addItem = (skin: StoreSkin) => {
    if (draftSkinIds.value.has(skin.id)) return

    draft.items.push({
        id: skin.id,
        name: skin.name,
        hero: skin.hero,
        icon_url_large: skin.icon_url_large,
        price: skin.effective_price,
    })
}

const removeItem = (skinId: string) => {
    draft.items = draft.items.filter((item) => item.id !== skinId)
}

const resetDraft = () => Object.assign(draft, emptyDraft())

const editKit = (kit: Kit) => {
    Object.assign(draft, {
        id: kit.id,
        name: kit.name,
        price: (kit.price / 100).toFixed(2).replace('.', ','),
        is_active: kit.is_active,
        items: kit.items.map((item) => ({
            id: item.id,
            name: item.name,
            hero: item.hero,
            icon_url_large: item.icon_url_large,
            price: item.price,
        })),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
}

const draftError = () => {
    if (!draft.name.trim()) return 'Dê um nome pro kit.'
    if (draft.items.length < 2) return 'O kit precisa de pelo menos 2 skins.'
    if (draftPrice.value <= 0) return 'Preço do kit inválido.'

    return null
}

const fetchKits = async () => {
    loadingKits.value = true
    try {
        const { data } = await adminService.listKits()
        kits.value = data
    } catch (error) {
        toast.error(errorMessage(error, 'Erro ao carregar kits.'))
    } finally {
        loadingKits.value = false
    }
}

const persistDraft = () => {
    const payload = {
        name: draft.name.trim(),
        price: draftPrice.value,
        is_active: draft.is_active,
        skin_uuids: draft.items.map((item) => item.id),
    }
    if (draft.id) return adminService.updateKit(draft.id, payload)

    return adminService.createKit(payload)
}

const saveDraft = async () => {
    const error = draftError()
    if (error) {
        toast.error(error)
        return
    }

    saving.value = true
    try {
        await persistDraft()
        toast.success(draft.id ? 'Kit atualizado!' : 'Kit criado!')
        resetDraft()
        await fetchKits()
    } catch (saveError) {
        toast.error(errorMessage(saveError, 'Erro ao salvar kit.'))
    } finally {
        saving.value = false
    }
}

const toggleActive = async (kit: Kit) => {
    try {
        await adminService.updateKit(kit.id, { is_active: !kit.is_active })
        await fetchKits()
    } catch (error) {
        toast.error(errorMessage(error, 'Erro ao atualizar kit.'))
    }
}

const removeKit = async (kit: Kit) => {
    if (!confirm(`Remover o kit "${kit.name}"? Quem já tem ele no carrinho perde o desconto.`)) return

    try {
        await adminService.deleteKit(kit.id)
        toast.success('Kit removido.')
        if (draft.id === kit.id) resetDraft()
        await fetchKits()
    } catch (error) {
        toast.error(errorMessage(error, 'Erro ao remover kit.'))
    }
}

const loadHeroes = async () => {
    try {
        const { data } = await adminService.getDotaHeroes()
        heroes.value = [...data].sort((a, b) => a.name.localeCompare(b.name))
    } catch {
        heroes.value = []
    }
}

onMounted(() => {
    fetchKits()
    fetchSkins()
    loadHeroes()
})
</script>

<template>
    <div class="view-wrap">
        <h1 class="page-title">
            <Icon icon="mdi:package-variant-plus" class="title-icon" /> Kits
        </h1>
        <p class="page-subtitle">
            Monte combos com os mesmos filtros da loja. O cliente leva todas as peças pelo preço do kit — se a soma avulsa cair abaixo dele, paga a soma.
        </p>

        <div class="builder">
            <section class="panel">
                <h2 class="section-title">Buscar skins</h2>

                <div class="filters">
                    <FilterField label="Busca" class="filters__search">
                        <input v-model="filters.search" type="text" class="field-input" placeholder="Nome da skin..." />
                    </FilterField>
                    <FilterField label="Herói">
                        <select v-model="filters.hero" class="field-input">
                            <option value="">Todos</option>
                            <option v-for="hero in heroes" :key="hero.id" :value="hero.name">{{ hero.name }}</option>
                        </select>
                    </FilterField>
                    <FilterField label="Raridade">
                        <select v-model="filters.rarity" class="field-input">
                            <option value="">Todas</option>
                            <option v-for="option in RARITY_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
                        </select>
                    </FilterField>
                    <FilterField label="TradeLock">
                        <select v-model="filters.tradable" class="field-input">
                            <option value="">Todos</option>
                            <option value="true">Trocáveis</option>
                            <option value="false">Não trocáveis</option>
                        </select>
                    </FilterField>
                    <FilterField label="Ordenar">
                        <select v-model="filters.sort" class="field-input">
                            <option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
                        </select>
                    </FilterField>
                    <FilterField label="Preço (R$)">
                        <div class="price-range">
                            <input v-model="filters.min_price" inputmode="decimal" class="field-input" placeholder="mín" aria-label="Preço mínimo" />
                            <input v-model="filters.max_price" inputmode="decimal" class="field-input" placeholder="máx" aria-label="Preço máximo" />
                        </div>
                    </FilterField>
                </div>

                <div class="facets">
                    <details v-for="facet in FACETS" :key="facet.key" class="facet">
                        <summary class="facet__summary">
                            {{ facet.label }}
                            <span v-if="filters[facet.key].length" class="facet__count">{{ filters[facet.key].length }}</span>
                        </summary>
                        <div class="chips">
                            <button
                                v-for="option in facet.options"
                                :key="option.value"
                                type="button"
                                class="chip"
                                :class="{ 'chip--on': filters[facet.key].includes(option.value) }"
                                @click="toggleFacet(facet.key, option.value)"
                            >
                                {{ option.label }}
                            </button>
                        </div>
                    </details>
                    <button type="button" class="btn-link" @click="clearFilters">Limpar filtros</button>
                </div>

                <p class="results-meta">{{ total }} resultado{{ total === 1 ? '' : 's' }}</p>

                <div class="results">
                    <button
                        v-for="skin in results"
                        :key="skin.id"
                        type="button"
                        class="skin-card"
                        :class="{ 'skin-card--added': draftSkinIds.has(skin.id) }"
                        :disabled="draftSkinIds.has(skin.id)"
                        @click="addItem(skin)"
                    >
                        <img :src="thumb(skin.icon_url_large)" class="skin-card__image" alt="" referrerpolicy="no-referrer" />
                        <span class="skin-card__name">{{ skin.name }}</span>
                        <span class="skin-card__meta">{{ skin.hero ?? '—' }} · {{ skin.quantity }} em estoque</span>
                        <span class="skin-card__price">{{ formatCurrency(skin.effective_price) }}</span>
                        <Icon :icon="draftSkinIds.has(skin.id) ? 'mdi:check' : 'mdi:plus'" class="skin-card__action" />
                    </button>
                </div>

                <div v-if="searching" class="loading-state">
                    <Icon icon="mdi:loading" class="spin" /> Buscando...
                </div>
                <p v-else-if="!results.length" class="empty-state">Nenhuma skin com esses filtros.</p>
                <button v-else-if="hasMore" type="button" class="btn-cancel load-more" @click="loadMore">
                    Carregar mais
                </button>
            </section>

            <aside class="panel draft">
                <div v-if="draft.id" class="editing-banner">
                    <Icon icon="mdi:pencil-outline" /> Editando kit existente
                </div>
                <h2 class="section-title">{{ draft.id ? 'Editar kit' : 'Novo kit' }}</h2>

                <label class="field">
                    <span class="field-label">Nome</span>
                    <input v-model="draft.name" type="text" maxlength="120" class="field-input" placeholder="ex: Kit Pudge completo" />
                </label>

                <ul class="draft-items">
                    <li v-for="item in draft.items" :key="item.id" class="draft-item">
                        <img :src="thumb(item.icon_url_large)" class="draft-item__image" alt="" referrerpolicy="no-referrer" />
                        <span class="draft-item__name">{{ item.name }}</span>
                        <span class="draft-item__price">{{ formatCurrency(item.price) }}</span>
                        <button type="button" class="btn-delete" :aria-label="`Remover ${item.name}`" @click="removeItem(item.id)">
                            <Icon icon="mdi:close" />
                        </button>
                    </li>
                    <li v-if="!draft.items.length" class="empty-state empty-state--compact">Clique nas skins da busca pra adicionar.</li>
                </ul>

                <div class="draft-sum">
                    <span>Soma avulsa ({{ draft.items.length }} peça{{ draft.items.length === 1 ? '' : 's' }})</span>
                    <strong>{{ formatCurrency(itemsTotal) }}</strong>
                </div>

                <label class="field">
                    <span class="field-label">Preço do kit (R$)</span>
                    <input v-model="draft.price" type="text" inputmode="decimal" class="field-input field-input--price" placeholder="ex: 120,00" />
                </label>
                <div v-if="pricePreview" class="price-feedback">
                    <strong class="price-preview" :class="{ 'price-preview--bad': pricePreview.invalid }">
                        {{ pricePreview.text }}
                    </strong>
                    <span v-if="!pricePreview.invalid && itemsTotal" class="field-hint" :class="{ 'field-hint--bad': discountPct <= 0 }">
                        {{ discountPct > 0 ? `${discountPct}% de desconto sobre a soma avulsa` : 'Sem desconto: o cliente paga a soma avulsa' }}
                    </span>
                </div>

                <label class="checkbox">
                    <input v-model="draft.is_active" type="checkbox" />
                    No ar (aparece em /kits na loja)
                </label>

                <div class="form-actions">
                    <button v-if="draft.id || draft.items.length" type="button" class="btn-cancel" @click="resetDraft">
                        Cancelar
                    </button>
                    <button type="button" class="btn-submit" :disabled="saving" @click="saveDraft">
                        <Icon v-if="saving" icon="mdi:loading" class="spin" />
                        <Icon v-else :icon="draft.id ? 'mdi:content-save-outline' : 'mdi:plus-circle-outline'" />
                        {{ saving ? 'Salvando...' : (draft.id ? 'Salvar alterações' : 'Criar kit') }}
                    </button>
                </div>
            </aside>
        </div>

        <section class="panel">
            <h2 class="section-title">Kits cadastrados</h2>

            <div v-if="loadingKits" class="loading-state">
                <Icon icon="mdi:loading" class="spin" /> Carregando...
            </div>

            <div v-else class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Kit</th>
                            <th>Peças</th>
                            <th>Soma avulsa</th>
                            <th>Preço do kit</th>
                            <th>Cliente paga</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="kit in kits" :key="kit.id">
                            <td>{{ kit.name }}</td>
                            <td>
                                <div class="thumbs">
                                    <img
                                        v-for="item in kit.items"
                                        :key="item.id"
                                        :src="thumb(item.icon_url_large)"
                                        :title="`${item.name} — ${formatCurrency(item.price)}${item.is_available ? '' : ' (esgotada)'}`"
                                        :alt="item.name"
                                        class="thumbs__image"
                                        :class="{ 'thumbs__image--out': !item.is_available }"
                                        referrerpolicy="no-referrer"
                                    />
                                </div>
                            </td>
                            <td>{{ formatCurrency(kit.items_total) }}</td>
                            <td class="price-col">{{ formatCurrency(kit.price) }}</td>
                            <td>{{ formatCurrency(kit.sale_price) }}</td>
                            <td>
                                <span class="status-badge" :class="kitStatus(kit).badge">{{ kitStatus(kit).label }}</span>
                            </td>
                            <td>
                                <div class="action-row">
                                    <button type="button" class="btn-edit" aria-label="Editar" @click="editKit(kit)">
                                        <Icon icon="mdi:pencil-outline" />
                                    </button>
                                    <button type="button" class="btn-edit" :aria-label="kit.is_active ? 'Pausar' : 'Colocar no ar'" @click="toggleActive(kit)">
                                        <Icon :icon="kit.is_active ? 'mdi:pause' : 'mdi:play'" />
                                    </button>
                                    <button type="button" class="btn-delete" aria-label="Remover" @click="removeKit(kit)">
                                        <Icon icon="mdi:trash-can-outline" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                        <tr v-if="!kits.length">
                            <td colspan="7" class="empty-state">Nenhum kit cadastrado.</td>
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
    max-width 1400px

.page-title
    font-size 1.8rem
    font-weight 700
    margin-bottom 0.25rem
    display flex
    align-items center
    gap 0.5rem

.title-icon
    color #f59e0b

.page-subtitle
    color #94a3b8
    font-size 0.9rem
    margin-bottom 2rem

.builder
    display grid
    grid-template-columns minmax(0, 1fr) 360px
    gap 1.5rem
    align-items start
    margin-bottom 1.5rem

.panel
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.draft
    position sticky
    top 1rem
    display flex
    flex-direction column
    gap 1rem

.section-title
    font-size 1rem
    font-weight 600
    color #cbd5e1
    margin-bottom 1rem

.draft .section-title
    margin-bottom 0

.filters
    display grid
    grid-template-columns repeat(auto-fill, minmax(150px, 1fr))
    gap 0.75rem

.filters__search
    grid-column 1 / -1

.price-range
    display grid
    grid-template-columns 1fr 1fr
    gap 0.4rem

.field
    display flex
    flex-direction column
    gap 0.4rem

.field-label
    font-size 0.8rem
    font-weight 500
    color #94a3b8
    text-transform uppercase
    letter-spacing 0.04em

.field-input
    width 100%
    background #121214
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.55rem 0.75rem
    font-size 0.875rem
    outline none
    font-family inherit

    &:focus
        border-color rgba(99,102,241,0.5)

    &--price
        font-size 1.1rem
        font-weight 600
        color #4caf50

.price-feedback
    display flex
    flex-direction column
    gap 0.15rem
    margin-top -0.5rem

.price-preview
    font-size 1.3rem
    font-weight 700
    color #fff

    &--bad
        font-size 0.85rem
        color #ef4444

.field-hint
    font-size 0.78rem
    color #4caf50
    font-weight 600

    &--bad
        color #f59e0b

.facets
    display flex
    flex-wrap wrap
    align-items flex-start
    gap 0.5rem
    margin-top 0.75rem

.facet
    background #121214
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px

    &[open]
        flex-basis 100%

.facet__summary
    cursor pointer
    padding 0.45rem 0.75rem
    font-size 0.8rem
    color #cbd5e1
    display flex
    align-items center
    gap 0.4rem

.facet__count
    background #6366f1
    color #fff
    border-radius 999px
    font-size 0.68rem
    padding 0 0.4rem

.chips
    display flex
    flex-wrap wrap
    gap 0.35rem
    padding 0 0.75rem 0.75rem

.chip
    background transparent
    border 1px solid rgba(255,255,255,0.12)
    color #94a3b8
    border-radius 999px
    padding 0.2rem 0.65rem
    font-size 0.75rem
    cursor pointer

    &--on
        background rgba(99,102,241,0.2)
        border-color #6366f1
        color #fff

.btn-link
    background none
    border none
    color #94a3b8
    font-size 0.8rem
    cursor pointer
    padding 0.45rem 0.25rem
    text-decoration underline

.results-meta
    color #64748b
    font-size 0.8rem
    margin 1rem 0 0.75rem

.results
    display grid
    grid-template-columns repeat(auto-fill, minmax(150px, 1fr))
    gap 0.75rem

.skin-card
    position relative
    display flex
    flex-direction column
    gap 0.25rem
    text-align left
    background #121214
    border 1px solid rgba(255,255,255,0.06)
    border-radius 10px
    padding 0.6rem
    color #fff
    cursor pointer
    font-family inherit

    &:hover:not(:disabled)
        border-color rgba(99,102,241,0.5)

    &--added
        opacity 0.45
        cursor default

.skin-card__image
    width 100%
    aspect-ratio 4 / 3
    object-fit contain

.skin-card__name
    font-size 0.8rem
    font-weight 600
    line-height 1.25

.skin-card__meta
    font-size 0.7rem
    color #64748b

.skin-card__price
    font-size 0.85rem
    font-weight 600
    color #4caf50

.skin-card__action
    position absolute
    top 0.5rem
    right 0.5rem
    background #6366f1
    border-radius 50%
    padding 0.15rem
    font-size 1.1rem

.load-more
    display block
    margin 1rem auto 0

.draft-items
    list-style none
    display flex
    flex-direction column
    gap 0.4rem
    max-height 340px
    overflow-y auto

.draft-item
    display grid
    grid-template-columns 40px minmax(0, 1fr) auto auto
    align-items center
    gap 0.5rem
    background #121214
    border-radius 8px
    padding 0.35rem 0.5rem

.draft-item__image
    width 40px
    height 30px
    object-fit contain

.draft-item__name
    font-size 0.8rem
    overflow hidden
    text-overflow ellipsis
    white-space nowrap

.draft-item__price
    font-size 0.8rem
    color #94a3b8

.draft-sum
    display flex
    justify-content space-between
    align-items center
    font-size 0.85rem
    color #94a3b8
    border-top 1px solid rgba(255,255,255,0.06)
    padding-top 0.75rem

    strong
        color #fff
        font-size 1rem

.checkbox
    display flex
    align-items center
    gap 0.5rem
    font-size 0.85rem
    color #cbd5e1
    cursor pointer

.editing-banner
    display flex
    align-items center
    gap 0.5rem
    background rgba(99,102,241,0.1)
    border 1px solid rgba(99,102,241,0.3)
    color #a5b4fc
    padding 0.6rem 0.9rem
    border-radius 8px
    font-size 0.85rem
    font-weight 600

.form-actions
    display flex
    justify-content flex-end
    gap 0.75rem

.btn-cancel
    background transparent
    color #94a3b8
    border 1px solid rgba(255,255,255,0.1)
    padding 0.6rem 1.25rem
    border-radius 8px
    font-size 0.875rem
    font-weight 600
    cursor pointer

    &:hover
        background rgba(255,255,255,0.05)
        color #fff

.btn-submit
    display inline-flex
    align-items center
    gap 0.5rem
    background #6366f1
    color #fff
    border none
    padding 0.6rem 1.5rem
    border-radius 8px
    font-size 0.875rem
    font-weight 600
    cursor pointer

    &:hover:not(:disabled)
        background #4f52d4

    &:disabled
        opacity 0.5
        cursor not-allowed

.loading-state
    padding 2rem
    text-align center
    color #94a3b8
    display flex
    align-items center
    justify-content center
    gap 0.5rem

.spin
    animation spin 1s linear infinite

@keyframes spin
    from transform rotate(0deg)
    to transform rotate(360deg)

.empty-state
    text-align center
    padding 2rem
    color #64748b

    &--compact
        padding 1rem
        font-size 0.8rem

.table-wrapper
    overflow-x auto

table
    width 100%
    border-collapse collapse

    th
        text-align left
        color #94a3b8
        font-size 0.75rem
        font-weight 500
        padding 0.6rem 0.75rem
        border-bottom 1px solid rgba(255,255,255,0.06)
        text-transform uppercase

    td
        padding 0.6rem 0.75rem
        font-size 0.875rem
        border-bottom 1px solid rgba(255,255,255,0.04)
        vertical-align middle

.thumbs
    display flex
    flex-wrap wrap
    gap 0.25rem
    max-width 320px

.thumbs__image
    width 44px
    height 33px
    object-fit contain
    background #121214
    border-radius 4px

    &--out
        opacity 0.3
        outline 1px solid #ef4444

.price-col
    font-weight 600
    color #4caf50

.status-badge
    display inline-flex
    padding 0.2rem 0.55rem
    border-radius 999px
    font-size 0.72rem
    font-weight 600
    text-transform uppercase

.badge-live
    background rgba(76,175,80,0.12)
    color #4caf50
    border 1px solid rgba(76,175,80,0.25)

.badge-sold-out
    background rgba(239,68,68,0.12)
    color #ef4444
    border 1px solid rgba(239,68,68,0.25)

.badge-paused
    background rgba(100,116,139,0.12)
    color #94a3b8
    border 1px solid rgba(100,116,139,0.25)

.action-row
    display flex
    gap 0.25rem

.btn-edit
    background transparent
    border none
    color #94a3b8
    cursor pointer
    padding 0.3rem
    border-radius 6px

    &:hover
        background rgba(255,255,255,0.08)
        color #fff

.btn-delete
    background transparent
    border none
    color #ef4444
    cursor pointer
    padding 0.3rem
    border-radius 6px

    &:hover
        background rgba(239,68,68,0.1)

@media (max-width: 1100px)
    .builder
        grid-template-columns 1fr

    .draft
        position static
</style>
