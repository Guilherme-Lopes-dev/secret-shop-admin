<template>
  <section class="section">
    <div>
      <h2 class="section-title">Criativos</h2>
      <span class="hint">Cada anúncio da conta com a imagem e o texto. Ativos primeiro. As métricas estão no "Detalhe por nível".</span>
    </div>
    <p v-if="error" class="error-msg">{{ error }}</p>
    <p v-else-if="!creatives" class="hint">Carregando...</p>
    <p v-else-if="!creatives.length" class="hint">Nenhum anúncio na conta.</p>
    <div v-else class="grid">
      <article v-for="creative in creatives" :key="creative.id" class="card">
        <img v-if="creative.image_url" :src="creative.image_url" :alt="creative.name" class="card__image" loading="lazy" />
        <div v-else class="card__image card__image--empty">sem imagem</div>
        <div class="card__body">
          <span class="status" :class="statusClass(creative.status)">{{ creative.status }}</span>
          <strong class="card__name">{{ creative.name }}</strong>
          <span v-if="creative.title" class="card__title">{{ creative.title }}</span>
          <p v-if="creative.body" class="card__text">{{ creative.body }}</p>
          <a v-if="creative.preview_url" :href="creative.preview_url" target="_blank" rel="noopener" class="link">
            Ver prévia na Meta
          </a>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { adminService } from '@/services/admin/admin.service'
import { statusClass } from '@/views/ads/status'
import { useLive } from '@/views/ads/useLive'

const { data: creatives, error } = useLive(adminService.getMetaCreatives, 'Não carregou os criativos da Meta.')
</script>

<style lang="stylus" scoped>
@import '../ads/section.styl'

.grid
  display grid
  grid-template-columns repeat(auto-fill, minmax(220px, 1fr))
  gap 12px

.card
  display flex
  flex-direction column
  background rgba(0,0,0,0.25)
  border-radius 8px
  overflow hidden

.card__image
  width 100%
  aspect-ratio 1
  object-fit cover
  background rgba(255,255,255,0.04)

.card__image--empty
  display flex
  align-items center
  justify-content center
  font-size 0.75rem
  color rgba(255,255,255,0.35)

.card__body
  display flex
  flex-direction column
  align-items flex-start
  gap 6px
  padding 10px 12px

.card__name
  font-size 0.85rem

.card__title
  font-size 0.8rem
  color rgba(255,255,255,0.75)

.card__text
  margin 0
  font-size 0.75rem
  color rgba(255,255,255,0.5)
  display -webkit-box
  -webkit-line-clamp 4
  -webkit-box-orient vertical
  overflow hidden
</style>
