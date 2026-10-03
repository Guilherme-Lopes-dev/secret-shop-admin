<template>
  <div class="conditions-list">
    <div v-for="(cond, idx) in conditions" :key="cond.type" class="condition-card">
      <div class="condition-card__header">
        <span class="condition-card__type">{{ LABELS[cond.type] ?? cond.type }}</span>
        <button type="button" class="condition-card__remove" @click="removeCondition(idx)">
          <Icon icon="mdi:close" width="14" />
        </button>
      </div>

      <p v-if="cond.type === 'HAS_PURCHASED'" class="condition-card__desc">
        Pelo menos um pedido pago (skin, collector ou físico). Brinde e pedido estornado não contam.
      </p>

      <p v-else-if="cond.type === 'HAS_TRADE_LINK'" class="condition-card__desc">
        Trade link cadastrado no perfil. Sem ele, skin ganha fica parada na fila.
      </p>

      <div v-else-if="cond.type === 'MIN_ACCOUNT_AGE_DAYS'" class="condition-card__fields">
        <label>Conta criada há pelo menos (dias)</label>
        <input v-model.number="cond.days" type="number" min="1" class="form-input" />
        <p class="field-hint">Segura conta criada só pra caçar runa.</p>
      </div>

      <div v-else-if="cond.type === 'MIN_PASS_TIER'" class="condition-card__fields">
        <label>Tier mínimo do Secret Pass</label>
        <input v-model.number="cond.tier_rank" type="number" min="1" max="10" class="form-input" />
        <p class="field-hint">Tier do passe, não o nível do perfil (esse fica na faixa acima).</p>
      </div>

      <div v-else-if="cond.type === 'MIN_SPENT'" class="condition-card__fields">
        <label>Gasto mínimo (R$)</label>
        <input :value="cond.value / 100" type="number" min="0.01" step="0.01" class="form-input" @input="setSpent(cond, $event)" />
        <p class="field-hint">Vale {{ formatCurrency(cond.value) }}. Mesmo gasto da régua das gemas: dropship vale 10%, brinde não conta.</p>
      </div>
    </div>

    <div v-if="conditions.length === 0" class="conditions-empty">
      Nenhuma condição. Vale só a faixa de nível e a lista de usuários.
    </div>

    <p v-if="missingTradeLink" class="condition-warn">
      <Icon icon="mdi:alert-outline" width="14" />
      Prêmio é skin: sem "Tem trade link", quem pegar sem trade link fica com a skin parada na fila até cadastrar.
    </p>
  </div>

  <div v-if="available.length" class="add-condition">
    <select v-model="newType" class="form-input">
      <option value="" disabled>Adicionar condição...</option>
      <option v-for="type in available" :key="type" :value="type">{{ LABELS[type] }}</option>
    </select>
    <button type="button" class="btn-add-condition" :disabled="!newType" @click="addCondition">
      <Icon icon="mdi:plus" width="16" /> Adicionar
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { RuneCondition, RuneConditionType } from '@/services/admin/types'
import { formatCurrency } from '@/utils/formatCurrency'

// Espelha rune-conditions.ts do backend. Somam (E) com a faixa de nível e a lista.
const conditions = defineModel<RuneCondition[]>({ required: true })

// Só pro aviso: trade link fica a critério de quem monta a runa, não é forçado.
const props = defineProps<{ prizeType: 'COUPON' | 'SKIN' }>()

const missingTradeLink = computed(
  () => props.prizeType === 'SKIN' && !conditions.value.some((cond) => cond.type === 'HAS_TRADE_LINK'),
)

const LABELS: Record<RuneConditionType, string> = {
  HAS_PURCHASED:        'Já comprou',
  HAS_TRADE_LINK:       'Tem trade link',
  MIN_ACCOUNT_AGE_DAYS: 'Conta com mais de X dias',
  MIN_PASS_TIER:        'Tier mínimo (Secret Pass)',
  MIN_SPENT:            'Gasto mínimo',
}

const DEFAULTS: Record<RuneConditionType, () => RuneCondition> = {
  HAS_PURCHASED:        () => ({ type: 'HAS_PURCHASED' }),
  HAS_TRADE_LINK:       () => ({ type: 'HAS_TRADE_LINK' }),
  MIN_ACCOUNT_AGE_DAYS: () => ({ type: 'MIN_ACCOUNT_AGE_DAYS', days: 30 }),
  MIN_PASS_TIER:        () => ({ type: 'MIN_PASS_TIER', tier_rank: 1 }),
  MIN_SPENT:            () => ({ type: 'MIN_SPENT', value: 5000 }),
}

const newType = ref<RuneConditionType | ''>('')

// Cada tipo uma vez só: dois "gasto mínimo" seriam só o maior valendo.
const available = computed(() => {
  const used = new Set(conditions.value.map((cond) => cond.type))
  return (Object.keys(DEFAULTS) as RuneConditionType[]).filter((type) => !used.has(type))
})

const addCondition = () => {
  if (!newType.value) return

  conditions.value = [...conditions.value, DEFAULTS[newType.value]()]
  newType.value = ''
}

const removeCondition = (idx: number) => {
  conditions.value = conditions.value.filter((_, i) => i !== idx)
}

// Digitado em reais, guardado em centavos como o resto do sistema. Campo vazio
// ou zero não vira `value: 0` (a API recusa com erro genérico): fica o último
// valor válido, e o "Vale R$ X" embaixo mostra qual é.
const setSpent = (cond: Extract<RuneCondition, { type: 'MIN_SPENT' }>, event: Event) => {
  const cents = Math.round(Number((event.target as HTMLInputElement).value) * 100)
  if (!(cents >= 1)) return

  cond.value = cents
}
</script>

<style lang="stylus" scoped>
.conditions-list
  display flex
  flex-direction column
  gap 0.75rem
  margin-bottom 1rem

.conditions-empty
  text-align center
  padding 1.25rem
  color rgba(255,255,255,0.3)
  font-size 0.85rem
  border 1px dashed rgba(255,255,255,0.1)
  border-radius 8px

.condition-card
  background rgba(99,102,241,0.06)
  border 1px solid rgba(99,102,241,0.15)
  border-radius 10px
  padding 0.75rem 1rem

.condition-card__header
  display flex
  align-items center
  justify-content space-between
  margin-bottom 8px

.condition-card__type
  font-size 0.8rem
  font-weight 700
  color #a5b4fc

.condition-card__remove
  background transparent
  border none
  color rgba(255,255,255,0.4)
  cursor pointer
  padding 0
  display flex
  align-items center
  &:hover
    color #fc8181

.condition-card__desc
  font-size 0.8rem
  color rgba(255,255,255,0.45)
  margin 0

.condition-warn
  display flex
  align-items center
  gap 6px
  margin 0
  font-size 0.78rem
  color #fbbf24

.condition-card__fields
  display flex
  flex-direction column
  gap 4px

  label
    font-size 0.78rem
    color rgba(255,255,255,0.5)

.field-hint
  font-size 0.75rem
  color rgba(255,255,255,0.35)
  margin 0

.form-input
  background rgba(0,0,0,0.25)
  border 1px solid rgba(255,255,255,0.1)
  border-radius 8px
  color #fff
  padding 0.5rem 0.75rem
  font-size 0.875rem
  outline none
  width 100%
  box-sizing border-box
  &:focus
    border-color rgba(99,102,241,0.5)

  option
    background #1a1a1e
    color #fff

.add-condition
  display flex
  gap 8px
  margin-top 0.5rem

  select
    flex 1

.btn-add-condition
  display inline-flex
  align-items center
  gap 4px
  padding 0.5rem 0.9rem
  background rgba(99,102,241,0.15)
  border 1px solid rgba(99,102,241,0.3)
  border-radius 8px
  color #a5b4fc
  font-size 0.82rem
  font-weight 600
  cursor pointer
  white-space nowrap
  &:hover:not(:disabled)
    background rgba(99,102,241,0.25)
  &:disabled
    opacity 0.4
    cursor not-allowed
</style>
