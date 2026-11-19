<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <h1 class="page-title">
          Análise de patch
          <InfoTip :text="PAGE_TIP" align="left" />
        </h1>
        <p class="page-subtitle">
          Buffs e nerfs do patch de Dota 2 cruzados com o estoque e as vendas de skins de cada herói
        </p>
      </div>
      <div class="header-actions">
        <select v-model="version" class="patch-select" :disabled="!patches.length">
          <option v-for="item in patches" :key="item.version" :value="item.version">
            {{ item.version }} · {{ day(item.released_at) }}
          </option>
        </select>
        <button class="ghost-btn" :disabled="loading || !version" @click="fetchReport">
          <Icon icon="mdi:refresh" width="18" :class="{ spin: loading }" />
          Atualizar
        </button>
      </div>
    </header>

    <div v-if="error" class="error-banner">{{ error }}</div>
    <div v-else-if="loading && !report" class="loading-state">Lendo o patch...</div>

    <template v-if="report">
      <div class="stats-grid">
        <div v-for="stat in stats" :key="stat.label" class="stat-card">
          <div class="stat-info">
            <span class="stat-label">{{ stat.label }}</span>
            <span class="stat-value" :class="stat.tone">{{ stat.value }}</span>
            <span v-if="stat.sub" class="stat-sub">{{ stat.sub }}</span>
          </div>
        </div>
      </div>

      <PatchClaudeAnalysis :version="report.patch.version" :initial="report.analysis" @updated="analysis = $event" />

      <section class="section">
        <div class="section-head">
          <div>
            <h2 class="section-title">Heróis alterados</h2>
            <p class="section-hint">
              Vendas = unidades pagas nos {{ report.patch.window_days }} dias antes e depois do patch. Clique no herói pra ver as mudanças.
            </p>
          </div>
          <label class="toggle">
            <input v-model="onlyInStock" type="checkbox" />
            Só com estoque
          </label>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Herói</th>
                <SortableTh v-for="column in COLUMNS" :key="column.key" :column="column.key" :label="column.label" :sort="sort" @toggle="toggleSort" />
                <th>Recomendação</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="hero in rows" :key="hero.heroId">
                <tr class="hero-row" @click="toggleHero(hero.heroId)">
                  <td class="fw">
                    <Icon :icon="expanded.has(hero.heroId) ? 'mdi:chevron-down' : 'mdi:chevron-right'" width="14" />
                    {{ hero.hero }}
                  </td>
                  <td class="green">{{ hero.buffs }}</td>
                  <td class="red">{{ hero.nerfs }}</td>
                  <td>{{ hero.review }}</td>
                  <td :class="balanceTone(hero)">{{ balanceOf(hero) }}</td>
                  <td>{{ hero.store.in_stock }}</td>
                  <td>{{ formatCurrency(hero.store.stock_value_cents) }}</td>
                  <td>{{ hero.store.sales_before }}</td>
                  <td>{{ hero.store.sales_after }}</td>
                  <td>
                    <span v-if="recommendationOf(hero)" class="badge" :class="`action-${recommendationOf(hero)!.action}`">
                      {{ describeRecommendation(recommendationOf(hero)!) }}
                    </span>
                    <span v-else class="muted">—</span>
                  </td>
                </tr>
                <tr v-if="expanded.has(hero.heroId)" class="changes-row">
                  <td :colspan="COLUMNS.length + 2">
                    <PatchHeroChanges :changes="hero.changes" />
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
          <p v-if="!rows.length" class="empty-state">Nenhum herói com estoque neste patch.</p>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import InfoTip from '@/components/common/InfoTip.vue'
import SortableTh from '@/components/common/SortableTh.vue'
import { formatCurrency } from '@/utils/formatCurrency'
import { nextSort, sortRows, type SortGetters, type SortState } from '@/utils/tableSort'
import PatchClaudeAnalysis from './PatchClaudeAnalysis.vue'
import PatchHeroChanges from './PatchHeroChanges.vue'
import { patchAnalysisApi, type HeroPatchReport, type PatchAnalysis, type PatchListItem, type PatchReport } from './patchAnalysisApi'
import { describeRecommendation, heroKey } from './recommendations'

const PAGE_TIP =
  'Lê as notas oficiais do patch (datafeed do dota2.com) e classifica cada mudança: buff/nerf vêm de regra automática ' +
  'em mudança numérica, "revisar" é texto sem número (rework, mecânica nova) que só o Claude julga. Saldo = buffs − nerfs.'

const COLUMNS = [
  { key: 'buffs', label: 'Buffs' },
  { key: 'nerfs', label: 'Nerfs' },
  { key: 'review', label: 'Revisar' },
  { key: 'balance', label: 'Saldo' },
  { key: 'in_stock', label: 'Estoque' },
  { key: 'stock_value', label: 'Valor estoque' },
  { key: 'sales_before', label: 'Vendas antes' },
  { key: 'sales_after', label: 'Vendas depois' },
]

const balanceOf = (hero: HeroPatchReport) => hero.buffs - hero.nerfs

const SORTS: SortGetters<HeroPatchReport> = {
  buffs: (hero) => hero.buffs,
  nerfs: (hero) => hero.nerfs,
  review: (hero) => hero.review,
  balance: balanceOf,
  in_stock: (hero) => hero.store.in_stock,
  stock_value: (hero) => hero.store.stock_value_cents,
  sales_before: (hero) => hero.store.sales_before,
  sales_after: (hero) => hero.store.sales_after,
}

const patches = ref<PatchListItem[]>([])
const version = ref('')
const report = ref<PatchReport | null>(null)
const analysis = ref<PatchAnalysis | null>(null)
const loading = ref(false)
const error = ref('')
const onlyInStock = ref(false)
const sort = ref<SortState | undefined>()
const expanded = reactive(new Set<number>())

const day = (date: string) => dayjs(date).format('DD/MM/YYYY')

const recommendations = computed(() => {
  const items = analysis.value?.result?.recommendations ?? []

  return new Map(items.map((item) => [heroKey(item.hero), item]))
})

const recommendationOf = (hero: HeroPatchReport) => recommendations.value.get(heroKey(hero.hero))

const balanceTone = (hero: HeroPatchReport) => {
  const balance = balanceOf(hero)
  if (balance > 0) return 'green'
  if (balance < 0) return 'red'

  return 'muted'
}

const visibleHeroes = computed(() => {
  const heroes = report.value?.heroes ?? []
  if (!onlyInStock.value) return heroes

  return heroes.filter((hero) => hero.store.in_stock > 0)
})

const rows = computed(() => sortRows(visibleHeroes.value, SORTS, sort.value))

const sum = (pick: (hero: HeroPatchReport) => number) =>
  (report.value?.heroes ?? []).reduce((total, hero) => total + pick(hero), 0)

const stats = computed(() => {
  const patch = report.value?.patch

  return [
    { label: 'Heróis alterados', value: report.value?.heroes.length ?? 0, sub: patch && `lançado em ${day(patch.released_at)}` },
    { label: 'Buffs', value: sum((hero) => hero.buffs), tone: 'green' },
    { label: 'Nerfs', value: sum((hero) => hero.nerfs), tone: 'red' },
    { label: 'Pra revisar', value: sum((hero) => hero.review), sub: 'mudança sem número' },
    { label: 'Dias desde o patch', value: patch?.days_since_patch ?? 0 },
  ]
})

const toggleSort = (column: string) => {
  sort.value = nextSort(sort.value, column)
}

const toggleHero = (heroId: number) => {
  if (expanded.has(heroId)) return expanded.delete(heroId)

  expanded.add(heroId)
}

const fetchReport = async () => {
  loading.value = true
  error.value = ''
  try {
    const { data } = await patchAnalysisApi.report(version.value)
    report.value = data
    analysis.value = data.analysis
  } catch (err: any) {
    error.value = err.response?.data?.message ?? 'Não carregou o patch.'
  } finally {
    loading.value = false
  }
}

const fetchPatches = async () => {
  try {
    const { data } = await patchAnalysisApi.patches()
    patches.value = data
    version.value = data[0]?.version ?? ''
  } catch (err: any) {
    error.value = err.response?.data?.message ?? 'Não carregou a lista de patches.'
  }
}

watch(version, () => {
  expanded.clear()
  fetchReport()
})
onMounted(fetchPatches)
</script>

<style lang="stylus" scoped>
@import '../../styles/report-view.styl'

.header-actions
  display flex
  flex-wrap wrap
  gap 0.5rem

.page-title
  display flex
  align-items center
  gap 0.5rem

.patch-select
  padding 0.5rem 0.75rem
  background rgba(255,255,255,0.04)
  border 1px solid rgba(255,255,255,0.1)
  border-radius 8px
  color #fff
  font-size 0.85rem

.toggle
  display inline-flex
  align-items center
  gap 0.4rem
  font-size 0.85rem
  color #cbd5e1
  cursor pointer

.hero-row
  cursor pointer
  td:first-child
    white-space nowrap

.changes-row td
  background rgba(0,0,0,0.2)

.badge
  font-size 0.72rem
  padding 2px 8px
  border-radius 99px
  white-space nowrap
  background rgba(255,255,255,0.08)
  &.action-raise, &.action-buy_stock
    background rgba(52,211,153,0.15)
    color #34d399
  &.action-hold
    background rgba(251,191,36,0.12)
    color #fbbf24
  &.action-lower
    background rgba(252,129,129,0.12)
    color #fc8181
</style>
