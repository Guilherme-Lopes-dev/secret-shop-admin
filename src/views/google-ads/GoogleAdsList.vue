<template>
  <section class="section">
    <div>
      <h2 class="section-title">Anúncios de pesquisa</h2>
      <span class="hint">Ao vivo da conta. O Google combina os títulos e descrições abaixo em cada busca. Ativos primeiro.</span>
    </div>
    <p v-if="error" class="error-msg">{{ error }}</p>
    <p v-else-if="!ads" class="hint">Carregando...</p>
    <p v-else-if="!ads.length" class="hint">Nenhum anúncio na conta.</p>
    <div v-else class="grid">
      <article v-for="ad in ads" :key="ad.resource_name" class="card">
        <div class="card__tags">
          <span class="status" :class="statusClass(ad.status)">{{ ad.status }}</span>
          <span v-if="ad.approval" class="status" :class="statusClass(ad.approval)">{{ ad.approval }}</span>
          <span v-if="ad.strength" class="hint">força: {{ STRENGTH[ad.strength] ?? ad.strength }}</span>
        </div>
        <span class="hint">{{ [ad.campaign, ad.ad_group].filter(Boolean).join(' › ') }}</span>
        <div class="chips">
          <span v-for="headline in ad.headlines" :key="headline" class="chip">{{ headline }}</span>
        </div>
        <p v-for="description in ad.descriptions" :key="description" class="card__text">{{ description }}</p>
        <a v-if="ad.final_url" :href="ad.final_url" target="_blank" rel="noopener" class="link">{{ ad.final_url }}</a>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { adminService } from '@/services/admin/admin.service'
import { statusClass } from '@/views/ads/status'
import { useLive } from '@/views/ads/useLive'

const STRENGTH: Record<string, string> = { EXCELLENT: 'excelente', GOOD: 'boa', AVERAGE: 'média', POOR: 'fraca', PENDING: 'calculando' }

const { data: ads, error } = useLive(adminService.getGoogleSearchAds, 'Não carregou os anúncios do Google Ads.')
</script>

<style lang="stylus" scoped>
@import '../ads/section.styl'

.grid
  display grid
  grid-template-columns repeat(auto-fill, minmax(320px, 1fr))
  gap 12px

.card
  display flex
  flex-direction column
  align-items flex-start
  gap 8px
  padding 12px
  background rgba(0,0,0,0.25)
  border-radius 8px

.card__tags
  display flex
  align-items center
  gap 6px
  flex-wrap wrap

.chips
  display flex
  flex-wrap wrap
  gap 4px

.chip
  font-size 0.75rem
  padding 2px 8px
  border-radius 6px
  background rgba(255,255,255,0.06)
  color rgba(255,255,255,0.8)

.card__text
  margin 0
  font-size 0.78rem
  color rgba(255,255,255,0.55)
</style>
