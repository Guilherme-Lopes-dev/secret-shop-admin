<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'

// ponytail: espelha REWARD_MAX_TIER do backend, igual ao filtro de nível da fila
const GEMS = [1, 2, 3]
// Espelha o @Max do DTO: R$ 1.000 por gema.
const MAX_PER_GEM_CENTS = 100_000

// Valor salvo vem do pai (mesma busca da chave geral) e volta pra ele no save.
const savedCents = defineModel<number>('savedCents', { required: true })

// Digitado em reais; a API guarda centavos. Vazio = campo apagado, não zero.
const perGem = ref<number | ''>('')
const saving = ref(false)

const ladderOf = (cents: number) => GEMS.map(gem => ({ gem, cents: gem * cents }))

const inputCents = computed(() => Math.round(Number(perGem.value) * 100))
const isOverMax = computed(() => inputCents.value > MAX_PER_GEM_CENTS)
const isValid = computed(
  () => perGem.value !== '' && Number.isFinite(inputCents.value) && inputCents.value >= 0 && !isOverMax.value,
)
const isDirty = computed(() => isValid.value && inputCents.value !== savedCents.value)

const savedLadder = computed(() => ladderOf(savedCents.value))
const draftLadder = computed(() => ladderOf(inputCents.value))

watch(savedCents, cents => (perGem.value = cents / 100), { immediate: true })

const save = async () => {
  saving.value = true
  try {
    const { data } = await adminService.setRewardsMinSpend(inputCents.value)
    savedCents.value = data.min_spend_per_tier
    toast.success(data.min_spend_per_tier ? 'Gasto mínimo por gema salvo.' : 'Gasto mínimo removido.')
  } catch (e: any) {
    toast.error(e?.response?.data?.message || 'Não deu para salvar o gasto mínimo.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="min-spend">
    <header class="min-spend__head">
      <div class="min-spend__title">
        <Icon icon="mdi:diamond-stone" />
        Gasto mínimo por gema
      </div>
      <span v-if="savedCents" class="min-spend__ladder">
        <span v-for="step in savedLadder" :key="step.gem">Gema {{ step.gem }}: <b>{{ formatCurrency(step.cents) }}</b></span>
      </span>
      <span v-else class="min-spend__off">Sem mínimo</span>
    </header>

    <p class="min-spend__hint">
      O valor <b>acumula</b>: com R$ 50, a gema 1 pede R$ 50 gastos, a 2 pede R$ 100 e a 3 pede R$ 150.
      Conta o mesmo gasto da coluna <b>Gasto</b> da fila (dropship vale 10%, brinde não conta).
      Quem não chega vê o baú só como <b>Bloqueado</b>, sem valor nenhum.
      A conferência vale no resgate e de novo ao liberar: brinde na fila de quem ficou abaixo
      (estorno ou mínimo aumentado) não sai — negue ou espere a pessoa comprar. 0 = sem mínimo.
    </p>

    <div class="min-spend__fields">
      <label class="field">
        <span>Valor por gema (R$)</span>
        <input v-model.number="perGem" type="number" min="0" max="1000" step="0.01" placeholder="0" class="field__input" />
      </label>
      <button class="btn-save" :disabled="saving || !isDirty" @click="save">
        <Icon icon="mdi:content-save-outline" /> Salvar
      </button>
      <span v-if="isOverMax" class="min-spend__warn">Máximo de {{ formatCurrency(MAX_PER_GEM_CENTS) }} por gema.</span>
      <span v-else-if="isDirty" class="min-spend__draft">
        Ao salvar:
        <span v-for="step in draftLadder" :key="step.gem">gema {{ step.gem }} <b>{{ formatCurrency(step.cents) }}</b></span>
      </span>
    </div>
  </section>
</template>

<style lang="stylus" scoped>
.min-spend
    margin-bottom 1.25rem
    padding 0.9rem 1rem
    border 1px solid rgba(255,255,255,0.06)
    border-radius 10px
    background rgba(99,102,241,0.04)

.min-spend__head
    display flex
    align-items center
    gap 0.75rem
    flex-wrap wrap

.min-spend__title
    display inline-flex
    align-items center
    gap 0.4rem
    font-weight 700
    color #818cf8

.min-spend__ladder
    display inline-flex
    gap 0.75rem
    flex-wrap wrap
    color #94a3b8
    font-size 0.85rem

    b
        color #fff

.min-spend__off
    color #64748b
    font-size 0.85rem

.min-spend__hint
    margin 0.4rem 0 0.8rem
    color #64748b
    font-size 0.78rem
    line-height 1.5

    b
        color #94a3b8

.min-spend__fields
    display flex
    align-items flex-end
    gap 0.75rem
    flex-wrap wrap

.min-spend__draft
    display inline-flex
    gap 0.6rem
    flex-wrap wrap
    align-self center
    color #94a3b8
    font-size 0.8rem

    b
        color #fbbf24

.min-spend__warn
    align-self center
    color #f44336
    font-size 0.8rem

.field
    display flex
    flex-direction column
    gap 0.25rem

    > span
        color #64748b
        font-size 0.7rem
        text-transform uppercase
        letter-spacing 0.04em

.field__input
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.5rem 0.6rem
    font-size 0.875rem
    outline none
    width 140px
    box-sizing border-box

.btn-save
    display inline-flex
    align-items center
    gap 0.4rem
    padding 0.5rem 0.9rem
    border-radius 8px
    font-size 0.85rem
    font-weight 600
    cursor pointer
    background rgba(99,102,241,0.14)
    border 1px solid rgba(99,102,241,0.35)
    color #818cf8

    &:hover:not(:disabled)
        background rgba(99,102,241,0.22)

    &:disabled
        opacity 0.5
        cursor not-allowed
</style>
