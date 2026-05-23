<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { api } from '@/lib/api/api'

const router = useRouter()
const authStore = useAuthStore()

onMounted(async () => {
    if (!authStore.isAuthenticated) {
        const params = new URLSearchParams(window.location.search)
        const csrfToken = params.get('csrfToken')

        if (!csrfToken) {
            router.push('/login')
            return
        }

        try {
            const { data: user } = await api.get('/users/me')
            authStore.setSession(user, decodeURIComponent(csrfToken))
        } catch {
            router.push('/login')
            return
        }
    }

    router.push('/')
})
</script>

<template>
    <div class="callback-page">
        <div class="spinner" />
        <p>Autenticando...</p>
    </div>
</template>

<style lang="stylus" scoped>
.callback-page
    min-height 100vh
    background #121214
    display flex
    flex-direction column
    align-items center
    justify-content center
    gap 1rem
    color #94a3b8
    font-size 0.9rem

.spinner
    width 32px
    height 32px
    border 3px solid rgba(255,255,255,0.1)
    border-top-color #6366f1
    border-radius 50%
    animation spin 0.8s linear infinite

@keyframes spin
    to transform rotate(360deg)
</style>
