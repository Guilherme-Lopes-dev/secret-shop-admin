<template>
  <AdsDashboard :network="googleAds">
    <GoogleConversions />
    <GoogleAdLibrary />
  </AdsDashboard>
</template>

<script setup lang="ts">
import AdsDashboard from '@/views/ads/AdsDashboard.vue'
import { googleAds } from '@/views/ads/networks'
import GoogleAdLibrary from './GoogleAdLibrary.vue'
import GoogleConversions from './GoogleConversions.vue'
</script>
