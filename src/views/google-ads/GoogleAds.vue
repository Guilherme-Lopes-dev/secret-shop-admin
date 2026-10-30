<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <h1 class="page-title">Google Ads</h1>
        <p class="page-subtitle">{{ syncLabel }}</p>
      </div>
      <div class="controls">
        <div class="toggle">
          <button
            v-for="period in PERIODS"
            :key="period"
            type="button"
            :class="{ active: days === period }"
            @click="days = period"
          >
            {{ period }}d
          </button>
        </div>
        <button type="button" class="btn-ghost" :disabled="!configured || status?.syncing" @click="sync">
          <Icon icon="mdi:refresh" width="15" :class="{ spin: status?.syncing }" />
          {{ status?.syncing ? 'Sincronizando...' : 'Sincronizar' }}
        </button>
      </div>
    </header>

    <p v-if="status && !configured" class="warn">
      Google Ads não configurado no backend. Faltam as variáveis: <code>{{ status.missing_env.join(', ') }}</code>
    </p>
    <p v-else-if="status?.last_sync_error && !status.syncing" class="warn">
      Último sync falhou: {{ status.last_sync_error }}
    </p>

    <section class="section">
      <p v-if="error" class="error-msg">{{ error }}</p>
      <p v-else-if="!overview" class="hint">Carregando...</p>
      <template v-else>
        <p v-if="measurementWarning" class="warn">{{ measurementWarning }}</p>
        <div class="totals">
          <div v-for="total in totals" :key="total.label" class="total">
            <span class="total__value">{{ total.value }}</span>
            <span class="total__label">{{ total.label }}</span>
          </div>
        </div>
        <div class="canvas-wrap"><canvas ref="canvas"></canvas></div>
      </template>
    </section>

    <GoogleAdsAccess v-if="overview" :days="days" :daily="overview.daily" />

    <section class="section">
      <div class="section-head">
        <h2 class="section-title">Detalhe por nível</h2>
        <div class="toggle">
          <button
            v-for="option in LEVELS"
            :key="option.value"
            type="button"
            :class="{ active: level === option.value }"
            @click="level = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
      <p v-if="!entities.length" class="hint">Sem dados nesse período. Sincronize primeiro.</p>
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Status</th>
              <th v-for="column in COLUMNS" :key="column.key" class="num">{{ column.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entity in entities" :key="entity.resource_name">
              <td>
                <span class="entity-name">{{ entity.name }}</span>
                <span v-if="parentOf(entity)" class="hint">{{ parentOf(entity) }}</span>
              </td>
              <td><span class="status" :class="entity.status?.toLowerCase()">{{ entity.status ?? '-' }}</span></td>
              <td v-for="column in COLUMNS" :key="column.key" class="num">{{ column.format(entity[column.key]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <GoogleAdsAnalyses :disabled="!configured" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import Chart from 'chart.js/auto'
import dayjs from 'dayjs'
import { toast } from 'vue3-toastify'
import {
  adminService,
  type GoogleAdsEntity,
  type GoogleAdsLevel,
  type GoogleAdsOverview,
  type GoogleAdsStatus,
} from '@/services/admin/admin.service'
import { persistedRef } from '@/utils/persistedRef'
import GoogleAdsAccess from './GoogleAdsAccess.vue'
import GoogleAdsAnalyses from './GoogleAdsAnalyses.vue'

const PERIODS = [7, 30, 90]
const SYNC_POLL_MS = 4000
// Abaixo disso o "valor" da conversão não é venda real (a ação PURCHASE antiga manda R$1).
const MIN_REAL_TICKET_BRL = 5

const LEVELS: { value: GoogleAdsLevel; label: string }[] = [
  { value: 'campaign', label: 'Campanhas' },
  { value: 'ad_group', label: 'Grupos' },
  { value: 'ad', label: 'Anúncios' },
  { value: 'keyword', label: 'Palavras-chave' },
  { value: 'search_term', label: 'Termos de busca' },
]

const brl = (value: unknown) =>
  value == null ? '-' : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const number = (value: unknown) => (value == null ? '-' : Number(value).toLocaleString('pt-BR'))
const percent = (value: unknown) => (value == null ? '-' : `${Number(value).toLocaleString('pt-BR')}%`)
const multiple = (value: unknown) => (value == null ? '-' : `${Number(value).toLocaleString('pt-BR')}x`)

type NumericKey = 'impressions' | 'clicks' | 'ctr' | 'cost_brl' | 'cpc_brl' | 'conversions' | 'cpa_brl' | 'roas'

const COLUMNS: { key: NumericKey; label: string; format: (value: unknown) => string }[] = [
  { key: 'impressions', label: 'Impr.', format: number },
  { key: 'clicks', label: 'Cliques', format: number },
  { key: 'ctr', label: 'CTR', format: percent },
  { key: 'cost_brl', label: 'Custo', format: brl },
  { key: 'cpc_brl', label: 'CPC', format: brl },
  { key: 'conversions', label: 'Conv.', format: number },
  { key: 'cpa_brl', label: 'CPA', format: brl },
  { key: 'roas', label: 'ROAS', format: multiple },
]

const days = persistedRef('google-ads:days', 30)
const level = persistedRef<GoogleAdsLevel>('google-ads:level', 'campaign')
const status = ref<GoogleAdsStatus | null>(null)
const overview = ref<GoogleAdsOverview | null>(null)
const entities = ref<GoogleAdsEntity[]>([])
const error = ref('')
const canvas = ref<HTMLCanvasElement | null>(null)
let chart: Chart | undefined
let pollTimer: ReturnType<typeof setTimeout> | undefined

const configured = computed(() => !!status.value && !status.value.missing_env.length)

const syncLabel = computed(() => {
  const last = status.value?.last_synced_at
  if (!last) return 'Nunca sincronizado'
  return `Último sync: ${dayjs(last).format('DD/MM HH:mm')} · sync automático todo dia às 6h`
})

const sum = (key: 'cost_brl' | 'clicks' | 'conversions' | 'conversions_value') =>
  (overview.value?.campaigns ?? []).reduce((total, campaign) => total + campaign[key], 0)

const totals = computed(() => {
  const cost = sum('cost_brl')
  const conversions = sum('conversions')
  const sales = overview.value?.store_sales
  return [
    { label: 'Custo', value: brl(cost) },
    { label: 'Cliques', value: number(sum('clicks')) },
    { label: 'Conversões (Ads)', value: number(conversions) },
    { label: 'CPA (Ads)', value: conversions ? brl(cost / conversions) : '-' },
    { label: 'Valor conv. (Ads)', value: brl(sum('conversions_value')) },
    { label: 'Vendas pagas (loja)', value: number(sales?.orders) },
    { label: 'Receita (loja)', value: brl(sales?.revenue_brl) },
  ]
})

// Mesma régua que o prompt do Claude usa pra desconfiar da medição.
const measurementWarning = computed(() => {
  const conversions = sum('conversions')
  const orders = overview.value?.store_sales.orders ?? 0
  if (!conversions) return ''
  if (conversions > orders) {
    return `O Ads registrou ${number(conversions)} conversões, mas a loja teve ${number(orders)} vendas pagas no período inteiro. A conversão está contando outra coisa: CPA e ROAS daqui não valem.`
  }
  if (sum('conversions_value') / conversions < MIN_REAL_TICKET_BRL) {
    return 'O valor por conversão está perto de R$1: o Ads não recebe o valor da venda. ROAS daqui não vale.'
  }
  return ''
})

const parentOf = (entity: GoogleAdsEntity) => [entity.campaign_name, entity.ad_group_name].filter(Boolean).join(' › ')

const fetchStatus = async () => {
  const { data } = await adminService.getGoogleAdsStatus()
  status.value = data
}

const fetchOverview = async () => {
  try {
    const { data } = await adminService.getGoogleAdsOverview(days.value)
    overview.value = data
    error.value = ''
  } catch (err: any) {
    error.value = err.response?.data?.message ?? 'Não carregou os dados do Google Ads.'
  }
}

const fetchEntities = async () => {
  const { data } = await adminService.getGoogleAdsEntities(level.value, days.value)
  entities.value = data
}

const loadAll = () => Promise.all([fetchStatus(), fetchOverview(), fetchEntities()])

// Sync roda em background no backend: acompanha pelo status até soltar a flag.
const pollSync = async () => {
  // Falha de rede passageira (backend reiniciando) não pode matar o acompanhamento: tenta de novo.
  const fetched = await fetchStatus().then(() => true, () => false)
  if (!fetched || status.value?.syncing) {
    pollTimer = setTimeout(pollSync, SYNC_POLL_MS)
    return
  }
  if (status.value?.last_sync_error) {
    toast.error(status.value.last_sync_error)
    return
  }
  await loadAll()
  toast.success('Google Ads sincronizado.')
}

const sync = async () => {
  try {
    await adminService.syncGoogleAds(days.value)
    status.value = status.value && { ...status.value, syncing: true }
    pollTimer = setTimeout(pollSync, SYNC_POLL_MS)
  } catch (err: any) {
    toast.error(err.response?.data?.message ?? 'Não iniciou a sincronização.')
  }
}

const renderChart = () => {
  chart?.destroy()
  const points = overview.value?.daily ?? []
  if (!canvas.value || !points.length) return

  chart = new Chart(canvas.value, {
    data: {
      labels: points.map((point) => dayjs(point.date).format('DD/MM')),
      datasets: [
        { type: 'bar', label: 'Custo (R$)', data: points.map((point) => point.cost_brl), backgroundColor: '#6366f1', borderRadius: 4, yAxisID: 'cost' },
        { type: 'line', label: 'Conversões', data: points.map((point) => point.conversions), borderColor: '#34d399', yAxisID: 'conversions' },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        cost: { position: 'left', beginAtZero: true, grid: { color: 'rgba(255,255,255,0.07)' }, ticks: { color: '#94a3b8' } },
        conversions: { position: 'right', beginAtZero: true, grid: { display: false }, ticks: { color: '#94a3b8', precision: 0 } },
        x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
      },
    },
  })
}

watch(days, () => Promise.all([fetchOverview(), fetchEntities()]))
watch(level, fetchEntities)
watch([overview, canvas], renderChart)
onMounted(loadAll)
onUnmounted(() => {
  chart?.destroy()
  clearTimeout(pollTimer)
})
</script>

<style lang="stylus" scoped>
.view-wrap
  padding 2rem
  color #fff
  min-height 100vh

.page-header
  display flex
  align-items flex-end
  justify-content space-between
  gap 1rem
  flex-wrap wrap
  margin-bottom 2rem

.page-title
  font-size 1.8rem
  font-weight 700
  margin 0 0 4px

.page-subtitle
  font-size 0.85rem
  color rgba(255,255,255,0.45)
  margin 0

.controls
  display flex
  gap 8px
  flex-wrap wrap

.section
  background #16161a
  border 1px solid rgba(255,255,255,0.06)
  border-radius 12px
  padding 1.25rem
  margin-bottom 1.5rem
  display flex
  flex-direction column
  gap 1rem

.section-head
  display flex
  align-items center
  justify-content space-between
  gap 1rem
  flex-wrap wrap

.section-title
  font-size 1rem
  font-weight 600
  margin 0

.toggle
  display flex
  border 1px solid rgba(255,255,255,0.1)
  border-radius 7px
  overflow hidden
  button
    padding 6px 12px
    background transparent
    border none
    color rgba(255,255,255,0.55)
    font-size 0.8rem
    cursor pointer
    &.active
      background #6366f1
      color #fff

.btn-ghost
  display inline-flex
  align-items center
  gap 6px
  padding 6px 12px
  background transparent
  border 1px solid rgba(255,255,255,0.12)
  border-radius 6px
  color rgba(255,255,255,0.65)
  font-size 0.85rem
  cursor pointer
  &:hover
    background rgba(255,255,255,0.06)
  &:disabled
    opacity 0.5
    cursor not-allowed

.totals
  display grid
  grid-template-columns repeat(auto-fill, minmax(140px, 1fr))
  gap 8px

.total
  display flex
  flex-direction column
  gap 2px
  padding 10px 12px
  background rgba(0,0,0,0.25)
  border-radius 8px

.total__value
  font-size 1.2rem
  font-weight 700
  font-variant-numeric tabular-nums

.total__label
  font-size 0.75rem
  color rgba(255,255,255,0.5)

.canvas-wrap
  position relative
  height 220px

.table-wrap
  overflow-x auto

.table
  width 100%
  border-collapse collapse
  font-size 0.82rem
  th, td
    padding 8px 10px
    border-bottom 1px solid rgba(255,255,255,0.06)
    text-align left
    white-space nowrap
  th
    color rgba(255,255,255,0.5)
    font-weight 500
  .num
    text-align right
    font-variant-numeric tabular-nums
  td:first-child
    white-space normal
    min-width 220px

.entity-name
  display block

.status
  font-size 0.7rem
  padding 2px 8px
  border-radius 99px
  background rgba(255,255,255,0.08)
  &.enabled
    background rgba(52,211,153,0.15)
    color #34d399
  &.paused
    background rgba(251,191,36,0.12)
    color #fbbf24

.warn
  margin 0
  padding 10px 14px
  background rgba(251,191,36,0.08)
  border 1px solid rgba(251,191,36,0.3)
  border-radius 8px
  color #fbbf24
  font-size 0.85rem

.hint
  display block
  margin 0
  font-size 0.75rem
  color rgba(255,255,255,0.45)

.error-msg
  color #fc8181
  font-size 0.85rem
  margin 0

.spin
  animation spin 1s linear infinite

@keyframes spin
  to
    transform rotate(360deg)
</style>
