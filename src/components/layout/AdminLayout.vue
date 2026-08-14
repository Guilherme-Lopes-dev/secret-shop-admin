<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useAuthStore } from '@/stores/auth.store'
import { authService } from '@/services/auth/auth.service'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const sidebarOpen = ref(true)

// Abaixo de 768px o CSS já força o modo trilho; o JS precisa saber pra não desenhar
// cabeçalho de grupo sem largura pra rótulo.
const narrowScreenQuery = window.matchMedia('(max-width: 768px)')
const narrowScreen = ref(narrowScreenQuery.matches)
narrowScreenQuery.addEventListener('change', (event) => {
    narrowScreen.value = event.matches
})

const expanded = computed(() => sidebarOpen.value && !narrowScreen.value)

const OPEN_GROUPS_STORAGE_KEY = 'admin.sidebar.groups'

type NavItem = { label: string; icon: string; to: string; name: string }
type NavGroup = { label: string; icon: string; key: string; items: NavItem[] }

const dashboard: NavItem = {
    label: 'Dashboard',
    icon: 'mdi:view-dashboard-outline',
    to: '/',
    name: 'dashboard',
}

const navGroups: NavGroup[] = [
    {
        label: 'Vendas',
        icon: 'mdi:cart-outline',
        key: 'vendas',
        items: [
            { label: 'Vendas', icon: 'mdi:cart-outline', to: '/sales', name: 'sales' },
            { label: 'Resumo', icon: 'mdi:chart-bar', to: '/sales/summary', name: 'sales-summary' },
            { label: 'Pedidos Collector', icon: 'mdi:receipt-text-outline', to: '/collector-orders', name: 'collector-orders' },
            { label: 'Envios Dropship', icon: 'mdi:package-variant-closed', to: '/dropship-orders', name: 'dropship-orders' },
            { label: 'Pedidos Físicos', icon: 'mdi:truck-outline', to: '/physical-orders', name: 'physical-orders' },
        ],
    },
    {
        label: 'Catálogo',
        icon: 'mdi:view-grid-outline',
        key: 'catalogo',
        items: [
            { label: 'Inventário', icon: 'mdi:sword', to: '/inventory', name: 'inventory' },
            { label: 'Collectors', icon: 'mdi:trophy-outline', to: '/collectors', name: 'collectors' },
            { label: 'Catálogo Collectors', icon: 'mdi:trophy-variant-outline', to: '/collectors/catalog', name: 'collectors-catalog' },
            { label: 'Preços por Set', icon: 'mdi:treasure-chest', to: '/collectors/sets', name: 'collectors-sets' },
            { label: 'Produtos Físicos', icon: 'mdi:trophy-award', to: '/physical-products', name: 'physical-products' },
        ],
    },
    {
        label: 'Precificação',
        icon: 'mdi:cash-multiple',
        key: 'precificacao',
        items: [
            { label: 'Evolução de Preços', icon: 'mdi:chart-line', to: '/skins/prices', name: 'skins-prices' },
            { label: 'Config de Preços', icon: 'mdi:cash-edit', to: '/pricing-config', name: 'pricing-config' },
            { label: 'Market Explorer', icon: 'mdi:cloud-search-outline', to: '/market-explorer', name: 'market-explorer' },
        ],
    },
    {
        label: 'Steam & Bots',
        icon: 'mdi:robot-outline',
        key: 'steam',
        items: [
            { label: 'Bots Steam', icon: 'mdi:robot-outline', to: '/bots', name: 'bots' },
            { label: 'Trade Offers', icon: 'mdi:swap-horizontal', to: '/trade-offers', name: 'trade-offers' },
            { label: 'Trocas (Swaps)', icon: 'mdi:swap-horizontal-bold', to: '/swaps', name: 'swaps' },
            { label: 'Partidas', icon: 'mdi:gamepad-variant-outline', to: '/match-history', name: 'match-history' },
        ],
    },
    {
        label: 'Usuários',
        icon: 'mdi:account-group-outline',
        key: 'usuarios',
        items: [
            { label: 'Usuários', icon: 'mdi:account-group-outline', to: '/users', name: 'users' },
            { label: 'Secret Pass', icon: 'mdi:shield-star-outline', to: '/passes', name: 'passes' },
            { label: 'Antifraude', icon: 'mdi:shield-alert-outline', to: '/antifraud', name: 'antifraud-policy' },
        ],
    },
    {
        label: 'Afiliados',
        icon: 'mdi:account-cash-outline',
        key: 'afiliados',
        items: [
            { label: 'Afiliados', icon: 'mdi:account-cash-outline', to: '/affiliates', name: 'affiliates' },
            { label: 'Configuração', icon: 'mdi:tune-variant', to: '/affiliates/config', name: 'affiliate-config' },
            { label: 'Comissões', icon: 'mdi:percent-outline', to: '/affiliates/commissions', name: 'affiliate-commissions' },
            { label: 'Pagamentos', icon: 'mdi:cash-fast', to: '/affiliates/payouts', name: 'affiliate-payouts' },
        ],
    },
    {
        label: 'Marketing',
        icon: 'mdi:bullhorn-outline',
        key: 'marketing',
        items: [
            { label: 'Cupons', icon: 'mdi:ticket-percent-outline', to: '/coupons', name: 'coupons' },
            { label: 'Novidades', icon: 'mdi:bullhorn-outline', to: '/news', name: 'news' },
            { label: 'Feedbacks', icon: 'mdi:comment-quote-outline', to: '/feedbacks', name: 'feedbacks' },
            { label: 'WhatsApp Blast', icon: 'mdi:whatsapp', to: '/whatsapp/blast', name: 'whatsapp-blast' },
            { label: 'Recomendações', icon: 'mdi:star-shooting-outline', to: '/recommendations', name: 'recommendations' },
            { label: 'Brindes', icon: 'mdi:gift-outline', to: '/rewards', name: 'rewards' },
            { label: 'Simular brindes', icon: 'mdi:dice-multiple-outline', to: '/rewards/simulate', name: 'rewards-simulate' },
            { label: 'Discord', icon: 'mdi:discord', to: '/discord', name: 'discord' },
        ],
    },
    {
        label: 'Relatórios',
        icon: 'mdi:file-chart-outline',
        key: 'relatorios',
        items: [
            { label: 'Relatórios', icon: 'mdi:file-chart-outline', to: '/reports', name: 'reports' },
            { label: 'Histórico', icon: 'mdi:history', to: '/historico', name: 'historico' },
        ],
    },
    {
        label: 'Sistema',
        icon: 'mdi:cog-outline',
        key: 'sistema',
        items: [
            { label: 'Teste Upload', icon: 'mdi:cloud-upload-outline', to: '/uploads/test', name: 'upload-test' },
        ],
    },
]

const allItems = navGroups.flatMap((group) => group.items)

// Busca no menu: acento não pode atrapalhar ("usuarios" tem que achar "Usuários")
const normalize = (value: string) =>
    value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const searchableItems = [
    { ...dashboard, group: 'Geral' },
    ...navGroups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label }))),
]

const searchQuery = ref('')

const searchResults = computed(() => {
    const term = normalize(searchQuery.value.trim())
    if (!term) return []

    return searchableItems.filter((item) => normalize(`${item.label} ${item.group}`).includes(term))
})

const goToFirstResult = () => {
    const first = searchResults.value[0]
    if (!first) return

    router.push(first.to)
    searchQuery.value = ''
}

// Rota ativa = item de rota mais específica que casa com o path. Resolve /sales vs
// /sales/summary sem flag manual, e deixa /sales/123 acender "Vendas".
const activeItemName = computed(() => {
    const path = route.path
    if (path === '/') return dashboard.name

    const matches = allItems.filter(
        (item) => path === item.to || path.startsWith(`${item.to}/`),
    )
    if (!matches.length) return null

    return matches.reduce((best, item) => (item.to.length > best.to.length ? item : best)).name
})

const activeGroupKey = computed(
    () =>
        navGroups.find((group) =>
            group.items.some((item) => item.name === activeItemName.value),
        )?.key ?? null,
)

const openGroups = ref<Record<string, boolean>>({})

// Recolhida não tem largura pra cabeçalho: mostra todos os ícones direto.
const isGroupOpen = (key: string) => !expanded.value || openGroups.value[key] === true

const persistOpenGroups = () => {
    localStorage.setItem(OPEN_GROUPS_STORAGE_KEY, JSON.stringify(openGroups.value))
}

const toggleGroup = (key: string) => {
    openGroups.value = { ...openGroups.value, [key]: !openGroups.value[key] }
    persistOpenGroups()
}

const loadOpenGroups = () => {
    const raw = localStorage.getItem(OPEN_GROUPS_STORAGE_KEY)
    if (!raw) return

    try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') openGroups.value = parsed
    } catch {
        // preferência corrompida: começa do zero, sem quebrar o menu
    }
}

const openActiveGroup = () => {
    const key = activeGroupKey.value
    if (!key) return
    if (openGroups.value[key]) return

    openGroups.value = { ...openGroups.value, [key]: true }
}

const logout = async () => {
    await authService.logout()
    router.push('/login')
}

watch(activeGroupKey, openActiveGroup)

onMounted(() => {
    loadOpenGroups()
    openActiveGroup()
})
</script>

<template>
    <div class="admin-shell">
        <aside class="admin-sidebar" :class="{ collapsed: !expanded }">
            <div class="sidebar-header">
                <span v-if="expanded" class="sidebar-brand">SecretShop<span class="brand-accent">ADM</span></span>
                <button class="sidebar-toggle" @click="sidebarOpen = !sidebarOpen">
                    <Icon :icon="expanded ? 'mdi:chevron-left' : 'mdi:chevron-right'" />
                </button>
            </div>

            <div v-if="expanded" class="sidebar-search">
                <Icon icon="mdi:magnify" class="search-icon" />
                <input
                    v-model="searchQuery"
                    type="text"
                    class="search-input"
                    placeholder="Buscar no menu..."
                    @keydown.enter="goToFirstResult"
                    @keydown.esc="searchQuery = ''"
                />
                <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">
                    <Icon icon="mdi:close" width="14" />
                </button>
            </div>

            <nav v-if="searchQuery" class="sidebar-nav">
                <router-link
                    v-for="item in searchResults"
                    :key="item.name"
                    :to="item.to"
                    class="nav-item nav-item--result"
                    :class="{ active: activeItemName === item.name }"
                    @click="searchQuery = ''"
                >
                    <Icon :icon="item.icon" class="nav-icon" />
                    <span class="nav-label">
                        {{ item.label }}
                        <small class="result-group">{{ item.group }}</small>
                    </span>
                </router-link>

                <p v-if="!searchResults.length" class="search-empty">Nada encontrado.</p>
            </nav>

            <nav v-else class="sidebar-nav">
                <router-link
                    :to="dashboard.to"
                    class="nav-item"
                    :class="{ active: activeItemName === dashboard.name }"
                    :title="expanded ? undefined : dashboard.label"
                >
                    <Icon :icon="dashboard.icon" class="nav-icon" />
                    <span v-if="expanded" class="nav-label">{{ dashboard.label }}</span>
                </router-link>

                <div v-for="group in navGroups" :key="group.key" class="nav-group">
                    <button
                        v-if="expanded"
                        class="nav-group-header"
                        :class="{ 'has-active': activeGroupKey === group.key }"
                        @click="toggleGroup(group.key)"
                    >
                        <Icon :icon="group.icon" class="nav-icon" />
                        <span class="nav-label">{{ group.label }}</span>
                        <Icon
                            icon="mdi:chevron-down"
                            class="nav-chevron"
                            :class="{ open: isGroupOpen(group.key) }"
                        />
                    </button>

                    <div v-if="isGroupOpen(group.key)" class="nav-group-items">
                        <router-link
                            v-for="item in group.items"
                            :key="item.name"
                            :to="item.to"
                            class="nav-item nav-item--child"
                            :class="{ active: activeItemName === item.name }"
                            :title="expanded ? undefined : item.label"
                        >
                            <Icon :icon="item.icon" class="nav-icon" />
                            <span v-if="expanded" class="nav-label">{{ item.label }}</span>
                        </router-link>
                    </div>
                </div>
            </nav>

            <div class="sidebar-footer">
                <div class="user-info" v-if="expanded && authStore.user">
                    <img v-if="authStore.user.avatar" :src="authStore.user.avatar" class="user-avatar" alt="" />
                    <div v-else class="user-avatar-placeholder"><Icon icon="mdi:account" /></div>
                    <span class="user-name">{{ authStore.user.username }}</span>
                </div>
                <button class="nav-item nav-item--logout" @click="logout">
                    <Icon icon="mdi:logout" class="nav-icon" />
                    <span v-if="expanded" class="nav-label">Sair</span>
                </button>
            </div>
        </aside>

        <main class="admin-content">
            <router-view />
        </main>
    </div>
</template>

<style lang="stylus" scoped>
.admin-shell
    display flex
    min-height 100vh
    background #121214
    color #fff

.admin-sidebar
    width 230px
    min-width 230px
    background #0e0e10
    border-right 1px solid rgba(255,255,255,0.05)
    display flex
    flex-direction column
    position sticky
    top 0
    height 100vh
    overflow hidden
    transition width 0.2s ease, min-width 0.2s ease
    flex-shrink 0

    &.collapsed
        width 60px
        min-width 60px

.sidebar-header
    display flex
    align-items center
    justify-content space-between
    padding 1.25rem 1rem
    border-bottom 1px solid rgba(255,255,255,0.05)
    min-height 60px

.sidebar-brand
    font-size 1rem
    font-weight 700
    color #fff
    white-space nowrap
    overflow hidden

.brand-accent
    color #6366f1

.sidebar-toggle
    background transparent
    border none
    color #94a3b8
    cursor pointer
    padding 0.25rem
    display flex
    align-items center
    border-radius 4px
    flex-shrink 0

    &:hover
        color #fff
        background rgba(255,255,255,0.05)

.sidebar-search
    position relative
    display flex
    align-items center
    padding 0.75rem 0.75rem 0.5rem

.search-icon
    position absolute
    left 1.4rem
    font-size 1rem
    color #64748b
    pointer-events none

.search-input
    width 100%
    background rgba(255,255,255,0.04)
    border 1px solid rgba(255,255,255,0.07)
    border-radius 8px
    color #fff
    font-size 0.82rem
    padding 0.45rem 1.75rem
    outline none

    &::placeholder
        color #64748b

    &:focus
        border-color rgba(99,102,241,0.5)
        background rgba(255,255,255,0.06)

.search-clear
    position absolute
    right 1.4rem
    display flex
    background transparent
    border none
    color #64748b
    cursor pointer
    padding 0

    &:hover
        color #fff

.search-empty
    padding 0.75rem 1rem
    font-size 0.8rem
    color #64748b
    margin 0

.nav-item--result .nav-label
    display flex
    flex-direction column
    line-height 1.25

.result-group
    font-size 0.68rem
    color #64748b
    text-transform uppercase
    letter-spacing 0.04em

.sidebar-nav
    flex 1
    padding 0.5rem 0
    overflow-y auto

.nav-group
    border-top 1px solid rgba(255,255,255,0.03)
    margin-top 0.25rem
    padding-top 0.25rem

.nav-group-header
    display flex
    align-items center
    gap 0.75rem
    width 100%
    padding 0.6rem 1rem
    background transparent
    border none
    color #64748b
    font-size 0.72rem
    font-weight 600
    text-transform uppercase
    letter-spacing 0.05em
    cursor pointer
    white-space nowrap
    transition color 0.15s

    &:hover
        color #cbd5e1

    &.has-active
        color #cbd5e1

    .nav-icon
        font-size 1.05rem

.nav-chevron
    margin-left auto
    font-size 1rem
    flex-shrink 0
    transition transform 0.15s

    &.open
        transform rotate(180deg)

.sidebar-footer
    padding 0.75rem 0
    border-top 1px solid rgba(255,255,255,0.05)

.user-info
    display flex
    align-items center
    gap 0.625rem
    padding 0.6rem 1rem
    margin-bottom 0.25rem

.user-avatar
    width 28px
    height 28px
    border-radius 50%
    object-fit cover
    flex-shrink 0

.user-avatar-placeholder
    width 28px
    height 28px
    border-radius 50%
    background rgba(255,255,255,0.06)
    display flex
    align-items center
    justify-content center
    color #64748b
    flex-shrink 0

.user-name
    font-size 0.8rem
    color #cbd5e1
    white-space nowrap
    overflow hidden
    text-overflow ellipsis

.nav-item
    display flex
    align-items center
    gap 0.75rem
    padding 0.65rem 1rem
    color #94a3b8
    text-decoration none
    font-size 0.875rem
    font-weight 500
    transition all 0.15s
    white-space nowrap
    border-left 3px solid transparent
    cursor pointer
    background transparent
    border-top none
    border-right none
    border-bottom none
    width 100%

    &:hover
        color #fff
        background rgba(255,255,255,0.04)

    &.active
        color #6366f1
        background rgba(99, 102, 241, 0.08)
        border-left-color #6366f1

    &--child
        padding-left 1.75rem
        font-size 0.84rem

    &--logout
        color #64748b

        &:hover
            color #f44336
            background rgba(244,67,54,0.06)

.nav-icon
    font-size 1.25rem
    flex-shrink 0

.nav-label
    overflow hidden
    text-overflow ellipsis

.admin-content
    flex 1
    min-width 0
    overflow auto

.admin-sidebar.collapsed
    .nav-item--child
        padding-left 1rem

    .nav-group
        margin-top 0.35rem
        padding-top 0.35rem

@media (max-width: 768px)
    .admin-sidebar
        width 60px
        min-width 60px

        .nav-label, .sidebar-brand, .user-info
            display none

        .nav-item--child
            padding-left 1rem
</style>
