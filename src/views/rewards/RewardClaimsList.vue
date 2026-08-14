<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import ConfirmActionModal from '@/components/common/ConfirmActionModal.vue'
import {
  adminService,
  type BulkReleaseFilters,
  type BulkReleaseGift,
  type RewardClaim,
} from '@/services/admin/admin.service'
import BulkReleaseConsole from './BulkReleaseConsole.vue'
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
// Gasto do usuário: só a liberação em lote filtra por ele — não é coluna, é
// soma de skins + collector + físico, cara demais pra paginar a fila inteira.
const minSpent = ref('')
const maxSpent = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const bulkLimit = ref(20)
const pageSize = ref(50)
const pageSizes = [20, 50, 100]

// Seleção manual: some ao trocar de página ou filtro — marcar 100 e liberar
// outra página seria o pior erro possível nesta tela.
const selected = ref<Set<string>>(new Set())

const isSelectable = (claim: RewardClaim) =>
  claim.status === 'AWAITING_REVIEW' && claim.user.has_trade_link

const selectableClaims = computed(() => claims.value.filter(isSelectable))

const isSelected = (claim: RewardClaim) => selected.value.has(claim.order_uuid)

const toggleSelected = (claim: RewardClaim) => {
  const next = new Set(selected.value)
  if (!next.delete(claim.order_uuid)) next.add(claim.order_uuid)

  selected.value = next
}

const allSelected = computed(
  () => selectableClaims.value.length > 0 && selected.value.size === selectableClaims.value.length,
)

const toggleAll = () => {
  selected.value = allSelected.value
    ? new Set()
    : new Set(selectableClaims.value.map(claim => claim.order_uuid))
}
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
      limit: pageSize.value,
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
    selected.value = new Set()
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

const bulkFilters = (): BulkReleaseFilters => ({
  limit: bulkLimit.value,
  search: searchQuery.value || undefined,
  tier: Number(tierFilter.value) || undefined,
  min_price: toCents(minPrice.value),
  max_price: toCents(maxPrice.value),
  min_spent: toCents(minSpent.value),
  max_spent: toCents(maxSpent.value),
  from: dateFrom.value || undefined,
  to: dateTo.value ? `${dateTo.value}T23:59:59.999Z` : undefined,
})

const bulkOpen = ref(false)
const bulkRunning = ref(false)
// O que o console de tela cheia vai mostrar — é a lista final, não um filtro.
const bulkGifts = ref<BulkReleaseGift[]>([])
const bulkNote = ref('')

const bulkWarning = (size: number) =>
  size > 50 ? 'lote grande, o bot envia uma trade por vez' : ''

/**
 * Lote pelos filtros: a prévia vem do backend porque o gasto é calculado lá, e
 * o que ela devolve vira a lista final. Reenviar os filtros no confirmar deixaria
 * o servidor re-selecionar — outro admin liberando no meio mudaria o conjunto,
 * e a tela teria prometido um número diferente do que sai.
 */
const askBulkByFilters = async () => {
  bulkRunning.value = true
  try {
    const { data } = await adminService.previewBulkRelease(bulkFilters())

    if (!data.batch_size) {
      toast.info('Nenhum brinde em análise bate com os filtros atuais.')
      return
    }

    openConsole(
      data.gifts,
      [`${data.matched} na fila com esses filtros`, bulkWarning(data.batch_size)]
        .filter(Boolean)
        .join(' · '),
    )
  } catch (e: any) {
    toast.error(e?.response?.data?.message || 'Não deu para calcular o lote.')
  } finally {
    bulkRunning.value = false
  }
}

/** Lote pela seleção: as linhas marcadas na tabela já são a lista final. */
const askBulkBySelection = () => {
  const chosen = claims.value.filter(claim => selected.value.has(claim.order_uuid))
  if (!chosen.length) return

  openConsole(chosen.map(toBulkGift), bulkWarning(chosen.length))
}

const toBulkGift = (claim: RewardClaim): BulkReleaseGift => ({
  order_uuid: claim.order_uuid,
  order_number: claim.order_number,
  username: claim.user.username,
  avatar: claim.user.avatar,
  has_trade_link: claim.user.has_trade_link,
  spent: claim.user.spent,
  tier: claim.tier,
  // Fragmento cru: quem resolve a URL do Steam é o console, igual pro lote que
  // vem da prévia do backend.
  item: {
    name: claim.item.name,
    icon_url_large: claim.item.icon_url_large,
    retail_price: claim.item.retail_price,
  },
})

const openConsole = (gifts: BulkReleaseGift[], note: string) => {
  bulkGifts.value = gifts
  bulkNote.value = note
  bulkOpen.value = true
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
    minSpent.value ||
    maxSpent.value ||
    dateFrom.value ||
    dateTo.value,
  ),
)

const clearFilters = () => {
  searchQuery.value = ''
  tierFilter.value = ''
  minPrice.value = ''
  maxPrice.value = ''
  minSpent.value = ''
  maxSpent.value = ''
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
        <span title="Só a liberação em lote usa este filtro">Gasto do usuário (R$) *</span>
        <div class="filter-pair">
          <input v-model="minSpent" type="number" min="0" step="0.01" placeholder="mín" class="filter-input" />
          <input v-model="maxSpent" type="number" min="0" step="0.01" placeholder="máx" class="filter-input" />
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

    <div class="bulk-row">
      <button
        class="btn-bulk btn-bulk--selection"
        :disabled="bulkRunning || selected.size === 0"
        @click="askBulkBySelection"
      >
        <Icon icon="mdi:checkbox-multiple-marked-outline" />
        Liberar selecionados ({{ selected.size }})
      </button>

      <label class="filter-field">
        <span>Ou pelos filtros</span>
        <div class="filter-pair">
          <input v-model.number="bulkLimit" type="number" min="1" max="100" class="filter-input" />
          <button class="btn-bulk" :disabled="bulkRunning" @click="askBulkByFilters">
            <Icon icon="mdi:send-check-outline" />
            Liberar mais antigos
          </button>
        </div>
      </label>

      <label class="filter-field">
        <span>Por página</span>
        <select v-model.number="pageSize" @change="onFilterChange" class="filter-select">
          <option v-for="size in pageSizes" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>

      <p class="bulk-hint">
        Teto de 100 por vez. O bot envia uma trade por vez — lote grande não entrega
        mais rápido, só alonga a fila.
      </p>
    </div>

    <BulkReleaseConsole
      v-model:open="bulkOpen"
      :gifts="bulkGifts"
      :note="bulkNote"
      :arm-seconds="5"
      @finished="fetchClaims(currentPage)"
    />

    <div class="section">
      <div v-if="loading" class="loading-state">Carregando brindes...</div>
      <div v-else>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th class="check-col">
                  <input
                    type="checkbox"
                    :checked="allSelected"
                    :disabled="selectableClaims.length === 0"
                    :title="allSelected ? 'Limpar seleção' : 'Selecionar todos os liberáveis desta página'"
                    @change="toggleAll"
                  />
                </th>
                <th>Usuário</th>
                <th>Item sorteado</th>
                <th>Nível</th>
                <th>Custo</th>
                <th>Gasto</th>
                <th>Status</th>
                <th>Resgatado em</th>
                <th class="center">Ação</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="claim in claims" :key="claim.order_uuid" :class="{ 'row-selected': isSelected(claim) }">
                <td class="check-col">
                  <input
                    type="checkbox"
                    :checked="isSelected(claim)"
                    :disabled="!isSelectable(claim)"
                    :title="isSelectable(claim) ? 'Selecionar' : 'Só brinde em análise e com trade link entra no lote'"
                    @change="toggleSelected(claim)"
                  />
                </td>
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
                <td class="price spent">{{ claim.user.spent === null ? '—' : formatCurrency(claim.user.spent) }}</td>
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
                <td colspan="9" class="empty-state">Nenhum brinde nesta visão.</td>
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

.check-col
    width 36px
    text-align center

    input
        cursor pointer
        accent-color #ec4899

        &:disabled
            cursor not-allowed
            opacity 0.35

.row-selected
    background rgba(236,72,153,0.06)

.spent
    color #94a3b8

.bulk-row
    display flex
    align-items flex-end
    gap 1rem
    flex-wrap wrap
    margin-bottom 1.25rem
    padding 0.9rem 1rem
    border 1px solid rgba(255,255,255,0.06)
    border-radius 10px
    background rgba(236,72,153,0.04)

.bulk-hint
    flex 1
    min-width 260px
    color #64748b
    font-size 0.78rem
    line-height 1.4

.btn-bulk
    display inline-flex
    align-items center
    gap 0.4rem
    background rgba(236,72,153,0.14)
    border 1px solid rgba(236,72,153,0.35)
    border-radius 8px
    color #f472b6
    padding 0.5rem 0.9rem
    font-size 0.85rem
    font-weight 600
    cursor pointer
    white-space nowrap

    &:hover:not(:disabled)
        background rgba(236,72,153,0.22)

    &:disabled
        opacity 0.5
        cursor not-allowed

// Depois de `.btn-bulk`: mesma especificidade, quem vem por último pinta.
.btn-bulk--selection
    align-self flex-end
    background rgba(46,220,138,0.14)
    border-color rgba(46,220,138,0.35)
    color #2edc8a

    &:hover:not(:disabled)
        background rgba(46,220,138,0.22)

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
