import { api } from '@/lib/api/api'
import { useAuthStore } from '@/stores/auth.store'

const API_URL = import.meta.env.VITE_API_URL?.trim()
const API_ORIGIN = API_URL ? new URL(API_URL).origin : window.location.origin
const SELF_ORIGIN = window.location.origin
const LS_KEY = 'auth_callback'

async function bootstrapSessionFromCookies() {
  const { data: user } = await api.get('/users/me')
  const { data } = await api.get<{ csrfToken: string }>('/auth/csrf')
  const authStore = useAuthStore()
  authStore.setSession(user, data.csrfToken)
}

export const authService = {
  login(): Promise<void> {
    return new Promise((resolve, reject) => {
      const steamLoginUrl = API_URL
        ? new URL('/auth/steam', API_URL).toString()
        : `${window.location.origin}/auth/steam`

      localStorage.removeItem(LS_KEY)

      const popup = window.open(steamLoginUrl, 'steam-login', 'width=600,height=800')
      if (!popup) return reject(new Error('Falha ao abrir janela de login'))

      let timer: ReturnType<typeof setInterval>
      let loginCompleted = false
      let firstPopupClosedAt: number | null = null

      const finishLogin = async (csrfTokenHint?: string) => {
        localStorage.removeItem(LS_KEY)
        try {
          if (csrfTokenHint) {
            const { data: user } = await api.get('/users/me')
            const authStore = useAuthStore()
            authStore.setSession(user, csrfTokenHint)
          } else {
            await bootstrapSessionFromCookies()
          }
          resolve()
        } catch (err) {
          reject(err)
        }
      }

      const onMessage = async (event: MessageEvent) => {
        if (event.origin !== API_ORIGIN && event.origin !== SELF_ORIGIN) return
        if (!event.data?.success) return
        if (loginCompleted) return

        loginCompleted = true
        clearInterval(timer)
        window.removeEventListener('message', onMessage)
        popup.close()

        await finishLogin(event.data.csrfToken || undefined)
      }

      window.addEventListener('message', onMessage)

      timer = setInterval(async () => {
        if (loginCompleted) return

        const raw = localStorage.getItem(LS_KEY)
        if (raw) {
          let token: string | undefined
          try {
            const { csrfToken, ts } = JSON.parse(raw)
            if (Date.now() - ts <= 30_000) token = csrfToken
          } catch {}
          localStorage.removeItem(LS_KEY)
          if (token) {
            loginCompleted = true
            clearInterval(timer)
            window.removeEventListener('message', onMessage)
            popup.close()
            await finishLogin(token)
            return
          }
        }

        if (popup.closed) {
          if (firstPopupClosedAt === null) firstPopupClosedAt = Date.now()
          if (Date.now() - firstPopupClosedAt >= 15_000) {
            loginCompleted = true
            clearInterval(timer)
            window.removeEventListener('message', onMessage)
            reject(new Error('Login cancelado'))
          }
        } else {
          firstPopupClosedAt = null
        }
      }, 500)
    })
  },

  async logout() {
    const authStore = useAuthStore()
    await api.post('/auth/logout').catch(() => null)
    authStore.clearSession()
  },

  async bootstrapSession() {
    await bootstrapSessionFromCookies()
  },
}
