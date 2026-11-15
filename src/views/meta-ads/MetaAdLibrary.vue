<template>
  <section class="section">
    <div>
      <h2 class="section-title">Anúncios dos concorrentes</h2>
      <span class="hint">
        Abre a Biblioteca de Anúncios da Meta (só os ativos no Brasil). A API pública dela só lista anúncio comercial
        veiculado na Europa, por isso não dá pra trazer pra cá.
      </span>
    </div>
    <form :action="LIBRARY_URL" method="get" target="_blank" class="search">
      <input v-for="(value, name) in BRAZIL_ACTIVE" :key="name" type="hidden" :name="name" :value="value" />
      <input type="hidden" name="search_type" value="keyword_unordered" />
      <input name="q" class="search__input" value="skins dota 2" aria-label="Termo de busca" />
      <button type="submit" class="search__button">Buscar</button>
    </form>
    <div class="pages">
      <a v-for="page in PAGES" :key="page.id" :href="pageUrl(page.id)" target="_blank" rel="noopener" class="link">
        {{ page.name }}
      </a>
    </div>
  </section>
</template>

<script setup lang="ts">
const LIBRARY_URL = 'https://www.facebook.com/ads/library/'

const BRAZIL_ACTIVE = { active_status: 'active', ad_type: 'all', country: 'BR' }

// Páginas que anunciavam skins de Dota no Brasil em 15/11/2026.
const PAGES = [
  { id: '1442827219164439', name: 'Secret Shop Gg (nós)' },
  { id: '478299055359307', name: 'Divine Shop' },
  { id: '1383379234860872', name: 'Pagodao STORE' },
]

const pageUrl = (pageId: string) => `${LIBRARY_URL}?${new URLSearchParams({ ...BRAZIL_ACTIVE, view_all_page_id: pageId })}`
</script>

<style lang="stylus" scoped>
@import './section.styl'

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

.pages
  display flex
  gap 16px
  flex-wrap wrap
</style>
