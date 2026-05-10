<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { Icon } from '@iconify/vue'

const route = useRoute()
const router = useRouter()
const user = ref<any>(null)
const loading = ref(true)
const error = ref('')

const fetchUser = async () => {
    loading.value = true
    error.value = ''
    try {
        const response = await adminService.getUserById(route.params.uuid as string)
        if (response.data) user.value = response.data
    } catch (e: any) {
        error.value = e?.response?.data?.message || 'Erro ao carregar usuário.'
    } finally {
        loading.value = false
    }
}

const getStatusClass = (status: string) => {
    if (!status) return ''
    const s = status.toLowerCase()
    if (['completed', 'approved', 'paid'].includes(s)) return 'status-completed'
    if (['pending', 'processing'].includes(s)) return 'status-pending'
    return 'status-canceled'
}

onMounted(fetchUser)
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <button class="btn-back" @click="router.push('/users')">
                <Icon icon="mdi:arrow-left" /> Usuários
            </button>
        </header>

        <div v-if="loading" class="loading-state">Carregando usuário...</div>
        <div v-else-if="error" class="error-state">{{ error }}</div>

        <template v-else-if="user">
            <div class="user-hero">
                <img v-if="user.avatar" :src="user.avatar" class="hero-avatar" alt="" />
                <div v-else class="hero-avatar-placeholder">
                    <Icon icon="mdi:account" style="font-size: 2.5rem;" />
                </div>
                <div class="hero-info">
                    <h1 class="hero-name">{{ user.username || 'Sem nome' }}</h1>
                    <div class="hero-meta">
                        <span class="status-badge" :class="user.admin ? 'status-admin' : 'status-user'">
                            {{ user.admin ? 'Administrador' : 'Usuário' }}
                        </span>
                        <code class="hero-uuid">{{ user.id }}</code>
                    </div>
                </div>
            </div>

            <div class="user-stats">
                <div class="stat-card">
                    <div class="stat-icon">
                        <Icon icon="mdi:cash-multiple" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Total Gasto</span>
                        <span class="stat-value">{{ formatCurrency(user.total_spent ?? 0) }}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon stat-icon--blue">
                        <Icon icon="mdi:cart-outline" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Total de Pedidos</span>
                        <span class="stat-value">{{ user._count?.sales ?? 0 }}</span>
                    </div>
                </div>
            </div>

            <div class="details-grid">
                <div class="section">
                    <h2 class="section-title">Informações</h2>
                    <div class="info-list">
                        <div class="info-row">
                            <span class="info-label">Steam ID</span>
                            <code class="info-value mono">{{ user.steam_id || '—' }}</code>
                        </div>
                        <div class="info-row">
                            <span class="info-label">E-mail</span>
                            <span class="info-value">{{ user.email || '—' }}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Contato</span>
                            <span class="info-value">{{ user.contact || '—' }}</span>
                        </div>
                        <div class="info-row info-row--wrap">
                            <span class="info-label">Trade Link</span>
                            <code v-if="user.trade_link" class="info-value mono trade-link-text">{{ user.trade_link }}</code>
                            <span v-else class="info-value muted">—</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">País</span>
                            <span class="info-value">{{ user.country || '—' }}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Último IP</span>
                            <code class="info-value mono">{{ user.last_ip || '—' }}</code>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Risk Score</span>
                            <span class="info-value" :style="{ color: user.risk_score > 50 ? '#f44336' : '#4caf50' }">
                                {{ user.risk_score ?? 0 }}
                            </span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Cadastro</span>
                            <span class="info-value">{{ $dayjs(user.created_at).format('DD/MM/YYYY HH:mm') }}</span>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <h2 class="section-title">Últimos Pedidos ({{ user.sales?.length ?? 0 }})</h2>
                    <div v-if="!user.sales?.length" class="empty-state">Nenhum pedido.</div>
                    <div v-else class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Pedido</th>
                                    <th>Valor</th>
                                    <th>Status</th>
                                    <th>Data</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="sale in user.sales"
                                    :key="sale.uuid ?? sale.id"
                                    class="clickable-row"
                                    @click="router.push(`/sales/${sale.uuid ?? sale.id}`)"
                                >
                                    <td><strong>{{ sale.order_number }}</strong></td>
                                    <td>{{ formatCurrency(sale.total_amount) }}</td>
                                    <td>
                                        <span class="status-badge" :class="getStatusClass(sale.payment_status)">
                                            {{ sale.payment_status }}
                                        </span>
                                    </td>
                                    <td>{{ $dayjs(sale.created_at).format('DD/MM/YY HH:mm') }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </template>
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

.btn-back
    display inline-flex
    align-items center
    gap 0.4rem
    background transparent
    border none
    color #94a3b8
    cursor pointer
    font-size 0.875rem
    padding 0.4rem 0.5rem
    border-radius 6px
    transition all 0.15s

    &:hover
        color #fff
        background rgba(255,255,255,0.05)

.loading-state
    padding 3rem
    text-align center
    color #94a3b8

.error-state
    padding 3rem
    text-align center
    color #f44336

.user-hero
    display flex
    align-items center
    gap 1.25rem
    margin-bottom 2rem

.hero-avatar
    width 72px
    height 72px
    border-radius 50%
    object-fit cover
    border 2px solid rgba(99,102,241,0.3)

.hero-avatar-placeholder
    width 72px
    height 72px
    border-radius 50%
    background rgba(255,255,255,0.05)
    display flex
    align-items center
    justify-content center
    color #64748b

.hero-name
    font-size 1.6rem
    font-weight 700
    margin-bottom 0.4rem

.hero-meta
    display flex
    align-items center
    gap 0.75rem
    flex-wrap wrap

.hero-uuid
    font-family monospace
    font-size 0.78rem
    color #64748b

.user-stats
    display flex
    gap 1rem
    margin-bottom 1.5rem
    flex-wrap wrap

.stat-card
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 12px
    padding 1rem 1.25rem
    display flex
    align-items center
    gap 0.875rem
    min-width 180px

.stat-icon
    width 42px
    height 42px
    border-radius 9px
    background rgba(76,175,80,0.12)
    color #4caf50
    display flex
    align-items center
    justify-content center
    flex-shrink 0

    &--blue
        background rgba(33,150,243,0.12)
        color #2196f3

.stat-info
    display flex
    flex-direction column

.stat-label
    font-size 0.78rem
    color #64748b
    margin-bottom 0.15rem

.stat-value
    font-size 1.1rem
    font-weight 700
    color #e2e8f0

.details-grid
    display grid
    grid-template-columns 1fr 1.5fr
    gap 1.5rem

    @media (max-width: 900px)
        grid-template-columns 1fr

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.section-title
    font-size 1rem
    font-weight 600
    margin-bottom 1.25rem
    padding-bottom 0.75rem
    border-bottom 1px solid rgba(255,255,255,0.05)

.info-list
    display flex
    flex-direction column

.info-row
    display flex
    justify-content space-between
    align-items center
    padding 0.6rem 0
    border-bottom 1px solid rgba(255,255,255,0.04)

    &:last-child
        border-bottom none

    &--wrap
        align-items flex-start
        flex-wrap wrap
        gap 0.4rem

.info-label
    color #64748b
    font-size 0.8rem

.info-value
    font-size 0.875rem
    color #e2e8f0

    &.mono
        font-family monospace
        background rgba(255,255,255,0.04)
        padding 1px 5px
        border-radius 4px
        font-size 0.78rem

    &.muted
        color #64748b

.trade-link-text
    max-width 100%
    word-break break-all
    white-space normal

.info-link
    color #6366f1
    text-decoration none
    font-size 0.875rem

    &:hover
        text-decoration underline

.table-wrapper
    overflow-x auto

table
    width 100%
    border-collapse collapse

    th
        text-align left
        color #64748b
        font-size 0.75rem
        font-weight 500
        padding 0.5rem
        border-bottom 1px solid rgba(255,255,255,0.05)
        text-transform uppercase

    td
        padding 0.65rem 0.5rem
        font-size 0.85rem
        border-bottom 1px solid rgba(255,255,255,0.04)
        vertical-align middle

.clickable-row
    cursor pointer
    transition background 0.15s

    &:hover
        background rgba(255,255,255,0.02)

.status-badge
    padding 3px 7px
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

.status-completed
    background rgba(76,175,80,0.1)
    color #4caf50

.status-pending
    background rgba(255,152,0,0.1)
    color #ff9800

.status-canceled
    background rgba(244,67,54,0.1)
    color #f44336

.empty-state
    text-align center
    padding 2rem
    color #64748b
    font-size 0.875rem
</style>
