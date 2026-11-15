<template>
  <section class="section">
    <div>
      <h2 class="section-title">Conversões</h2>
      <span class="hint">Ao vivo do Google Ads. A compra chega pelo GA4 com 24–48h de atraso e é datada no dia do clique.</span>
    </div>
    <p v-if="error" class="error-msg">{{ error }}</p>
    <p v-else-if="!health" class="hint">Carregando...</p>
    <template v-else>
      <p v-if="primaryIsSilent" class="warn">
        A conversão principal não registrou nenhuma compra em 30 dias. Com o volume de cliques da conta, isso indica que a
        importação do GA4 pro Ads parou.
      </p>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Ação</th>
              <th>Status</th>
              <th class="num">Conversões ({{ health.days }}d)</th>
              <th class="num">Valor ({{ health.days }}d)</th>
              <th>Última conversão</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="action in health.actions" :key="action.resource_name">
              <td>
                {{ action.name }}
                <span v-if="action.primary" class="badge">principal</span>
              </td>
              <td><span class="status" :class="statusClass(action.status)">{{ action.status }}</span></td>
              <td class="num">{{ action.conversions.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) }}</td>
              <td class="num">{{ brl(action.value_brl) }}</td>
              <td>{{ action.last_conversion_on ? dayjs(action.last_conversion_on).format('DD/MM') : 'nada em 30 dias' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import { adminService } from '@/services/admin/admin.service'
import { statusClass } from '@/views/ads/status'
import { useLive } from '@/views/ads/useLive'

const { data: health, error } = useLive(adminService.getGoogleConversions, 'Não carregou as conversões do Google Ads.')

// Com ~25 cliques/dia, 7 dias sem compra é normal; 30 dias sem nenhuma é a importação parada.
const primaryIsSilent = computed(() => health.value?.actions.some((action) => action.primary && !action.last_conversion_on))

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
</script>

<style lang="stylus" scoped>
@import '../ads/section.styl'

.badge
  margin-left 6px
  font-size 0.7rem
  padding 2px 8px
  border-radius 99px
  background rgba(99,102,241,0.2)
  color #a5b4fc
</style>
