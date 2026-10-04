<template>
  <section class="overview">
    <div v-if="error" class="error-row">
      <p class="error-msg">{{ error }}</p>
      <button type="button" class="btn-ghost" :disabled="loading" @click="fetchOverview">
        <Icon icon="mdi:refresh" width="15" /> Tentar de novo
      </button>
    </div>
    <p v-else-if="!overview" class="muted">Carregando dados do perfil...</p>
    <template v-else>
      <div class="overview__head">
        <img
          v-if="overview.profile.profile_picture_url"
          :src="overview.profile.profile_picture_url"
          referrerpolicy="no-referrer"
          class="avatar"
          alt=""
        />
        <div class="counts">
          <span><strong>{{ number(overview.profile.followers_count) }}</strong> seguidores</span>
          <span><strong>{{ number(overview.profile.follows_count) }}</strong> seguindo</span>
          <span><strong>{{ number(overview.profile.media_count) }}</strong> posts</span>
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
          <button type="button" class="btn-ghost" :disabled="refreshing || loading" @click="refresh">
            <Icon icon="mdi:refresh" width="15" :class="{ spin: refreshing }" /> Atualizar métricas
          </button>
        </div>
      </div>

      <p v-if="overview.insights_error" class="warn">
        Insights da conta indisponíveis ({{ overview.insights_error }}). O token precisa de
        <code>instagram_business_manage_insights</code>: gera de novo no painel da Meta marcando essa permissão e cola em
        "Trocar token".
      </p>
      <template v-else>
        <div class="totals">
          <div v-for="total in totals" :key="total.key" class="total">
            <span class="total__value">{{ number(total.value) }}</span>
            <span class="total__label">{{ total.label }}</span>
          </div>
        </div>
        <div class="chart">
          <h3 class="chart__title">Alcance por dia <span class="muted">(contas únicas; a Meta atrasa até 48h)</span></h3>
          <div class="canvas-wrap"><canvas ref="canvas"></canvas></div>
        </div>
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import Chart from 'chart.js/auto'
import dayjs from 'dayjs'
import { toast } from 'vue3-toastify'
import { adminService, type InstagramOverview } from '@/services/admin/admin.service'
import { persistedRef } from '@/utils/persistedRef'

const emit = defineEmits<{ refreshed: [] }>()

// Meta recusa período maior que 30 dias.
const PERIODS = [7, 30]
const REACH_COLOR = '#6366f1'

const TOTALS = [
  { key: 'reach', label: 'Alcance' },
  { key: 'views', label: 'Views' },
  { key: 'accounts_engaged', label: 'Contas engajadas' },
  { key: 'total_interactions', label: 'Interações' },
  { key: 'likes', label: 'Curtidas' },
  { key: 'comments', label: 'Comentários' },
  { key: 'shares', label: 'Compartilhamentos' },
  { key: 'saves', label: 'Salvos' },
  { key: 'profile_links_taps', label: 'Cliques no link' },
]

const days = persistedRef('instagram:overview-days', 7)
const overview = ref<InstagramOverview | null>(null)
const error = ref('')
const loading = ref(false)
const refreshing = ref(false)
const canvas = ref<HTMLCanvasElement | null>(null)
let chart: Chart | undefined

const number = (value?: number) => (value ?? 0).toLocaleString('pt-BR')

const totals = computed(() => {
  const values = overview.value?.totals
  if (!values) return []
  return TOTALS.filter((total) => values[total.key] != null).map((total) => ({ ...total, value: values[total.key] }))
})

// Troca rápida de período (7→30→7): só a última resposta vale.
let latestRequest = 0

const requestOverview = (period: number) =>
  adminService.getInstagramOverview(period).then(
    ({ data }) => ({ data, error: '' }),
    (err: any) => ({ data: null, error: err.response?.data?.message ?? 'Não carregou os dados do Instagram.' }),
  )

const fetchOverview = async () => {
  const request = ++latestRequest
  loading.value = true
  const result = await requestOverview(days.value)
  if (request !== latestRequest) return
  loading.value = false
  error.value = result.error
  if (result.data) overview.value = result.data
}

// Insights de story vêm do snapshot do cron (de hora em hora); o botão força um agora e recarrega tudo.
const refresh = async () => {
  refreshing.value = true
  try {
    await adminService.refreshInstagramInsights()
    await fetchOverview()
    emit('refreshed')
  } catch {
    toast.error('Não atualizou as métricas.')
  } finally {
    refreshing.value = false
  }
}

// end_time da Meta marca o FIM do dia medido: o valor é do dia anterior.
const dayLabel = (endTime: string) => dayjs(endTime).subtract(1, 'day').format('DD/MM')

const renderChart = () => {
  chart?.destroy()
  const points = overview.value?.reach_by_day ?? []
  if (!canvas.value || !points.length) return

  chart = new Chart(canvas.value, {
    type: 'bar',
    data: {
      labels: points.map((point) => dayLabel(point.day)),
      datasets: [
        {
          label: 'Alcance',
          data: points.map((point) => point.value),
          backgroundColor: REACH_COLOR,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.07)' }, ticks: { color: '#94a3b8', precision: 0 } },
        x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
      },
    },
  })
}

watch(days, fetchOverview)
watch([overview, canvas], renderChart)
onMounted(fetchOverview)
onUnmounted(() => chart?.destroy())
</script>

<style lang="stylus" scoped>
.overview
  background #16161a
  border 1px solid rgba(255,255,255,0.06)
  border-radius 12px
  padding 1.25rem
  margin-bottom 1.5rem
  display flex
  flex-direction column
  gap 1rem

.overview__head
  display flex
  align-items center
  gap 1rem
  flex-wrap wrap

.avatar
  width 48px
  height 48px
  border-radius 50%
  object-fit cover

.counts
  display flex
  gap 1.25rem
  flex-wrap wrap
  font-size 0.9rem
  color rgba(255,255,255,0.6)
  strong
    color #fff
    font-size 1.1rem

.controls
  display flex
  gap 8px
  margin-left auto
  flex-wrap wrap

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
  grid-template-columns repeat(auto-fill, minmax(130px, 1fr))
  gap 8px

.total
  display flex
  flex-direction column
  gap 2px
  padding 10px 12px
  background rgba(0,0,0,0.25)
  border-radius 8px

.total__value
  font-size 1.25rem
  font-weight 700
  font-variant-numeric tabular-nums

.total__label
  font-size 0.75rem
  color rgba(255,255,255,0.5)

.chart__title
  font-size 0.9rem
  font-weight 600
  margin 0 0 8px
  .muted
    font-weight 400
    font-size 0.75rem

.canvas-wrap
  position relative
  height 200px

.warn
  margin 0
  padding 10px 14px
  background rgba(251,191,36,0.08)
  border 1px solid rgba(251,191,36,0.3)
  border-radius 8px
  color #fbbf24
  font-size 0.85rem
  code
    font-size 0.8rem

.muted
  color rgba(255,255,255,0.45)
  margin 0

.error-row
  display flex
  align-items center
  justify-content space-between
  gap 1rem
  flex-wrap wrap

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
