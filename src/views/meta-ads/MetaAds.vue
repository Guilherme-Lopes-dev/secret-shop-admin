<template>
  <AdsDashboard :network="metaAds">
    <MetaPixelHealth />
    <MetaAdLibrary />
  </AdsDashboard>
</template>

<script setup lang="ts">
import AdsDashboard from '@/views/ads/AdsDashboard.vue'
import { metaAds } from '@/views/ads/networks'
import MetaAdLibrary from './MetaAdLibrary.vue'
import MetaPixelHealth from './MetaPixelHealth.vue'
</script>
