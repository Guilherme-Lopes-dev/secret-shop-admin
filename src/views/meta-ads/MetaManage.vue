<template>
  <section class="section">
    <div>
      <h2 class="section-title">Gerenciar campanhas</h2>
      <span class="hint">
        Ao vivo da conta. Ativar, pausar e orçamento vão direto pra Meta. Anúncio só roda com campanha, conjunto e ele
        ativos.
      </span>
    </div>
    <p v-if="!writable" class="warn">Escrita na Meta desligada: falta <code>META_ADS_APPLY_ENABLED=true</code> no backend.</p>
    <p v-if="error" class="error-msg">{{ error }}</p>
    <p v-else-if="!structure" class="hint">Carregando...</p>
    <p v-else-if="!rows.length" class="hint">Nenhuma campanha na conta.</p>
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
          <tr v-for="{ node, level } in rows" :key="node.id" :class="`row--${level}`">
            <td>
              <span class="level">{{ LEVEL_LABEL[level] }}</span>
              {{ node.name }}
            </td>
            <td><span class="status" :class="statusClass(node.effective_status)">{{ node.effective_status }}</span></td>
            <td class="num">
              <input
                v-if="node.daily_budget_brl != null"
                type="number"
                min="6"
                step="0.01"
                class="budget"
                :value="node.daily_budget_brl"
                :disabled="!writable || busy === node.id"
                :aria-label="`Orçamento diário de ${node.name}`"
                @change="saveBudget(node, $event)"
              />
            </td>
            <td>
              <button type="button" class="btn-ghost" :disabled="!writable || busy === node.id" @click="toggle(node)">
                {{ node.status === 'ACTIVE' ? 'Pausar' : 'Ativar' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue3-toastify'
import { adminService, type MetaEntityChange, type MetaNode } from '@/services/admin/admin.service'
import { useLive } from './useLive'

defineProps<{ writable: boolean }>()

type Level = 'campaign' | 'ad_set' | 'ad'

const LEVEL_LABEL: Record<Level, string> = { campaign: 'Campanha', ad_set: 'Conjunto', ad: 'Anúncio' }

const { data: structure, error, reload } = useLive(adminService.getMetaStructure, 'Não carregou as campanhas da Meta.')

const busy = ref<string | null>(null)

const rows = computed(() =>
  (structure.value ?? []).flatMap((campaign) => [
    { node: campaign, level: 'campaign' as Level },
    ...campaign.ad_sets.flatMap((adSet) => [
      { node: adSet, level: 'ad_set' as Level },
      ...adSet.ads.map((ad) => ({ node: ad, level: 'ad' as Level })),
    ]),
  ]),
)

const brl = (value: number | null) => (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// CAMPAIGN_PAUSED/ADSET_PAUSED = parado pelo pai: mesma cor de pausado.
const statusClass = (status: string) => (status.endsWith('_PAUSED') ? 'paused' : status.toLowerCase())

/** true = a Meta aceitou. */
const apply = async (node: MetaNode, change: MetaEntityChange) => {
  busy.value = node.id
  try {
    await adminService.updateMetaEntity(node.id, change)
    toast.success('Alterado na Meta.')
    await reload()
    return true
  } catch (err: any) {
    toast.error(err.response?.data?.message ?? 'A Meta recusou a alteração.')
    return false
  } finally {
    busy.value = null
  }
}

const toggle = (node: MetaNode) => {
  const next = node.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
  const question =
    next === 'ACTIVE' ? `Ativar "${node.name}"? Começa a gastar se o resto da estrutura estiver ativo.` : `Pausar "${node.name}"?`
  if (!window.confirm(question)) return
  return apply(node, { status: next })
}

// Cancelou ou a Meta recusou: o campo volta pro valor que está na conta.
const saveBudget = async (node: MetaNode, event: Event) => {
  const input = event.target as HTMLInputElement
  const value = Number(input.value)
  if (!value || value === node.daily_budget_brl) return
  const confirmed = window.confirm(`Orçamento de "${node.name}": ${brl(node.daily_budget_brl)} → ${brl(value)} por dia?`)
  if (confirmed && (await apply(node, { daily_budget_brl: value }))) return
  input.value = String(node.daily_budget_brl)
}

defineExpose({ reload })
</script>

<style lang="stylus" scoped>
@import './section.styl'

.level
  display inline-block
  min-width 70px
  font-size 0.7rem
  color rgba(255,255,255,0.4)

.row--ad_set td:first-child
  padding-left 28px

.row--ad td:first-child
  padding-left 48px

.row--campaign td
  font-weight 600

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
  &:hover
    background rgba(255,255,255,0.06)
  &:disabled
    opacity 0.5
    cursor not-allowed
</style>
