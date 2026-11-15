<template>
  <section class="section">
    <div>
      <h2 class="section-title">Campanhas no Google</h2>
      <span class="hint">
        Ao vivo da conta. Anúncio e palavra-chave só rodam com campanha, grupo e eles ativos. Negativar = o anúncio
        deixa de aparecer pra buscas com aquele termo.
      </span>
    </div>
    <p v-if="!writable" class="warn">Escrita no Google desligada: falta <code>GOOGLE_ADS_APPLY_ENABLED=true</code> no backend.</p>
    <p v-if="error" class="error-msg">{{ error }}</p>
    <p v-else-if="!structure" class="hint">Carregando...</p>
    <ManageTable v-else :rows="rows" :writable="writable" :busy="busy" :min-budget="1" @toggle="toggle" @budget="saveBudget">
      <template #actions="{ row }">
        <button
          v-if="searchCampaigns.has(row.key)"
          type="button"
          class="btn-ghost"
          :disabled="!writable || busy === row.key"
          @click="addNegative(row)"
        >
          Negativar termo
        </button>
        <button
          v-if="pausedKeywordsOf(row).length"
          type="button"
          class="btn-ghost"
          :disabled="!writable || busy === row.key"
          @click="enableWithKeywords(row)"
        >
          Ativar com palavras-chave
        </button>
      </template>
    </ManageTable>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { adminService, type GoogleNode } from '@/services/admin/admin.service'
import ManageTable, { type ManageRow } from '@/views/ads/ManageTable.vue'
import { statusClass } from '@/views/ads/status'
import { useApplyEnabled, useLive } from '@/views/ads/useLive'
import { useManage } from '@/views/ads/useManage'

const { data: structure, error, reload } = useLive(adminService.getGoogleStructure, 'Não carregou as campanhas do Google Ads.')
const writable = useApplyEnabled(adminService.getGoogleAdsStatus)
const { busy, run, confirmToggle, runBudget } = useManage(reload)

const toRow = (node: GoogleNode, level: string, depth: ManageRow['depth']): ManageRow => ({
  key: node.resource_name,
  name: node.name,
  level,
  depth,
  status: node.status,
  statusClass: statusClass(node.status),
  active: node.status === 'ENABLED',
  budget: node.daily_budget_brl,
})

const rows = computed(() =>
  (structure.value ?? []).flatMap((campaign) => [
    toRow(campaign, 'Campanha', 0),
    ...campaign.ad_groups.flatMap((adGroup) => [
      toRow(adGroup, 'Grupo', 1),
      ...adGroup.ads.map((ad) => toRow(ad, 'Anúncio', 2)),
      ...adGroup.keywords.map((keyword) => toRow(keyword, 'Palavra-chave', 2)),
    ]),
  ]),
)

// Performance Max recusa negativa por campanha: o botão só aparece em campanha de pesquisa.
const searchCampaigns = computed(
  () => new Set((structure.value ?? []).filter((campaign) => campaign.channel === 'SEARCH').map((campaign) => campaign.resource_name)),
)

// Anúncio → palavras-chave pausadas do grupo dele. Anúncio novo nasce pausado junto com as palavras.
const pausedKeywordsByAd = computed(
  () =>
    new Map(
      (structure.value ?? [])
        .flatMap((campaign) => campaign.ad_groups)
        .flatMap((group) =>
          group.ads.map((ad): [string, GoogleNode[]] => [
            ad.resource_name,
            group.keywords.filter((keyword) => keyword.status === 'PAUSED'),
          ]),
        ),
    ),
)

const pausedKeywordsOf = (row: ManageRow) => pausedKeywordsByAd.value.get(row.key) ?? []

const PREVIEW_COUNT = 5

// A confirmação lista as palavras: pode ter alguma que alguém pausou de propósito.
const enableWithKeywords = (row: ManageRow) => {
  const keywords = pausedKeywordsOf(row)
  const names = keywords.slice(0, PREVIEW_COUNT).map((keyword) => keyword.name).join(', ')
  const more = keywords.length > PREVIEW_COUNT ? ` e mais ${keywords.length - PREVIEW_COUNT}` : ''
  const question = `Ativar "${row.name}" e ${keywords.length} palavra(s)-chave pausada(s) do grupo: ${names}${more}? Começa a gastar se campanha e grupo estiverem ativos.`
  if (!window.confirm(question)) return
  return run(row.key, () => adminService.enableGoogleResources([row.key, ...keywords.map((keyword) => keyword.resource_name)]))
}

const toggle = (row: ManageRow) => {
  if (!confirmToggle(row)) return
  return run(row.key, () => adminService.updateGoogleResource(row.key, { status: row.active ? 'PAUSED' : 'ENABLED' }))
}

const saveBudget = (row: ManageRow, value: number, input: HTMLInputElement) =>
  runBudget(row, value, input, () => adminService.updateGoogleResource(row.key, { daily_budget_brl: value }))

// Correspondência de frase: bloqueia toda busca que contém o termo, que é o uso normal de negativa.
const addNegative = (row: ManageRow) => {
  const text = window.prompt(`Termo pra negativar em "${row.name}" (correspondência de frase):`)?.trim()
  if (!text) return
  if (!window.confirm(`Negativar "${text}" em "${row.name}"? Buscas com esse termo deixam de mostrar o anúncio.`)) return
  return run(row.key, () => adminService.addGoogleNegative(row.key, { text, match_type: 'PHRASE' }))
}
</script>

<style lang="stylus" scoped>
@import '../ads/section.styl'

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
