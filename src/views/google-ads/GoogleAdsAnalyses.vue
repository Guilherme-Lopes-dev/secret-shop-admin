<template>
  <section class="section">
    <div class="section-head">
      <div>
        <h2 class="section-title">Análises do Claude</h2>
        <p class="hint">Toda segunda às 6h30 com os últimos 30 dias. Aprovar só registra a decisão: nada é aplicado no Google Ads ainda.</p>
      </div>
      <button type="button" class="btn-primary" :disabled="disabled || hasRunning || starting" @click="start">
        <Icon icon="mdi:robot-outline" width="16" />
        {{ hasRunning ? 'Analisando...' : 'Rodar análise agora' }}
      </button>
    </div>

    <p v-if="!analyses.length" class="hint">Nenhuma análise ainda.</p>
    <div v-else class="layout">
      <ul class="history">
        <li v-for="item in analyses" :key="item.id">
          <button type="button" class="history__item" :class="{ active: item.id === selectedId }" @click="selectedId = item.id">
            <span>{{ when(item.created_at) }}</span>
            <span class="badge" :class="item.status.toLowerCase()">{{ STATUS_LABELS[item.status] }}</span>
            <span v-if="item.suggestions_pending" class="hint">{{ item.suggestions_pending }} pendente(s)</span>
          </button>
        </li>
      </ul>

      <div v-if="selected" class="detail">
        <p class="hint">
          Período {{ day(selected.period_start) }} a {{ day(selected.period_end) }} · {{ selected.model }}
        </p>
        <p v-if="selected.status === 'RUNNING'" class="hint">Claude analisando a conta...</p>
        <p v-else-if="selected.status === 'FAILED'" class="error-msg">{{ selected.error }}</p>
        <template v-else>
          <p class="summary">{{ selected.summary }}</p>

          <p v-if="!selected.suggestions.length" class="hint">Nenhuma mudança sugerida.</p>
          <article v-for="suggestion in selected.suggestions" :key="suggestion.id" class="suggestion">
            <header class="suggestion__head">
              <span class="badge" :class="`risk-${suggestion.risk}`">risco {{ RISK_LABELS[suggestion.risk] }}</span>
              <strong>{{ describeChange(suggestion) }}</strong>
              <span class="hint">{{ LEVEL_LABELS[suggestion.target_level] }}: {{ suggestion.target_name }}</span>
            </header>
            <p class="suggestion__why">{{ suggestion.rationale }}</p>

            <div v-if="suggestion.status === 'PENDING'" class="decision">
              <input v-model="notes[suggestion.id]" class="note" placeholder="Observação (opcional)" maxlength="500" />
              <button type="button" class="btn-approve" :disabled="deciding" @click="decide(suggestion, 'approve')">Aprovar</button>
              <button type="button" class="btn-reject" :disabled="deciding" @click="decide(suggestion, 'reject')">Rejeitar</button>
            </div>
            <p v-else class="hint">
              <span class="badge" :class="suggestion.status.toLowerCase()">{{ STATUS_LABELS[suggestion.status] }}</span>
              por {{ suggestion.decider?.username ?? '?' }} em {{ when(suggestion.decided_at) }}
              <template v-if="suggestion.decision_note"> · "{{ suggestion.decision_note }}"</template>
            </p>
          </article>

          <details v-if="selected.discarded.length" class="discarded">
            <summary>{{ selected.discarded.length }} sugestão(ões) barrada(s) pelas travas</summary>
            <p v-for="(item, index) in selected.discarded" :key="index" class="hint">
              {{ item.suggestion.action_type }} · {{ item.reason }} · {{ item.suggestion.rationale }}
            </p>
          </details>
        </template>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import { toast } from 'vue3-toastify'
import {
  adminService,
  type GoogleAdsAnalysis,
  type GoogleAdsAnalysisItem,
  type GoogleAdsLevel,
  type GoogleAdsSuggestion,
} from '@/services/admin/admin.service'

defineProps<{ disabled: boolean }>()

const POLL_MS = 5000

const STATUS_LABELS: Record<string, string> = {
  RUNNING: 'rodando',
  DONE: 'pronta',
  FAILED: 'falhou',
  PENDING: 'pendente',
  APPROVED: 'aprovada',
  REJECTED: 'rejeitada',
}

const RISK_LABELS = { low: 'baixo', medium: 'médio', high: 'alto' }

const LEVEL_LABELS: Record<GoogleAdsLevel, string> = {
  campaign: 'Campanha',
  ad_group: 'Grupo',
  ad: 'Anúncio',
  keyword: 'Palavra-chave',
  search_term: 'Termo',
}

const brl = (value: unknown) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const CHANGE_DESCRIPTIONS: Record<string, (suggestion: GoogleAdsSuggestion) => string> = {
  set_campaign_budget: ({ current_value, proposed_value }) =>
    `Orçamento diário ${brl(current_value?.daily_budget_brl)} → ${brl(proposed_value?.daily_budget_brl)}`,
  pause_campaign: () => 'Pausar campanha',
  pause_ad_group: () => 'Pausar grupo',
  pause_ad: () => 'Pausar anúncio',
  pause_keyword: () => 'Pausar palavra-chave',
  add_negative_keyword: ({ proposed_value }) => `Negativar "${proposed_value?.text}" (${proposed_value?.match_type})`,
}

const analyses = ref<GoogleAdsAnalysisItem[]>([])
const selectedId = ref<string | null>(null)
const selected = ref<GoogleAdsAnalysis | null>(null)
const notes = reactive<Record<string, string>>({})
const starting = ref(false)
const deciding = ref(false)
let pollTimer: ReturnType<typeof setTimeout> | undefined

const hasRunning = computed(() => analyses.value.some((item) => item.status === 'RUNNING'))

const when = (date: string | null) => (date ? dayjs(date).format('DD/MM HH:mm') : '-')
const day = (date: string) => dayjs(date.slice(0, 10)).format('DD/MM')

const describeChange = (suggestion: GoogleAdsSuggestion) =>
  CHANGE_DESCRIPTIONS[suggestion.action_type]?.(suggestion) ?? suggestion.action_type

const fetchSelected = async () => {
  if (!selectedId.value) return
  const { data } = await adminService.getGoogleAdsAnalysis(selectedId.value)
  selected.value = data
}

const fetchAnalyses = async () => {
  const { data } = await adminService.getGoogleAdsAnalyses()
  analyses.value = data
  selectedId.value ??= data[0]?.id ?? null
}

// Análise roda em background no backend; enquanto tiver RUNNING, recarrega.
const schedulePoll = () => {
  clearTimeout(pollTimer)
  if (!hasRunning.value) return
  pollTimer = setTimeout(async () => {
    // Erro de rede passageiro: ignora e tenta no próximo ciclo.
    await fetchAnalyses()
      .then(fetchSelected)
      .catch(() => {})
    schedulePoll()
  }, POLL_MS)
}

const start = async () => {
  starting.value = true
  try {
    const { data } = await adminService.startGoogleAdsAnalysis()
    selectedId.value = data.id
    await fetchAnalyses()
    schedulePoll()
  } catch (err: any) {
    toast.error(err.response?.data?.message ?? 'Não iniciou a análise.')
  } finally {
    starting.value = false
  }
}

const DECISIONS = {
  approve: adminService.approveGoogleAdsSuggestion,
  reject: adminService.rejectGoogleAdsSuggestion,
}

const decide = async (suggestion: GoogleAdsSuggestion, decision: keyof typeof DECISIONS) => {
  deciding.value = true
  try {
    await DECISIONS[decision](suggestion.id, notes[suggestion.id])
    await Promise.all([fetchSelected(), fetchAnalyses()])
  } catch (err: any) {
    toast.error(err.response?.data?.message ?? 'Não registrou a decisão.')
  } finally {
    deciding.value = false
  }
}

watch(selectedId, fetchSelected)
onMounted(async () => {
  await fetchAnalyses()
  schedulePoll()
})
onUnmounted(() => clearTimeout(pollTimer))
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
  align-items flex-start
  justify-content space-between
  gap 1rem
  flex-wrap wrap

.section-title
  font-size 1rem
  font-weight 600
  margin 0 0 4px

.layout
  display grid
  grid-template-columns 220px 1fr
  gap 1rem
  @media (max-width 800px)
    grid-template-columns 1fr

.history
  list-style none
  margin 0
  padding 0
  display flex
  flex-direction column
  gap 4px

.history__item
  width 100%
  display flex
  flex-wrap wrap
  align-items center
  gap 6px
  padding 8px 10px
  background transparent
  border 1px solid rgba(255,255,255,0.06)
  border-radius 8px
  color #fff
  font-size 0.8rem
  cursor pointer
  text-align left
  &.active
    border-color #6366f1
    background rgba(99,102,241,0.1)

.detail
  display flex
  flex-direction column
  gap 10px

.summary
  margin 0
  white-space pre-wrap
  line-height 1.5
  font-size 0.9rem

.suggestion
  padding 12px 14px
  background rgba(0,0,0,0.25)
  border-radius 8px
  display flex
  flex-direction column
  gap 8px

.suggestion__head
  display flex
  flex-wrap wrap
  align-items center
  gap 8px

.suggestion__why
  margin 0
  font-size 0.85rem
  color rgba(255,255,255,0.75)

.decision
  display flex
  gap 8px
  flex-wrap wrap

.note
  flex 1
  min-width 180px
  padding 6px 10px
  background rgba(255,255,255,0.04)
  border 1px solid rgba(255,255,255,0.1)
  border-radius 6px
  color #fff
  font-size 0.8rem

.btn-primary, .btn-approve, .btn-reject
  display inline-flex
  align-items center
  gap 6px
  padding 6px 14px
  border none
  border-radius 6px
  color #fff
  font-size 0.85rem
  cursor pointer
  &:disabled
    opacity 0.5
    cursor not-allowed

.btn-primary
  background #6366f1

.btn-approve
  background #059669

.btn-reject
  background transparent
  border 1px solid rgba(252,129,129,0.5)
  color #fc8181

.badge
  font-size 0.7rem
  padding 2px 8px
  border-radius 99px
  background rgba(255,255,255,0.08)
  &.done, &.approved, &.risk-low
    background rgba(52,211,153,0.15)
    color #34d399
  &.running, &.pending, &.risk-medium
    background rgba(251,191,36,0.12)
    color #fbbf24
  &.failed, &.rejected, &.risk-high
    background rgba(252,129,129,0.12)
    color #fc8181

.discarded
  font-size 0.8rem
  color rgba(255,255,255,0.6)
  summary
    cursor pointer

.hint
  margin 0
  font-size 0.75rem
  color rgba(255,255,255,0.45)

.error-msg
  color #fc8181
  font-size 0.85rem
  margin 0
</style>
