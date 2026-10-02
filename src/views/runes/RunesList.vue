<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <h1 class="page-title">Runas</h1>
        <p class="page-subtitle">{{ runes.length }} runas · aparecem na loja no horário, quem clica ganha o cupom</p>
      </div>
      <div class="header-actions">
        <button class="btn-ghost" @click="router.push('/runes/routines/new')">
          <Icon icon="mdi:calendar-sync" width="16" /> Nova rotina
        </button>
        <button class="btn-primary" @click="router.push('/runes/new')">
          <Icon icon="mdi:plus" width="16" /> Nova runa
        </button>
      </div>
    </header>

    <div v-if="routines.length" class="section section--routines">
      <h2 class="section-heading">
        <Icon icon="mdi:calendar-sync" width="16" /> Rotinas
        <span class="section-heading__hint">geram uma runa por dia marcado, horário sorteado, tipo por usuário</span>
      </h2>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Rotina</th>
              <th>Dias</th>
              <th>Janela</th>
              <th>Tipos</th>
              <th>Prêmio</th>
              <th>Último spawn</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="routine in routines" :key="routine.id">
              <td class="rune-label">{{ routine.name }}</td>
              <td>{{ weekdaysLabel(routine.weekdays) }}</td>
              <td>
                <span class="mono">{{ routine.window_start }}–{{ routine.window_end }}</span>
                <p class="row-sub">{{ routine.visible_minutes }} min visível</p>
              </td>
              <td>
                <div v-if="routine.types.length" class="type-icons">
                  <img v-for="type in routine.types" :key="type" :src="runeInfo(type).image" :title="runeInfo(type).label" alt="" />
                </div>
                <span v-else class="text-muted">qualquer uma</span>
              </td>
              <td>
                <span v-if="routine.prize_type === 'SKIN'" class="skin-badge" :class="{ 'skin-badge--sold': routine.inventory?.is_sold }">
                  <Icon icon="mdi:sword" width="13" /> {{ routine.inventory?.skins?.name ?? 'skin' }}
                </span>
                <span v-else class="code-badge">{{ templateLabel(routine.coupon_template) }}</span>
              </td>
              <td>
                <template v-if="routine.runes?.[0]">
                  <span>{{ day(routine.runes[0].starts_on) }}</span>
                  <span class="mono"> {{ routine.runes[0].spawn_time }}</span>
                  <p class="row-sub">{{ runeTypeLabel(routine.runes[0]) }}{{ routine.runes[0].deleted_at ? ' · removida' : '' }}</p>
                </template>
                <span v-else class="text-muted">—</span>
              </td>
              <td><span class="status-badge" :class="routineStatus(routine).css">{{ routineStatus(routine).label }}</span></td>
              <td>
                <div class="action-row">
                  <button class="btn-view" @click="router.push(`/runes/routines/${routine.id}/edit`)">Abrir</button>
                  <button class="btn-danger" @click="routineToDelete = routine">Remover</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Runa</th>
              <th>Spawn</th>
              <th>Período</th>
              <th>Página</th>
              <th>Vagas</th>
              <th>Prêmio</th>
              <th>Pegaram</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <template v-if="loading">
              <tr v-for="n in 4" :key="n" class="skeleton-row">
                <td v-for="c in 9" :key="c"><div class="skeleton" style="width:80px;height:14px" /></td>
              </tr>
            </template>

            <tr v-else-if="runes.length === 0">
              <td colspan="9" class="empty-state">Nenhuma runa ainda. Cria a primeira.</td>
            </tr>

            <tr v-for="r in runes" v-else :key="r.id">
              <td>
                <div class="rune-cell">
                  <Icon v-if="isPerUserType(r)" icon="mdi:dice-5-outline" class="rune-img" />
                  <img v-else :src="runeInfo(r.type).image" class="rune-img" alt="" />
                  <div>
                    <div class="rune-label">{{ runeTypeLabel(r) }}</div>
                    <p v-if="r.routine" class="row-sub routine-tag"><Icon icon="mdi:calendar-sync" width="12" /> {{ r.routine.name }}</p>
                    <p v-else-if="r.name" class="row-sub">{{ r.name }}</p>
                  </div>
                </div>
              </td>
              <td>
                <span class="mono">{{ r.spawn_time }}</span>
                <p class="row-sub">{{ r.visible_minutes }} min visível</p>
              </td>
              <td>
                <span>{{ day(r.starts_on) }}</span>
                <span class="text-muted"> → {{ r.ends_on ? day(r.ends_on) : 'sempre' }}</span>
              </td>
              <td class="text-muted">
                {{ runePageLabel(r.page) }}
                <p v-if="audienceLabel(r)" class="row-sub">{{ audienceLabel(r) }}</p>
              </td>
              <td>{{ r.max_finders ?? '∞' }}</td>
              <td>
                <template v-if="r.prize_type === 'SKIN'">
                  <span v-if="r.inventory" class="skin-badge" :class="{ 'skin-badge--sold': r.inventory.is_sold }">
                    <Icon icon="mdi:sword" width="13" /> {{ r.inventory.skins?.name ?? 'Skin' }}
                  </span>
                  <span v-else class="text-warn"><Icon icon="mdi:alert-outline" width="14" /> skin não escolhida</span>
                </template>
                <template v-else>
                  <span v-if="r.coupon" class="code-badge">{{ r.coupon.code }}</span>
                  <span v-else class="text-warn"><Icon icon="mdi:alert-outline" width="14" /> sem prêmio</span>
                </template>
              </td>
              <td><span class="count-badge">{{ r._count?.discoveries ?? 0 }}</span></td>
              <td><span class="status-badge" :class="statusClass(r)">{{ statusLabel(r) }}</span></td>
              <td>
                <div class="action-row">
                  <button class="btn-view" @click="router.push(`/runes/${r.id}/edit`)">Abrir</button>
                  <button class="btn-danger" @click="deleteTarget = r">Remover</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal">
        <h3>Remover runa</h3>
        <p>Remover a runa <strong>{{ runeTypeLabel(deleteTarget) }}</strong>{{ deleteTarget.name ? ` (${deleteTarget.name})` : '' }}?</p>
        <p class="modal-hint">Ela some da loja. O cupom vinculado continua existindo.</p>
        <div class="modal-actions">
          <button class="btn-ghost" @click="deleteTarget = null">Cancelar</button>
          <button class="btn-danger" :disabled="deleting" @click="doDelete">{{ deleting ? 'Removendo...' : 'Remover' }}</button>
        </div>
      </div>
    </div>

    <div v-if="routineToDelete" class="modal-overlay" @click.self="routineToDelete = null">
      <div class="modal">
        <h3>Remover rotina</h3>
        <p>Remover a rotina <strong>{{ routineToDelete.name }}</strong>?</p>
        <p class="modal-hint">Para de gerar runas. As já geradas ficam na lista; skin não entregue volta pro estoque.</p>
        <div class="modal-actions">
          <button class="btn-ghost" @click="routineToDelete = null">Cancelar</button>
          <button class="btn-danger" :disabled="deleting" @click="doDeleteRoutine">{{ deleting ? 'Removendo...' : 'Remover' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import { adminService } from '@/services/admin/admin.service'
import { isPerUserType, runeInfo, runePageLabel, runeTypeLabel, weekdaysLabel } from '@/utils/runes'

const router = useRouter()
const runes = ref<any[]>([])
const routines = ref<any[]>([])
const loading = ref(true)
const deleteTarget = ref<any>(null)
const routineToDelete = ref<any>(null)
const deleting = ref(false)

const discountOf = (template: any) => {
  if (template.discount_type === 'FIXED') return `R$ ${(template.discount_value / 100).toFixed(2)} off`
  return `${template.discount_value}% off`
}

const conditionsOf = (template: any) => {
  const count = template.conditions?.length ?? 0
  if (!count) return ''
  return count === 1 ? ' · 1 condição' : ` · ${count} condições`
}

const templateLabel = (template: any) => {
  if (!template) return 'sem cupom'
  return discountOf(template) + conditionsOf(template)
}

// Skin já entregue (ou nunca escolhida) = rotina parada até trocar
const routineStatus = (routine: any) => {
  if (!routine.is_active) return { label: 'Inativa', css: 'status-inactive' }
  if (routine.prize_type === 'SKIN' && (!routine.inventory || routine.inventory.is_sold)) return { label: 'Sem skin', css: 'status-expired' }
  return { label: 'Ativa', css: 'status-active' }
}

// DATE vem como meia-noite UTC; ler só o YYYY-MM-DD evita cair no dia anterior em UTC-3
const day = (d: string) => dayjs(String(d).slice(0, 10)).format('DD/MM/YY')

const isOver = (r: any) => r.ends_on && dayjs(String(r.ends_on).slice(0, 10)).endOf('day').isBefore(dayjs())

// "" = todo mundo; senão resume a faixa de nível e/ou quantos usuários na lista
const tierLabel = (min: number | null, max: number | null) => {
  if (min && max) return `nível ${min}–${max}`
  if (min) return `nível ${min}+`
  if (max) return `até nível ${max}`
  return ''
}

const audienceLabel = (r: any) => {
  const users = r.audience?.length ? `${r.audience.length} usuário(s)` : ''
  return [tierLabel(r.min_tier, r.max_tier), users].filter(Boolean).join(' · ')
}

const statusLabel = (r: any) => {
  if (!r.is_active) return 'Inativa'
  if (isOver(r)) return 'Encerrada'
  return 'Ativa'
}

const statusClass = (r: any) => {
  const map: Record<string, string> = { Ativa: 'status-active', Encerrada: 'status-expired', Inativa: 'status-inactive' }
  return map[statusLabel(r)]
}

const fetchRunes = async () => {
  loading.value = true
  try {
    const [runesRes, routinesRes] = await Promise.all([adminService.getRunes(), adminService.getRuneRoutines()])
    runes.value = runesRes.data
    routines.value = routinesRes.data
  } finally {
    loading.value = false
  }
}

const doDeleteRoutine = async () => {
  if (!routineToDelete.value) return
  deleting.value = true
  try {
    await adminService.deleteRuneRoutine(routineToDelete.value.id)
    routines.value = routines.value.filter((r) => r.id !== routineToDelete.value.id)
    routineToDelete.value = null
  } finally {
    deleting.value = false
  }
}

const doDelete = async () => {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await adminService.deleteRune(deleteTarget.value.id)
    runes.value = runes.value.filter((r) => r.id !== deleteTarget.value.id)
    deleteTarget.value = null
  } finally {
    deleting.value = false
  }
}

onMounted(fetchRunes)
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

.header-actions
  display flex
  gap 8px

.section
  background #16161a
  border 1px solid rgba(255,255,255,0.06)
  border-radius 12px
  overflow hidden

.section--routines
  margin-bottom 1.5rem

.section-heading
  display flex
  align-items center
  gap 8px
  margin 0
  padding 0.9rem 1rem
  font-size 0.95rem
  font-weight 700
  border-bottom 1px solid rgba(255,255,255,0.06)

  &__hint
    font-size 0.78rem
    font-weight 400
    color rgba(255,255,255,0.38)

.type-icons
  display flex
  gap 2px
  img
    width 22px
    height 22px

.routine-tag
  display inline-flex
  align-items center
  gap 4px
  color #a5b4fc

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

.rune-cell
  display flex
  align-items center
  gap 10px

.rune-img
  width 36px
  height 36px
  filter drop-shadow(0 0 6px rgba(255,255,255,0.15))

.rune-label
  font-weight 600

.mono
  font-family 'Courier New', monospace
  font-weight 700

.row-sub
  color rgba(255,255,255,0.38)
  font-size 0.75rem
  margin 2px 0 0

.code-badge
  background rgba(99,102,241,0.12)
  color #a5b4fc
  padding 2px 8px
  border-radius 6px
  font-size 0.85rem
  font-weight 700
  letter-spacing 0.05em

.skin-badge
  display inline-flex
  align-items center
  gap 5px
  background rgba(251,191,36,0.12)
  color #fbbf24
  padding 2px 8px
  border-radius 6px
  font-size 0.8rem
  font-weight 600
  max-width 220px
  white-space nowrap
  overflow hidden
  text-overflow ellipsis

  &--sold
    opacity 0.55
    text-decoration line-through

.count-badge
  display inline-block
  background rgba(255,255,255,0.08)
  padding 1px 8px
  border-radius 999px
  font-size 0.8rem
  font-weight 600

.text-muted
  color rgba(255,255,255,0.35)
  font-size 0.82rem

.text-warn
  display inline-flex
  align-items center
  gap 4px
  color #fbbf24
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

.status-expired
  background rgba(252,129,129,0.12)
  color #fc8181

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

.btn-danger
  padding 4px 12px
  background rgba(252,129,129,0.10)
  border 1px solid rgba(252,129,129,0.25)
  border-radius 6px
  color #fc8181
  font-size 0.8rem
  cursor pointer
  &:hover
    background rgba(252,129,129,0.18)
  &:disabled
    opacity 0.5
    cursor not-allowed

.btn-ghost
  display inline-flex
  align-items center
  gap 6px
  padding 4px 12px
  background transparent
  border 1px solid rgba(255,255,255,0.12)
  border-radius 6px
  color rgba(255,255,255,0.65)
  font-size 0.85rem
  cursor pointer
  &:hover
    background rgba(255,255,255,0.06)

.empty-state
  text-align center
  padding 2.5rem
  color rgba(255,255,255,0.35)
  font-size 0.9rem

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
  width 420px
  max-width 95vw

  h3
    margin 0 0 12px
    font-size 1.1rem
    font-weight 700

  p
    color rgba(255,255,255,0.7)
    font-size 0.9rem
    margin 0 0 8px

  strong
    color #fff

.modal-hint
  color rgba(255,255,255,0.4) !important
  font-size 0.8rem !important

.modal-actions
  display flex
  justify-content flex-end
  gap 8px
  margin-top 1.25rem
</style>
