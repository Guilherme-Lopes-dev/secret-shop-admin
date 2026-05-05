<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { authService } from '@/services/auth/auth.service'
import { api } from '@/lib/api/api'
import { toast } from 'vue3-toastify'

const router = useRouter()
const authStore = useAuthStore()

onMounted(async () => {
    console.log('[AuthCallback] mounted — isAuthenticated:', authStore.isAuthenticated, '| isAdmin:', authStore.isAdmin)
    console.log('[AuthCallback] URL:', window.location.href)
    console.log('[AuthCallback] user in store:', JSON.stringify(authStore.user))

    if (!authStore.isAuthenticated) {
        const params = new URLSearchParams(window.location.search)
        const csrfToken = params.get('csrfToken')
        console.log('[AuthCallback] not authenticated — csrfToken from URL:', csrfToken ? 'present' : 'MISSING')

        if (!csrfToken) {
            console.warn('[AuthCallback] no csrfToken in URL → redirecting to /login')
            router.push('/login')
            return
        }

        try {
            console.log('[AuthCallback] calling /users/me...')
            const { data: user } = await api.get('/users/me')
            console.log('[AuthCallback] /users/me response:', JSON.stringify(user))
            authStore.setSession(user, decodeURIComponent(csrfToken))
            console.log('[AuthCallback] session set — isAdmin now:', authStore.isAdmin)
        } catch (err: any) {
            console.error('[AuthCallback] /users/me failed:', err?.response?.status, err?.message)
            router.push('/login')
            return
        }
    }

    if (!authStore.isAdmin) {
        console.warn('[AuthCallback] user is NOT admin — user object:', JSON.stringify(authStore.user))
        await authService.logout()
        toast.error('Acesso negado. Esta área é restrita a administradores.')
        router.push('/login')
        return
    }

    console.log('[AuthCallback] OK — redirecting to /')
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
