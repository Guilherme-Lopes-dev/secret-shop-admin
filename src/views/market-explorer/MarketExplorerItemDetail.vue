<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminService } from '@/services/admin/admin.service'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'

const route = useRoute()
const router = useRouter()

const data = ref<Record<string, any> | null>(null)
const loading = ref(true)
const showRaw = ref(false)

const marketHashName = computed(() => String(route.query.name ?? ''))

const isComplex = (v: any) => v !== null && typeof v === 'object'

// Campos escalares (string/number/bool/null) vão numa tabela; objetos/arrays viram blocos JSON.
const scalarEntries = computed(() =>
  Object.entries(data.value ?? {}).filter(([, v]) => !isComplex(v)),
)
const complexEntries = computed(() =>
  Object.entries(data.value ?? {}).filter(([, v]) => isComplex(v)),
)

const formatValue = (v: any) => {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'sim' : 'não'
  return String(v)
}

const load = async () => {
  if (!marketHashName.value) {
    toast.error('Item não informado.')
    router.replace({ name: 'market-explorer' })
    return
  }
  loading.value = true
  try {
    const res = await adminService.getMarketItemDetail(marketHashName.value)
    data.value = res.data
  } catch (e: any) {
    toast.error(e?.response?.data?.message || 'Erro ao buscar item.')
  } finally {
    loading.value = false
  }
}

const copyRaw = async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(data.value, null, 2))
    toast.success('JSON copiado.')
  } catch {
    toast.error('Não foi possível copiar.')
  }
}

onMounted(load)
</script>

<template>
  <div class="view-wrap">
    <header class="page-header">
      <button class="btn-back" @click="router.push({ name: 'market-explorer' })">
        <Icon icon="mdi:arrow-left" /> Voltar
      </button>
      <button v-if="data" class="btn-copy" @click="copyRaw">
        <Icon icon="mdi:content-copy" /> Copiar JSON
      </button>
    </header>

    <div v-if="loading" class="loading-state">Carregando item...</div>

    <div v-else-if="!data" class="empty-state">Item não encontrado.</div>

    <div v-else>
      <div class="item-header">
        <img v-if="data.image" :src="data.image" class="item-img" alt="" />
        <div class="item-header-info">
          <h1 class="item-title">{{ data.marketname || data.markethashname }}</h1>
          <p class="item-sub mono">{{ data.markethashname }}</p>
          <div class="badges">
            <span v-if="data.tag2" class="badge">{{ data.tag2 }}</span>
            <span v-if="data.tag5" class="badge badge-hero">{{ data.tag5 }}</span>
            <a v-if="data.steamurl" :href="data.steamurl" target="_blank" rel="noopener" class="badge badge-link">
              <Icon icon="mdi:steam" /> Steam Market
            </a>
          </div>
        </div>
      </div>

      <section class="section">
        <h2 class="section-title">Campos ({{ scalarEntries.length }})</h2>
        <div class="fields-grid">
          <div v-for="[k, v] in scalarEntries" :key="k" class="field">
            <span class="field-key">{{ k }}</span>
            <span class="field-val" :title="formatValue(v)">{{ formatValue(v) }}</span>
          </div>
        </div>
      </section>

      <section class="section" v-if="complexEntries.length">
        <h2 class="section-title">Objetos & listas ({{ complexEntries.length }})</h2>
        <details v-for="[k, v] in complexEntries" :key="k" class="complex">
          <summary>{{ k }} <small>({{ Array.isArray(v) ? v.length + ' itens' : 'objeto' }})</small></summary>
          <pre class="json">{{ JSON.stringify(v, null, 2) }}</pre>
        </details>
      </section>

      <section class="section">
        <h2 class="section-title toggle" @click="showRaw = !showRaw">
          <Icon :icon="showRaw ? 'mdi:chevron-down' : 'mdi:chevron-right'" /> Payload cru completo
        </h2>
        <pre v-if="showRaw" class="json">{{ JSON.stringify(data, null, 2) }}</pre>
      </section>
    </div>
  </div>
</template>

<style lang="stylus" scoped>
.view-wrap
    padding 2rem
    color #fff
    background #121214
    min-height 100vh

.page-header
    display flex
    justify-content space-between
    align-items center
    margin-bottom 1.5rem

.btn-back, .btn-copy
    display inline-flex
    align-items center
    gap 0.4rem
    background #1a1a1e
    color #cbd5e1
    border 1px solid rgba(255,255,255,0.1)
    padding 0.5rem 1rem
    border-radius 8px
    font-size 0.875rem
    cursor pointer
    transition all 0.2s

    &:hover
        background #2a2a30

.loading-state, .empty-state
    padding 3rem
    text-align center
    color #94a3b8

.item-header
    display flex
    gap 1.25rem
    align-items center
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 12px
    padding 1.5rem
    margin-bottom 1.5rem

.item-img
    width 96px
    height 96px
    object-fit contain
    border-radius 8px
    background rgba(255,255,255,0.04)

.item-title
    font-size 1.4rem
    font-weight 700
    margin-bottom 0.25rem

.item-sub
    color #94a3b8
    font-size 0.85rem
    margin-bottom 0.75rem

.badges
    display flex
    gap 0.5rem
    flex-wrap wrap

.badge
    padding 3px 10px
    border-radius 6px
    font-size 0.75rem
    font-weight 600
    background rgba(99,102,241,0.12)
    color #a5b4fc

.badge-hero
    background rgba(76,175,80,0.12)
    color #86efac

.badge-link
    display inline-flex
    align-items center
    gap 0.3rem
    background rgba(255,255,255,0.06)
    color #cbd5e1
    text-decoration none

    &:hover
        background rgba(255,255,255,0.12)

.section
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 12px
    padding 1.5rem
    margin-bottom 1.5rem

.section-title
    font-size 0.95rem
    font-weight 600
    color #e2e8f0
    margin-bottom 1rem

    &.toggle
        display flex
        align-items center
        gap 0.3rem
        cursor pointer
        margin-bottom 0
        user-select none

.fields-grid
    display grid
    grid-template-columns repeat(auto-fill, minmax(240px, 1fr))
    gap 0.5rem

.field
    display flex
    flex-direction column
    gap 0.15rem
    background #121214
    border 1px solid rgba(255,255,255,0.04)
    border-radius 8px
    padding 0.5rem 0.75rem
    overflow hidden

.field-key
    color #64748b
    font-size 0.72rem
    font-family monospace
    text-transform lowercase

.field-val
    color #e2e8f0
    font-size 0.85rem
    white-space nowrap
    overflow hidden
    text-overflow ellipsis

.complex
    border 1px solid rgba(255,255,255,0.06)
    border-radius 8px
    margin-bottom 0.5rem
    background #121214

    summary
        padding 0.6rem 0.85rem
        cursor pointer
        font-family monospace
        font-size 0.82rem
        color #cbd5e1

        small
            color #64748b

.json
    margin 0
    padding 0.85rem
    font-family monospace
    font-size 0.78rem
    color #a5b4fc
    background #0d0d0f
    border-radius 0 0 8px 8px
    overflow-x auto
    white-space pre
    max-height 480px
    overflow-y auto

.mono
    font-family monospace
</style>
