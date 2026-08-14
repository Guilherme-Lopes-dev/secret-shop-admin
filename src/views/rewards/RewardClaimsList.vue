<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import ConfirmActionModal from '@/components/common/ConfirmActionModal.vue'
import { adminService, type RewardClaim } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'

const router = useRouter()

const claims = ref<RewardClaim[]>([])
const loading = ref(true)
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const awaitingReview = ref(0)
const searchQuery = ref('')
// Abre na fila de análise: é pra isso que a tela existe.
const statusFilter = ref('AWAITING_REVIEW')
const tierFilter = ref('')
// Valor digitado em reais; a API filtra em centavos.
const minPrice = ref('')
const maxPrice = ref('')
const dateFrom = ref('')
const dateTo = ref('')
let searchTimeout: ReturnType<typeof setTimeout> | null = null

const toCents = (value: string) => {
  const parsed = Number(value.replace(',', '.'))
  if (!value || !Number.isFinite(parsed)) return undefined

  return Math.round(parsed * 100)
}

const statusOptions = [
  { label: 'Aguardando liberação', value: 'AWAITING_REVIEW' },
  { label: 'Liberados', value: 'PENDING' },
  { label: 'Entregues', value: 'COMPLETED' },
  { label: 'Negados', value: 'REJECTED' },
  { label: 'Todos', value: '' },
]

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  AWAITING_REVIEW: { label: 'Em análise', cls: 'status-pending' },
  PENDING:         { label: 'Liberado',   cls: 'status-progress' },
  IN_PROGRESS:     { label: 'Enviando',   cls: 'status-progress' },
  COMPLETED:       { label: 'Entregue',   cls: 'status-completed' },
  ACTION_REQUIRED: { label: 'Travado',    cls: 'status-canceled' },
  REJECTED:        { label: 'Negado',     cls: 'status-canceled' },
}

const statusOf = (status: string) => STATUS_LABEL[status] ?? { label: status, cls: '' }

const busy = ref<Set<string>>(new Set())
const isBusy = (claim: RewardClaim) => busy.value.has(claim.order_uuid)

const fetchClaims = async (page: number) => {
  loading.value = true
  try {
    const { data } = await adminService.getRewardClaims({
      page,
      status: statusFilter.value || undefined,
      search: searchQuery.value || undefined,
      tier: Number(tierFilter.value) || undefined,
      min_price: toCents(minPrice.value),
      max_price: toCents(maxPrice.value),
      from: dateFrom.value || undefined,
      // Fim do dia, senão "até hoje" corta tudo que foi resgatado hoje.
      to: dateTo.value ? `${dateTo.value}T23:59:59.999Z` : undefined,
    })
    claims.value = data.data
    totalPages.value = data.meta.totalPages
    totalItems.value = data.meta.total
    currentPage.value = data.meta.page
    awaitingReview.value = data.meta.awaiting_review
  } catch (e: any) {
    toast.error(e?.response?.data?.message || 'Erro ao carregar os brindes.')
  } finally {
    loading.value = false
  }
}

// Liberar e negar são a mesma dança: trava a linha, chama, recarrega a página.
const runAction = async (
  claim: RewardClaim,
  action: () => Promise<unknown>,
  done: string,
) => {
  if (isBusy(claim)) return

  busy.value = new Set([...busy.value, claim.order_uuid])
  try {
    await action()
    toast.success(done)
    await fetchClaims(currentPage.value)
  } catch (e: any) {
    toast.error(e?.response?.data?.message || 'Não deu para concluir.')
  } finally {
    busy.value = new Set([...busy.value].filter(id => id !== claim.order_uuid))
  }
}

const release = (claim: RewardClaim) =>
  runAction(
    claim,
    () => adminService.releaseRewardClaim(claim.order_uuid),
    `${claim.order_number} liberado — trade a caminho.`,
  )

// Recusa passa por modal, não por window.prompt: depois de alguns diálogos
// seguidos o Chrome oferece "impedir diálogos adicionais", e daí o prompt volta
// null direto — o botão Negar pararia de funcionar em silêncio numa triagem.
const rejecting = ref<RewardClaim | null>(null)
const rejectReason = ref('')

const askReject = (claim: RewardClaim) => {
  rejectReason.value = ''
  rejecting.value = claim
}

const confirmReject = async () => {
  const claim = rejecting.value
  if (!claim) return

  const reason = rejectReason.value.trim()
  rejecting.value = null

  await runAction(
    claim,
    () => adminService.rejectRewardClaim(claim.order_uuid, reason || undefined),
    `${claim.order_number} negado — skin voltou pro estoque.`,
  )
}

const skinThumb = (icon?: string | null): string | null =>
  icon ? `https://steamcommunity-a.akamaihd.net/economy/image/${icon}/62fx62f` : null

const openUser = (claim: RewardClaim) => {
  if (!claim.user.id) return
  router.push(`/users/${claim.user.id}`)
}

// Chave geral: desligada, ninguém resgata e a escada some da tela do usuário.
// A fila daqui continua liberando o que já foi resgatado.
const systemEnabled = ref(true)
const togglingSystem = ref(false)

const fetchConfig = () =>
  adminService
    .getRewardsConfig()
    .then(({ data }) => (systemEnabled.value = data.enabled))
    .catch(() => undefined)

const toggleSystem = async () => {
  const next = !systemEnabled.value
  const verb = next ? 'ligar' : 'desligar'
  if (!window.confirm(`Tem certeza que deseja ${verb} os brindes para TODOS os usuários?`)) return

  togglingSystem.value = true
  try {
    const { data } = await adminService.setRewardsEnabled(next)
    systemEnabled.value = data.enabled
    toast.success(data.enabled ? 'Brindes ligados para todos.' : 'Brindes desligados para todos.')
  } catch (e: any) {
    toast.error(e?.response?.data?.message || 'Não deu para mudar o sistema de brindes.')
  } finally {
    togglingSystem.value = false
  }
}

const onFilterChange = () => fetchClaims(1)
// Campo digitado espera a pessoa parar de digitar; select e data batem na hora.
const onTypedFilter = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => fetchClaims(1), 400)
}

const hasFilters = computed(() =>
  Boolean(
    searchQuery.value ||
    tierFilter.value ||
    minPrice.value ||
    maxPrice.value ||
    dateFrom.value ||
    dateTo.value,
  ),
)

const clearFilters = () => {
  searchQuery.value = ''
  tierFilter.value = ''
  minPrice.value = ''
  maxPrice.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  fetchClaims(1)
}
const nextPage = () => { if (currentPage.value < totalPages.value) fetchClaims(currentPage.value + 1) }
const prevPage = () => { if (currentPage.value > 1) fetchClaims(currentPage.value - 1) }

onMounted(() => {
  fetchClaims(1)
  fetchConfig()
})
</script>

<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <h1 class="page-title">Brindes</h1>
        <p class="page-subtitle">
          {{ totalItems }} resgate(s) nesta visão ·
          <b class="highlight">{{ awaitingReview }}</b> aguardando liberação
        </p>
      </div>
      <div class="header-actions">
        <button
          class="btn-system"
          :class="systemEnabled ? 'btn-system--on' : 'btn-system--off'"
          :disabled="togglingSystem"
          :title="systemEnabled ? 'Desligar os brindes para todos' : 'Ligar os brindes para todos'"
          @click="toggleSystem"
        >
          <Icon :icon="systemEnabled ? 'mdi:gift-outline' : 'mdi:gift-off-outline'" />
          {{ systemEnabled ? 'Brindes ligados' : 'Brindes desligados' }}
        </button>
        <select v-model="statusFilter" @change="onFilterChange" class="filter-select">
          <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>
    </header>

    <div class="filters-row">
      <div class="search-wrap">
        <Icon icon="mdi:magnify" class="search-icon" />
        <input
          v-model="searchQuery"
          @input="onTypedFilter"
          type="search"
          placeholder="Buscar por usuário ou pedido..."
          class="search-input"
        />
      </div>

      <label class="filter-field">
        <span>Nível</span>
        <select v-model="tierFilter" @change="onFilterChange" class="filter-select">
          <option value="">Todos</option>
          <option v-for="tier in [1, 2, 3]" :key="tier" :value="String(tier)">Nível {{ tier }}</option>
        </select>
      </label>

      <label class="filter-field">
        <span>Valor (R$)</span>
        <div class="filter-pair">
          <input v-model="minPrice" @input="onTypedFilter" type="number" min="0" step="0.01" placeholder="mín" class="filter-input" />
          <input v-model="maxPrice" @input="onTypedFilter" type="number" min="0" step="0.01" placeholder="máx" class="filter-input" />
        </div>
      </label>

      <label class="filter-field">
        <span>Resgatado em</span>
        <div class="filter-pair">
          <input v-model="dateFrom" @change="onFilterChange" type="date" class="filter-input" />
          <input v-model="dateTo" @change="onFilterChange" type="date" class="filter-input" />
        </div>
      </label>

      <button v-if="hasFilters" class="btn-clear" @click="clearFilters">
        <Icon icon="mdi:filter-remove-outline" /> Limpar
      </button>
    </div>

    <div class="section">
      <div v-if="loading" class="loading-state">Carregando brindes...</div>
      <div v-else>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Item sorteado</th>
                <th>Nível</th>
                <th>Custo</th>
                <th>Status</th>
                <th>Resgatado em</th>
                <th class="center">Ação</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="claim in claims" :key="claim.order_uuid">
                <td>
                  <button class="user-cell" @click="openUser(claim)">
                    <img v-if="claim.user.avatar" :src="claim.user.avatar" class="user-avatar" alt="" />
                    <div>
                      <span class="user-name">{{ claim.user.username || '—' }}</span>
                      <small v-if="!claim.user.has_trade_link" class="user-warn">
                        <Icon icon="mdi:alert" width="12" /> sem trade link
                      </small>
                      <small v-else class="user-order">{{ claim.order_number }}</small>
                    </div>
                  </button>
                </td>
                <td>
                  <div class="item-cell">
                    <img v-if="skinThumb(claim.item.icon_url_large)" :src="skinThumb(claim.item.icon_url_large)!" class="item-thumb" alt="" />
                    <div v-else class="item-thumb item-thumb--empty"><Icon icon="mdi:gift-outline" /></div>
                    <div>
                      <span class="item-name">{{ claim.item.name || '—' }}</span>
                      <small class="item-hero">{{ claim.item.hero || 'sem herói' }}</small>
                    </div>
                  </div>
                </td>
                <td class="center">{{ claim.tier ?? '—' }}</td>
                <td class="price">{{ formatCurrency(claim.item.retail_price) }}</td>
                <td>
                  <span class="status-badge" :class="statusOf(claim.status).cls">
                    {{ statusOf(claim.status).label }}
                  </span>
                </td>
                <td>{{ $dayjs(claim.created_at).format('DD/MM/YY HH:mm') }}</td>
                <td class="center">
                  <div v-if="claim.status === 'AWAITING_REVIEW'" class="row-actions">
                    <button
                      class="btn-release"
                      :disabled="isBusy(claim) || !claim.user.has_trade_link"
                      :title="claim.user.has_trade_link ? 'Liberar e enviar a trade' : 'Usuário sem trade link'"
                      @click="release(claim)"
                    >
                      <Icon :icon="isBusy(claim) ? 'mdi:loading' : 'mdi:check'" :class="{ spinning: isBusy(claim) }" />
                      Liberar
                    </button>
                    <button class="btn-reject" :disabled="isBusy(claim)" @click="askReject(claim)">
                      <Icon icon="mdi:close" /> Negar
                    </button>
                  </div>
                  <span v-else class="row-done">—</span>
                </td>
              </tr>
              <tr v-if="claims.length === 0">
                <td colspan="7" class="empty-state">Nenhum brinde nesta visão.</td>
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

    <ConfirmActionModal
      :open="!!rejecting"
      icon="mdi:gift-off-outline"
      variant="danger"
      title="Negar este brinde"
      :description="rejecting
        ? `${rejecting.item.name || 'A skin sorteada'} volta pro estoque e ${rejecting.user.username || 'o usuário'} pode resgatar o nível ${rejecting.tier} de novo — vai cair outro sorteio. O pedido ${rejecting.order_number} fica gravado como negado.`
        : ''"
      confirm-label="Negar brinde"
      loading-label="Negando..."
      :delay-seconds="0"
      @update:open="rejecting = null"
      @confirm="confirmReject"
    >
      <label class="form-label" for="reject-reason">Motivo (opcional)</label>
      <textarea
        id="reject-reason"
        v-model="rejectReason"
        class="form-textarea"
        rows="3"
        placeholder="Fica no histórico da entrega, junto do seu usuário."
      />
    </ConfirmActionModal>
  </div>
</template>

<style lang="stylus" scoped>
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

.btn-system
    display inline-flex
    align-items center
    gap 0.4rem
    padding 0.5rem 0.85rem
    border-radius 8px
    font-size 0.875rem
    font-weight 600
    cursor pointer
    transition all 0.15s

    &:disabled
        opacity 0.4
        cursor not-allowed

.btn-system--on
    background rgba(76,175,80,0.12)
    border 1px solid rgba(76,175,80,0.3)
    color #4caf50

    &:hover:not(:disabled)
        background rgba(76,175,80,0.22)

.btn-system--off
    background rgba(244,67,54,0.12)
    border 1px solid rgba(244,67,54,0.3)
    color #f44336

    &:hover:not(:disabled)
        background rgba(244,67,54,0.22)

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

.filter-field
    display flex
    flex-direction column
    gap 0.25rem

    > span
        color #64748b
        font-size 0.7rem
        text-transform uppercase
        letter-spacing 0.04em

.filter-pair
    display flex
    gap 0.35rem

.filter-input
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.5rem 0.6rem
    font-size 0.875rem
    outline none
    width 110px
    box-sizing border-box

    &::-webkit-calendar-picker-indicator
        filter invert(0.6)

.btn-clear
    display inline-flex
    align-items center
    gap 0.3rem
    align-self flex-end
    background transparent
    border 1px solid rgba(255,255,255,0.12)
    border-radius 8px
    color #94a3b8
    padding 0.5rem 0.75rem
    font-size 0.8rem
    cursor pointer

    &:hover
        color #fff
        border-color rgba(255,255,255,0.25)

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

    &::placeholder
        color #64748b

    &:focus
        border-color rgba(99,102,241,0.4)

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

.user-order
    display block
    color #64748b
    font-size 0.72rem
    font-family monospace

.user-warn
    display flex
    align-items center
    gap 0.2rem
    color #ff9800
    font-size 0.72rem

.item-cell
    display flex
    align-items center
    gap 0.625rem

.item-thumb
    width 40px
    height 40px
    object-fit contain
    border-radius 4px
    background rgba(255,255,255,0.04)

    &--empty
        display flex
        align-items center
        justify-content center
        color #64748b

.item-name
    display block
    font-weight 500
    font-size 0.85rem

.item-hero
    display block
    color #64748b
    font-size 0.73rem

.status-badge
    padding 3px 8px
    border-radius 5px
    font-size 0.72rem
    font-weight 600
    text-transform uppercase
    white-space nowrap

.status-completed
    background rgba(76,175,80,0.1)
    color #4caf50

.status-pending
    background rgba(255,152,0,0.1)
    color #ff9800

.status-progress
    background rgba(99,102,241,0.12)
    color #818cf8

.status-canceled
    background rgba(244,67,54,0.1)
    color #f44336

.row-actions
    display inline-flex
    gap 0.4rem

.btn-release,
.btn-reject
    display inline-flex
    align-items center
    gap 0.3rem
    padding 0.4rem 0.75rem
    border-radius 7px
    font-size 0.8rem
    font-weight 600
    cursor pointer
    transition all 0.15s

    &:disabled
        opacity 0.4
        cursor not-allowed

.btn-release
    background rgba(76,175,80,0.12)
    border 1px solid rgba(76,175,80,0.3)
    color #4caf50

    &:hover:not(:disabled)
        background rgba(76,175,80,0.22)

.btn-reject
    background transparent
    border 1px solid rgba(244,67,54,0.25)
    color #f44336

    &:hover:not(:disabled)
        background rgba(244,67,54,0.12)

.row-done
    color #64748b

.form-label
    display block
    margin-bottom 0.4rem
    color #94a3b8
    font-weight 500

.form-textarea
    width 100%
    box-sizing border-box
    background #101014
    border 1px solid rgba(255,255,255,0.1)
    border-radius 8px
    color #fff
    font-family inherit
    resize vertical
    outline none

    &::placeholder
        color #64748b

    &:focus
        border-color rgba(239,68,68,0.4)

.spinning
    animation spin 1s linear infinite

@keyframes spin
    from transform rotate(0deg)
    to transform rotate(360deg)

.empty-state
    text-align center
    padding 3rem
    color #94a3b8

.pagination
    display flex
    justify-content flex-end
    align-items center
    gap 1rem
    padding-top 1rem
    border-top 1px solid rgba(255,255,255,0.05)

.page-btn
    background #2a2a30
    color #fff
    border 1px solid rgba(255,255,255,0.1)
    padding 0.45rem 1rem
    border-radius 6px
    cursor pointer
    font-size 0.85rem
    transition all 0.2s

    &:hover:not(:disabled)
        background #3a3a42

    &:disabled
        opacity 0.4
        cursor not-allowed

.page-info
    color #94a3b8
    font-size 0.875rem
</style>
