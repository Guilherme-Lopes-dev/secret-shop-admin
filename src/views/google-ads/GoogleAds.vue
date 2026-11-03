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
        <p v-if="smallSample" class="note">
          Amostra pequena: {{ number(sum('clicks')) }} cliques e {{ number(sum('conversions')) }} compra(s) atribuída(s)
          ao anúncio no período. Com esse volume uma venda muda CPA e ROAS inteiros: use pra tendência, não pra cortar
          campanha. O Ads põe a compra no dia do clique e só conta quem clicou no anúncio.
        </p>
        <div v-for="group in totalGroups" :key="group.title" class="group">
          <h3 class="group-title">{{ group.title }}</h3>
          <div class="totals">
            <div v-for="total in group.totals" :key="total.label" class="total">
              <span class="total__value">{{ total.value }}</span>
              <span class="total__label">{{ total.label }}</span>
            </div>
          </div>
        </div>
        <div class="canvas-wrap"><canvas ref="canvas"></canvas></div>
      </template>
    </section>

    <GoogleAdsCustomers v-if="overview" :customers="overview.new_customers" />

    <GoogleAdsAccess v-if="overview" :daily="overview.daily" :access="overview.site_access" />

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
              <th
                v-for="column in COLUMNS"
                :key="column.key"
                class="num"
                :class="{ muted: isMuted(column) }"
                :title="isMuted(column) ? 'Menos de 10 compras no período: não decide nada' : undefined"
              >
                {{ column.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entity in entities" :key="entity.resource_name">
              <td>
                <span class="entity-name">{{ entity.name }}</span>
                <span v-if="parentOf(entity)" class="hint">{{ parentOf(entity) }}</span>
              </td>
              <td><span class="status" :class="entity.status?.toLowerCase()">{{ entity.status ?? '-' }}</span></td>
              <td v-for="column in COLUMNS" :key="column.key" class="num" :class="{ muted: isMuted(column) }">
                {{ column.format(entity[column.key]) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <GoogleAdsAnalyses :disabled="!configured" :apply-enabled="!!status?.apply_enabled" />
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
import GoogleAdsCustomers from './GoogleAdsCustomers.vue'

const PERIODS = [7, 30, 90]
const SYNC_POLL_MS = 4000
// Abaixo disso uma venda a mais ou a menos vira o CPA/ROAS do avesso.
const MIN_CONVERSIONS_TO_DECIDE = 10

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

type Column = { key: NumericKey; label: string; format: (value: unknown) => string; needsSample?: boolean }

const COLUMNS: Column[] = [
  { key: 'impressions', label: 'Impr.', format: number },
  { key: 'clicks', label: 'Cliques', format: number },
  { key: 'ctr', label: 'CTR', format: percent },
  { key: 'cost_brl', label: 'Custo', format: brl },
  { key: 'cpc_brl', label: 'CPC', format: brl },
  { key: 'conversions', label: 'Compras', format: number, needsSample: true },
  { key: 'cpa_brl', label: 'CPA', format: brl, needsSample: true },
  { key: 'roas', label: 'ROAS', format: multiple, needsSample: true },
]

const days = persistedRef('google-ads:days', 30)
// Termo de busca é onde se corta desperdício; campanha, com uma só ativa, repete o topo.
const level = persistedRef<GoogleAdsLevel>('google-ads:level', 'search_term')
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

const sum = (key: 'cost_brl' | 'clicks' | 'impressions' | 'conversions' | 'conversions_value') =>
  (overview.value?.campaigns ?? []).reduce((total, campaign) => total + campaign[key], 0)

const ratioText = (part: number, whole: number) =>
  whole ? `${((part / whole) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '-'

const smallSample = computed(() => sum('conversions') < MIN_CONVERSIONS_TO_DECIDE)

const isMuted = (column: Column) => !!column.needsSample && smallSample.value

// Dia sem visitante registrado (antes de site_visits existir) inflaria a fatia com cliques sem denominador.
const trafficShare = computed(() => {
  const clicksByDay = new Map((overview.value?.daily ?? []).map((point) => [point.date, point.clicks]))
  const measured = (overview.value?.site_access ?? []).filter((day) => day.visitors > 0)
  const visitors = measured.reduce((total, day) => total + day.visitors, 0)
  const clicks = measured.reduce((total, day) => total + (clicksByDay.get(day.day) ?? 0), 0)
  return ratioText(clicks, visitors)
})

const trafficTotals = () => {
  const clicks = sum('clicks')
  return [
    { label: 'Gasto', value: brl(sum('cost_brl')) },
    { label: 'Cliques', value: number(clicks) },
    { label: 'CPC médio', value: clicks ? brl(sum('cost_brl') / clicks) : '-' },
    { label: 'CTR', value: ratioText(clicks, sum('impressions')) },
    { label: 'Fatia do tráfego do site', value: trafficShare.value },
  ]
}

const fromAdsText = (customers: GoogleAdsOverview['new_customers']) =>
  customers.tracked ? number(customers.from_ads) : 'sem registro ainda'

const resultTotals = () => {
  const { store_sales: sales, new_customers: customers } = overview.value!
  return [
    { label: 'Compras do anúncio', value: `${number(sum('conversions'))} · ${brl(sum('conversions_value'))}` },
    { label: 'Clientes novos (loja, todos os canais)', value: number(customers.count) },
    { label: 'Clientes novos que clicaram no anúncio', value: fromAdsText(customers) },
    { label: 'Gasto ÷ clientes novos', value: customers.count ? brl(sum('cost_brl') / customers.count) : '-' },
    { label: 'Vendas na loja', value: `${number(sales.orders)} · ${brl(sales.revenue_brl)}` },
  ]
}

const totalGroups = computed(() => {
  if (!overview.value) return []
  return [
    { title: 'O que o anúncio trouxe', totals: trafficTotals() },
    { title: 'Resultado', totals: resultTotals() },
  ]
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
        { type: 'line', label: 'Cliques', data: points.map((point) => point.clicks), borderColor: '#fbbf24', yAxisID: 'counts' },
        { type: 'line', label: 'Compras do anúncio', data: points.map((point) => point.conversions), borderColor: '#34d399', yAxisID: 'counts' },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        cost: { position: 'left', beginAtZero: true, grid: { color: 'rgba(255,255,255,0.07)' }, ticks: { color: '#94a3b8' } },
        counts: { position: 'right', beginAtZero: true, grid: { display: false }, ticks: { color: '#94a3b8', precision: 0 } },
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

.note
  margin 0
  padding 10px 14px
  background rgba(99,102,241,0.08)
  border 1px solid rgba(99,102,241,0.3)
  border-radius 8px
  color rgba(255,255,255,0.75)
  font-size 0.85rem

.group
  display flex
  flex-direction column
  gap 8px

.group-title
  margin 0
  font-size 0.75rem
  font-weight 600
  text-transform uppercase
  letter-spacing 0.04em
  color rgba(255,255,255,0.45)

.muted
  opacity 0.35

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
