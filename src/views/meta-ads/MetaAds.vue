<template>
  <AdsDashboard :network="metaAds">
    <MetaManage ref="manage" :writable="writable" />
    <MetaNewAd :writable="writable" @created="manage?.reload()" />
    <MetaPixelHealth />
    <MetaCreatives />
    <MetaActivity />
    <MetaAdLibrary />
  </AdsDashboard>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { adminService } from '@/services/admin/admin.service'
import AdsDashboard from '@/views/ads/AdsDashboard.vue'
import { metaAds } from '@/views/ads/networks'
import MetaActivity from './MetaActivity.vue'
import MetaAdLibrary from './MetaAdLibrary.vue'
import MetaCreatives from './MetaCreatives.vue'
import MetaManage from './MetaManage.vue'
import MetaNewAd from './MetaNewAd.vue'
import MetaPixelHealth from './MetaPixelHealth.vue'
import { useLive } from './useLive'

const manage = useTemplateRef('manage')

const { data: status } = useLive(adminService.getMetaAdsStatus, '')

const writable = computed(() => !!status.value?.apply_enabled)
</script>
