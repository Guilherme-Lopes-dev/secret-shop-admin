<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { adminService } from '@/services/admin/admin.service'

interface BlastUser {
  id: string
  username: string | null
  email: string | null
  contact: string
  sales_count: number
  total_spent: number
  tier_rank: number
  tier_name: string
}

const TIERS = [
  { rank: 0, name: 'Common',    color: '#B0C3D9' },
  { rank: 1, name: 'Uncommon',  color: '#5E98D9' },
  { rank: 2, name: 'Rare',      color: '#4B69FF' },
  { rank: 3, name: 'Mythical',  color: '#8847FF' },
  { rank: 4, name: 'Legendary', color: '#D32CE6' },
  { rank: 5, name: 'Ancient',   color: '#EB4B4B' },
  { rank: 6, name: 'Immortal',  color: '#E4AE33' },
]

const SEGMENTS = [
  { value: 'all', label: 'Todos com WhatsApp', icon: 'mdi:whatsapp' },
  { value: 'no_purchases', label: 'Sem compras', icon: 'mdi:cart-off' },
  { value: 'top_buyers', label: 'Maiores compradores', icon: 'mdi:trending-up' },
  { value: 'low_buyers', label: 'Menores compradores', icon: 'mdi:trending-down' },
]

const segment = ref('all')
const previewLimit = ref(500)
const tierRank = ref<number | ''>('')
const message = ref('')

const users = ref<BlastUser[]>([])
const selectedUuids = ref<Set<string>>(new Set())
const loadingPreview = ref(false)
const sending = ref(false)
const result = ref<{ queued: number } | null>(null)
const error = ref<string | null>(null)

const allSelected = computed(() =>
  users.value.length > 0 && users.value.every((u) => selectedUuids.value.has(u.id)),
)

const selectedCount = computed(() => selectedUuids.value.size)

const canSend = computed(() =>
  selectedCount.value > 0 && message.value.trim().length > 0 && !sending.value,
)

async function loadPreview() {
  loadingPreview.value = true
  error.value = null
  result.value = null
  selectedUuids.value = new Set()

  try {
    const res = await adminService.previewWhatsappBlast(segment.value, previewLimit.value, tierRank.value === '' ? undefined : tierRank.value)
    users.value = res.data
  } catch (e: any) {
    error.value = e?.message ?? 'Erro ao buscar usuários.'
  } finally {
    loadingPreview.value = false
  }
}

function toggleAll() {
  if (allSelected.value) {
    selectedUuids.value = new Set()
  } else {
    selectedUuids.value = new Set(users.value.map((u) => u.id))
  }
}

function toggleUser(uuid: string) {
  const next = new Set(selectedUuids.value)
  if (next.has(uuid)) next.delete(uuid)
  else next.add(uuid)
  selectedUuids.value = next
}

async function sendBlast() {
  if (!canSend.value) return
  error.value = null
  result.value = null
  sending.value = true

  try {
    const res = await adminService.sendWhatsappBlast(
      Array.from(selectedUuids.value),
      message.value.trim(),
    )
    result.value = res.data
    selectedUuids.value = new Set()
    message.value = ''
    toast.success(`${res.data.queued} mensagem(ns) enfileirada(s) com sucesso!`)
  } catch (e: any) {
    error.value = e?.message ?? 'Erro ao enviar.'
    toast.error(error.value ?? 'Erro ao enviar.')
  } finally {
    sending.value = false
  }
}

function formatCurrency(cents: number) {
  return `R$ ${(cents / 100).toFixed(2)}`
}
</script>

<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <h1 class="page-title">
          <Icon icon="mdi:whatsapp" style="color:#25d366;vertical-align:-3px;margin-right:6px" />
          Disparo em Massa — WhatsApp
        </h1>
        <p class="page-subtitle">Filtre usuários com WhatsApp cadastrado e envie mensagem via Z-API.</p>
      </div>
    </header>

    <!-- Filters -->
    <div class="section">
      <h2 class="section-title">Segmento</h2>
      <div class="segment-grid">
        <button
          v-for="s in SEGMENTS"
          :key="s.value"
          class="segment-card"
          :class="{ active: segment === s.value }"
          @click="segment = s.value"
        >
          <Icon :icon="s.icon" width="20" />
          <span>{{ s.label }}</span>
        </button>
      </div>

      <div class="filter-row">
        <div class="field-inline">
          <label>Nível de passe</label>
          <select v-model="tierRank" class="form-input input-tier">
            <option value="">Todos os níveis</option>
            <option v-for="t in TIERS" :key="t.rank" :value="t.rank">
              {{ t.name }}
            </option>
          </select>
        </div>
        <div class="field-inline">
          <label>Limite de usuários</label>
          <input v-model.number="previewLimit" type="number" min="1" max="5000" class="form-input input-sm" />
        </div>
        <button class="btn-primary" :disabled="loadingPreview" @click="loadPreview">
          <Icon icon="mdi:magnify" width="16" />
          {{ loadingPreview ? 'Buscando...' : 'Buscar usuários' }}
        </button>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="alert alert-error">
      <Icon icon="mdi:alert-circle-outline" width="16" /> {{ error }}
    </div>

    <!-- Result -->
    <div v-if="result" class="alert alert-success">
      <Icon icon="mdi:check-circle-outline" width="16" />
      {{ result.queued }} mensagem(ns) enfileirada(s) com sucesso!
    </div>

    <!-- Users table -->
    <div v-if="users.length > 0" class="section">
      <div class="table-header">
        <h2 class="section-title">
          {{ users.length }} usuário(s) encontrado(s)
          <span v-if="selectedCount > 0" class="badge-selected">{{ selectedCount }} selecionado(s)</span>
        </h2>
        <div class="table-actions">
          <button class="btn-ghost" @click="toggleAll">
            {{ allSelected ? 'Desmarcar todos' : 'Selecionar todos' }}
          </button>
        </div>
      </div>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th class="col-check">
                <input type="checkbox" :checked="allSelected" @change="toggleAll" />
              </th>
              <th>Usuário</th>
              <th>WhatsApp</th>
              <th>Tier</th>
              <th>Compras</th>
              <th>Total gasto</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="user in users"
              :key="user.id"
              :class="{ selected: selectedUuids.has(user.id) }"
              @click="toggleUser(user.id)"
            >
              <td class="col-check" @click.stop>
                <input
                  type="checkbox"
                  :checked="selectedUuids.has(user.id)"
                  @change="toggleUser(user.id)"
                />
              </td>
              <td>
                <div class="user-info">
                  <span class="user-name">{{ user.username ?? '—' }}</span>
                  <span class="user-email">{{ user.email ?? '' }}</span>
                </div>
              </td>
              <td class="mono">{{ user.contact }}</td>
              <td>
                <span
                  class="tier-badge"
                  :style="{ color: TIERS[user.tier_rank]?.color ?? '#B0C3D9', borderColor: TIERS[user.tier_rank]?.color ?? '#B0C3D9' }"
                >
                  {{ user.tier_name }}
                </span>
              </td>
              <td class="center">{{ user.sales_count }}</td>
              <td class="center">{{ formatCurrency(user.total_spent) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else-if="!loadingPreview && users.length === 0 && !error" class="empty-state">
      <Icon icon="mdi:account-search-outline" width="48" />
      <p>Selecione um segmento e clique em "Buscar usuários".</p>
    </div>

    <!-- Message + Send -->
    <div v-if="users.length > 0" class="section">
      <h2 class="section-title">Mensagem</h2>
      <p class="section-hint">Será enviada para os {{ selectedCount }} usuário(s) selecionado(s).</p>

      <div class="field">
        <textarea
          v-model="message"
          class="form-input message-textarea"
          placeholder="Digite a mensagem que será enviada via WhatsApp..."
          maxlength="4096"
          rows="6"
        />
        <p class="field-hint">{{ message.length }}/4096</p>
      </div>

      <div class="send-row">
        <button
          class="btn-send"
          :disabled="!canSend"
          @click="sendBlast"
        >
          <Icon :icon="sending ? 'mdi:loading' : 'mdi:send'" width="18" :class="{ spin: sending }" />
          {{ sending ? 'Enviando...' : `Enviar para ${selectedCount} usuário(s)` }}
        </button>
        <p v-if="selectedCount === 0" class="field-hint field-hint--warn">
          Selecione ao menos um usuário.
        </p>
      </div>
    </div>
  </div>
</template>

<style lang="stylus" scoped>
.view-wrap
  padding 2rem
  max-width 1100px
  margin 0 auto

.page-header
  display flex
  justify-content space-between
  align-items flex-start
  margin-bottom 2rem

.page-title
  font-size 1.5rem
  font-weight 700
  color #f1f5f9
  margin 0 0 0.25rem

.page-subtitle
  font-size 0.875rem
  color #64748b
  margin 0

.section
  background #16181d
  border 1px solid rgba(255,255,255,0.06)
  border-radius 10px
  padding 1.5rem
  margin-bottom 1.25rem

.section-title
  font-size 0.95rem
  font-weight 600
  color #e2e8f0
  margin 0 0 1rem

.section-hint
  font-size 0.8rem
  color #64748b
  margin -0.5rem 0 1rem

.segment-grid
  display grid
  grid-template-columns repeat(auto-fill, minmax(180px, 1fr))
  gap 0.75rem
  margin-bottom 1.25rem

.segment-card
  display flex
  align-items center
  gap 0.5rem
  padding 0.65rem 1rem
  background rgba(255,255,255,0.03)
  border 1px solid rgba(255,255,255,0.08)
  border-radius 8px
  color #94a3b8
  font-size 0.85rem
  cursor pointer
  transition all 0.15s

  &:hover
    border-color rgba(99,102,241,0.4)
    color #c7d2fe

  &.active
    background rgba(99,102,241,0.12)
    border-color #6366f1
    color #a5b4fc

.filter-row
  display flex
  align-items flex-end
  gap 1rem
  flex-wrap wrap

.field-inline
  display flex
  flex-direction column
  gap 0.3rem

  label
    font-size 0.8rem
    color #64748b

.input-sm
  width 100px

.input-tier
  width 160px

.form-input
  background #1e2028
  border 1px solid rgba(255,255,255,0.1)
  border-radius 6px
  color #e2e8f0
  font-size 0.875rem
  padding 0.5rem 0.75rem
  outline none
  transition border-color 0.15s
  appearance none
  -webkit-appearance none

  &:focus
    border-color rgba(99,102,241,0.5)

  option
    background #1e2028
    color #e2e8f0

.message-textarea
  width 100%
  resize vertical
  font-family inherit

.btn-primary
  display inline-flex
  align-items center
  gap 0.4rem
  padding 0.55rem 1.1rem
  background #6366f1
  color #fff
  border none
  border-radius 6px
  font-size 0.875rem
  font-weight 500
  cursor pointer
  transition background 0.15s

  &:hover:not(:disabled)
    background #4f46e5

  &:disabled
    opacity 0.5
    cursor not-allowed

.btn-ghost
  background transparent
  border 1px solid rgba(255,255,255,0.1)
  color #94a3b8
  border-radius 6px
  padding 0.4rem 0.85rem
  font-size 0.8rem
  cursor pointer
  transition all 0.15s

  &:hover
    border-color rgba(255,255,255,0.2)
    color #cbd5e1

.table-header
  display flex
  justify-content space-between
  align-items center
  margin-bottom 1rem

.table-actions
  display flex
  gap 0.5rem

.badge-selected
  margin-left 0.5rem
  background rgba(99,102,241,0.15)
  color #a5b4fc
  font-size 0.75rem
  padding 0.15rem 0.5rem
  border-radius 10px
  font-weight 500

.table-wrapper
  overflow-x auto
  border-radius 8px
  border 1px solid rgba(255,255,255,0.06)

table
  width 100%
  border-collapse collapse
  font-size 0.875rem

thead tr
  background rgba(255,255,255,0.03)

th
  padding 0.65rem 0.875rem
  color #64748b
  font-weight 500
  text-align left
  border-bottom 1px solid rgba(255,255,255,0.06)
  white-space nowrap

td
  padding 0.65rem 0.875rem
  border-bottom 1px solid rgba(255,255,255,0.04)
  color #cbd5e1

tbody tr
  cursor pointer
  transition background 0.1s

  &:hover
    background rgba(255,255,255,0.03)

  &.selected
    background rgba(99,102,241,0.07)

  &:last-child td
    border-bottom none

.col-check
  width 40px

.user-info
  display flex
  flex-direction column
  gap 0.15rem

.user-name
  color #e2e8f0
  font-weight 500

.user-email
  font-size 0.75rem
  color #64748b

.mono
  font-family monospace
  font-size 0.82rem

.tier-badge
  font-size 0.75rem
  font-weight 600
  padding 0.15rem 0.45rem
  border-radius 4px
  border 1px solid
  background rgba(255,255,255,0.04)
  white-space nowrap

.center
  text-align center

.field
  display flex
  flex-direction column
  gap 0.4rem
  margin-bottom 1rem

.field-hint
  font-size 0.78rem
  color #64748b
  margin 0

  &--warn
    color #f59e0b

.send-row
  display flex
  align-items center
  gap 1rem
  flex-wrap wrap

.btn-send
  display inline-flex
  align-items center
  gap 0.5rem
  padding 0.65rem 1.4rem
  background #25d366
  color #fff
  border none
  border-radius 8px
  font-size 0.9rem
  font-weight 600
  cursor pointer
  transition background 0.15s

  &:hover:not(:disabled)
    background #1ebe5d

  &:disabled
    opacity 0.5
    cursor not-allowed

.spin
  animation spin 1s linear infinite

@keyframes spin
  from transform rotate(0deg)
  to transform rotate(360deg)

.empty-state
  display flex
  flex-direction column
  align-items center
  gap 1rem
  padding 4rem 2rem
  color #334155
  text-align center

  p
    font-size 0.9rem

.alert
  display flex
  align-items center
  gap 0.5rem
  padding 0.75rem 1rem
  border-radius 8px
  font-size 0.875rem
  margin-bottom 1rem

  &-error
    background rgba(239,68,68,0.1)
    border 1px solid rgba(239,68,68,0.2)
    color #fca5a5

  &-success
    background rgba(34,197,94,0.1)
    border 1px solid rgba(34,197,94,0.2)
    color #86efac
</style>
