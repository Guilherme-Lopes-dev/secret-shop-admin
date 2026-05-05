import { defineStore } from 'pinia'

interface AuthUser {
  id: string
  sub?: string
  steam_id?: string
  username?: string
  avatar?: string
  email?: string
  admin?: boolean
}

interface AuthState {
  user: AuthUser | null
  csrfToken: string
  isLoading: boolean
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    csrfToken: '',
    isLoading: false,
  }),

  getters: {
    isAuthenticated: (state) => state.user !== null,
    isAdmin: (state) => state.user?.admin === true,
  },

  actions: {
    setSession(user: AuthUser, csrfToken: string) {
      this.user = user
      this.csrfToken = csrfToken
    },

    clearSession() {
      this.user = null
      this.csrfToken = ''
    },
  },
})
