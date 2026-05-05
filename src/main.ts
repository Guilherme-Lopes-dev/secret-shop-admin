import { createApp } from 'vue'
import App from './App.vue'
import { router } from '@/router'
import { createPinia } from 'pinia'
import dayjs from 'dayjs'
import { Icon } from '@iconify/vue'
import Vue3Toastify, { type ToastContainerOptions } from 'vue3-toastify'
import { formatCurrency } from '@/utils/formatCurrency'
import 'vue3-toastify/dist/index.css'

const app = createApp(App)

app.use(router)
app.use(createPinia())
app.use(Vue3Toastify, {
  autoClose: 2600,
  position: 'bottom-left',
  theme: 'dark',
} as ToastContainerOptions)

app.component('Icon', Icon)
app.config.globalProperties.$formatCurrency = formatCurrency
app.config.globalProperties.$dayjs = dayjs

app.mount('#app')
