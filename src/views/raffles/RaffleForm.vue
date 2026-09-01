<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <h1 class="page-title">Novo sorteio</h1>
        <p class="page-subtitle">
          Escolha os parâmetros e o valor do ticket. Nada é salvo até você confirmar na próxima tela.
        </p>
      </div>
      <button class="btn-ghost" @click="router.push('/raffles')">
        <Icon icon="mdi:format-list-bulleted" width="16" /> Sorteios salvos
      </button>
    </header>

    <form class="section form-grid" @submit.prevent="proceed">
      <div class="field">
        <label>Período — de <span class="label-optional">— opcional</span></label>
        <input v-model="periodFrom" type="date" />
      </div>

      <div class="field">
        <label>Período — até <span class="label-optional">— opcional</span></label>
        <input v-model="periodTo" type="date" />
        <p v-if="!periodFrom && !periodTo" class="field-hint">
          Sem data, o sorteio conta <strong>todo pedido pago</strong> das lojas marcadas.
        </p>
      </div>

      <div class="field">
        <label>Valor de cada ticket</label>
        <div class="money-input">
          <span class="prefix">R$</span>
          <input
            v-model="perTicket"
            type="number"
            min="0.01"
            step="0.01"
            required
            placeholder="50,00"
          />
        </div>
        <p class="field-hint">
          Quem gastar menos que isso no período não entra no sorteio. A sobra não vira ticket.
        </p>
      </div>

      <div class="field field-wide">
        <label>Lojas que contam</label>
        <div class="store-row">
          <label v-for="store in STORES" :key="store.value" class="store-check">
            <input v-model="stores" type="checkbox" :value="store.value" />
            <Icon :icon="store.icon" width="16" />
            {{ store.label }}
          </label>
        </div>
        <p v-if="couponPhysicalClash" class="field-warn">
          <Icon icon="mdi:alert-outline" width="14" />
          Pedido físico não aceita cupom. Com cupom marcado, o gasto em Físico entra
          <strong>por fora</strong> do filtro de cupom.
        </p>
      </div>

      <div class="field field-wide">
        <label>Cupons <span class="label-optional">— vazio conta todo pedido pago</span></label>
        <div class="chip-row">
          <button
            v-for="coupon in coupons"
            :key="coupon.id"
            type="button"
            class="chip"
            :class="{ 'chip-on': selectedCoupons.includes(coupon.id) }"
            @click="toggleCoupon(coupon.id)"
          >
            {{ coupon.code }}
          </button>
          <span v-if="!coupons.length" class="text-muted">Nenhum cupom cadastrado.</span>
        </div>
      </div>

      <div class="field field-wide">
        <label>Excluir usuários <span class="label-optional">— admin, contas de teste</span></label>
        <div class="search-wrap">
          <Icon icon="mdi:magnify" class="search-icon" />
          <input
            v-model="userSearch"
            type="search"
            class="search-input"
            placeholder="Buscar por nome, e-mail ou steam id..."
          />
        </div>

        <div v-if="userResults.length" class="result-list">
          <button
            v-for="user in userResults"
            :key="user.id"
            type="button"
            class="result-row"
            @click="excludeUser(user)"
          >
            <Icon icon="mdi:plus-circle-outline" width="14" />
            {{ user.username || user.email || user.id }}
          </button>
        </div>

        <div v-if="excluded.length" class="chip-row excluded-row">
          <button
            v-for="user in excluded"
            :key="user.id"
            type="button"
            class="chip chip-remove"
            @click="removeExcluded(user.id)"
          >
            {{ user.username || user.email || user.id }}
            <Icon icon="mdi:close" width="12" />
          </button>
        </div>
      </div>

      <div class="form-actions">
        <p v-if="error" class="form-error">{{ error }}</p>
        <button class="btn-primary" type="submit">
          Prosseguir <Icon icon="mdi:arrow-right" width="16" />
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { adminService, type RaffleStore } from '@/services/admin/admin.service'

type PickedUser = { id: string; username: string | null; email: string | null }

const STORES: Array<{ value: RaffleStore; label: string; icon: string }> = [
  { value: 'skins', label: 'Skins', icon: 'mdi:sword-cross' },
  { value: 'collector', label: 'Collector', icon: 'mdi:treasure-chest' },
  { value: 'physical', label: 'Físico', icon: 'mdi:package-variant-closed' },
]

const router = useRouter()

const periodFrom = ref('')
const periodTo = ref('')
const perTicket = ref<string>('')
const stores = ref<RaffleStore[]>(['skins', 'collector'])
const selectedCoupons = ref<string[]>([])
const excluded = ref<PickedUser[]>([])
const coupons = ref<Array<{ id: string; code: string }>>([])
const userSearch = ref('')
const userResults = ref<PickedUser[]>([])
const error = ref('')

/** Cupom + Físico juntos: o gasto físico entra sem passar pelo filtro de cupom. */
const couponPhysicalClash = computed(
  () => selectedCoupons.value.length > 0 && stores.value.includes('physical'),
)

const toggleCoupon = (id: string) => {
  selectedCoupons.value = selectedCoupons.value.includes(id)
    ? selectedCoupons.value.filter((current) => current !== id)
    : [...selectedCoupons.value, id]
}

const excludeUser = (user: PickedUser) => {
  if (excluded.value.some((current) => current.id === user.id)) return

  excluded.value = [...excluded.value, user]
  userSearch.value = ''
  userResults.value = []
}

const removeExcluded = (id: string) => {
  excluded.value = excluded.value.filter((user) => user.id !== id)
}

const searchUsers = async (term: string) => {
  if (term.trim().length < 2) {
    userResults.value = []
    return
  }

  const res = await adminService.getAllUsers(1, 8, term.trim())
  userResults.value = res.data?.data ?? []
}

let searchTimer: ReturnType<typeof setTimeout>
watch(userSearch, (term) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => searchUsers(term), 300)
})

/** R$ digitado vira centavos — o backend só fala em centavos. */
const centsPerTicket = () => Math.round(Number(perTicket.value) * 100)

const validate = () => {
  const bothFilled = periodFrom.value && periodTo.value
  if (bothFilled && periodFrom.value > periodTo.value) {
    return 'O início do período é depois do fim.'
  }
  if (!stores.value.length) return 'Escolha pelo menos uma loja.'
  if (!(centsPerTicket() > 0)) return 'O valor do ticket precisa ser maior que zero.'

  return ''
}

/** Data vazia não vira `from=` na URL — senão o backend recebe string vazia. */
const proceed = () => {
  error.value = validate()
  if (error.value) return

  router.push({
    path: '/raffles/eligible',
    query: {
      ...(periodFrom.value ? { from: periodFrom.value } : {}),
      ...(periodTo.value ? { to: periodTo.value } : {}),
      cents: String(centsPerTicket()),
      stores: stores.value.join(','),
      coupons: selectedCoupons.value.join(','),
      excluded: excluded.value.map((user) => user.id).join(','),
    },
  })
}

onMounted(async () => {
  const res = await adminService.getCoupons()
  coupons.value = res.data ?? []
})
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
  max-width 60ch

.section
  background #16161a
  border 1px solid rgba(255,255,255,0.06)
  border-radius 12px
  padding 1.5rem

.form-grid
  display grid
  grid-template-columns repeat(auto-fit, minmax(220px, 1fr))
  gap 1.25rem

.field
  display flex
  flex-direction column
  gap 0.4rem

.field-wide
  grid-column 1 / -1

label
  font-size 0.78rem
  font-weight 600
  text-transform uppercase
  letter-spacing 0.04em
  color rgba(255,255,255,0.5)

.label-optional
  text-transform none
  letter-spacing 0
  font-weight 400
  color rgba(255,255,255,0.3)

input[type="date"],
input[type="number"],
.search-input
  background #1a1a1e
  border 1px solid rgba(255,255,255,0.08)
  border-radius 8px
  color #fff
  padding 0.55rem 0.75rem
  font-size 0.875rem
  outline none
  width 100%
  &:focus
    border-color rgba(99,102,241,0.5)

.money-input
  position relative
  display flex
  align-items center

  .prefix
    position absolute
    left 10px
    font-size 0.85rem
    color rgba(255,255,255,0.4)

  input
    padding-left 2.2rem

.field-hint
  font-size 0.75rem
  color rgba(255,255,255,0.35)
  margin 0

.field-warn
  display flex
  align-items flex-start
  gap 6px
  font-size 0.78rem
  color #fbbf24
  background rgba(251,191,36,0.08)
  border 1px solid rgba(251,191,36,0.2)
  border-radius 8px
  padding 0.5rem 0.7rem
  margin 0.2rem 0 0

.store-row
  display flex
  gap 0.6rem
  flex-wrap wrap

.store-check
  display inline-flex
  align-items center
  gap 6px
  background #1a1a1e
  border 1px solid rgba(255,255,255,0.08)
  border-radius 8px
  padding 0.5rem 0.85rem
  font-size 0.85rem
  text-transform none
  letter-spacing 0
  color #fff
  cursor pointer
  &:hover
    border-color rgba(99,102,241,0.4)

  input
    accent-color #6366f1

.chip-row
  display flex
  flex-wrap wrap
  gap 6px

.chip
  display inline-flex
  align-items center
  gap 5px
  background rgba(255,255,255,0.05)
  border 1px solid rgba(255,255,255,0.08)
  color rgba(255,255,255,0.7)
  padding 4px 11px
  border-radius 999px
  font-size 0.78rem
  cursor pointer
  &:hover
    border-color rgba(99,102,241,0.4)

.chip-on
  background rgba(99,102,241,0.15)
  border-color rgba(99,102,241,0.45)
  color #a5b4fc
  font-weight 600

.chip-remove
  background rgba(252,129,129,0.10)
  border-color rgba(252,129,129,0.25)
  color #fca5a5

.search-wrap
  position relative

.search-icon
  position absolute
  left 10px
  top 50%
  transform translateY(-50%)
  color rgba(255,255,255,0.35)
  width 16px

.search-input
  padding-left 2.1rem

.result-list
  display flex
  flex-direction column
  background #1a1a1e
  border 1px solid rgba(255,255,255,0.08)
  border-radius 8px
  overflow hidden

.result-row
  display flex
  align-items center
  gap 6px
  background none
  border none
  border-bottom 1px solid rgba(255,255,255,0.04)
  color #fff
  font-size 0.83rem
  padding 0.5rem 0.75rem
  text-align left
  cursor pointer
  &:last-child
    border-bottom none
  &:hover
    background rgba(99,102,241,0.10)

.excluded-row
  margin-top 0.2rem

.text-muted
  color rgba(255,255,255,0.35)
  font-size 0.82rem

.form-actions
  grid-column 1 / -1
  display flex
  align-items center
  justify-content flex-end
  gap 1rem

.form-error
  color #fc8181
  font-size 0.82rem
  margin 0
  margin-right auto

.btn-primary
  display inline-flex
  align-items center
  gap 6px
  padding 0.6rem 1.3rem
  background #6366f1
  border none
  border-radius 8px
  color #fff
  font-weight 600
  font-size 0.9rem
  cursor pointer
  &:hover
    background #4f46e5

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
  &:hover
    background rgba(255,255,255,0.08)
</style>
