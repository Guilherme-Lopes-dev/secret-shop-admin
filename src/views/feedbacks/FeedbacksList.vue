<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <h1 class="page-title">Feedbacks de compra</h1>
        <p class="page-subtitle">
          Coletado na tela de sucesso do checkout — avalia pagamento/checkout, não a entrega.
        </p>
      </div>
    </header>

    <div class="summary-row">
      <div class="summary-card">
        <span class="summary-label">Nota média (geral)</span>
        <strong class="summary-value">{{ averageLabel }}</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">Feedbacks recebidos</span>
        <strong class="summary-value">{{ overallTotal }}</strong>
      </div>
      <div class="summary-card">
        <span class="summary-label">Pendentes de tratativa</span>
        <strong class="summary-value" :class="{ 'summary-value--alert': pending > 0 }">
          {{ pending }}
        </strong>
      </div>
    </div>

    <div class="filters">
      <select v-model="handledFilter" class="filter-input" @change="reload">
        <option value="pending">Pendentes</option>
        <option value="handled">Tratados</option>
        <option value="all">Todos</option>
      </select>
      <select v-model="visibleFilter" class="filter-input" @change="reload">
        <option value="all">Visíveis e escondidos</option>
        <option value="visible">Só visíveis na home</option>
        <option value="hidden">Só escondidos</option>
      </select>
      <select v-model="ratingFilter" class="filter-input" @change="reload">
        <option value="">Todas as notas</option>
        <option v-for="n in 5" :key="n" :value="String(n)">{{ n }} estrela{{ n > 1 ? 's' : '' }}</option>
      </select>
    </div>

    <div class="section">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nota</th>
              <th>Comentário</th>
              <th>Cliente</th>
              <th>Pedido</th>
              <th>Enviado em</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <template v-if="loading">
              <tr v-for="n in 5" :key="n" class="skeleton-row">
                <td><div class="skeleton" style="width:90px;height:14px" /></td>
                <td><div class="skeleton" style="width:260px;height:14px" /></td>
                <td><div class="skeleton" style="width:120px;height:14px" /></td>
                <td><div class="skeleton" style="width:110px;height:14px" /></td>
                <td><div class="skeleton" style="width:90px;height:14px" /></td>
                <td><div class="skeleton" style="width:100px;height:28px;border-radius:8px" /></td>
              </tr>
            </template>
            <template v-else>
              <tr v-for="item in feedbacks" :key="item.id">
                <td>
                  <span class="rating" :class="ratingClass(item.rating)">
                    {{ '★'.repeat(item.rating) }}{{ '☆'.repeat(5 - item.rating) }}
                  </span>
                </td>
                <td>
                  <span v-if="item.comment" class="comment">{{ item.comment }}</span>
                  <span v-else class="text-muted">— sem comentário</span>
                  <p v-if="item.reply" class="reply-preview">
                    <strong>Resposta:</strong> {{ item.reply }}
                  </p>
                </td>
                <td>
                  <button
                    v-if="item.user?.id"
                    class="link-cell"
                    @click="goToUser(item.user.id)"
                  >
                    {{ item.user.username || 'Sem nome' }}
                  </button>
                  <span v-else class="title-cell">{{ item.user?.username || 'Sem nome' }}</span>
                  <p v-if="item.user?.steam_id" class="row-sub">{{ item.user.steam_id }}</p>
                </td>
                <td>
                  <button
                    v-if="item.order_uuid"
                    class="link-cell"
                    @click="goToOrder(item)"
                  >
                    {{ item.order_number || 'Ver pedido' }}
                  </button>
                  <span v-else class="text-muted">{{ item.order_number || '—' }}</span>
                  <p class="row-sub">{{ ORDER_TYPE_LABELS[item.order_type] || item.order_type }}</p>
                </td>
                <td class="text-muted">{{ $dayjs(item.created_at).format('DD/MM/YY HH:mm') }}</td>
                <td>
                  <div class="action-row">
                    <button class="btn-view" @click="openReply(item)">
                      {{ item.reply ? 'Editar resposta' : 'Responder' }}
                    </button>
                    <button
                      class="btn-ghost"
                      :disabled="!item.comment || visibilityUuid === item.id"
                      :title="item.comment ? '' : 'Sem comentário — nunca aparece na home.'"
                      @click="toggleVisibility(item)"
                    >
                      {{ visibilityLabel(item) }}
                    </button>
                    <span v-if="!item.is_visible" class="status-badge status-inactive">
                      Escondido
                    </span>
                    <span v-if="item.handled_at" class="status-badge status-active">Tratado</span>
                    <button
                      v-else
                      class="btn-ghost"
                      :disabled="handlingUuid === item.id"
                      @click="markHandled(item)"
                    >
                      {{ handlingUuid === item.id ? 'Salvando...' : 'Marcar tratado' }}
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="feedbacks.length === 0">
                <td colspan="6" class="empty-state">Nenhum feedback com esses filtros.</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="replyTarget" class="modal-overlay" @click.self="closeReply">
      <div class="modal">
        <h3>Responder feedback</h3>
        <p class="modal-quote">
          <span class="rating" :class="ratingClass(replyTarget.rating)">
            {{ '★'.repeat(replyTarget.rating) }}{{ '☆'.repeat(5 - replyTarget.rating) }}
          </span>
          {{ replyTarget.comment || 'Sem comentário.' }}
        </p>
        <p class="modal-hint">O comprador vê essa resposta no detalhe do pedido dele.</p>
        <textarea
          v-model="replyText"
          class="modal-textarea"
          rows="5"
          :maxlength="REPLY_MAX_LENGTH"
          placeholder="Escreva a resposta..."
        />
        <span class="modal-counter" :class="{ 'modal-counter--full': replyText.length >= REPLY_MAX_LENGTH }">
          {{ replyText.length }}/{{ REPLY_MAX_LENGTH }}
        </span>
        <div class="modal-actions">
          <button class="btn-ghost" @click="closeReply">Cancelar</button>
          <button class="btn-primary" :disabled="!replyText.trim() || replying" @click="sendReply">
            {{ replying ? 'Enviando...' : 'Enviar resposta' }}
          </button>
        </div>
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue3-toastify'
import { adminService } from '@/services/admin/admin.service'
import { persistedRef } from '@/utils/persistedRef'

const ORDER_TYPE_LABELS: Record<string, string> = {
  sale: 'Skins',
  collector: 'Collectors',
  physical: 'Físico',
}

const ORDER_ROUTES: Record<string, string> = {
  sale: 'sale-details',
  collector: 'collector-order-detail',
  physical: 'physical-order-detail',
}

const router = useRouter()

const goToUser = (userUuid: string) => {
  router.push({ name: 'user-details', params: { uuid: userUuid } })
}

const goToOrder = (item: any) => {
  const name = ORDER_ROUTES[item.order_type]
  if (!name) return

  // A rota de skins usa :id, as outras duas usam :uuid — o valor é o mesmo uuid.
  const params = item.order_type === 'sale' ? { id: item.order_uuid } : { uuid: item.order_uuid }
  router.push({ name, params })
}

const LIMIT = 20
const REPLY_MAX_LENGTH = 2000

const feedbacks = ref<any[]>([])
const total = ref(0)
const overallTotal = ref(0)
const pending = ref(0)
const average = ref<number | null>(null)
const page = ref(1)
const loading = ref(true)
const handlingUuid = ref<string | null>(null)
const visibilityUuid = ref<string | null>(null)
const replyTarget = ref<any>(null)
const replyText = ref('')
const replying = ref(false)
const handledFilter = ref<'pending' | 'handled' | 'all'>('pending')
const visibleFilter = persistedRef<'all' | 'visible' | 'hidden'>('feedbacks:visible', 'all')
const ratingFilter = persistedRef('feedbacks:rating', '')

const totalPages = computed(() => Math.max(Math.ceil(total.value / LIMIT), 1))

const averageLabel = computed(() =>
  average.value === null ? '—' : `${Number(average.value).toFixed(1)} ★`,
)

const ratingClass = (rating: number) => {
  if (rating <= 2) return 'rating--bad'
  if (rating === 3) return 'rating--mid'
  return 'rating--good'
}

const handledParam = () => {
  if (handledFilter.value === 'pending') return false
  if (handledFilter.value === 'handled') return true
  return undefined
}

const visibleParam = () => {
  if (visibleFilter.value === 'visible') return true
  if (visibleFilter.value === 'hidden') return false
  return undefined
}

const fetchFeedbacks = async () => {
  loading.value = true
  try {
    const res = await adminService.getFeedbacks({
      page: page.value,
      limit: LIMIT,
      ...(ratingFilter.value ? { rating: Number(ratingFilter.value) } : {}),
      ...(handledParam() === undefined ? {} : { handled: handledParam() }),
      ...(visibleParam() === undefined ? {} : { visible: visibleParam() }),
    })
    feedbacks.value = res.data.data
    total.value = res.data.total
    overallTotal.value = res.data.overall_total
    pending.value = res.data.pending
    average.value = res.data.average
  } finally {
    loading.value = false
  }
}

const reload = () => {
  page.value = 1
  void fetchFeedbacks()
}

const changePage = (next: number) => {
  page.value = next
  void fetchFeedbacks()
}

const openReply = (item: any) => {
  replyTarget.value = item
  replyText.value = item.reply ?? ''
}

const closeReply = () => {
  replyTarget.value = null
  replyText.value = ''
}

const closeReplyOnEsc = (event: KeyboardEvent) => {
  if (event.key === 'Escape') closeReply()
}

// Listener só existe enquanto o modal está aberto.
watch(replyTarget, (target) => {
  if (target) document.addEventListener('keydown', closeReplyOnEsc)
  else document.removeEventListener('keydown', closeReplyOnEsc)
})

onUnmounted(() => document.removeEventListener('keydown', closeReplyOnEsc))

const errorMessage = (err: any, fallback: string) =>
  err?.response?.data?.message ?? fallback

const sendReply = async () => {
  if (!replyTarget.value || !replyText.value.trim()) return

  replying.value = true
  try {
    const wasPending = !replyTarget.value.handled_at
    await adminService.replyFeedback(replyTarget.value.id, replyText.value.trim())
    closeReply()

    // Some da lista filtrada em "Pendentes" — recua pra não ficar em página vazia.
    if (wasPending && feedbacks.value.length === 1 && page.value > 1) page.value--

    await fetchFeedbacks()
    toast.success('Resposta enviada.')
  } catch (err: any) {
    toast.error(errorMessage(err, 'Não foi possível enviar a resposta.'))
  } finally {
    replying.value = false
  }
}

const markHandled = async (item: any) => {
  handlingUuid.value = item.id
  try {
    await adminService.markFeedbackHandled(item.id)

    // Último item da página sai da lista filtrada — recua para não ficar em página vazia.
    if (feedbacks.value.length === 1 && page.value > 1) page.value--

    await fetchFeedbacks()
  } catch (err: any) {
    toast.error(errorMessage(err, 'Não foi possível marcar como tratado.'))
  } finally {
    handlingUuid.value = null
  }
}

const visibilityLabel = (item: any) => {
  if (visibilityUuid.value === item.id) return 'Salvando...'
  if (!item.is_visible) return 'Mostrar na home'

  return 'Esconder da home'
}

const toggleVisibility = async (item: any) => {
  visibilityUuid.value = item.id
  try {
    await adminService.setFeedbackVisibility(item.id, !item.is_visible)

    // Sai da lista quando o filtro de visibilidade está ligado — recua da página vazia.
    if (visibleParam() !== undefined && feedbacks.value.length === 1 && page.value > 1) page.value--

    await fetchFeedbacks()
  } catch (err: any) {
    toast.error(errorMessage(err, 'Não foi possível mudar a visibilidade.'))
  } finally {
    visibilityUuid.value = null
  }
}

onMounted(fetchFeedbacks)
</script>

<style lang="stylus" scoped>
.view-wrap
  padding 2rem
  color #fff
  min-height 100vh

.page-header
  margin-bottom 1.5rem

.page-title
  font-size 1.8rem
  font-weight 700
  margin 0 0 4px

.page-subtitle
  font-size 0.85rem
  color rgba(255,255,255,0.45)
  margin 0

.summary-row
  display grid
  grid-template-columns repeat(auto-fit, minmax(180px, 1fr))
  gap 1rem
  margin-bottom 1.5rem

.summary-card
  background #16161a
  border 1px solid rgba(255,255,255,0.06)
  border-radius 12px
  padding 1rem 1.25rem
  display flex
  flex-direction column
  gap 6px

.summary-label
  font-size 0.75rem
  text-transform uppercase
  letter-spacing 0.04em
  color rgba(255,255,255,0.45)

.summary-value
  font-size 1.5rem
  font-weight 700

.summary-value--alert
  color #fc8181

.filters
  display flex
  gap 8px
  margin-bottom 1rem
  flex-wrap wrap

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

.rating
  font-size 0.95rem
  letter-spacing 1px
  white-space nowrap

.rating--good
  color #4ade80

.rating--mid
  color #fbbf24

.rating--bad
  color #fc8181

.comment
  display block
  max-width 420px
  white-space pre-wrap
  word-break break-word

.title-cell
  font-weight 600

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
  &:hover
    text-decoration underline

.row-sub
  color rgba(255,255,255,0.38)
  font-size 0.75rem
  margin 2px 0 0

.text-muted
  color rgba(255,255,255,0.35)
  font-size 0.82rem

.status-badge
  display inline-block
  padding 2px 10px
  border-radius 999px
  font-size 0.75rem
  font-weight 600

.status-active
  background rgba(46,220,138,0.12)
  color #4ade80

.status-inactive
  background rgba(255,255,255,0.06)
  color rgba(255,255,255,0.45)

.btn-view
  padding 4px 12px
  background rgba(99,102,241,0.12)
  border 1px solid rgba(99,102,241,0.25)
  border-radius 6px
  color #a5b4fc
  font-size 0.8rem
  cursor pointer
  &:hover
    background rgba(99,102,241,0.22)
  &:disabled
    opacity 0.5
    cursor not-allowed

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

.action-row
  display flex
  align-items center
  gap 6px

.reply-preview
  margin 6px 0 0
  padding-left 10px
  border-left 2px solid rgba(99,102,241,0.4)
  color rgba(255,255,255,0.6)
  font-size 0.8rem
  max-width 420px
  white-space pre-wrap
  word-break break-word

  strong
    color #a5b4fc

.modal-overlay
  position fixed
  inset 0
  background rgba(0,0,0,0.65)
  z-index 100
  display flex
  align-items center
  justify-content center

.modal
  background #1e1e24
  border 1px solid rgba(255,255,255,0.1)
  border-radius 14px
  padding 1.75rem
  width 520px
  max-width 95vw

  h3
    margin 0 0 12px
    font-size 1.1rem
    font-weight 700

.modal-quote
  background rgba(255,255,255,0.04)
  border-radius 10px
  padding 12px 14px
  margin 0 0 10px
  color rgba(255,255,255,0.75)
  font-size 0.875rem
  white-space pre-wrap
  word-break break-word

.modal-hint
  color rgba(255,255,255,0.4)
  font-size 0.8rem
  margin 0 0 10px

.modal-textarea
  width 100%
  background #16161a
  border 1px solid rgba(255,255,255,0.12)
  border-radius 10px
  color #fff
  padding 0.75rem
  font-family inherit
  font-size 0.875rem
  resize vertical

  &:focus
    outline none
    border-color #6366f1

.modal-counter
  display block
  text-align right
  margin-top 4px
  font-size 0.75rem
  color rgba(255,255,255,0.35)

.modal-counter--full
  color #fbbf24

.modal-actions
  display flex
  justify-content flex-end
  gap 8px
  margin-top 1rem

.btn-primary
  display inline-flex
  align-items center
  gap 6px
  padding 0.5rem 1rem
  background #6366f1
  border none
  border-radius 8px
  color #fff
  font-weight 600
  font-size 0.875rem
  cursor pointer
  &:hover:not(:disabled)
    background #4f46e5
  &:disabled
    opacity 0.5
    cursor not-allowed

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
</style>
