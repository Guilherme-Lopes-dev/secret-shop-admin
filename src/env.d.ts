/// <reference types="vite/client" />

import type { Dayjs } from 'dayjs'
import type dayjs from 'dayjs'
import type { formatCurrency } from '@/utils/formatCurrency'

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  /** Origem pública dos links de afiliado (/r/:code). Sem ela, cai no VITE_API_URL. */
  readonly VITE_LINK_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $dayjs: typeof dayjs
    $formatCurrency: typeof formatCurrency
  }
}
