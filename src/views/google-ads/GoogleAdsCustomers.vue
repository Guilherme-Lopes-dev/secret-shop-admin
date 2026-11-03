<template>
  <section class="section">
    <div>
      <h2 class="section-title">Clientes novos no período</h2>
      <span class="hint">
        1ª compra paga da vida dentro do período, de qualquer canal (skins, collectors e físicos). "Anúncio" = clicou num
        anúncio do Google antes da 1ª compra. A origem é gravada desde 03/11/2026; antes disso aparece "sem registro".
      </span>
    </div>
    <p v-if="!customers.list.length" class="hint">Nenhum cliente novo no período.</p>
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>1ª compra</th>
            <th class="num">Gasto no período</th>
            <th>Origem (1ª visita)</th>
            <th>Anúncio</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="customer in customers.list" :key="`${customer.username}-${customer.first_purchase_at}`">
            <td>{{ customer.username ?? '-' }}</td>
            <td>{{ dayjs(customer.first_purchase_at).format('DD/MM HH:mm') }}</td>
            <td class="num">{{ brl(customer.revenue_brl) }}</td>
            <td :class="{ muted: !customer.tracked }">{{ originOf(customer) }}</td>
            <td><span v-if="customer.from_ads" class="badge">Anúncio</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import type { GoogleAdsNewCustomer, GoogleAdsOverview } from '@/services/admin/admin.service'

defineProps<{ customers: GoogleAdsOverview['new_customers'] }>()

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const originOf = (customer: GoogleAdsNewCustomer) => {
  if (!customer.source) return customer.tracked ? '-' : 'sem registro'
  const channel = `${customer.source} / ${customer.medium ?? '-'}`
  if (!customer.campaign) return channel
  return `${channel} · ${customer.campaign}`
}
</script>

<style lang="stylus" scoped>
.section
  background #16161a
  border 1px solid rgba(255,255,255,0.06)
  border-radius 12px
  padding 1.25rem
  margin-bottom 1.5rem
  display flex
  flex-direction column
  gap 1rem

.section-title
  font-size 1rem
  font-weight 600
  margin 0 0 4px

.table-wrap
  overflow auto
  max-height 420px

.table
  width 100%
  border-collapse collapse
  font-size 0.82rem
  th, td
    padding 8px 10px
    border-bottom 1px solid rgba(255,255,255,0.06)
    text-align left
    white-space nowrap
  th
    position sticky
    top 0
    background #16161a
    color rgba(255,255,255,0.5)
    font-weight 500
  .num
    text-align right
    font-variant-numeric tabular-nums

.muted
  color rgba(255,255,255,0.35)

.badge
  font-size 0.7rem
  padding 2px 8px
  border-radius 99px
  background rgba(52,211,153,0.15)
  color #34d399

.hint
  display block
  margin 0
  font-size 0.75rem
  color rgba(255,255,255,0.45)
</style>
