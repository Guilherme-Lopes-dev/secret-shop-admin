<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { Icon } from '@iconify/vue'

const router = useRouter()
const users = ref<any[]>([])
const loading = ref(true)
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const limit = ref(20)
const search = ref('')
const sortFilter = ref('')
const minOrdersInput = ref('')
const maxOrdersInput = ref('')
const minSpentInput = ref('')
const maxSpentInput = ref('')
let searchTimeout: ReturnType<typeof setTimeout> | null = null

const sortOptions = [
    { label: 'Mais recente', value: '' },
    { label: 'Mais pedidos', value: 'orders' },
    { label: 'Maior gasto', value: 'spent' },
]

const fetchUsers = async (page: number) => {
    loading.value = true
    try {
        const minOrders = minOrdersInput.value ? parseInt(minOrdersInput.value) : undefined
        const maxOrders = maxOrdersInput.value ? parseInt(maxOrdersInput.value) : undefined
        const minSpent = minSpentInput.value ? Math.round(parseFloat(minSpentInput.value) * 100) : undefined
        const maxSpent = maxSpentInput.value ? Math.round(parseFloat(maxSpentInput.value) * 100) : undefined

        const response = await adminService.getAllUsers(
            page,
            limit.value,
            search.value || undefined,
            sortFilter.value || undefined,
            minOrders,
            maxOrders,
            minSpent,
            maxSpent,
        )
        if (response.data) {
            users.value = response.data.data
            totalPages.value = response.data.pages
            totalItems.value = response.data.total
            currentPage.value = response.data.page
        }
    } catch (error) {
        console.error('Erro ao buscar usuários:', error)
    } finally {
        loading.value = false
    }
}

let filterTimeout: ReturnType<typeof setTimeout> | null = null

const onFilterChange = () => fetchUsers(1)
const onFilterInput = () => {
    if (filterTimeout) clearTimeout(filterTimeout)
    filterTimeout = setTimeout(() => fetchUsers(1), 300)
}
const onSearchInput = () => {
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => fetchUsers(1), 200)
}

const nextPage = () => { if (currentPage.value < totalPages.value) fetchUsers(currentPage.value + 1) }
const prevPage = () => { if (currentPage.value > 1) fetchUsers(currentPage.value - 1) }

onMounted(() => fetchUsers(1))
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Usuários</h1>
                <p class="page-subtitle">{{ totalItems }} usuários cadastrados</p>
            </div>
        </header>

        <div class="filters-row">
            <div class="search-wrap">
                <Icon icon="mdi:magnify" class="search-icon" />
                <input
                    v-model="search"
                    @input="onSearchInput"
                    type="text"
                    placeholder="Buscar por nome, e-mail ou Steam ID..."
                    class="search-input"
                />
            </div>
            <select v-model="sortFilter" @change="onFilterChange" class="filter-select">
                <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <div class="range-group">
                <span class="range-label">Pedidos</span>
                <input
                    v-model="minOrdersInput"
                    @input="onFilterInput"
                    type="number"
                    min="0"
                    placeholder="Mín"
                    class="range-input"
                />
                <span class="range-sep">—</span>
                <input
                    v-model="maxOrdersInput"
                    @input="onFilterInput"
                    type="number"
                    min="0"
                    placeholder="Máx"
                    class="range-input"
                />
            </div>
            <div class="range-group">
                <span class="range-label">Gasto (R$)</span>
                <input
                    v-model="minSpentInput"
                    @input="onFilterInput"
                    type="number"
                    min="0"
                    placeholder="Mín"
                    class="range-input"
                />
                <span class="range-sep">—</span>
                <input
                    v-model="maxSpentInput"
                    @input="onFilterInput"
                    type="number"
                    min="0"
                    placeholder="Máx"
                    class="range-input"
                />
            </div>
        </div>

        <div class="section">
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Usuário</th>
                            <th>Steam ID</th>
                            <th>E-mail</th>
                            <th>Pedidos</th>
                            <th>Valor Gasto</th>
                            <th>Role</th>
                            <th>Cadastro</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        <template v-if="loading">
                            <tr v-for="n in limit" :key="n" class="skeleton-row">
                                <td>
                                    <div class="user-cell">
                                        <div class="skeleton skeleton-avatar" />
                                        <div>
                                            <div class="skeleton skeleton-line" style="width: 100px" />
                                            <div class="skeleton skeleton-line" style="width: 60px; margin-top: 4px" />
                                        </div>
                                    </div>
                                </td>
                                <td><div class="skeleton skeleton-line" style="width: 120px" /></td>
                                <td><div class="skeleton skeleton-line" style="width: 140px" /></td>
                                <td><div class="skeleton skeleton-line" style="width: 40px" /></td>
                                <td><div class="skeleton skeleton-line" style="width: 70px" /></td>
                                <td><div class="skeleton skeleton-line" style="width: 50px" /></td>
                                <td><div class="skeleton skeleton-line" style="width: 80px" /></td>
                                <td><div class="skeleton skeleton-line" style="width: 40px" /></td>
                            </tr>
                        </template>
                        <template v-else>
                            <tr v-for="user in users" :key="user.id">
                                <td>
                                    <div class="user-cell">
                                        <img v-if="user.avatar" :src="user.avatar" class="user-avatar" alt="" />
                                        <div v-else class="user-avatar-placeholder">
                                            <Icon icon="mdi:account" />
                                        </div>
                                        <div>
                                            <span class="user-name">{{ user.username || '—' }}</span>
                                            <small class="user-uuid">{{ user.id?.substring(0, 8) ?? '—' }}</small>
                                        </div>
                                    </div>
                                </td>
                                <td><code class="mono">{{ user.steam_id || '—' }}</code></td>
                                <td>{{ user.email || '—' }}</td>
                                <td><span class="count-badge">{{ user._count?.sales ?? 0 }}</span></td>
                                <td class="spent-cell">{{ formatCurrency(user.total_spent ?? 0) }}</td>
                                <td>
                                    <span class="status-badge" :class="user.admin ? 'status-admin' : 'status-user'">
                                        {{ user.admin ? 'Admin' : 'User' }}
                                    </span>
                                </td>
                                <td>{{ $dayjs(user.created_at).format('DD/MM/YYYY') }}</td>
                                <td>
                                    <button class="btn-view" @click="router.push(`/users/${user.id}`)">Ver</button>
                                </td>
                            </tr>
                            <tr v-if="users.length === 0">
                                <td colspan="8" class="empty-state">Nenhum usuário encontrado.</td>
                            </tr>
                        </template>
                    </tbody>
                </table>
            </div>

            <div class="pagination" v-if="!loading && totalPages > 1">
                <button class="page-btn" :disabled="currentPage === 1" @click="prevPage">Anterior</button>
                <span class="page-info">Página {{ currentPage }} de {{ totalPages }}</span>
                <button class="page-btn" :disabled="currentPage === totalPages" @click="nextPage">Próxima</button>
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

.range-group
    display flex
    align-items center
    gap 0.4rem

.range-label
    color #64748b
    font-size 0.78rem
    white-space nowrap

.range-input
    width 90px
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.5rem 0.6rem
    font-size 0.875rem
    outline none

    &::placeholder
        color #64748b

    &:focus
        border-color rgba(99,102,241,0.4)

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button
        -webkit-appearance none

.range-sep
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

.table-wrapper
    overflow-x auto
    margin-bottom 1.5rem

table
    width 100%
    border-collapse collapse

    th
        text-align left
        color #94a3b8
        font-size 0.78rem
        font-weight 500
        padding 0.75rem
        border-bottom 1px solid rgba(255,255,255,0.05)
        white-space nowrap
        text-transform uppercase

    td
        padding 0.85rem 0.75rem
        font-size 0.875rem
        border-bottom 1px solid rgba(255,255,255,0.04)
        vertical-align middle

.user-cell
    display flex
    align-items center
    gap 0.625rem

.user-avatar
    width 32px
    height 32px
    border-radius 50%
    object-fit cover

.user-avatar-placeholder
    width 32px
    height 32px
    border-radius 50%
    background rgba(255,255,255,0.06)
    display flex
    align-items center
    justify-content center
    color #64748b

.user-name
    display block
    font-weight 500

.user-uuid
    display block
    color #64748b
    font-size 0.72rem

.mono
    font-family monospace
    font-size 0.8rem
    color #94a3b8

.count-badge
    background rgba(99,102,241,0.12)
    color #6366f1
    padding 2px 8px
    border-radius 4px
    font-size 0.8rem
    font-weight 600

.spent-cell
    color #4caf50
    font-weight 500
    font-size 0.82rem

.status-badge
    padding 3px 8px
    border-radius 5px
    font-size 0.72rem
    font-weight 600
    text-transform uppercase

.status-admin
    background rgba(99,102,241,0.15)
    color #818cf8

.status-user
    background rgba(148,163,184,0.08)
    color #94a3b8

.btn-view
    background rgba(99,102,241,0.1)
    color #6366f1
    border none
    padding 0.4rem 0.9rem
    border-radius 6px
    font-size 0.82rem
    font-weight 500
    cursor pointer
    transition all 0.2s

    &:hover
        background rgba(99,102,241,0.2)

.empty-state
    text-align center
    padding 3rem
    color #94a3b8

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
    font-size 0.875rem

.skeleton
    background linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)
    background-size 200% 100%
    border-radius 4px
    animation skeleton-shimmer 1.4s infinite

.skeleton-avatar
    width 32px
    height 32px
    border-radius 50%
    flex-shrink 0

.skeleton-line
    height 12px

.skeleton-row td
    border-bottom 1px solid rgba(255,255,255,0.04)

@keyframes skeleton-shimmer
    0%
        background-position 200% 0
    100%
        background-position -200% 0
</style>
