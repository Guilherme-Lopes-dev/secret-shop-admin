<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <h1 class="page-title">{{ current.title }}</h1>
        <p class="page-subtitle">{{ current.subtitle }} Números e análise ficam em Marketing → Análise Meta / Google.</p>
      </div>
      <div class="toggle" role="tablist" aria-label="Rede de anúncios">
        <button
          v-for="(label, value) in NETWORKS"
          :key="value"
          type="button"
          role="tab"
          :aria-selected="activeNetwork === value"
          :class="{ active: activeNetwork === value }"
          @click="network = value"
        >
          {{ label }}
        </button>
      </div>
    </header>
    <component
      :is="section"
      v-for="(section, index) in current.sections[activeNetwork]"
      :key="`${page}-${activeNetwork}-${index}`"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import { persistedRef } from '@/utils/persistedRef'
import GoogleAdsList from '@/views/google-ads/GoogleAdsList.vue'
import GoogleChanges from '@/views/google-ads/GoogleChanges.vue'
import GoogleManage from '@/views/google-ads/GoogleManage.vue'
import GoogleNewAd from '@/views/google-ads/GoogleNewAd.vue'
import MetaActivity from '@/views/meta-ads/MetaActivity.vue'
import MetaCreatives from '@/views/meta-ads/MetaCreatives.vue'
import MetaManage from '@/views/meta-ads/MetaManage.vue'
import MetaNewAd from '@/views/meta-ads/MetaNewAd.vue'

type Network = 'meta' | 'google'
type Page = 'view' | 'edit' | 'create'

const { page } = defineProps<{ page: Page }>()

const NETWORKS: Record<Network, string> = { meta: 'Meta', google: 'Google' }

// Ver, editar e criar das duas redes: a rota escolhe a tela, o seletor escolhe a rede.
const PAGES: Record<Page, { title: string; subtitle: string; sections: Record<Network, Component[]> }> = {
  view: {
    title: 'Ver campanhas',
    subtitle: 'Anúncios no ar e o que mudou na conta.',
    sections: { meta: [MetaCreatives, MetaActivity], google: [GoogleAdsList, GoogleChanges] },
  },
  edit: {
    title: 'Editar campanhas',
    subtitle: 'Ativar, pausar e mudar orçamento direto na conta.',
    sections: { meta: [MetaManage], google: [GoogleManage] },
  },
  create: {
    title: 'Criar anúncio',
    subtitle: 'Tudo nasce pausado: confira e ative em Editar.',
    sections: { meta: [MetaNewAd], google: [GoogleNewAd] },
  },
}

const current = computed(() => PAGES[page])

// A rede escolhida vale pras três telas. Valor salvo que não é rede conhecida (storage antigo) cai na Meta.
const network = persistedRef<Network>('campaigns.network', 'meta')
const activeNetwork = computed<Network>(() => (network.value in NETWORKS ? network.value : 'meta'))
</script>

<style lang="stylus" scoped>
.view-wrap
  padding 2rem
  color #fff
  min-height 100vh

.page-header
  display flex
  align-items flex-end
  justify-content space-between
  gap 1rem
  flex-wrap wrap
  margin-bottom 2rem

.page-title
  font-size 1.8rem
  font-weight 700
  margin 0 0 4px

.page-subtitle
  font-size 0.85rem
  color rgba(255,255,255,0.45)
  margin 0

.toggle
  display flex
  border 1px solid rgba(255,255,255,0.1)
  border-radius 7px
  overflow hidden
  button
    padding 6px 16px
    background transparent
    border none
    color rgba(255,255,255,0.55)
    font-size 0.85rem
    cursor pointer
    &.active
      background #6366f1
      color #fff
</style>
