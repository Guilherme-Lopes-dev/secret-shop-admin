import axios, { type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth.store'

const API_URL = import.meta.env.VITE_API_URL?.trim() || ''
const IS_NGROK_URL = /ngrok(-free)?\.app|ngrok-free\.dev$/i.test(
  API_URL ? new URL(API_URL).hostname : '',
)

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  withCredentials: true,
})

let refreshPromise: Promise<void> | null = null

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (IS_NGROK_URL) {
    config.headers['ngrok-skip-browser-warning'] = 'true'
  }

  const authStore = useAuthStore()
  if (authStore.csrfToken && config.method && !['get', 'head', 'options'].includes(config.method)) {
    config.headers['X-CSRF-Token'] = authStore.csrfToken
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const isRefreshEndpoint = originalRequest.url?.includes('/auth/refresh')

    if (error.response?.status !== 401 || originalRequest._retried || isRefreshEndpoint) {
      return Promise.reject(error)
    }

    originalRequest._retried = true

    if (!refreshPromise) {
      refreshPromise = api
        .post<{ csrfToken: string }>('/auth/refresh')
        .then(({ data }) => {
          const authStore = useAuthStore()
          authStore.csrfToken = data.csrfToken
        })
        .catch(async () => {
          const authStore = useAuthStore()
          authStore.clearSession()
        })
        .finally(() => {
          refreshPromise = null
        })
    }

    await refreshPromise

    const authStore = useAuthStore()
    if (!authStore.csrfToken) {
      return Promise.reject(error)
    }

    return api(originalRequest)
  },
)
