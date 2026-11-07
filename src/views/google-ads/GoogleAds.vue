<template>
  <AdsDashboard :network="googleAds" />
</template>

<script setup lang="ts">
import AdsDashboard from '@/views/ads/AdsDashboard.vue'
import { googleAds } from '@/views/ads/networks'
</script>
