<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { adminService } from '@/services/admin/admin.service'
import { Icon } from '@iconify/vue'

const router = useRouter()
const users = ref<any[]>([])
const loading = ref(true)
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const limit = ref(20)
const search = ref('')
let searchTimeout: ReturnType<typeof setTimeout> | null = null

const fetchUsers = async (page: number) => {
    loading.value = true
    try {
        const response = await adminService.getAllUsers(page, limit.value, search.value || undefined)
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

const onSearchInput = () => {
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => fetchUsers(1), 400)
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
            <div class="search-box">
                <Icon icon="mdi:magnify" class="search-icon" />
                <input
                    v-model="search"
                    @input="onSearchInput"
                    type="text"
                    placeholder="Buscar por nome, e-mail ou Steam ID..."
                    class="search-input"
                />
            </div>
        </header>

        <div class="section">
            <div v-if="loading" class="loading-state">Carregando usuários...</div>
            <div v-else>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Usuário</th>
                                <th>Steam ID</th>
                                <th>E-mail</th>
                                <th>Pedidos</th>
                                <th>Role</th>
                                <th>Cadastro</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
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
                                <td colspan="7" class="empty-state">Nenhum usuário encontrado.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="pagination" v-if="totalPages > 1">
                    <button class="page-btn" :disabled="currentPage === 1" @click="prevPage">Anterior</button>
                    <span class="page-info">Página {{ currentPage }} de {{ totalPages }}</span>
                    <button class="page-btn" :disabled="currentPage === totalPages" @click="nextPage">Próxima</button>
                </div>
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

.search-box
    display flex
    align-items center
    gap 0.5rem
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    padding 0.5rem 0.75rem

.search-icon
    color #64748b
    font-size 1.1rem
    flex-shrink 0

.search-input
    background transparent
    border none
    outline none
    color #fff
    font-size 0.875rem
    width 260px

    &::placeholder
        color #64748b

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
</style>
