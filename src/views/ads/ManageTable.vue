<template>
  <p v-if="!rows.length" class="hint">Nada na conta.</p>
  <div v-else class="table-wrap">
    <table class="table">
      <thead>
        <tr>
          <th>Nome</th>
          <th>Status</th>
          <th class="num">Orçamento/dia</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key" :class="`depth--${row.depth}`">
          <td>
            <span class="level">{{ row.level }}</span>
            {{ row.name }}
          </td>
          <td><span class="status" :class="row.statusClass">{{ row.status }}</span></td>
          <td class="num">
            <input
              v-if="row.budget != null"
              type="number"
              :min="minBudget"
              step="0.01"
              class="budget"
              :value="row.budget"
              :disabled="!writable || busy === row.key"
              :aria-label="`Orçamento diário de ${row.name}`"
              @change="changeBudget(row, $event)"
            />
          </td>
          <td>
            <div class="actions">
              <button type="button" class="btn-ghost" :disabled="!writable || busy === row.key" @click="emit('toggle', row)">
                {{ row.active ? 'Pausar' : 'Ativar' }}
              </button>
              <slot name="actions" :row="row" />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
// Tabela de editar das duas redes: cada rede só monta as linhas e diz o que fazer no clique.
export type ManageRow = {
  key: string
  name: string
  /** Campanha, Conjunto, Grupo, Anúncio, Palavra-chave. */
  level: string
  /** 0 = campanha; cada nível abaixo recua mais. */
  depth: 0 | 1 | 2
  status: string
  statusClass: string
  active: boolean
  /** null = sem orçamento próprio, sem campo. */
  budget: number | null
}

defineProps<{ rows: ManageRow[]; writable: boolean; busy: string | null; minBudget: number }>()

const emit = defineEmits<{
  toggle: [row: ManageRow]
  budget: [row: ManageRow, value: number, input: HTMLInputElement]
}>()

const changeBudget = (row: ManageRow, event: Event) => {
  const input = event.target as HTMLInputElement
  emit('budget', row, Number(input.value), input)
}
</script>

<style lang="stylus" scoped>
@import './section.styl'

.table-wrap
  max-height 70vh

.level
  display inline-block
  min-width 90px
  font-size 0.7rem
  color rgba(255,255,255,0.4)

.depth--0 td
  font-weight 600

.depth--1 td:first-child
  padding-left 28px

.depth--2 td:first-child
  padding-left 48px

.actions
  display flex
  gap 6px

.budget
  width 90px
  padding 4px 8px
  background rgba(0,0,0,0.25)
  border 1px solid rgba(255,255,255,0.12)
  border-radius 6px
  color #fff
  font-size 0.82rem
  text-align right

.btn-ghost
  padding 4px 10px
  background transparent
  border 1px solid rgba(255,255,255,0.12)
  border-radius 6px
  color rgba(255,255,255,0.75)
  font-size 0.8rem
  cursor pointer
  white-space nowrap
  &:hover
    background rgba(255,255,255,0.06)
  &:disabled
    opacity 0.5
    cursor not-allowed
</style>
