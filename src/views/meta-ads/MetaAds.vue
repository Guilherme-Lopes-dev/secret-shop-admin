<template>
  <AdsDashboard :network="metaAds" />
</template>

<script setup lang="ts">
import AdsDashboard from '@/views/ads/AdsDashboard.vue'
import { metaAds } from '@/views/ads/networks'
</script>
