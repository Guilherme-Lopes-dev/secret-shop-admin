<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { adminService, type RewardSimulationRow } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'

const router = useRouter()

const rows = ref<RewardSimulationRow[]>([])
const loading = ref(true)
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const purchaseCountTotal = ref(0)
const maxRewardTier = ref(3)
const searchQuery = ref('')
// Vazio = o próximo baú que cada um resgataria; fixo = "e se todos fossem no N".
const tierFilter = ref('')
const tierOptions = computed(() => Array.from({ length: maxRewardTier.value }, (_, i) => i + 1))
let searchTimeout: ReturnType<typeof setTimeout> | null = null

const REASON: Record<RewardSimulationRow['reason'], { label: string; cls: string }> = {
  ok:          { label: 'Sorteado',      cls: 'reason-ok' },
  locked:      { label: 'Nível travado', cls: 'reason-muted' },
  all_claimed: { label: 'Já pegou todos', cls: 'reason-muted' },
  no_stock:    { label: 'Sem estoque',   cls: 'reason-warn' },
}

const reasonOf = (row: RewardSimulationRow) => REASON[row.reason] ?? { label: row.reason, cls: '' }

// Cada linha sorteia sozinha, sem reservar nada — duas podem cair na mesma skin.
// Sem marcar, a página parece prometer um item por usuário.
const repeated = computed(() => {
  const seen = new Map<string, number>()
  rows.value.forEach((row) => {
    if (!row.item) return
    seen.set(row.item.id, (seen.get(row.item.id) ?? 0) + 1)
  })

  return seen
})

const isRepeated = (row: RewardSimulationRow) => (repeated.value.get(row.item?.id ?? '') ?? 0) > 1
// Os dois totais saem da mesma página de linhas — o sorteio só existe pra quem está nela.
const simulatedGifts = computed(() => rows.value.filter((row) => row.item))
const simulatedGiftCount = computed(() => simulatedGifts.value.length)
const prizeValueTotal = computed(() =>
  simulatedGifts.value.reduce((sum, row) => sum + (row.item?.price ?? 0), 0),
)

// Ordena só a página que já está na mão: gasto e nível não são coluna no banco,
// ordenar lá obrigaria a calcular a base inteira antes de paginar.
const SORTERS: Record<string, (a: RewardSimulationRow, b: RewardSimulationRow) => number> = {
  spent: (a, b) => b.spent - a.spent,
  item:  (a, b) => (b.item?.price ?? 0) - (a.item?.price ?? 0),
  tier:  (a, b) => (b.tier ?? 0) - (a.tier ?? 0),
  stock: (a, b) => a.stock - b.stock,
}

const sortBy = ref('')

const sortedRows = computed(() => {
  const sorter = SORTERS[sortBy.value]
  if (!sorter) return rows.value

  return [...rows.value].sort(sorter)
})

const fetchSimulation = async (page: number) => {
  loading.value = true
  try {
    const { data } = await adminService.simulateRewards({
      page,
      search: searchQuery.value || undefined,
      tier: Number(tierFilter.value) || undefined,
    })
    rows.value = data.data
    totalPages.value = data.meta.totalPages
    totalItems.value = data.meta.total
    purchaseCountTotal.value = data.meta.purchase_count_total ?? 0
    maxRewardTier.value = data.meta.max_reward_tier
    currentPage.value = data.meta.page
  } catch (e: any) {
    toast.error(e?.response?.data?.message || 'Erro ao simular os brindes.')
  } finally {
    loading.value = false
  }
}

// Sortear de novo é só refazer a chamada: o sorteio roda no servidor toda vez.
const reroll = () => fetchSimulation(currentPage.value)

const onFilterChange = () => fetchSimulation(1)
const onSearchInput = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => fetchSimulation(1), 400)
}

const skinThumb = (icon?: string | null): string | null =>
  icon ? `https://steamcommunity-a.akamaihd.net/economy/image/${icon}/62fx62f` : null

const openUser = (row: RewardSimulationRow) => router.push(`/users/${row.user.id}`)

const nextPage = () => { if (currentPage.value < totalPages.value) fetchSimulation(currentPage.value + 1) }
const prevPage = () => { if (currentPage.value > 1) fetchSimulation(currentPage.value - 1) }

onMounted(() => fetchSimulation(1))
</script>

<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <h1 class="page-title">Simular brindes</h1>
        <p class="page-subtitle">
          {{ totalItems }} usuário(s) com compra ·
          <b class="highlight">nada é reservado nem enviado</b> — cada sorteio é só um ensaio
        </p>
        <div class="reward-total">
          <Icon icon="mdi:trophy-outline" />
          <!-- O sorteio roda só nos usuários da página; somar a base inteira custa ~5 queries por usuário. -->
          <span>Prêmios nesta página</span>
          <strong>{{ formatCurrency(prizeValueTotal) }}</strong>
        </div>
        <div class="reward-counts">
          <span><b>{{ simulatedGiftCount }}</b> presente(s) nesta página</span>
          <span><b>{{ purchaseCountTotal }}</b> venda(s) no total</span>
        </div>
      </div>
      <div class="header-actions">
        <select v-model="tierFilter" @change="onFilterChange" class="filter-select">
          <option value="">Próximo baú de cada um</option>
          <option v-for="tier in tierOptions" :key="tier" :value="String(tier)">Forçar baú {{ tier }}</option>
        </select>
        <button class="btn-roll" :disabled="loading" @click="reroll">
          <Icon :icon="loading ? 'mdi:loading' : 'mdi:dice-multiple-outline'" :class="{ spinning: loading }" />
          Sortear de novo
        </button>
      </div>
    </header>

    <div class="filters-row">
      <div class="search-wrap">
        <Icon icon="mdi:magnify" class="search-icon" />
        <input
          v-model="searchQuery"
          @input="onSearchInput"
          type="search"
          placeholder="Buscar por usuário..."
          class="search-input"
        />
      </div>

      <select v-model="sortBy" class="filter-select" title="Ordena só a página atual">
        <option value="">Ordem de cadastro</option>
        <option value="spent">Maior gasto</option>
        <option value="item">Brinde mais caro</option>
        <option value="tier">Maior nível</option>
        <option value="stock">Menor estoque</option>
      </select>
    </div>

    <div class="section">
      <div v-if="loading" class="loading-state">Sorteando...</div>
      <div v-else>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Gasto</th>
                <th class="center">Baú a resgatar</th>
                <th>Faixa do brinde</th>
                <th>Brinde sorteado</th>
                <th class="center">Situação</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in sortedRows" :key="row.user.id">
                <td>
                  <button class="user-cell" @click="openUser(row)">
                    <img v-if="row.user.avatar" :src="row.user.avatar" class="user-avatar" alt="" />
                    <div>
                      <span class="user-name">{{ row.user.username || '—' }}</span>
                      <small v-if="!row.user.has_trade_link" class="user-warn">
                        <Icon icon="mdi:alert" width="12" /> sem trade link
                      </small>
                    </div>
                  </button>
                </td>
                <td class="price">{{ formatCurrency(row.spent) }}</td>
                <td class="center">
                  <span class="tier-cell">
                    baú {{ row.tier ?? '—' }}<span class="tier-of">/{{ maxRewardTier }}</span>
                  </span>
                  <small class="tier-reached">nível {{ row.reached_tier }}</small>
                </td>
                <td>
                  <template v-if="row.band">
                    <span class="band">
                      {{ formatCurrency(row.band.min_price) }} – {{ formatCurrency(row.band.max_price) }}
                    </span>
                    <small class="stock" :class="{ 'stock--low': row.stock < 5 }">
                      {{ row.stock }} no estoque
                    </small>
                  </template>
                  <span v-else class="muted">—</span>
                </td>
                <td>
                  <div v-if="row.item" class="item-cell">
                    <img v-if="skinThumb(row.item.icon_url_large)" :src="skinThumb(row.item.icon_url_large)!" class="item-thumb" alt="" />
                    <div v-else class="item-thumb item-thumb--empty"><Icon icon="mdi:gift-outline" /></div>
                    <div>
                      <span class="item-name">
                        {{ row.item.name }}
                        <em v-if="isRepeated(row)" class="repeated" title="Outro usuário caiu na mesma skin nesta página">
                          repetido
                        </em>
                      </span>
                      <small class="item-hero">
                        {{ row.item.hero || 'sem herói' }} · {{ formatCurrency(row.item.price) }}
                      </small>
                    </div>
                  </div>
                  <span v-else class="muted">—</span>
                </td>
                <td class="center">
                  <span class="status-badge" :class="reasonOf(row).cls">{{ reasonOf(row).label }}</span>
                </td>
              </tr>
              <tr v-if="rows.length === 0">
                <td colspan="6" class="empty-state">Nenhum usuário nesta visão.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pagination" v-if="totalPages > 1">
          <button class="page-btn" :disabled="currentPage === 1" @click="prevPage">Anterior</button>
          <span class="page-info">Página {{ currentPage }} de {{ totalPages }}</span>
          <button class="page-btn" :disabled="currentPage === totalPages" @click="nextPage">Próxima</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="stylus" scoped>
@import './rewards.styl'

.view-wrap
    padding 2rem
    color #fff
    background #121214
    min-height 100vh

.page-header
    display flex
    align-items flex-start
    justify-content space-between
    gap 1rem
    flex-wrap wrap
    margin-bottom 2rem

.page-title
    font-size 1.8rem
    font-weight 700
    margin-bottom 0.25rem

.page-subtitle
    color #94a3b8
    font-size 0.9rem

.highlight
    color #ff9800

.header-actions
    display flex
    gap 0.75rem
    align-items center
    flex-wrap wrap

.filter-select
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.5rem 0.75rem
    font-size 0.875rem
    outline none
    cursor pointer

    option
        background #1a1a1e

.btn-roll
    display inline-flex
    align-items center
    gap 0.4rem
    padding 0.5rem 0.85rem
    border-radius 8px
    font-size 0.875rem
    font-weight 600
    cursor pointer
    background rgba(99,102,241,0.14)
    border 1px solid rgba(99,102,241,0.35)
    color #a5b4fc

    &:hover:not(:disabled)
        background rgba(99,102,241,0.24)

    &:disabled
        opacity 0.5
        cursor not-allowed

.filters-row
    display flex
    align-items center
    gap 0.75rem
    flex-wrap wrap
    margin-bottom 1.25rem

.search-wrap
    position relative
    flex 1
    min-width 200px

.search-icon
    position absolute
    left 0.65rem
    top 50%
    transform translateY(-50%)
    color #64748b
    font-size 1rem
    pointer-events none

.search-input
    width 100%
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.5rem 0.75rem 0.5rem 2.1rem
    font-size 0.875rem
    outline none
    box-sizing border-box

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.loading-state
    padding 3rem
    text-align center
    color #94a3b8

.table-wrapper
    overflow-x auto
    margin-bottom 1.5rem

table
    width 100%
    border-collapse collapse

    th
        text-align left
        color #94a3b8
        font-size 0.78rem
        font-weight 500
        padding 0.75rem
        border-bottom 1px solid rgba(255,255,255,0.05)
        white-space nowrap
        text-transform uppercase

    td
        padding 0.85rem 0.75rem
        font-size 0.875rem
        border-bottom 1px solid rgba(255,255,255,0.04)
        vertical-align middle

        &.center
            text-align center

        &.price
            font-weight 600
            color #4caf50

.user-cell
    display flex
    align-items center
    gap 0.6rem
    padding 0
    border none
    background transparent
    color inherit
    text-align left
    cursor pointer

    &:hover .user-name
        color #6366f1

.user-avatar
    width 32px
    height 32px
    border-radius 50%
    object-fit cover

.user-name
    display block
    font-weight 500
    font-size 0.85rem

.user-warn
    display flex
    align-items center
    gap 0.2rem
    color #ff9800
    font-size 0.72rem

.tier-cell
    font-weight 600
    white-space nowrap

.tier-of
    color #64748b
    font-weight 500

.tier-reached
    display block
    color #64748b
    font-size 0.7rem

.band
    color #cbd5e1
    font-size 0.82rem
    white-space nowrap

.muted
    color #64748b

.stock
    display block
    color #64748b
    font-size 0.72rem

.stock--low
    color #ff9800

.repeated
    margin-left 0.35rem
    padding 0.1rem 0.35rem
    border-radius 4px
    background rgba(255,152,0,0.14)
    color #ff9800
    font-size 0.65rem
    font-style normal
    text-transform uppercase
    letter-spacing 0.03em

.item-cell
    display flex
    align-items center
    gap 0.625rem

.item-thumb
    width 40px
    height 40px
    object-fit contain
    border-radius 4px

.item-thumb--empty
    display flex
    align-items center
    justify-content center
    background rgba(255,255,255,0.04)
    color #64748b

.item-name
    display block
    font-weight 500
    font-size 0.85rem

.item-hero
    display block
    color #64748b
    font-size 0.72rem

.status-badge
    display inline-block
    padding 0.25rem 0.6rem
    border-radius 999px
    font-size 0.72rem
    font-weight 600

.reason-ok
    background rgba(76,175,80,0.12)
    color #4caf50

.reason-warn
    background rgba(255,152,0,0.12)
    color #ff9800

.reason-muted
    background rgba(255,255,255,0.06)
    color #94a3b8

.empty-state
    padding 3rem
    text-align center
    color #64748b

.pagination
    display flex
    align-items center
    justify-content center
    gap 1rem

.page-btn
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.45rem 0.9rem
    font-size 0.85rem
    cursor pointer

    &:disabled
        opacity 0.4
        cursor not-allowed

.page-info
    color #94a3b8
    font-size 0.85rem

.spinning
    animation spin 1s linear infinite

@keyframes spin
    to
        transform rotate(360deg)
</style>
