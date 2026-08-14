<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import UserPassCard from '@/components/passes/UserPassCard.vue'
import UserProgressCard from '@/components/profile-progress/UserProgressCard.vue'
import { countryName } from '@/utils/countries'

const route = useRoute()
const router = useRouter()
const user = ref<any>(null)
const loading = ref(true)
const error = ref('')

// Link de trade só se for steamcommunity https (evita href perigoso).
const tradeHref = (url?: string | null): string | null =>
    typeof url === 'string' && /^https:\/\/steamcommunity\.com\//i.test(url) ? url : null

// WhatsApp: wa.me com só dígitos do telefone.
const whatsappHref = (phone?: string | null): string | null => {
    const digits = (phone || '').replace(/\D/g, '')
    return digits.length >= 10 ? `https://wa.me/${digits}` : null
}

// Cada origem de pedido abre numa rota própria.
const ORDER_ORIGINS: Record<string, { label: string; path: string }> = {
    sale: { label: 'Skin', path: '/sales' },
    collector: { label: 'Collector', path: '/collector-orders' },
    physical: { label: 'Físico', path: '/physical-orders' },
}

const originOf = (kind: string) => ORDER_ORIGINS[kind] ?? { label: kind, path: '/sales' }

const openOrder = (order: { kind: string; uuid: string }) =>
    router.push(`${originOf(order.kind).path}/${order.uuid}`)

// Brinde é uma venda de skin — abre na mesma tela de pedido.
const openGift = (claim: { order_uuid: string }) => router.push(`/sales/${claim.order_uuid}`)

const skinThumb = (icon?: string | null): string | null =>
    icon ? `https://steamcommunity-a.akamaihd.net/economy/image/${icon}/62fx62f` : null

// Quanto o estoque saiu de graça: o pedido do brinde vale zero.
const giftCost = (claims: any[] = []) =>
    claims.reduce((total, claim) => total + (claim.item?.retail_price ?? 0), 0)

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

const toggling = ref(false)
const confirmingToggle = ref(false)

const toggleActive = async () => {
    if (!user.value) return
    if (!confirmingToggle.value) {
        confirmingToggle.value = true
        return
    }

    confirmingToggle.value = false
    toggling.value = true
    try {
        const response = await adminService.toggleUserActive(route.params.uuid as string)
        user.value = { ...user.value, is_active: response.data.is_active }
        toast.success(response.data.is_active ? 'Usuário ativado.' : 'Usuário desativado.')
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao alterar status do usuário.')
    } finally {
        toggling.value = false
    }
}

const resettingCooldown = ref(false)

const resetInventoryCooldown = async () => {
    if (!user.value) return
    resettingCooldown.value = true
    try {
        await adminService.resetInventoryCooldown(route.params.uuid as string)
        user.value = { ...user.value, last_inventory_fetch_at: null }
        toast.success('Atualização de inventário liberada.')
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao liberar atualização de inventário.')
    } finally {
        resettingCooldown.value = false
    }
}

const AVAILABLE_ROLES = [
    { value: 'seller', label: 'Vendedor', icon: 'mdi:store' },
    { value: 'affiliate', label: 'Afiliado', icon: 'mdi:link-variant' },
]

const savingRole = ref('')

const hasRole = (role: string) => Boolean(user.value?.roles?.includes(role))

// O papel de afiliado sem cadastro em /affiliates deixa o painel do usuário quebrado.
const startAffiliateSignup = () =>
    router.push({ path: '/affiliates', query: { userId: route.params.uuid as string } })

const toggleRole = async (role: string) => {
    if (!user.value || savingRole.value) return
    if (role === 'affiliate' && !hasRole(role)) return startAffiliateSignup()

    const current: string[] = user.value.roles ?? []
    const next = hasRole(role) ? current.filter((item) => item !== role) : [...current, role]

    savingRole.value = role
    try {
        const response = await adminService.setUserRoles(route.params.uuid as string, next)
        user.value = { ...user.value, roles: response.data.roles }
        toast.success('Papéis atualizados.')
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao atualizar papéis.')
    } finally {
        savingRole.value = ''
    }
}

const getStatusClass = (status: string) => {
    if (!status) return ''
    const s = status.toLowerCase()
    if (['completed', 'approved', 'paid'].includes(s)) return 'status-completed'
    // awaiting_review é brinde esperando liberação — amarelo, não vermelho.
    if (['pending', 'processing', 'awaiting_review', 'in_progress'].includes(s)) return 'status-pending'
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
                        <span class="status-badge" :class="user.is_active ? 'status-active' : 'status-inactive'">
                            {{ user.is_active ? 'Ativo' : 'Inativo' }}
                        </span>
                        <code class="hero-uuid">{{ user.id }}</code>
                    </div>
                    <div class="toggle-action">
                        <button
                            class="btn-toggle-active"
                            :class="{ 'btn-danger': user.is_active && !confirmingToggle, 'btn-success': !user.is_active && !confirmingToggle, 'btn-confirm': confirmingToggle }"
                            :disabled="toggling"
                            @click="toggleActive"
                        >
                            <Icon :icon="confirmingToggle ? 'mdi:alert' : user.is_active ? 'mdi:account-cancel' : 'mdi:account-check'" />
                            {{ toggling ? 'Aguarde...' : confirmingToggle ? 'Confirmar?' : user.is_active ? 'Desativar usuário' : 'Ativar usuário' }}
                        </button>
                        <button
                            v-if="confirmingToggle"
                            class="btn-toggle-active btn-cancel"
                            @click="confirmingToggle = false"
                        >
                            Cancelar
                        </button>
                        <button
                            class="btn-toggle-active btn-cooldown"
                            :disabled="resettingCooldown || !user.last_inventory_fetch_at"
                            :title="user.last_inventory_fetch_at ? 'Zera o cooldown de 12h para o usuário poder atualizar o inventário no trocador' : 'Usuário já pode atualizar o inventário'"
                            @click="resetInventoryCooldown"
                        >
                            <Icon icon="mdi:refresh" />
                            {{ resettingCooldown ? 'Aguarde...' : !user.last_inventory_fetch_at ? 'Inventário já liberado' : 'Liberar atualização de inventário' }}
                        </button>
                    </div>
                </div>
            </div>

            <div class="roles-card">
                <div class="roles-head">
                    <Icon icon="mdi:shield-account-outline" width="18" />
                    <span class="roles-title">Papéis de acesso</span>
                </div>
                <div class="roles-chips">
                    <button
                        v-for="role in AVAILABLE_ROLES"
                        :key="role.value"
                        class="role-chip"
                        :class="{ active: hasRole(role.value) }"
                        :disabled="savingRole !== ''"
                        @click="toggleRole(role.value)"
                    >
                        <Icon :icon="savingRole === role.value ? 'mdi:loading' : role.icon" :class="{ spin: savingRole === role.value }" />
                        {{ role.label }}
                    </button>
                </div>
                <p class="roles-hint">
                    Vendedor libera anúncios no marketplace. Afiliado abre o cadastro em Afiliados — revogar aqui não
                    suspende o cadastro nem interrompe as comissões.
                </p>
            </div>

            <div class="user-stats">
                <div class="stat-card">
                    <div class="stat-icon">
                        <Icon icon="mdi:cash-multiple" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Total Gasto (pago)</span>
                        <span class="stat-value">{{ formatCurrency(user.total_spent ?? 0) }}</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon stat-icon--blue">
                        <Icon icon="mdi:cart-outline" width="22" />
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Pedidos Pagos</span>
                        <span class="stat-value">{{ user.orders_count ?? 0 }}</span>
                    </div>
                </div>
            </div>

            <UserPassCard :user-uuid="user.id" />

            <UserProgressCard :user-uuid="user.id" />

            <div class="details-grid">
                <details class="section" open>
                    <summary class="section-title">Informações</summary>
                    <div class="info-list">
                        <div class="info-row">
                            <span class="info-label">Steam ID</span>
                            <a
                                v-if="user.steam_id"
                                class="info-value mono steam-link"
                                :href="`https://steamcommunity.com/profiles/${encodeURIComponent(user.steam_id)}`"
                                target="_blank"
                                rel="noopener noreferrer"
                            >{{ user.steam_id }}</a>
                            <code v-else class="info-value mono">—</code>
                        </div>
                        <div class="info-row">
                            <span class="info-label">E-mail</span>
                            <span class="info-value">{{ user.email || '—' }}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Contato</span>
                            <a
                                v-if="whatsappHref(user.contact)"
                                class="info-value steam-link"
                                :href="whatsappHref(user.contact)!"
                                target="_blank"
                                rel="noopener noreferrer"
                            >{{ user.contact }}</a>
                            <span v-else class="info-value">{{ user.contact || '—' }}</span>
                        </div>
                        <div class="info-row info-row--wrap">
                            <span class="info-label">Trade Link</span>
                            <a
                                v-if="tradeHref(user.trade_link)"
                                class="info-value mono trade-link-text steam-link"
                                :href="tradeHref(user.trade_link)!"
                                target="_blank"
                                rel="noopener noreferrer"
                            >{{ user.trade_link }}</a>
                            <code v-else-if="user.trade_link" class="info-value mono trade-link-text">{{ user.trade_link }}</code>
                            <span v-else class="info-value muted">—</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">País</span>
                            <span class="info-value">{{ user.country ? `${user.country} — ${countryName(user.country)}` : '—' }}</span>
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
                            <span class="info-label">Última busca de inventário (swap)</span>
                            <span class="info-value">{{ user.last_inventory_fetch_at ? $dayjs(user.last_inventory_fetch_at).format('DD/MM/YYYY HH:mm') : '—' }}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Cadastro</span>
                            <span class="info-value">{{ $dayjs(user.created_at).format('DD/MM/YYYY HH:mm') }}</span>
                        </div>
                    </div>
                </details>

                <details class="section" open>
                    <summary class="section-title">Últimos Pedidos ({{ user.recent_orders?.length ?? 0 }})</summary>
                    <div v-if="!user.recent_orders?.length" class="empty-state">Nenhum pedido.</div>
                    <div v-else class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Pedido</th>
                                    <th>Origem</th>
                                    <th>Valor</th>
                                    <th>Status</th>
                                    <th>Data</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="order in user.recent_orders"
                                    :key="`${order.kind}:${order.uuid}`"
                                    class="clickable-row"
                                    @click="openOrder(order)"
                                >
                                    <td><strong>{{ order.order_number }}</strong></td>
                                    <td>{{ originOf(order.kind).label }}</td>
                                    <td>{{ formatCurrency(order.total_amount) }}</td>
                                    <td>
                                        <span class="status-badge" :class="getStatusClass(order.payment_status)">
                                            {{ order.payment_status }}
                                        </span>
                                    </td>
                                    <td>{{ $dayjs(order.created_at).format('DD/MM/YY HH:mm') }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </details>

                <details class="section" open>
                    <summary class="section-title">
                        Brindes sorteados ({{ user.reward_claims?.length ?? 0 }})
                        <span v-if="user.reward_claims?.length" class="section-note">
                            {{ formatCurrency(giftCost(user.reward_claims)) }} em estoque
                        </span>
                    </summary>
                    <div v-if="!user.reward_claims?.length" class="empty-state">Nenhum brinde resgatado.</div>
                    <div v-else class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Nível</th>
                                    <th>Valor de vitrine</th>
                                    <th>Entrega</th>
                                    <th>Pedido</th>
                                    <th>Data</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="claim in user.reward_claims"
                                    :key="claim.order_uuid"
                                    class="clickable-row"
                                    @click="openGift(claim)"
                                >
                                    <td>
                                        <div class="gift-cell">
                                            <img
                                                v-if="skinThumb(claim.item?.icon_url_large)"
                                                :src="skinThumb(claim.item?.icon_url_large)!"
                                                class="gift-thumb"
                                                alt=""
                                            />
                                            <div v-else class="gift-thumb gift-thumb--empty">
                                                <Icon icon="mdi:gift-outline" />
                                            </div>
                                            <div>
                                                <span class="gift-name">{{ claim.item?.name || '—' }}</span>
                                                <small class="gift-hero">{{ claim.item?.hero || 'sem herói' }}</small>
                                            </div>
                                        </div>
                                    </td>
                                    <td>{{ claim.tier ?? '—' }}</td>
                                    <td>{{ formatCurrency(claim.item?.retail_price) }}</td>
                                    <td>
                                        <span class="status-badge" :class="getStatusClass(claim.fulfillment_status)">
                                            {{ claim.fulfillment_status }}
                                        </span>
                                    </td>
                                    <td><strong>{{ claim.order_number }}</strong></td>
                                    <td>{{ $dayjs(claim.created_at).format('DD/MM/YY HH:mm') }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </details>
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

.roles-card
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 12px
    padding 1rem 1.25rem
    margin-bottom 1.5rem

.roles-head
    display flex
    align-items center
    gap 0.5rem
    color #94a3b8
    margin-bottom 0.75rem

.roles-title
    font-size 0.8rem
    font-weight 600
    text-transform uppercase
    letter-spacing 0.03em

.roles-chips
    display flex
    gap 0.625rem
    flex-wrap wrap

.role-chip
    display inline-flex
    align-items center
    gap 0.45rem
    padding 0.5rem 0.9rem
    border-radius 8px
    border 1px solid rgba(255,255,255,0.08)
    background rgba(255,255,255,0.03)
    color #94a3b8
    font-size 0.85rem
    font-weight 600
    cursor pointer
    transition all 0.15s

    &:hover:not(:disabled)
        border-color rgba(255,255,255,0.18)
        color #e2e8f0

    &:disabled
        cursor default
        opacity 0.7

    &.active
        background rgba(99,102,241,0.14)
        border-color rgba(99,102,241,0.45)
        color #818cf8

.roles-hint
    margin 0.7rem 0 0
    font-size 0.75rem
    color #64748b

.spin
    animation spin 0.8s linear infinite

@keyframes spin
    to
        transform rotate(360deg)

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

// <details> nativo faz o abre/fecha — sem estado, sem JS. Só falta esconder o
// marcador padrão (que cada browser desenha diferente) e pôr a seta nossa.
summary.section-title
    display flex
    align-items center
    gap 0.5rem
    cursor pointer
    list-style none
    user-select none

    &::-webkit-details-marker
        display none

    &::before
        content '▸'
        display inline-block
        color #64748b
        font-size 0.85rem
        transition transform 0.15s

    &:hover::before
        color #94a3b8

details[open] > summary.section-title::before
    transform rotate(90deg)

// Fechado vira só a linha do título, sem sobra de espaçamento embaixo.
details.section:not([open]) > summary.section-title
    margin-bottom 0
    padding-bottom 0
    border-bottom none

.section-note
    margin-left 0.5rem
    font-size 0.8rem
    font-weight 500
    color #94a3b8

.gift-cell
    display flex
    align-items center
    gap 0.625rem

.gift-thumb
    width 40px
    height 40px
    object-fit contain
    border-radius 4px
    background rgba(255,255,255,0.04)

    &--empty
        display flex
        align-items center
        justify-content center
        color #64748b

.gift-name
    display block
    font-weight 500
    font-size 0.85rem

.gift-hero
    display block
    color #64748b
    font-size 0.73rem

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

    &.steam-link
        color #60a5fa
        cursor pointer
        text-decoration none
        &:hover
            text-decoration underline

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

.status-active
    background rgba(76,175,80,0.12)
    color #4caf50

.status-inactive
    background rgba(244,67,54,0.12)
    color #f44336

.toggle-action
    display flex
    align-items center
    gap 0.5rem
    margin-top 0.75rem

.btn-toggle-active
    display inline-flex
    align-items center
    gap 0.4rem
    padding 0.45rem 1rem
    border-radius 8px
    border none
    font-size 0.82rem
    font-weight 600
    cursor pointer
    transition all 0.15s

    &:disabled
        opacity 0.5
        cursor not-allowed

.btn-danger
    background rgba(244,67,54,0.12)
    color #f44336

    &:hover:not(:disabled)
        background rgba(244,67,54,0.22)

.btn-success
    background rgba(76,175,80,0.12)
    color #4caf50

    &:hover:not(:disabled)
        background rgba(76,175,80,0.22)

.btn-confirm
    background rgba(255,152,0,0.15)
    color #ff9800

    &:hover:not(:disabled)
        background rgba(255,152,0,0.25)

.btn-cancel
    background rgba(148,163,184,0.08)
    color #94a3b8

    &:hover
        background rgba(148,163,184,0.14)

.btn-cooldown
    background rgba(33,150,243,0.12)
    color #2196f3

    &:hover:not(:disabled)
        background rgba(33,150,243,0.22)

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
