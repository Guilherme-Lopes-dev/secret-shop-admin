<script setup lang="ts">
import { onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'

const handleLogin = () => {
    const apiUrl = import.meta.env.VITE_API_URL?.trim()
    const steamLoginUrl = apiUrl
        ? `${apiUrl}/auth/steam/admin`
        : `${window.location.origin}/auth/steam/admin`
    window.location.href = steamLoginUrl
}

onMounted(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'not_admin') {
        toast.error('Acesso negado. Esta área é restrita a administradores.')
    }
})
</script>

<template>
    <div class="login-page">
        <div class="login-card">
            <div class="brand">
                SecretShop<span class="accent">ADM</span>
            </div>
            <p class="subtitle">Painel Administrativo</p>

            <button class="btn-steam" @click="handleLogin">
                <Icon icon="mdi:steam" />
                Entrar com Steam
            </button>

            <p class="disclaimer">Acesso restrito a administradores.</p>
        </div>
    </div>
</template>

<style lang="stylus" scoped>
.login-page
    min-height 100vh
    background #121214
    display flex
    align-items center
    justify-content center

.login-card
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.07)
    border-radius 16px
    padding 3rem 2.5rem
    width 100%
    max-width 380px
    text-align center
    display flex
    flex-direction column
    align-items center
    gap 1rem

.brand
    font-size 1.75rem
    font-weight 800
    color #fff
    letter-spacing -0.5px

.accent
    color #6366f1

.subtitle
    color #64748b
    font-size 0.9rem
    margin-top -0.25rem

.btn-steam
    display inline-flex
    align-items center
    gap 0.6rem
    background #171a21
    color #fff
    border 1px solid rgba(255,255,255,0.1)
    padding 0.75rem 2rem
    border-radius 10px
    font-size 1rem
    font-weight 600
    cursor pointer
    transition all 0.2s
    margin-top 0.5rem
    width 100%
    justify-content center

    &:hover:not(:disabled)
        background #1e2433
        border-color rgba(255,255,255,0.2)

.disclaimer
    font-size 0.78rem
    color #475569
    margin-top 0.25rem
</style>
