<template>
  <section class="section">
    <div class="section-head">
      <div>
        <h2 class="section-title">Análise do Claude</h2>
        <p class="section-hint">
          Lê as notas do patch, cruza com estoque e vendas e sugere ajuste de preço por herói. Só leitura: nada é aplicado.
        </p>
      </div>
      <button type="button" class="ghost-btn" :disabled="running || starting" @click="start">
        <Icon icon="mdi:robot-outline" width="18" :class="{ spin: running }" />
        {{ buttonLabel }}
      </button>
    </div>

    <p v-if="!analysis" class="muted">Nenhuma análise deste patch ainda. Leva alguns minutos.</p>
    <p v-else-if="running" class="muted">Claude lendo o patch desde {{ when(analysis.started_at) }}...</p>
    <p v-else-if="analysis.status === 'FAILED'" class="error-msg">{{ analysis.error }}</p>
    <template v-else-if="analysis.result">
      <p class="muted">{{ analysis.model }} · {{ when(analysis.finished_at) }}</p>
      <p class="summary">{{ analysis.result.summary }}</p>

      <p v-if="!analysis.result.recommendations.length" class="muted">Nenhuma recomendação de preço.</p>
      <article v-for="item in analysis.result.recommendations" :key="item.hero" class="recommendation">
        <header class="recommendation__head">
          <strong>{{ item.hero }}</strong>
          <span class="badge" :class="`action-${item.action}`">{{ describeRecommendation(item) }}</span>
          <span class="badge" :class="`confidence-${item.confidence}`">{{ CONFIDENCE_LABELS[item.confidence] }}</span>
        </header>
        <p class="recommendation__why">{{ item.rationale }}</p>
      </article>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import { toast } from 'vue3-toastify'
import { patchAnalysisApi, type PatchAnalysis } from './patchAnalysisApi'
import { CONFIDENCE_LABELS, describeRecommendation } from './recommendations'

const POLL_MS = 5000

const props = defineProps<{ version: string; initial: PatchAnalysis | null }>()
const emit = defineEmits<{ updated: [analysis: PatchAnalysis | null] }>()

const analysis = ref<PatchAnalysis | null>(props.initial)
const starting = ref(false)
let pollTimer: ReturnType<typeof setTimeout> | undefined

const running = computed(() => analysis.value?.status === 'RUNNING')

const buttonLabel = computed(() => {
  if (running.value) return 'Analisando...'
  if (analysis.value) return 'Rodar de novo'

  return 'Rodar análise'
})

const when = (date: string | null) => (date ? dayjs(date).format('DD/MM HH:mm') : '-')

const setAnalysis = (value: PatchAnalysis | null) => {
  analysis.value = value
  emit('updated', value)
}

const poll = async () => {
  // Erro de rede passageiro: ignora e tenta no próximo ciclo.
  const { data } = await patchAnalysisApi.analysis(props.version).catch(() => ({ data: analysis.value }))
  setAnalysis(data)
  schedulePoll()
}

// Análise roda em background no backend; enquanto estiver RUNNING, recarrega.
const schedulePoll = () => {
  clearTimeout(pollTimer)
  if (!running.value) return

  pollTimer = setTimeout(poll, POLL_MS)
}

const start = async () => {
  starting.value = true
  try {
    const { data } = await patchAnalysisApi.startAnalysis(props.version)
    setAnalysis(data)
    schedulePoll()
  } catch (err: any) {
    toast.error(err.response?.data?.message ?? 'Não iniciou a análise.')
  } finally {
    starting.value = false
  }
}

watch(
  () => props.initial,
  (value) => {
    analysis.value = value
    schedulePoll()
  },
  { immediate: true },
)
onUnmounted(() => clearTimeout(pollTimer))
</script>

<style lang="stylus" scoped>
@import '../../styles/report-view.styl'

.section
  display flex
  flex-direction column
  gap 0.75rem

.summary
  margin 0
  white-space pre-wrap
  line-height 1.55
  font-size 0.9rem
  color #e2e8f0

.recommendation
  padding 0.75rem 0.9rem
  background rgba(0,0,0,0.25)
  border-radius 8px
  display flex
  flex-direction column
  gap 0.4rem

.recommendation__head
  display flex
  flex-wrap wrap
  align-items center
  gap 0.5rem

.recommendation__why
  margin 0
  font-size 0.85rem
  color rgba(255,255,255,0.75)

.badge
  font-size 0.72rem
  padding 2px 8px
  border-radius 99px
  background rgba(255,255,255,0.08)
  &.action-raise, &.action-buy_stock, &.confidence-high
    background rgba(52,211,153,0.15)
    color #34d399
  &.action-hold, &.confidence-medium
    background rgba(251,191,36,0.12)
    color #fbbf24
  &.action-lower
    background rgba(252,129,129,0.12)
    color #fc8181

.error-msg
  color #fc8181
  font-size 0.85rem
  margin 0
</style>
