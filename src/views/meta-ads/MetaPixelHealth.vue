<template>
  <section class="section">
    <div>
      <h2 class="section-title">Pixel e Conversions API</h2>
      <span class="hint">Ao vivo da Meta. Se a compra não chega lá, a campanha não tem como otimizar pra venda.</span>
    </div>
    <p v-if="error" class="error-msg">{{ error }}</p>
    <p v-else-if="!pixel" class="hint">Carregando...</p>
    <template v-else>
      <p v-if="pixel.unavailable" class="warn">A Meta marca o Pixel "{{ pixel.name }}" como indisponível.</p>
      <p v-if="!purchases && !pixel.capi_purchases_sent" class="warn">
        Nenhuma compra chegou na Meta em {{ pixel.days }} dias, nem pelo Pixel nem pela Conversions API.
      </p>
      <div class="totals">
        <div class="total">
          <span class="total__value">{{ lastFired }}</span>
          <span class="total__label">Último evento ({{ pixel.name }})</span>
        </div>
        <div class="total">
          <span class="total__value">{{ purchases }}</span>
          <span class="total__label">Compras pelo Pixel ({{ pixel.days }}d)</span>
        </div>
        <div class="total">
          <span class="total__value">{{ pixel.capi_purchases_sent }}</span>
          <span class="total__label">Compras enviadas pela CAPI ({{ pixel.days }}d)</span>
        </div>
      </div>
      <p v-if="!pixel.events.length" class="hint">Nenhum evento nos últimos {{ pixel.days }} dias.</p>
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Evento</th>
              <th class="num">Volume ({{ pixel.days }}d)</th>
              <th class="num" title="Event Match Quality: quanto dado do cliente vai junto (0 a 10)">Nota de correspondência</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in pixel.events" :key="row.event">
              <td>{{ row.event }}</td>
              <td class="num">{{ row.count.toLocaleString('pt-BR') }}</td>
              <td class="num">{{ scoreOf(row.event) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <span v-if="pixel.quality.error" class="hint">Nota indisponível: {{ pixel.quality.error }}</span>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import { adminService } from '@/services/admin/admin.service'
import { useLive } from '@/views/ads/useLive'

const { data: pixel, error } = useLive(adminService.getMetaPixelHealth, 'Não carregou o Pixel da Meta.')

const purchases = computed(() => pixel.value?.events.find((row) => row.event === 'Purchase')?.count ?? 0)

const lastFired = computed(() => {
  const at = pixel.value?.last_fired_at
  if (!at) return 'nunca'
  return dayjs(at).format('DD/MM HH:mm')
})

const scores = computed(() => new Map(pixel.value?.quality.events.map((row) => [row.event, row.score])))

const scoreOf = (event: string) => scores.value.get(event)?.toLocaleString('pt-BR') ?? '-'
</script>

<style lang="stylus" scoped>
@import '../ads/section.styl'

.totals
  display grid
  grid-template-columns repeat(auto-fill, minmax(180px, 1fr))
  gap 8px

.total
  display flex
  flex-direction column
  gap 2px
  padding 10px 12px
  background rgba(0,0,0,0.25)
  border-radius 8px

.total__value
  font-size 1.2rem
  font-weight 700
  font-variant-numeric tabular-nums

.total__label
  font-size 0.75rem
  color rgba(255,255,255,0.5)
</style>
