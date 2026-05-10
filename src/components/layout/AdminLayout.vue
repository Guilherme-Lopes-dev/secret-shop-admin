<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useAuthStore } from '@/stores/auth.store'
import { authService } from '@/services/auth/auth.service'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const sidebarOpen = ref(true)

const navItems = [
    { label: 'Dashboard', icon: 'mdi:view-dashboard-outline', to: '/', name: 'dashboard' },
    { label: 'Vendas', icon: 'mdi:cart-outline', to: '/sales', name: 'sales' },
    { label: 'Usuários', icon: 'mdi:account-group-outline', to: '/users', name: 'users' },
    { label: 'Trade Offers', icon: 'mdi:swap-horizontal', to: '/trade-offers', name: 'trade-offers' },
    { label: 'Inventário', icon: 'mdi:sword', to: '/inventory', name: 'inventory' },
    { label: 'Collectors', icon: 'mdi:trophy-outline', to: '/collectors', name: 'collectors' },
    { label: 'Pedidos Collector', icon: 'mdi:receipt-text-outline', to: '/collector-orders', name: 'collector-orders' },
    // { label: 'Add Produto', icon: 'mdi:plus-circle-outline', to: '/products/create', name: 'create-product' },
]

const isActive = (item: typeof navItems[0]) => {
    if (item.name === 'dashboard') return route.path === '/'
    return route.path.startsWith(item.to)
}

const logout = async () => {
    await authService.logout()
    router.push('/login')
}
</script>

<template>
    <div class="admin-shell">
        <aside class="admin-sidebar" :class="{ collapsed: !sidebarOpen }">
            <div class="sidebar-header">
                <span v-if="sidebarOpen" class="sidebar-brand">SecretShop<span class="brand-accent">ADM</span></span>
                <button class="sidebar-toggle" @click="sidebarOpen = !sidebarOpen">
                    <Icon :icon="sidebarOpen ? 'mdi:chevron-left' : 'mdi:chevron-right'" />
                </button>
            </div>

            <nav class="sidebar-nav">
                <router-link
                    v-for="item in navItems"
                    :key="item.name"
                    :to="item.to"
                    class="nav-item"
                    :class="{ active: isActive(item) }"
                >
                    <Icon :icon="item.icon" class="nav-icon" />
                    <span v-if="sidebarOpen" class="nav-label">{{ item.label }}</span>
                </router-link>
            </nav>

            <div class="sidebar-footer">
                <div class="user-info" v-if="sidebarOpen && authStore.user">
                    <img v-if="authStore.user.avatar" :src="authStore.user.avatar" class="user-avatar" alt="" />
                    <div v-else class="user-avatar-placeholder"><Icon icon="mdi:account" /></div>
                    <span class="user-name">{{ authStore.user.username }}</span>
                </div>
                <button class="nav-item nav-item--logout" @click="logout">
                    <Icon icon="mdi:logout" class="nav-icon" />
                    <span v-if="sidebarOpen" class="nav-label">Sair</span>
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
    width 220px
    min-width 220px
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

.sidebar-nav
    flex 1
    padding 0.75rem 0
    overflow-y auto

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
    padding 0.7rem 1rem
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

@media (max-width: 768px)
    .admin-sidebar
        width 60px
        min-width 60px

        .nav-label, .sidebar-brand, .user-info
            display none
</style>
