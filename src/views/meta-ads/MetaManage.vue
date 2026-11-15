<template>
  <section class="section">
    <div>
      <h2 class="section-title">Campanhas na Meta</h2>
      <span class="hint">Ao vivo da conta. Anúncio só roda com campanha, conjunto e ele ativos.</span>
    </div>
    <p v-if="!writable" class="warn">Escrita na Meta desligada: falta <code>META_ADS_APPLY_ENABLED=true</code> no backend.</p>
    <p v-if="error" class="error-msg">{{ error }}</p>
    <p v-else-if="!structure" class="hint">Carregando...</p>
    <ManageTable v-else :rows="rows" :writable="writable" :busy="busy" :min-budget="6" @toggle="toggle" @budget="saveBudget" />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { adminService, type MetaNode } from '@/services/admin/admin.service'
import ManageTable, { type ManageRow } from '@/views/ads/ManageTable.vue'
import { useApplyEnabled, useLive } from '@/views/ads/useLive'
import { useManage } from '@/views/ads/useManage'
import { statusClass } from '@/views/ads/status'

const { data: structure, error, reload } = useLive(adminService.getMetaStructure, 'Não carregou as campanhas da Meta.')
const writable = useApplyEnabled(adminService.getMetaAdsStatus)
const { busy, run, confirmToggle, runBudget } = useManage(reload)

const toRow = (node: MetaNode, level: string, depth: ManageRow['depth']): ManageRow => ({
  key: node.id,
  name: node.name,
  level,
  depth,
  status: node.effective_status,
  statusClass: statusClass(node.effective_status),
  active: node.status === 'ACTIVE',
  budget: node.daily_budget_brl,
})

const rows = computed(() =>
  (structure.value ?? []).flatMap((campaign) => [
    toRow(campaign, 'Campanha', 0),
    ...campaign.ad_sets.flatMap((adSet) => [toRow(adSet, 'Conjunto', 1), ...adSet.ads.map((ad) => toRow(ad, 'Anúncio', 2))]),
  ]),
)

const toggle = (row: ManageRow) => {
  if (!confirmToggle(row)) return
  return run(row.key, () => adminService.updateMetaEntity(row.key, { status: row.active ? 'PAUSED' : 'ACTIVE' }))
}

const saveBudget = (row: ManageRow, value: number, input: HTMLInputElement) =>
  runBudget(row, value, input, () => adminService.updateMetaEntity(row.key, { daily_budget_brl: value }))
</script>

<style lang="stylus" scoped>
@import '../ads/section.styl'
</style>
