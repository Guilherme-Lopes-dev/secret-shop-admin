<script setup lang="ts">
import { ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { adminService, type SkinPriceCatalogItem } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { buildSteamImageUrl } from '@/utils/steamImage'

const DEBOUNCE_MS = 300
const MIN_CHARS = 2
const SUGGESTION_LIMIT = 8

const emit = defineEmits<{ select: [marketHashName: string] }>()

const query = ref('')
const suggestions = ref<SkinPriceCatalogItem[]>([])
const open = ref(false)
const root = ref<HTMLElement | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
let lastRequest = 0

// Só a resposta da última digitação vale: uma busca lenta não sobrescreve a mais nova.
const fetchSuggestions = async (search: string) => {
    const requestId = ++lastRequest
    const response = await adminService.searchPriceCatalog(search, SUGGESTION_LIMIT).catch(() => null)
    if (requestId !== lastRequest) return

    suggestions.value = response?.data.data ?? []
    open.value = true
}

watch(query, value => {
    clearTimeout(timer)
    const search = value.trim()
    if (search.length < MIN_CHARS) {
        suggestions.value = []
        return
    }
    timer = setTimeout(() => fetchSuggestions(search), DEBOUNCE_MS)
})

const choose = (marketHashName: string) => {
    open.value = false
    query.value = ''
    suggestions.value = []
    emit('select', marketHashName)
}

// Enter usa o texto exato: dá pra colar um market_hash_name que não está no banco.
const submitTyped = () => {
    const name = query.value.trim()
    if (name) choose(name)
}

// Tab do input pra uma sugestão não pode fechar a lista no meio do caminho.
const closeWhenLeaving = (event: FocusEvent) => {
    if (root.value?.contains(event.relatedTarget as Node | null)) return
    open.value = false
}
</script>

<template>
    <div ref="root" class="search" @focusout="closeWhenLeaving" @focusin="open = suggestions.length > 0">
        <label class="field">
            <Icon icon="mdi:magnify" class="field-icon" />
            <input
                v-model="query"
                type="search"
                placeholder="Nome do item (ex.: Fiery Soul of the Slayer) — Enter busca o nome exato"
                aria-label="Buscar item do Market"
                autocomplete="off"
                @keydown.enter.prevent="submitTyped"
                @keydown.esc="open = false"
            />
        </label>

        <ul v-if="open && suggestions.length" class="suggestions">
            <li v-for="item in suggestions" :key="item.market_hash_name">
                <button type="button" @mousedown.prevent @click="choose(item.market_hash_name)">
                    <img
                        v-if="buildSteamImageUrl(item.icon_url_large ?? item.image_url, '64fx64f')"
                        :src="buildSteamImageUrl(item.icon_url_large ?? item.image_url, '64fx64f')!"
                        alt=""
                    />
                    <span class="info">
                        <span class="name">{{ item.name ?? item.market_hash_name }}</span>
                        <span class="meta">{{ item.hero ?? 'sem herói' }}<template v-if="item.in_stock"> · em estoque</template></span>
                    </span>
                    <span class="price">{{ item.median_price != null ? formatCurrency(item.median_price) : '—' }}</span>
                </button>
            </li>
        </ul>
    </div>
</template>

<style lang="stylus" scoped>
.search
    position relative

.field
    display flex
    align-items center
    gap 0.5rem
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.1)
    border-radius 10px
    padding 0 0.9rem

    &:focus-within
        border-color #6366f1

    input
        flex 1
        min-width 0
        background none
        border none
        outline none
        color #fff
        font-size 0.95rem
        padding 0.8rem 0

.field-icon
    color #64748b
    font-size 1.2rem

.suggestions
    position absolute
    z-index 10
    top calc(100% + 4px)
    left 0
    right 0
    list-style none
    margin 0
    padding 0.35rem
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.1)
    border-radius 10px
    box-shadow 0 12px 32px rgba(0,0,0,0.5)
    max-height 420px
    overflow-y auto

    button
        width 100%
        display flex
        align-items center
        gap 0.75rem
        background none
        border none
        color inherit
        text-align left
        padding 0.45rem 0.6rem
        border-radius 8px
        cursor pointer

        &:hover, &:focus-visible
            background #2a2a30
            outline none

    img
        width 40px
        height 40px
        object-fit contain
        border-radius 6px
        background rgba(255,255,255,0.04)

.info
    flex 1
    min-width 0
    display flex
    flex-direction column

.name
    color #e2e8f0
    font-size 0.88rem
    white-space nowrap
    overflow hidden
    text-overflow ellipsis

.meta
    color #64748b
    font-size 0.75rem

.price
    color #a5b4fc
    font-size 0.82rem
    font-variant-numeric tabular-nums
</style>
