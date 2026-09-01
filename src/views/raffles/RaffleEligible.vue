<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <h1 class="page-title">
          {{ frozen ? frozen.name : 'Elegíveis' }}
          <span v-if="frozen" class="frozen-badge">
            <Icon icon="mdi:lock-outline" width="12" /> congelado
          </span>
        </h1>
        <p class="page-subtitle">{{ periodLabel }}</p>
      </div>

      <div class="header-actions">
        <button v-if="!frozen" class="btn-ghost" @click="router.back()">
          <Icon icon="mdi:arrow-left" width="16" /> Ajustar parâmetros
        </button>
        <button class="btn-ghost" :disabled="!rows.length || exporting" @click="exportCsv">
          <Icon :icon="exporting ? 'mdi:loading' : 'mdi:file-delimited-outline'" :class="{ spin: exporting }" width="16" />
          {{ exporting ? 'Gerando...' : 'Exportar CSV' }}
        </button>
        <button v-if="!frozen" class="btn-primary" :disabled="!rows.length" @click="saving = true">
          <Icon icon="mdi:content-save-outline" width="16" /> Salvar sorteio
        </button>
        <button v-else class="btn-ghost" @click="router.push('/raffles')">
          <Icon icon="mdi:format-list-bulleted" width="16" /> Sorteios salvos
        </button>
      </div>
    </header>

    <div class="stat-row">
      <div class="stat-card">
        <span class="stat-label">Elegíveis</span>
        <strong class="stat-value">{{ loading ? '—' : eligibleCount }}</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">Tickets no total</span>
        <strong class="stat-value">{{ loading ? '—' : totalTickets }}</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">Valor de cada ticket</span>
        <strong class="stat-value">{{ formatCurrency(centsPerTicket) }}</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">Lojas</span>
        <strong class="stat-value stat-small">{{ storeLabels }}</strong>
      </div>
    </div>

    <p v-if="couponNote" class="warn-banner">
      <Icon icon="mdi:alert-outline" width="15" />
      {{ couponNote }}
    </p>

    <p v-if="exportWarn" class="warn-banner">
      <Icon icon="mdi:alert-outline" width="15" />
      {{ exportWarn }}
    </p>

    <p v-if="error" class="error-banner">{{ error }}</p>

    <div class="section">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th class="col-rank">#</th>
              <th>Usuário</th>
              <th>Gasto no período</th>
              <th class="col-tickets">Tickets</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="n in loading ? 8 : 0" :key="`sk-${n}`" class="skeleton-row">
              <td><div class="skeleton" style="width:20px;height:14px" /></td>
              <td><div class="skeleton" style="width:180px;height:14px" /></td>
              <td><div class="skeleton" style="width:90px;height:14px" /></td>
              <td><div class="skeleton" style="width:40px;height:22px;border-radius:999px" /></td>
            </tr>

            <tr v-for="(row, index) in rows" :key="row.users?.id ?? index">
              <!-- `rows` acumula com o scroll: a posição é o próprio índice. -->
              <td class="col-rank">{{ index + 1 }}</td>
              <td>
                <div class="user-cell">
                  <img v-if="row.users?.avatar" :src="row.users.avatar" class="avatar" alt="" />
                  <div>
                    <span class="user-name">{{ row.users?.username || 'Sem nome' }}</span>
                    <p class="row-sub">{{ row.users?.email || row.users?.steam_id || '—' }}</p>
                  </div>
                </div>
              </td>
              <td>{{ formatCurrency(row.spent) }}</td>
              <td class="col-tickets">
                <span class="ticket-badge">{{ row.tickets }}</span>
              </td>
            </tr>

            <tr v-if="!loading && !rows.length">
              <td colspan="4" class="empty-state">
                Ninguém ficou elegível com esses parâmetros.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Sentinela do scroll infinito: entrar na viewport puxa a próxima página. -->
      <div ref="sentinel" class="feed-foot">
        <span v-if="loadingMore" class="feed-loading">
          <Icon icon="mdi:loading" class="spin" width="15" /> Carregando mais...
        </span>
        <span v-else-if="rows.length" class="feed-count">
          {{ rows.length }} de {{ total }}{{ hasMore ? '' : ' — fim da lista' }}
        </span>
      </div>
    </div>

    <div v-if="saving" class="modal-overlay" @click.self="saving = false">
      <div class="modal">
        <h3>Salvar sorteio</h3>
        <p>
          A lista de <strong>{{ eligibleCount }}</strong> elegíveis e seus
          <strong>{{ totalTickets }}</strong> tickets ficam congelados como estão agora.
        </p>
        <p class="modal-hint">
          Venda nova no período não altera mais este sorteio. Para mudar o valor do ticket,
          crie outro.
        </p>
        <input
          v-model="name"
          class="modal-input"
          placeholder="Nome do sorteio (ex: Sorteio de Agosto)"
          maxlength="120"
        />
        <p v-if="saveError" class="form-error">{{ saveError }}</p>
        <div class="modal-actions">
          <button class="btn-ghost" @click="saving = false">Cancelar</button>
          <button class="btn-primary" :disabled="!name.trim() || savingNow" @click="save">
            {{ savingNow ? 'Salvando...' : 'Congelar e salvar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import Papa from 'papaparse'
import {
  adminService,
  type RaffleDetail,
  type RaffleEligibleRow,
  type RaffleParams,
  type RaffleStore,
} from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'

const LIMIT = 50

const STORE_LABELS: Record<RaffleStore, string> = {
  skins: 'Skins',
  collector: 'Collector',
  physical: 'Físico',
}

const route = useRoute()
const router = useRouter()

const rows = ref<RaffleEligibleRow[]>([])
const frozen = ref<RaffleDetail | null>(null)
const eligibleCount = ref(0)
const totalTickets = ref(0)
const total = ref(0)
const page = ref(1)
const loading = ref(true)
const loadingMore = ref(false)
const sentinel = ref<HTMLElement | null>(null)
const exporting = ref(false)
const exportWarn = ref('')
const error = ref('')
const saving = ref(false)
const savingNow = ref(false)
const saveError = ref('')
const name = ref('')

const listOf = (value: unknown) =>
  String(value ?? '')
    .split(',')
    .filter(Boolean)

/**
 * Os parâmetros da tela 1 viajam na URL: recarregar e compartilhar o link
 * funcionam. Data ausente sai do payload — o backend recusa string vazia.
 */
const paramsFromQuery = (): RaffleParams => ({
  ...(route.query.from ? { period_from: String(route.query.from) } : {}),
  ...(route.query.to ? { period_to: String(route.query.to) } : {}),
  cents_per_ticket: Number(route.query.cents ?? 0),
  stores: listOf(route.query.stores) as RaffleStore[],
  coupon_uuids: listOf(route.query.coupons),
  excluded_user_uuids: listOf(route.query.excluded),
})

const centsPerTicket = computed(() =>
  frozen.value ? frozen.value.cents_per_ticket : Number(route.query.cents ?? 0),
)

const stores = computed<RaffleStore[]>(() =>
  frozen.value ? frozen.value.stores : (listOf(route.query.stores) as RaffleStore[]),
)

const storeLabels = computed(() =>
  stores.value.map((store) => STORE_LABELS[store]).join(' · ') || '—',
)

const couponCount = computed(() =>
  frozen.value ? frozen.value.coupons.length : listOf(route.query.coupons).length,
)

/** Repete na tela 2 o aviso da tela 1 — a lista some do contexto senão. */
const couponNote = computed(() => {
  if (!couponCount.value) return ''
  if (!stores.value.includes('physical')) return ''

  return 'Pedido físico não aceita cupom: o gasto em Físico entrou por fora do filtro de cupom.'
})

const day = (value: string) => new Date(value).toLocaleDateString('pt-BR')

/** Cada ponta é opcional, então o rótulo tem quatro formas possíveis. */
const periodLabel = computed(() => {
  const from = frozen.value ? frozen.value.period_from : (route.query.from as string)
  const to = frozen.value ? frozen.value.period_to : (route.query.to as string)

  if (from && to) return `${day(from)} até ${day(to)}`
  if (from) return `A partir de ${day(from)}`
  if (to) return `Até ${day(to)}`

  return 'Todo o período — sem recorte de data'
})

const hasMore = computed(() => rows.value.length < total.value)

/** As duas origens devolvem o mesmo formato — o resto do fluxo não sabe qual é. */
type Chunk = {
  data: RaffleEligibleRow[]
  total: number
  eligibleCount: number
  totalTickets: number
  raffle?: RaffleDetail
}

const fetchFrozen = async (uuid: string): Promise<Chunk> => {
  const res = await adminService.getRaffle(uuid, page.value, LIMIT)

  return {
    data: res.data.eligible.data,
    total: res.data.eligible.total,
    eligibleCount: res.data.eligible_count,
    totalTickets: res.data.total_tickets,
    raffle: res.data,
  }
}

const fetchPreview = async (): Promise<Chunk> => {
  const res = await adminService.previewRaffle(paramsFromQuery(), page.value, LIMIT)

  return {
    data: res.data.data,
    total: res.data.total,
    eligibleCount: res.data.eligible_count,
    totalTickets: res.data.total_tickets,
  }
}

/**
 * Toda resposta carrega o token da requisição que a pediu. Trocar de rota no
 * meio de um `loadMore` invalida o que estiver em voo — sem isso a página 2
 * antiga colava por cima da lista nova.
 */
let requestToken = 0

/** Página 1 substitui, as seguintes empilham. */
const loadPage = async () => {
  const token = ++requestToken
  const uuid = route.params.uuid as string | undefined
  const chunk = await (uuid ? fetchFrozen(uuid) : fetchPreview())

  if (token !== requestToken) return

  if (chunk.raffle) frozen.value = chunk.raffle
  rows.value = page.value === 1 ? chunk.data : [...rows.value, ...chunk.data]
  total.value = chunk.total
  eligibleCount.value = chunk.eligibleCount
  totalTickets.value = chunk.totalTickets
}

const messageOf = (requestError: any, fallback: string) =>
  requestError?.response?.data?.message ?? fallback

const LOAD_FAILED = 'Não foi possível carregar os elegíveis.'

const load = async () => {
  page.value = 1
  rows.value = []
  loading.value = true
  error.value = ''

  try {
    await loadPage()
  } catch (requestError: any) {
    error.value = messageOf(requestError, LOAD_FAILED)
  } finally {
    loading.value = false
  }
}

// ── Export CSV ────────────────────────────────────────────────────────────────

/** Teto do backend. O export puxa a lista inteira, não só o que já rolou na tela. */
const EXPORT_LIMIT = 10_000

const fetchAll = async (): Promise<RaffleEligibleRow[]> => {
  const uuid = route.params.uuid as string | undefined
  if (uuid) {
    const res = await adminService.getRaffle(uuid, 1, EXPORT_LIMIT)
    return res.data.eligible.data
  }

  const res = await adminService.previewRaffle(paramsFromQuery(), 1, EXPORT_LIMIT)
  return res.data.data
}

/** Excel pt-BR: separador `;` e vírgula decimal, senão tudo cai numa coluna só. */
const toCsv = (all: RaffleEligibleRow[]) =>
  Papa.unparse(
    all.map((row) => ({
      nome: row.users?.username ?? '',
      email: row.users?.email ?? '',
      gasto: (row.spent / 100).toFixed(2).replace('.', ','),
      tickets: row.tickets,
    })),
    { delimiter: ';' },
  )

const fileName = () => {
  const slug = (frozen.value?.name ?? 'preview')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

  return `sorteio-${slug}-${new Date().toISOString().slice(0, 10)}.csv`
}

const download = (csv: string) => {
  // BOM na frente: sem ele o Excel come os acentos dos nomes.
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName()
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

const exportCsv = async () => {
  exporting.value = true
  exportWarn.value = ''

  try {
    const all = await fetchAll()
    download(toCsv(all))

    // Export truncado calado é pior que export que falha: avisa.
    if (all.length < total.value) {
      exportWarn.value = `O CSV saiu com ${all.length} dos ${total.value} elegíveis — o export para em ${EXPORT_LIMIT} linhas.`
    }
  } catch (requestError: any) {
    error.value = messageOf(requestError, 'Não foi possível gerar o CSV.')
  } finally {
    exporting.value = false
  }
}

const loadMore = async () => {
  if (loading.value || loadingMore.value) return
  if (!hasMore.value) return

  loadingMore.value = true
  page.value += 1

  try {
    await loadPage()
  } catch (requestError: any) {
    // Devolve a página pra sentinela poder tentar de novo em vez de pular um bloco.
    page.value -= 1
    error.value = messageOf(requestError, LOAD_FAILED)
  } finally {
    loadingMore.value = false
  }
}

const save = async () => {
  savingNow.value = true
  saveError.value = ''

  try {
    // Manda o que a tela mostrou: o backend recusa se o recálculo divergir.
    const res = await adminService.createRaffle({
      ...paramsFromQuery(),
      name: name.value.trim(),
      expected_eligible_count: eligibleCount.value,
      expected_total_tickets: totalTickets.value,
    })
    router.push(`/raffles/${res.data.id}`)
  } catch (requestError: any) {
    saveError.value =
      requestError?.response?.data?.message ?? 'Não foi possível salvar o sorteio.'
  } finally {
    savingNow.value = false
  }
}

watch(
  () => [route.params.uuid, route.query],
  load,
  { immediate: true, deep: true },
)

/**
 * IntersectionObserver em vez de listener de scroll: o browser já resolve isso
 * sozinho, sem throttle na mão nem medir posição a cada frame.
 */
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return

      loadMore()
    },
    // Puxa antes da sentinela aparecer — a lista não pisca no fim.
    { rootMargin: '300px' },
  )

  watch(
    sentinel,
    (element) => {
      observer?.disconnect()
      if (!element) return

      observer?.observe(element)
    },
    { immediate: true },
  )
})

onUnmounted(() => observer?.disconnect())
</script>

<style lang="stylus" scoped>
.view-wrap
  padding 2rem
  color #fff
  min-height 100vh

.page-header
  display flex
  align-items flex-start
  justify-content space-between
  gap 1rem
  margin-bottom 1.5rem

.page-title
  display flex
  align-items center
  gap 0.6rem
  font-size 1.8rem
  font-weight 700
  margin 0 0 4px

.frozen-badge
  display inline-flex
  align-items center
  gap 4px
  background rgba(99,102,241,0.15)
  border 1px solid rgba(99,102,241,0.35)
  color #a5b4fc
  font-size 0.7rem
  font-weight 600
  text-transform uppercase
  letter-spacing 0.05em
  padding 3px 9px
  border-radius 999px

.page-subtitle
  font-size 0.85rem
  color rgba(255,255,255,0.45)
  margin 0

.header-actions
  display flex
  gap 0.6rem

.stat-row
  display grid
  grid-template-columns repeat(auto-fit, minmax(160px, 1fr))
  gap 0.75rem
  margin-bottom 1.25rem

.stat-card
  background #16161a
  border 1px solid rgba(255,255,255,0.06)
  border-radius 12px
  padding 0.9rem 1.1rem
  display flex
  flex-direction column
  gap 4px

.stat-label
  font-size 0.72rem
  font-weight 600
  text-transform uppercase
  letter-spacing 0.04em
  color rgba(255,255,255,0.4)

.stat-value
  font-size 1.5rem
  font-weight 700

.stat-small
  font-size 0.95rem
  font-weight 600

.warn-banner
  display flex
  align-items center
  gap 7px
  font-size 0.82rem
  color #fbbf24
  background rgba(251,191,36,0.08)
  border 1px solid rgba(251,191,36,0.2)
  border-radius 10px
  padding 0.65rem 0.9rem
  margin 0 0 1rem

.error-banner
  font-size 0.85rem
  color #fc8181
  background rgba(252,129,129,0.08)
  border 1px solid rgba(252,129,129,0.2)
  border-radius 10px
  padding 0.65rem 0.9rem
  margin 0 0 1rem

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
  padding 0.7rem 1rem
  font-size 0.875rem
  border-bottom 1px solid rgba(255,255,255,0.04)
  vertical-align middle

tbody tr:last-child td
  border-bottom none

tbody tr:hover td
  background rgba(255,255,255,0.02)

.col-rank
  width 56px
  color rgba(255,255,255,0.35)

.col-tickets
  width 110px
  text-align right

.user-cell
  display flex
  align-items center
  gap 0.6rem

.avatar
  width 30px
  height 30px
  border-radius 50%
  object-fit cover

.user-name
  font-weight 600

.row-sub
  color rgba(255,255,255,0.38)
  font-size 0.75rem
  margin 2px 0 0

.ticket-badge
  display inline-block
  background rgba(99,102,241,0.15)
  color #a5b4fc
  font-weight 700
  padding 2px 12px
  border-radius 999px
  font-size 0.85rem

.empty-state
  text-align center
  color rgba(255,255,255,0.35)
  padding 2.5rem 1rem

.skeleton
  background rgba(255,255,255,0.06)
  border-radius 4px

.feed-foot
  display flex
  align-items center
  justify-content center
  min-height 46px
  padding 0.8rem
  border-top 1px solid rgba(255,255,255,0.05)

.feed-loading
  display inline-flex
  align-items center
  gap 7px
  font-size 0.82rem
  color rgba(255,255,255,0.55)

.feed-count
  font-size 0.8rem
  color rgba(255,255,255,0.35)

.spin
  animation spin 0.9s linear infinite

@keyframes spin
  to
    transform rotate(360deg)

.modal-overlay
  position fixed
  inset 0
  background rgba(0,0,0,0.6)
  display flex
  align-items center
  justify-content center
  z-index 50

.modal
  background #16161a
  border 1px solid rgba(255,255,255,0.08)
  border-radius 14px
  padding 1.5rem
  width min(440px, 92vw)

  h3
    margin 0 0 0.8rem
    font-size 1.15rem

  p
    font-size 0.87rem
    color rgba(255,255,255,0.7)
    margin 0 0 0.5rem

.modal-hint
  font-size 0.8rem !important
  color rgba(255,255,255,0.4) !important

.modal-input
  width 100%
  background #1a1a1e
  border 1px solid rgba(255,255,255,0.08)
  border-radius 8px
  color #fff
  padding 0.55rem 0.75rem
  font-size 0.875rem
  outline none
  margin-top 0.6rem
  &:focus
    border-color rgba(99,102,241,0.5)

.modal-actions
  display flex
  justify-content flex-end
  gap 0.6rem
  margin-top 1.2rem

.form-error
  color #fc8181 !important
  font-size 0.82rem !important
  margin 0.5rem 0 0 !important

.btn-primary
  display inline-flex
  align-items center
  gap 6px
  padding 0.5rem 1.1rem
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
    opacity 0.45
    cursor not-allowed

.btn-ghost
  display inline-flex
  align-items center
  gap 6px
  padding 0.5rem 1rem
  background rgba(255,255,255,0.05)
  border 1px solid rgba(255,255,255,0.08)
  border-radius 8px
  color rgba(255,255,255,0.75)
  font-size 0.85rem
  cursor pointer
  &:hover:not(:disabled)
    background rgba(255,255,255,0.08)
  &:disabled
    opacity 0.4
    cursor not-allowed
</style>
