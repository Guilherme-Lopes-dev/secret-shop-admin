<template>
  <section class="section">
    <div class="section-head">
      <div>
        <h2 class="section-title">Ads × acessos do site</h2>
        <span class="hint">Mesmos dados do gráfico de acessos da home, dia a dia ao lado do Ads.</span>
      </div>
      <button type="button" class="btn-ghost" @click="open = !open">
        <Icon :icon="open ? 'mdi:eye-off-outline' : 'mdi:swap-horizontal'" width="15" />
        {{ open ? 'Esconder' : 'Cruzar com acessos' }}
      </button>
    </div>

    <template v-if="open">
      <p v-if="error" class="error-msg">{{ error }}</p>
      <p v-else-if="!access" class="hint">Carregando...</p>
      <template v-else>
        <div class="totals">
          <div v-for="total in totals" :key="total.label" class="total">
            <span class="total__value">{{ total.value }}</span>
            <span class="total__label">{{ total.label }}</span>
          </div>
        </div>
        <div class="canvas-wrap"><canvas ref="canvas"></canvas></div>
        <!-- ponytail: sem gclid guardado não dá pra ligar clique a visitante; a razão é só ordem de grandeza -->
        <span class="hint">
          Cliques do Ads ÷ visitantes únicos do dia. Uma pessoa pode clicar mais de uma vez, então é estimativa da fatia
          do tráfego que veio do anúncio, não atribuição.
        </span>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Dia</th>
                <th class="num">Cliques Ads</th>
                <th class="num">Custo Ads</th>
                <th class="num">Conv. Ads</th>
                <th class="num">Visitantes</th>
                <th class="num">Logados</th>
                <th class="num">Cliques/visit.</th>
                <th class="num">Custo/visit.</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.day">
                <td>{{ dayjs(row.day).format('DD/MM ddd') }}</td>
                <td class="num">{{ number(row.clicks) }}</td>
                <td class="num">{{ brl(row.cost_brl) }}</td>
                <td class="num">{{ number(row.conversions) }}</td>
                <td class="num">{{ number(row.visitors) }}</td>
                <td class="num">{{ number(row.users) }}</td>
                <td class="num">{{ ratio(row.clicks, row.visitors) }}</td>
                <td class="num">{{ row.visitors ? brl(row.cost_brl / row.visitors) : '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import Chart from 'chart.js/auto'
import dayjs from 'dayjs'
import { adminService, type DashboardAccess, type GoogleAdsOverview } from '@/services/admin/admin.service'
import { persistedRef } from '@/utils/persistedRef'

const props = defineProps<{ days: number; daily: GoogleAdsOverview['daily'] }>()

const open = persistedRef('google-ads:access-open', false)
const access = ref<DashboardAccess | null>(null)
const error = ref('')
const canvas = ref<HTMLCanvasElement | null>(null)
let chart: Chart | undefined

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const number = (value: number) => value.toLocaleString('pt-BR')
const ratio = (part: number, whole: number) =>
  whole ? `${((part / whole) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '-'

// Os dois lados agrupam pelo dia de SP; dia sem impressão não vem do Ads e vira zero.
const series = computed(() => {
  const adsByDay = new Map(props.daily.map((point) => [point.date, point]))
  const noAds = { clicks: 0, cost_brl: 0, conversions: 0 }
  return (access.value?.byDay ?? []).map((point) => ({ ...point, ...noAds, ...adsByDay.get(point.day) }))
})

// Tabela do mais recente pro mais antigo; gráfico na ordem do tempo.
const rows = computed(() => [...series.value].reverse())

// Dia sem visitante registrado (antes de site_visits existir) inflaria a razão com cliques sem denominador.
const measuredRows = computed(() => rows.value.filter((row) => row.visitors > 0))

const sumOf = (key: 'clicks' | 'cost_brl' | 'visitors' | 'users') =>
  measuredRows.value.reduce((total, row) => total + row[key], 0)

const totals = computed(() => {
  const visitors = sumOf('visitors')
  return [
    { label: 'Visitantes (soma dos dias)', value: number(visitors) },
    { label: 'Logados (soma dos dias)', value: number(sumOf('users')) },
    { label: 'Cliques Ads', value: number(sumOf('clicks')) },
    { label: 'Cliques/visitantes', value: ratio(sumOf('clicks'), visitors) },
    { label: 'Custo por visitante', value: visitors ? brl(sumOf('cost_brl') / visitors) : '-' },
  ]
})

const fetchAccess = async () => {
  access.value = null
  try {
    const { data } = await adminService.getDashboardAccess(props.days)
    // Troca rápida de período: resposta atrasada de outra janela não sobrescreve a atual.
    if (data.days !== props.days) return
    access.value = data
    error.value = ''
  } catch (err: any) {
    error.value = err.response?.data?.message ?? 'Não carregou os acessos do site.'
  }
}

const renderChart = () => {
  chart?.destroy()
  const points = series.value
  if (!canvas.value || !points.length) return

  chart = new Chart(canvas.value, {
    data: {
      labels: points.map((point) => dayjs(point.day).format('DD/MM')),
      datasets: [
        { type: 'bar', label: 'Visitantes', data: points.map((point) => point.visitors), backgroundColor: '#6366f1', borderRadius: 4, yAxisID: 'site' },
        { type: 'line', label: 'Logados', data: points.map((point) => point.users), borderColor: '#fbbf24', yAxisID: 'site' },
        { type: 'line', label: 'Cliques Ads', data: points.map((point) => point.clicks), borderColor: '#34d399', yAxisID: 'clicks' },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        site: { position: 'left', beginAtZero: true, grid: { color: 'rgba(255,255,255,0.07)' }, ticks: { color: '#94a3b8', precision: 0 } },
        clicks: { position: 'right', beginAtZero: true, grid: { display: false }, ticks: { color: '#94a3b8', precision: 0 } },
        x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
      },
    },
  })
}

watch(
  () => [open.value, props.days] as const,
  ([isOpen]) => isOpen && fetchAccess(),
  { immediate: true },
)
watch([series, canvas], renderChart)
onUnmounted(() => chart?.destroy())
</script>

<style lang="stylus" scoped>
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

.totals
  display grid
  grid-template-columns repeat(auto-fill, minmax(160px, 1fr))
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

.hint
  display block
  margin 0
  font-size 0.75rem
  color rgba(255,255,255,0.45)

.error-msg
  color #fc8181
  font-size 0.85rem
  margin 0
</style>
