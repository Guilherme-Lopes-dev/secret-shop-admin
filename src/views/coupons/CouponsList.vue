<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <h1 class="page-title">Cupons</h1>
        <p class="page-subtitle">{{ coupons.length }} cupons cadastrados</p>
      </div>
      <button class="btn-primary" @click="router.push('/coupons/new')">
        <Icon icon="mdi:plus" width="16" /> Novo cupom
      </button>
    </header>

    <div class="filters-row">
      <div class="search-wrap">
        <Icon icon="mdi:magnify" class="search-icon" />
        <input
          v-model="search"
          type="text"
          placeholder="Buscar por código ou descrição..."
          class="search-input"
        />
      </div>
      <select v-model="filterStatus" class="filter-select">
        <option value="">Todos</option>
        <option value="active">Ativos</option>
        <option value="inactive">Inativos</option>
        <option value="expired">Expirados</option>
      </select>
    </div>

    <div class="section">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Desconto</th>
              <th>Usos</th>
              <th>Validade</th>
              <th>Status</th>
              <th>Condições</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <template v-if="loading">
              <tr v-for="n in 8" :key="n" class="skeleton-row">
                <td><div class="skeleton" style="width:90px;height:14px" /></td>
                <td><div class="skeleton" style="width:70px;height:14px" /></td>
                <td><div class="skeleton" style="width:50px;height:14px" /></td>
                <td><div class="skeleton" style="width:80px;height:14px" /></td>
                <td><div class="skeleton" style="width:60px;height:22px;border-radius:999px" /></td>
                <td><div class="skeleton" style="width:100px;height:14px" /></td>
                <td><div class="skeleton" style="width:80px;height:28px;border-radius:8px" /></td>
              </tr>
            </template>
            <template v-else>
              <tr v-for="c in filtered" :key="c.id">
                <td>
                  <code class="mono code-badge">{{ c.code }}</code>
                  <p v-if="c.description" class="row-sub">{{ c.description }}</p>
                </td>
                <td>
                  <span class="discount-value">
                    {{ c.discount_type === 'PERCENTAGE' ? `${c.discount_value}%` : formatCurrency(c.discount_value) }}
                  </span>
                  <span class="discount-type-badge">{{ c.discount_type === 'PERCENTAGE' ? '% off' : 'R$ fixo' }}</span>
                </td>
                <td>
                  <span class="count-badge">{{ c._count?.redemptions ?? 0 }}</span>
                  <span class="row-sub" v-if="c.max_uses"> / {{ c.max_uses }}</span>
                  <span class="row-sub" v-else> / ∞</span>
                </td>
                <td>
                  <span v-if="c.expires_at" :class="isExpired(c.expires_at) ? 'text-danger' : 'text-muted'">
                    {{ $dayjs(c.expires_at).format('DD/MM/YY HH:mm') }}
                  </span>
                  <span v-else class="text-muted">Sem validade</span>
                </td>
                <td>
                  <span class="status-badge" :class="statusClass(c)">{{ statusLabel(c) }}</span>
                </td>
                <td>
                  <div class="condition-pills">
                    <span
                      v-for="(cond, i) in (c.conditions ?? [])"
                      :key="i"
                      class="condition-pill"
                      :title="conditionTooltip(cond)"
                    >{{ conditionLabel(cond) }}</span>
                    <span v-if="!(c.conditions?.length)" class="text-muted">Nenhuma</span>
                  </div>
                </td>
                <td>
                  <div class="action-row">
                    <button class="btn-view" @click="router.push(`/coupons/${c.id}/edit`)">Editar</button>
                    <button class="btn-danger" @click="confirmDelete(c)">Remover</button>
                  </div>
                </td>
              </tr>
              <tr v-if="!loading && filtered.length === 0">
                <td colspan="7" class="empty-state">Nenhum cupom encontrado.</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Confirm delete modal -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal">
        <h3>Remover cupom</h3>
        <p>Tem certeza que deseja remover o cupom <strong>{{ deleteTarget.code }}</strong>?</p>
        <p class="modal-hint">Esta ação é irreversível. O cupom será desativado e removido.</p>
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
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'

const router = useRouter()
const coupons = ref<any[]>([])
const loading = ref(true)
const search = ref('')
const filterStatus = ref('')
const deleteTarget = ref<any>(null)
const deleting = ref(false)

const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date()

const statusLabel = (c: any) => {
  if (!c.is_active) return 'Inativo'
  if (c.expires_at && isExpired(c.expires_at)) return 'Expirado'
  return 'Ativo'
}

const statusClass = (c: any) => {
  const s = statusLabel(c)
  if (s === 'Ativo') return 'status-active'
  if (s === 'Expirado') return 'status-expired'
  return 'status-inactive'
}

const conditionLabel = (cond: any) => {
  const map: Record<string, string> = {
    FIRST_PURCHASE: '1ª compra',
    MIN_ORDER_AMOUNT: `Mín R$ ${(cond.value / 100).toFixed(0)}`,
    APPLIES_TO: cond.scope === 'SKINS' ? 'Skins' : cond.scope === 'COLLECTORS' ? 'Collectors' : 'Todos',
    MIN_TIER: `Tier ${cond.tier_rank}+`,
    NEW_USER_DAYS: `Novo (${cond.days}d)`,
  }
  return map[cond.type] ?? cond.type
}

const conditionTooltip = (cond: any) => {
  const map: Record<string, string> = {
    FIRST_PURCHASE: 'Válido apenas para a primeira compra',
    MIN_ORDER_AMOUNT: `Pedido mínimo de R$ ${(cond.value / 100).toFixed(2)}`,
    APPLIES_TO: `Aplica-se a: ${cond.scope}`,
    MIN_TIER: `Exige Secret Pass tier ${cond.tier_rank}+`,
    NEW_USER_DAYS: `Conta criada há no máximo ${cond.days} dias`,
  }
  return map[cond.type] ?? ''
}

const filtered = computed(() => {
  return coupons.value.filter((c) => {
    const matchSearch = !search.value || c.code.toLowerCase().includes(search.value.toLowerCase()) || (c.description ?? '').toLowerCase().includes(search.value.toLowerCase())
    const status = statusLabel(c)
    const matchStatus = !filterStatus.value
      || (filterStatus.value === 'active' && status === 'Ativo')
      || (filterStatus.value === 'inactive' && status === 'Inativo')
      || (filterStatus.value === 'expired' && status === 'Expirado')
    return matchSearch && matchStatus
  })
})

const fetchCoupons = async () => {
  loading.value = true
  try {
    const res = await adminService.getCoupons()
    coupons.value = res.data
  } finally {
    loading.value = false
  }
}

const confirmDelete = (c: any) => { deleteTarget.value = c }

const doDelete = async () => {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await adminService.deleteCoupon(deleteTarget.value.id)
    coupons.value = coupons.value.filter((c) => c.id !== deleteTarget.value.id)
    deleteTarget.value = null
  } finally {
    deleting.value = false
  }
}

onMounted(fetchCoupons)
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

.filters-row
  display flex
  align-items center
  gap 0.75rem
  flex-wrap wrap
  margin-bottom 1.25rem

.search-wrap
  position relative
  flex 1
  min-width 220px

.search-icon
  position absolute
  left 10px
  top 50%
  transform translateY(-50%)
  color rgba(255,255,255,0.35)
  width 16px

.search-input
  width 100%
  background #1a1a1e
  border 1px solid rgba(255,255,255,0.08)
  border-radius 8px
  color #fff
  padding 0.5rem 0.75rem 0.5rem 2.1rem
  font-size 0.875rem
  outline none
  &:focus
    border-color rgba(99,102,241,0.5)

.filter-select
  background #1a1a1e
  border 1px solid rgba(255,255,255,0.08)
  border-radius 8px
  color #fff
  padding 0.5rem 0.75rem
  font-size 0.875rem
  outline none
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

.mono
  font-family 'Courier New', monospace

.code-badge
  background rgba(99,102,241,0.12)
  color #a5b4fc
  padding 2px 8px
  border-radius 6px
  font-size 0.85rem
  font-weight 700
  letter-spacing 0.05em

.row-sub
  color rgba(255,255,255,0.38)
  font-size 0.75rem
  margin 2px 0 0

.discount-value
  font-weight 700
  color #fff

.discount-type-badge
  display inline-block
  margin-left 4px
  font-size 0.7rem
  color rgba(255,255,255,0.4)

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

.text-danger
  color #fc8181
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

.condition-pills
  display flex
  flex-wrap wrap
  gap 4px

.condition-pill
  display inline-block
  background rgba(99,102,241,0.10)
  border 1px solid rgba(99,102,241,0.2)
  color #a5b4fc
  padding 1px 7px
  border-radius 999px
  font-size 0.7rem
  cursor default

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
