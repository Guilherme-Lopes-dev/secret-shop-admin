<template>
  <section class="section">
    <div>
      <h2 class="section-title">Anúncios dos concorrentes</h2>
      <span class="hint">
        Abre o Centro de Transparência de Anúncios do Google no Brasil. Ele não tem API, então a busca é lá: digite o
        site do concorrente.
      </span>
    </div>
    <form :action="TRANSPARENCY_URL" method="get" target="_blank" class="search">
      <input type="hidden" name="region" value="BR" />
      <input name="domain" class="search__input" placeholder="site.com.br" aria-label="Site do concorrente" required />
      <button type="submit" class="search__button">Buscar</button>
    </form>
    <a :href="ownAdsUrl" target="_blank" rel="noopener" class="link">Nossos anúncios (secretshopgg.com)</a>
  </section>
</template>

<script setup lang="ts">
const TRANSPARENCY_URL = 'https://adstransparency.google.com/'

const ownAdsUrl = `${TRANSPARENCY_URL}?${new URLSearchParams({ region: 'BR', domain: 'secretshopgg.com' })}`
</script>

<style lang="stylus" scoped>
@import '../ads/section.styl'

.search
  display flex
  gap 8px
  flex-wrap wrap

.search__input
  flex 1
  min-width 200px
  padding 7px 12px
  background rgba(0,0,0,0.25)
  border 1px solid rgba(255,255,255,0.12)
  border-radius 6px
  color #fff
  font-size 0.85rem

.search__button
  padding 7px 14px
  background #6366f1
  border none
  border-radius 6px
  color #fff
  font-size 0.85rem
  cursor pointer
</style>
