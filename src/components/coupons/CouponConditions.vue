<template>
  <div class="conditions-list">
    <div v-for="(cond, idx) in conditions" :key="idx" class="condition-card">
      <div class="condition-card__header">
        <span class="condition-card__type">{{ conditionTypeLabel(cond.type) }}</span>
        <button type="button" class="condition-card__remove" @click="removeCondition(idx)">
          <Icon icon="mdi:close" width="14" />
        </button>
      </div>

      <!-- FIRST_PURCHASE: no extra fields -->
      <p v-if="cond.type === 'FIRST_PURCHASE'" class="condition-card__desc">
        Cupom válido apenas para a primeira compra do usuário.
      </p>

      <!-- MIN_ORDER_AMOUNT -->
      <div v-else-if="cond.type === 'MIN_ORDER_AMOUNT'" class="condition-card__fields">
        <label>Valor mínimo (centavos)</label>
        <input v-model.number="cond.value" type="number" min="1" class="form-input" />
        <p class="field-hint">R$ {{ (cond.value / 100).toFixed(2) }}</p>
      </div>

      <!-- APPLIES_TO -->
      <div v-else-if="cond.type === 'APPLIES_TO'" class="condition-card__fields">
        <label>Aplica-se a</label>
        <select v-model="cond.scope" class="form-input">
          <option value="ALL">Todos (Skins + Collectors)</option>
          <option value="SKINS">Apenas Skins</option>
          <option value="COLLECTORS">Apenas Collectors</option>
        </select>
      </div>

      <!-- MIN_TIER -->
      <div v-else-if="cond.type === 'MIN_TIER'" class="condition-card__fields">
        <label>Tier mínimo do Secret Pass</label>
        <input v-model.number="cond.tier_rank" type="number" min="1" max="10" class="form-input" />
        <p class="field-hint">Usuários com tier_rank &ge; {{ cond.tier_rank }}</p>
      </div>

      <!-- NEW_USER_DAYS -->
      <div v-else-if="cond.type === 'NEW_USER_DAYS'" class="condition-card__fields">
        <label>Conta criada há no máximo X dias</label>
        <input v-model.number="cond.days" type="number" min="1" class="form-input" />
      </div>
    </div>

    <div v-if="conditions.length === 0" class="conditions-empty">
      Nenhuma condição. O cupom será aceito por qualquer usuário.
    </div>
  </div>

  <div class="add-condition">
    <select v-model="newConditionType" class="form-input">
      <option value="" disabled>Adicionar condição...</option>
      <option v-for="opt in availableConditionTypes" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
    <button type="button" class="btn-add-condition" @click="addCondition" :disabled="!newConditionType">
      <Icon icon="mdi:plus" width="16" /> Adicionar
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'

const conditions = defineModel<any[]>({ required: true })

const newConditionType = ref('')

const conditionTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    FIRST_PURCHASE: 'Primeira compra',
    MIN_ORDER_AMOUNT: 'Valor mínimo do pedido',
    APPLIES_TO: 'Restringir a tipo de pedido',
    MIN_TIER: 'Tier mínimo (Secret Pass)',
    NEW_USER_DAYS: 'Conta nova',
  }
  return map[type] ?? type
}

const conditionDefaults: Record<string, () => any> = {
  FIRST_PURCHASE: () => ({ type: 'FIRST_PURCHASE' }),
  MIN_ORDER_AMOUNT: () => ({ type: 'MIN_ORDER_AMOUNT', value: 500 }),
  APPLIES_TO: () => ({ type: 'APPLIES_TO', scope: 'ALL' }),
  MIN_TIER: () => ({ type: 'MIN_TIER', tier_rank: 1 }),
  NEW_USER_DAYS: () => ({ type: 'NEW_USER_DAYS', days: 30 }),
}

const usedTypes = computed(() => new Set(conditions.value.map((c) => c.type)))

const availableConditionTypes = computed(() =>
  Object.keys(conditionDefaults)
    .filter((t) => !usedTypes.value.has(t))
    .map((t) => ({ value: t, label: conditionTypeLabel(t) }))
)

const addCondition = () => {
  if (!newConditionType.value) return
  conditions.value = [...conditions.value, conditionDefaults[newConditionType.value]?.()]
  newConditionType.value = ''
}

const removeCondition = (idx: number) => {
  conditions.value = conditions.value.filter((_, i) => i !== idx)
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
