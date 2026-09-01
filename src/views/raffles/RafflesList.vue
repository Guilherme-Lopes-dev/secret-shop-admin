<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <h1 class="page-title">Sorteios</h1>
        <p class="page-subtitle">{{ total }} sorteios salvos</p>
      </div>
      <button class="btn-primary" @click="router.push('/raffles/new')">
        <Icon icon="mdi:plus" width="16" /> Novo sorteio
      </button>
    </header>

    <div class="section">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Sorteio</th>
              <th>Período</th>
              <th>Lojas</th>
              <th>R$ / ticket</th>
              <th>Elegíveis</th>
              <th>Tickets</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="n in loading ? 6 : 0" :key="`sk-${n}`">
              <td v-for="col in 7" :key="col">
                <div class="skeleton" style="width:80px;height:14px" />
              </td>
            </tr>

            <tr v-for="raffle in raffles" :key="raffle.id">
              <td>
                <span class="raffle-name">{{ raffle.name }}</span>
                <p class="row-sub">Criado em {{ day(raffle.created_at) }}</p>
              </td>
              <td class="text-muted">{{ periodLabel(raffle) }}</td>
              <td>
                <div class="chip-row">
                  <span v-for="store in raffle.stores" :key="store" class="chip">
                    {{ STORE_LABELS[store] }}
                  </span>
                </div>
              </td>
              <td>{{ formatCurrency(raffle.cents_per_ticket) }}</td>
              <td><span class="count-badge">{{ raffle.eligible_count }}</span></td>
              <td><span class="ticket-badge">{{ raffle.total_tickets }}</span></td>
              <td>
                <div class="action-row">
                  <button class="btn-view" @click="router.push(`/raffles/${raffle.id}`)">Ver</button>
                  <button class="btn-danger" @click="deleteTarget = raffle">Remover</button>
                </div>
              </td>
            </tr>

            <tr v-if="!loading && !raffles.length">
              <td colspan="7" class="empty-state">
                Nenhum sorteio salvo ainda.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal">
        <h3>Remover sorteio</h3>
        <p>
          Remover <strong>{{ deleteTarget.name }}</strong> e a lista congelada de
          {{ deleteTarget.eligible_count }} elegíveis?
        </p>
        <p class="modal-hint">A lista não pode ser reconstruída depois — ela era o registro de quem concorreu.</p>
        <div class="modal-actions">
          <button class="btn-ghost" @click="deleteTarget = null">Cancelar</button>
          <button class="btn-danger" :disabled="deleting" @click="doDelete">
            {{ deleting ? 'Removendo...' : 'Remover' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { adminService, type RaffleStore, type RaffleSummary } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'

const STORE_LABELS: Record<RaffleStore, string> = {
  skins: 'Skins',
  collector: 'Collector',
  physical: 'Físico',
}

const router = useRouter()
const raffles = ref<RaffleSummary[]>([])
const total = ref(0)
const loading = ref(true)
const deleteTarget = ref<RaffleSummary | null>(null)
const deleting = ref(false)

const day = (value: string) => new Date(value).toLocaleDateString('pt-BR')

/** Sorteio sem data conta todo pedido pago — a coluna tem que dizer isso. */
const periodLabel = (raffle: RaffleSummary) => {
  if (raffle.period_from && raffle.period_to) {
    return `${day(raffle.period_from)} — ${day(raffle.period_to)}`
  }
  if (raffle.period_from) return `A partir de ${day(raffle.period_from)}`
  if (raffle.period_to) return `Até ${day(raffle.period_to)}`

  return 'Todo o período'
}

const fetchRaffles = async () => {
  loading.value = true
  try {
    const res = await adminService.getRaffles()
    raffles.value = res.data.data
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

const doDelete = async () => {
  if (!deleteTarget.value) return

  deleting.value = true
  try {
    await adminService.deleteRaffle(deleteTarget.value.id)
    raffles.value = raffles.value.filter((raffle) => raffle.id !== deleteTarget.value?.id)
    total.value -= 1
    deleteTarget.value = null
  } finally {
    deleting.value = false
  }
}

onMounted(fetchRaffles)
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
  margin-bottom 2rem

.page-title
  font-size 1.8rem
  font-weight 700
  margin 0 0 4px

.page-subtitle
  font-size 0.85rem
  color rgba(255,255,255,0.45)
  margin 0

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

.raffle-name
  font-weight 600

.row-sub
  color rgba(255,255,255,0.38)
  font-size 0.75rem
  margin 2px 0 0

.text-muted
  color rgba(255,255,255,0.35)
  font-size 0.82rem

.chip-row
  display flex
  flex-wrap wrap
  gap 4px

.chip
  display inline-block
  background rgba(99,102,241,0.10)
  border 1px solid rgba(99,102,241,0.2)
  color #a5b4fc
  padding 1px 8px
  border-radius 999px
  font-size 0.7rem

.count-badge
  display inline-block
  background rgba(255,255,255,0.08)
  padding 1px 10px
  border-radius 999px
  font-size 0.8rem
  font-weight 600

.ticket-badge
  display inline-block
  background rgba(99,102,241,0.15)
  color #a5b4fc
  font-weight 700
  padding 1px 10px
  border-radius 999px
  font-size 0.8rem

.empty-state
  text-align center
  color rgba(255,255,255,0.35)
  padding 2.5rem 1rem

.skeleton
  background rgba(255,255,255,0.06)
  border-radius 4px

.action-row
  display flex
  gap 6px

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
  &:hover
    background #4f46e5

.btn-ghost
  padding 0.5rem 1rem
  background rgba(255,255,255,0.05)
  border 1px solid rgba(255,255,255,0.08)
  border-radius 8px
  color rgba(255,255,255,0.75)
  font-size 0.85rem
  cursor pointer
  &:hover
    background rgba(255,255,255,0.08)

.btn-view
  padding 4px 12px
  background rgba(99,102,241,0.12)
  border 1px solid rgba(99,102,241,0.25)
  border-radius 8px
  color #a5b4fc
  font-size 0.8rem
  cursor pointer
  &:hover
    background rgba(99,102,241,0.2)

.btn-danger
  padding 4px 12px
  background rgba(252,129,129,0.10)
  border 1px solid rgba(252,129,129,0.25)
  border-radius 8px
  color #fca5a5
  font-size 0.8rem
  cursor pointer
  &:hover:not(:disabled)
    background rgba(252,129,129,0.18)
  &:disabled
    opacity 0.5
    cursor not-allowed

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
  width min(430px, 92vw)

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

.modal-actions
  display flex
  justify-content flex-end
  gap 0.6rem
  margin-top 1.2rem
</style>
