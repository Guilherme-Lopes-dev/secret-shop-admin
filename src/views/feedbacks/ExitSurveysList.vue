<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <h1 class="page-title">Pesquisa de saída</h1>
        <p class="page-subtitle">
          "O que faltou pra você comprar hoje?" — aparece 1x a cada 30 dias pra quem passou 20s+ em
          produto e saiu sem ir pro carrinho.
        </p>
      </div>
      <FilterField label="Período">
        <select v-model="days" class="filter-input" @change="reload">
          <option :value="7">Últimos 7 dias</option>
          <option :value="30">Últimos 30 dias</option>
          <option :value="90">Últimos 90 dias</option>
        </select>
      </FilterField>
    </header>

    <div class="section breakdown">
      <div class="breakdown-head">
        <span class="summary-label">Respostas no período</span>
        <strong class="summary-value">{{ periodTotal }}</strong>
      </div>
      <button
        v-for="option in REASONS"
        :key="option.value"
        type="button"
        class="breakdown-row"
        :class="{ 'breakdown-row--on': reasonFilter === option.value }"
        @click="toggleReason(option.value)"
      >
        <span class="breakdown-label">{{ option.label }}</span>
        <span class="breakdown-track">
          <span class="breakdown-bar" :style="{ width: `${share(option.value)}%` }" />
        </span>
        <span class="breakdown-count">
          {{ byReason[option.value] ?? 0 }}
          <span class="text-muted">· {{ share(option.value) }}%</span>
        </span>
      </button>
    </div>

    <div class="list-head">
      <span class="text-muted">
        {{ reasonFilter ? `Filtrando: ${REASON_LABELS[reasonFilter]}` : 'Todas as respostas' }}
      </span>
      <button v-if="reasonFilter" class="btn-ghost" @click="toggleReason(reasonFilter)">Limpar filtro</button>
    </div>

    <div class="section">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Motivo</th>
              <th>Comentário</th>
              <th>Página</th>
              <th>Cliente</th>
              <th>Quando</th>
            </tr>
          </thead>
          <tbody>
            <template v-if="loading">
              <tr v-for="n in 5" :key="n" class="skeleton-row">
                <td><div class="skeleton" style="width:110px;height:14px" /></td>
                <td><div class="skeleton" style="width:260px;height:14px" /></td>
                <td><div class="skeleton" style="width:160px;height:14px" /></td>
                <td><div class="skeleton" style="width:90px;height:14px" /></td>
                <td><div class="skeleton" style="width:90px;height:14px" /></td>
              </tr>
            </template>
            <template v-else>
              <tr v-for="item in surveys" :key="item.id">
                <td>
                  <span class="reason-badge">{{ REASON_LABELS[item.reason] || item.reason }}</span>
                </td>
                <td>
                  <span v-if="item.comment" class="comment">{{ item.comment }}</span>
                  <span v-else class="text-muted">—</span>
                </td>
                <td>
                  <a class="link-cell" :href="`${SITE_ORIGIN}${item.path}`" target="_blank" rel="noopener">
                    {{ item.path }}
                  </a>
                </td>
                <td>
                  <button v-if="item.user?.id" class="link-cell" @click="goToUser(item.user.id)">
                    {{ item.user.username || 'Sem nome' }}
                  </button>
                  <span v-else class="text-muted">Anônimo</span>
                </td>
                <td class="text-muted">{{ $dayjs(item.created_at).format('DD/MM/YY HH:mm') }}</td>
              </tr>
              <tr v-if="surveys.length === 0">
                <td colspan="5" class="empty-state">Nenhuma resposta nesse período.</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="totalPages > 1" class="pagination">
      <button class="btn-ghost" :disabled="page === 1" @click="changePage(page - 1)">Anterior</button>
      <span class="text-muted">{{ page }} de {{ totalPages }}</span>
      <button class="btn-ghost" :disabled="page === totalPages" @click="changePage(page + 1)">
        Próxima
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { adminService } from '@/services/admin/admin.service'
import { persistedRef } from '@/utils/persistedRef'
import FilterField from '@/components/common/FilterField.vue'

const SITE_ORIGIN = 'https://secretshopgg.com'
const LIMIT = 20

// Mesmas chaves do EXIT_SURVEY_REASONS do backend e das opções do card no site.
const REASONS = [
  { value: 'not_found', label: 'Não achei o item' },
  { value: 'price', label: 'Preço' },
  { value: 'trust', label: 'Não sei se é confiável' },
  { value: 'browsing', label: 'Só olhando' },
  { value: 'other', label: 'Outro' },
]

const REASON_LABELS: Record<string, string> = Object.fromEntries(
  REASONS.map(option => [option.value, option.label]),
)

const router = useRouter()

const surveys = ref<any[]>([])
const byReason = ref<Record<string, number>>({})
const total = ref(0)
const page = ref(1)
const loading = ref(true)
const days = persistedRef('exit-surveys:days', 30)
const reasonFilter = ref('')

const totalPages = computed(() => Math.max(Math.ceil(total.value / LIMIT), 1))

const periodTotal = computed(() =>
  Object.values(byReason.value).reduce((sum, count) => sum + count, 0),
)

const share = (reason: string) => {
  if (!periodTotal.value) return 0

  return Math.round(((byReason.value[reason] ?? 0) / periodTotal.value) * 100)
}

const goToUser = (userUuid: string) => {
  router.push({ name: 'user-details', params: { uuid: userUuid } })
}

const fetchSurveys = async () => {
  loading.value = true
  try {
    const res = await adminService.getExitSurveys({
      days: days.value,
      page: page.value,
      limit: LIMIT,
      reason: reasonFilter.value || undefined,
    })
    surveys.value = res.data.data
    total.value = res.data.total
    byReason.value = res.data.by_reason
  } finally {
    loading.value = false
  }
}

const reload = () => {
  page.value = 1
  void fetchSurveys()
}

const changePage = (next: number) => {
  page.value = next
  void fetchSurveys()
}

const toggleReason = (reason: string) => {
  reasonFilter.value = reasonFilter.value === reason ? '' : reason
  reload()
}

onMounted(fetchSurveys)
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
  margin-bottom 1.5rem

.page-title
  font-size 1.8rem
  font-weight 700
  margin 0 0 4px

.page-subtitle
  font-size 0.85rem
  color rgba(255,255,255,0.45)
  margin 0
  max-width 640px

.filter-input
  background #16161a
  border 1px solid rgba(255,255,255,0.1)
  border-radius 8px
  color #fff
  padding 0.5rem 0.75rem
  font-size 0.85rem
  cursor pointer

.section
  background #16161a
  border 1px solid rgba(255,255,255,0.06)
  border-radius 12px
  overflow hidden

.breakdown
  padding 1rem 1.25rem
  display flex
  flex-direction column
  gap 4px
  margin-bottom 1.5rem

.breakdown-head
  display flex
  align-items baseline
  justify-content space-between
  margin-bottom 8px

.summary-label
  font-size 0.75rem
  text-transform uppercase
  letter-spacing 0.04em
  color rgba(255,255,255,0.45)

.summary-value
  font-size 1.5rem
  font-weight 700

.breakdown-row
  display grid
  grid-template-columns 180px 1fr 90px
  align-items center
  gap 12px
  padding 8px 10px
  background none
  border 1px solid transparent
  border-radius 8px
  color #fff
  font-family inherit
  font-size 0.875rem
  text-align left
  cursor pointer
  &:hover
    background rgba(255,255,255,0.03)

.breakdown-row--on
  border-color rgba(99,102,241,0.4)
  background rgba(99,102,241,0.08)

.breakdown-track
  height 8px
  background rgba(255,255,255,0.06)
  border-radius 999px
  overflow hidden

.breakdown-bar
  display block
  height 100%
  background #6366f1
  border-radius 999px
  transition width 0.3s ease

.breakdown-count
  text-align right
  font-weight 600
  font-variant-numeric tabular-nums

.list-head
  display flex
  align-items center
  justify-content space-between
  margin-bottom 0.75rem
  min-height 28px

.table-wrapper
  overflow-x auto

table
  width 100%
  border-collapse collapse

thead tr
  background rgba(255,255,255,0.03)

th
  padding 0.7rem 1rem
  text-align left
  font-size 0.75rem
  font-weight 600
  text-transform uppercase
  letter-spacing 0.04em
  color rgba(255,255,255,0.45)
  border-bottom 1px solid rgba(255,255,255,0.06)

td
  padding 0.75rem 1rem
  font-size 0.875rem
  border-bottom 1px solid rgba(255,255,255,0.04)
  vertical-align middle

tbody tr:last-child td
  border-bottom none

tbody tr:hover td
  background rgba(255,255,255,0.02)

.reason-badge
  display inline-block
  padding 2px 10px
  border-radius 999px
  background rgba(99,102,241,0.12)
  color #a5b4fc
  font-size 0.75rem
  font-weight 600
  white-space nowrap

.comment
  display block
  max-width 420px
  white-space pre-wrap
  word-break break-word

.link-cell
  background none
  border none
  padding 0
  font-family inherit
  font-size 0.875rem
  font-weight 600
  color #a5b4fc
  cursor pointer
  text-align left
  text-decoration none
  word-break break-all
  &:hover
    text-decoration underline

.text-muted
  color rgba(255,255,255,0.35)
  font-size 0.82rem

.btn-ghost
  padding 4px 12px
  background transparent
  border 1px solid rgba(255,255,255,0.12)
  border-radius 6px
  color rgba(255,255,255,0.65)
  font-size 0.85rem
  cursor pointer
  &:hover:not(:disabled)
    background rgba(255,255,255,0.06)
  &:disabled
    opacity 0.4
    cursor not-allowed

.empty-state
  text-align center
  padding 2.5rem
  color rgba(255,255,255,0.35)
  font-size 0.9rem

.pagination
  display flex
  align-items center
  justify-content center
  gap 12px
  margin-top 1rem

.skeleton-row td
  padding 0.85rem 1rem

.skeleton
  background rgba(255,255,255,0.06)
  border-radius 4px
  animation pulse 1.4s ease-in-out infinite

@keyframes pulse
  0%, 100%
    opacity 1
  50%
    opacity 0.4

@media (max-width: 640px)
  .breakdown-row
    grid-template-columns 1fr 70px
  .breakdown-track
    grid-column 1 / -1
    grid-row 2
</style>
