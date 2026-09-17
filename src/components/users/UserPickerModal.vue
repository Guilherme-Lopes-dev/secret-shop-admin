<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { RUNE_TYPES, runeInfo } from '@/utils/runes'
import {
    FRIENDSHIP_DURATION_PRESETS,
    FRIENDSHIP_FILTER_OPTIONS,
    friendshipDurationRange,
    friendshipIcon,
    friendshipLabel,
    friendshipTone,
} from '@/utils/friendship'

// Mesmos filtros da tela de usuários, só que pra marcar gente e devolver a lista.
// `selected` entra já marcado; quem desmarca aqui sai da lista ao aplicar.
const props = defineProps<{
    open: boolean
    selected: any[]
}>()

const emit = defineEmits<{
    (e: 'close'): void
    (e: 'apply', users: any[]): void
}>()

const TIERS = ['Common', 'Uncommon', 'Rare', 'Mythical', 'Legendary', 'Ancient', 'Immortal']

const users = ref<any[]>([])
const loading = ref(false)
const page = ref(1)
const pages = ref(1)
const total = ref(0)
const search = ref('')
const sort = ref('')
const tierRank = ref<number | ''>('')
const friendship = ref('')
const friendDuration = ref('0')
const minOrders = ref('')
const maxOrders = ref('')
const minSpent = ref('')
const maxSpent = ref('')
const runes = ref<string[]>([])
let timer: ReturnType<typeof setTimeout> | null = null

// mapa por id: sobrevive à paginação e à troca de filtro
const picked = ref(new Map<string, any>())

const toCents = (v: string) => (v ? Math.round(parseFloat(v) * 100) : undefined)
const toInt = (v: string) => (v ? parseInt(v) : undefined)

const fetchUsers = async (p = 1) => {
    loading.value = true
    try {
        const duration = friendshipDurationRange(friendDuration.value)
        const res = await adminService.getAllUsers(
            p, 15, search.value || undefined, sort.value || undefined,
            toInt(minOrders.value), toInt(maxOrders.value), toCents(minSpent.value), toCents(maxSpent.value),
            tierRank.value === '' ? undefined : tierRank.value,
            { friendship: friendship.value || undefined, minFriendDays: duration.min, maxFriendDays: duration.max },
            runes.value,
        )
        users.value = res.data.data
        page.value = res.data.page
        pages.value = res.data.pages
        total.value = res.data.total
    } catch {
        users.value = []
    } finally {
        loading.value = false
    }
}

const refetch = () => fetchUsers(1)
const debounced = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(refetch, 350)
}

const toggleRune = (type: string) => {
    runes.value = runes.value.includes(type) ? runes.value.filter((t) => t !== type) : [...runes.value, type]
    refetch()
}

const isPicked = (user: any) => picked.value.has(user.id)
const togglePick = (user: any) => {
    if (picked.value.has(user.id)) picked.value.delete(user.id)
    else picked.value.set(user.id, user)
    picked.value = new Map(picked.value)
}

const allOnPageChecked = computed(() => users.value.length > 0 && users.value.every(isPicked))
const togglePage = () => {
    const check = !allOnPageChecked.value
    users.value.forEach((user) => (check ? picked.value.set(user.id, user) : picked.value.delete(user.id)))
    picked.value = new Map(picked.value)
}

const apply = () => emit('apply', [...picked.value.values()])

watch(() => props.open, (open) => {
    if (!open) return
    picked.value = new Map(props.selected.map((user) => [user.id, user]))
    fetchUsers(1)
})
</script>

<template>
    <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
        <div class="modal">
            <header class="modal__head">
                <h2 class="modal__title"><Icon icon="mdi:account-multiple-check" /> Selecionar usuários</h2>
                <button type="button" class="modal__close" @click="emit('close')"><Icon icon="mdi:close" /></button>
            </header>

            <div class="filters">
                <div class="search-wrap">
                    <Icon icon="mdi:magnify" class="search-icon" />
                    <input v-model="search" type="search" placeholder="Nome, e-mail ou Steam ID..." class="search-input" @input="debounced" />
                </div>
                <select v-model="sort" class="filter-select" @change="refetch">
                    <option value="">Mais recente</option>
                    <option value="orders">Mais pedidos</option>
                    <option value="spent">Maior gasto</option>
                </select>
                <select v-model="tierRank" class="filter-select" @change="refetch">
                    <option value="">Todos os tiers</option>
                    <option v-for="(name, rank) in TIERS" :key="name" :value="rank">{{ name }}</option>
                </select>
                <select v-model="friendship" class="filter-select" @change="refetch">
                    <option v-for="opt in FRIENDSHIP_FILTER_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
                <select v-model="friendDuration" class="filter-select" @change="refetch">
                    <option v-for="(preset, index) in FRIENDSHIP_DURATION_PRESETS" :key="preset.label" :value="String(index)">{{ preset.label }}</option>
                </select>
                <div class="rune-filter" title="Quem pegou qualquer runa marcada">
                    <button
                        v-for="rune in RUNE_TYPES"
                        :key="rune.value"
                        type="button"
                        class="rune-filter__chip"
                        :class="{ 'rune-filter__chip--on': runes.includes(rune.value) }"
                        :title="rune.label"
                        @click="toggleRune(rune.value)"
                    >
                        <img :src="rune.image" :alt="rune.label" />
                    </button>
                </div>
                <div class="range-group">
                    <span class="range-label">Pedidos</span>
                    <input v-model="minOrders" type="number" min="0" placeholder="Mín" class="range-input" @input="debounced" />
                    <span class="range-sep">—</span>
                    <input v-model="maxOrders" type="number" min="0" placeholder="Máx" class="range-input" @input="debounced" />
                </div>
                <div class="range-group">
                    <span class="range-label">Gasto (R$)</span>
                    <input v-model="minSpent" type="number" min="0" placeholder="Mín" class="range-input" @input="debounced" />
                    <span class="range-sep">—</span>
                    <input v-model="maxSpent" type="number" min="0" placeholder="Máx" class="range-input" @input="debounced" />
                </div>
            </div>

            <div class="table-wrap">
                <div v-if="loading" class="state"><Icon icon="mdi:loading" class="spin" width="28" /></div>
                <p v-else-if="!users.length" class="state">Ninguém com esses filtros.</p>
                <table v-else class="table">
                    <thead>
                        <tr>
                            <th class="check-col"><input type="checkbox" :checked="allOnPageChecked" title="Marcar a página" @change="togglePage" /></th>
                            <th>Usuário</th>
                            <th>Tier</th>
                            <th>Amizade</th>
                            <th>Runas</th>
                            <th>Pedidos</th>
                            <th>Gasto</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="user in users" :key="user.id" :class="{ 'row--on': isPicked(user) }" @click="togglePick(user)">
                            <td class="check-col" @click.stop><input type="checkbox" :checked="isPicked(user)" @change="togglePick(user)" /></td>
                            <td>
                                <div class="user-cell">
                                    <img v-if="user.avatar" :src="user.avatar" class="avatar" alt="" />
                                    <span v-else class="avatar avatar--empty"><Icon icon="mdi:account" /></span>
                                    <div class="user-text">
                                        <strong>{{ user.username || '—' }}</strong>
                                        <small>{{ user.email || user.steam_id || user.id?.slice(0, 8) }}</small>
                                    </div>
                                </div>
                            </td>
                            <td><span class="pill">{{ user.tier_name ?? 'Common' }}</span></td>
                            <td>
                                <span class="pill" :class="`pill--${friendshipTone(user.friendship)}`">
                                    <Icon :icon="friendshipIcon(user.friendship)" /> {{ friendshipLabel(user.friendship) }}
                                </span>
                            </td>
                            <td>
                                <span class="pill" :title="(user.rune_types ?? []).map((t: string) => runeInfo(t).label).join(', ') || 'Nenhuma'">
                                    {{ user.runes_found ?? 0 }}/{{ RUNE_TYPES.length }}
                                </span>
                            </td>
                            <td>{{ user._count?.sales ?? 0 }}</td>
                            <td class="spent">{{ formatCurrency(user.total_spent ?? 0) }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <footer class="modal__foot">
                <div class="pagination">
                    <button type="button" class="page-btn" :disabled="page <= 1 || loading" @click="fetchUsers(page - 1)">Anterior</button>
                    <span class="page-info">{{ page }} / {{ pages }} · {{ total }} usuário(s)</span>
                    <button type="button" class="page-btn" :disabled="page >= pages || loading" @click="fetchUsers(page + 1)">Próxima</button>
                </div>
                <div class="actions">
                    <span class="picked-count">{{ picked.size }} selecionado(s)</span>
                    <button type="button" class="btn-ghost" @click="emit('close')">Cancelar</button>
                    <button type="button" class="btn-primary" @click="apply">Aplicar</button>
                </div>
            </footer>
        </div>
    </div>
</template>

<style lang="stylus" scoped>
.modal-backdrop
    position fixed
    inset 0
    background rgba(0,0,0,0.7)
    display flex
    align-items center
    justify-content center
    z-index 100
    backdrop-filter blur(4px)

.modal
    display flex
    flex-direction column
    width calc(100% - 2rem)
    max-width 1100px
    max-height calc(100vh - 3rem)
    background #1e1e24
    border 1px solid rgba(255,255,255,0.1)
    border-radius 14px
    color #fff

    &__head
        display flex
        align-items center
        justify-content space-between
        padding 1.25rem 1.5rem 0.75rem

    &__title
        display flex
        align-items center
        gap 0.5rem
        margin 0
        font-size 1.15rem
        font-weight 700
        color #e2e8f0

    &__close
        background none
        border none
        color #94a3b8
        font-size 1.3rem
        cursor pointer

        &:hover
            color #fff

    &__foot
        display flex
        align-items center
        justify-content space-between
        gap 1rem
        padding 0.85rem 1.5rem
        border-top 1px solid rgba(255,255,255,0.06)

.filters
    display flex
    flex-wrap wrap
    gap 0.5rem
    padding 0 1.5rem 0.85rem

.search-wrap
    position relative
    flex 1
    min-width 220px

.search-icon
    position absolute
    left 0.65rem
    top 50%
    transform translateY(-50%)
    color #64748b
    pointer-events none

.search-input, .filter-select, .range-input
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.45rem 0.7rem
    font-size 0.85rem
    outline none

    &::placeholder
        color #64748b

    &:focus
        border-color rgba(99,102,241,0.4)

.search-input
    width 100%
    padding-left 2.1rem
    box-sizing border-box

.filter-select
    cursor pointer

    option
        background #1a1a1e

.range-group
    display flex
    align-items center
    gap 0.35rem

.range-label, .range-sep
    color #64748b
    font-size 0.78rem
    white-space nowrap

.range-input
    width 80px

.rune-filter
    display inline-flex
    gap 3px
    padding 2px 5px
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px

    &__chip
        width 28px
        height 28px
        padding 2px
        border none
        border-radius 6px
        background none
        cursor pointer
        filter grayscale(1) brightness(0.55)
        opacity 0.5

        img
            width 100%
            height 100%
            object-fit contain

        &--on
            filter none
            opacity 1
            background rgba(56,189,248,0.14)

.table-wrap
    flex 1
    min-height 240px
    overflow auto
    border-top 1px solid rgba(255,255,255,0.06)

.state
    display flex
    justify-content center
    padding 3rem
    color #64748b

.spin
    animation spin 1s linear infinite

@keyframes spin
    to
        transform rotate(360deg)

.table
    width 100%
    border-collapse collapse
    font-size 0.85rem

    th, td
        padding 0.55rem 0.9rem
        text-align left
        border-bottom 1px solid rgba(255,255,255,0.04)
        white-space nowrap

    th
        position sticky
        top 0
        background #1e1e24
        color #64748b
        font-size 0.72rem
        text-transform uppercase
        letter-spacing 0.05em

    tbody tr
        cursor pointer

        &:hover
            background rgba(255,255,255,0.03)

    .row--on
        background rgba(99,102,241,0.08)

.check-col
    width 36px

    input
        cursor pointer

.user-cell
    display flex
    align-items center
    gap 0.6rem

.avatar
    width 30px
    height 30px
    border-radius 50%
    object-fit cover
    flex-shrink 0

    &--empty
        display grid
        place-items center
        background #2a2a30
        color #64748b

.user-text
    display flex
    flex-direction column
    line-height 1.2

    small
        color #64748b
        font-size 0.72rem

.pill
    display inline-flex
    align-items center
    gap 4px
    padding 2px 8px
    border-radius 999px
    background rgba(255,255,255,0.06)
    font-size 0.75rem
    font-weight 600

    &--friends
        color #4ade80
    &--not_friends
        color #f87171
    &--unknown
        color #94a3b8

.spent
    color #4caf50
    font-weight 500

.pagination
    display flex
    align-items center
    gap 0.75rem

.page-btn
    background #2a2a30
    color #fff
    border 1px solid rgba(255,255,255,0.1)
    padding 0.4rem 0.9rem
    border-radius 6px
    cursor pointer
    font-size 0.8rem

    &:disabled
        opacity 0.4
        cursor not-allowed

.page-info
    color #94a3b8
    font-size 0.8rem

.actions
    display flex
    align-items center
    gap 0.6rem

.picked-count
    color #a5b4fc
    font-size 0.85rem
    font-weight 600

.btn-ghost, .btn-primary
    padding 0.5rem 1rem
    border-radius 8px
    font-size 0.85rem
    font-weight 600
    cursor pointer

.btn-ghost
    background none
    border 1px solid rgba(255,255,255,0.12)
    color #cbd5e1

.btn-primary
    background #6366f1
    border none
    color #fff

    &:hover
        background #4f46e5
</style>
