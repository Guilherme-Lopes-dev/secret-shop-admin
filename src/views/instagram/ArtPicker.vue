<template>
  <div class="field">
    <label>Imagem da skin <span class="text-muted">(galeria em Mídia)</span></label>
    <p v-if="!marketHashName" class="field-hint">Escolhe a skin acima.</p>
    <p v-else-if="loadingGallery" class="field-hint">Carregando galeria...</p>
    <p v-else-if="!images.length" class="field-hint">Essa skin não tem imagem subida em Mídia.</p>
    <div v-else class="thumb-grid">
      <button
        v-for="image in images"
        :key="image.id"
        type="button"
        class="thumb"
        :class="{ 'thumb--on': image.id === media }"
        @click="media = image.id"
      >
        <img referrerpolicy="no-referrer" :src="mediaUrl(image.url)" alt="" />
        <span v-if="image.level" class="thumb__level">nv {{ image.level }}</span>
      </button>
    </div>
  </div>

  <div class="field">
    <label>Fundo <span class="text-muted">(imagens soltas em Mídia)</span></label>
    <p v-if="!backgrounds.length" class="field-hint">Nenhuma imagem solta. Sobe o fundo em Mídia sem vincular a skin.</p>
    <div v-else class="thumb-grid">
      <button
        v-for="bg in backgrounds"
        :key="bg.id"
        type="button"
        class="thumb"
        :class="{ 'thumb--on': bg.id === background }"
        @click="background = bg.id"
      >
        <img referrerpolicy="no-referrer" :src="mediaUrl(bg.url)" alt="" />
      </button>
    </div>
    <p class="field-hint">Fundo é cortado pro formato (1080×1080 feed, 1080×1920 story). Skin em PNG transparente fica melhor.</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { toast } from 'vue3-toastify'
import { mediaUrl } from '@/utils/mediaUrl'
import { adminService, type MediaAsset } from '@/services/admin/admin.service'

const props = defineProps<{ marketHashName: string | null }>()
const media = defineModel<string | null>('media', { required: true })
const background = defineModel<string | null>('background', { required: true })

const images = ref<MediaAsset[]>([])
const loadingGallery = ref(false)
const backgrounds = ref<MediaAsset[]>([])

const onlyImages = (assets: MediaAsset[]) => assets.filter((asset) => asset.media_type === 'image')

const loadGallery = async (marketHashName: string | null) => {
  media.value = null
  images.value = []
  if (!marketHashName) return
  loadingGallery.value = true
  try {
    const res = await adminService.mediaGallery({ market_hash_name: marketHashName })
    images.value = onlyImages(res.data)
    media.value = images.value[0]?.id ?? null
  } finally {
    loadingGallery.value = false
  }
}

watch(() => props.marketHashName, loadGallery, { immediate: true })

onMounted(async () => {
  try {
    const res = await adminService.listMedia('orphans')
    backgrounds.value = onlyImages(res.data)
  } catch {
    toast.error('Não carregou os fundos.')
  }
})
</script>

<style lang="stylus" scoped>
.field
  display flex
  flex-direction column
  gap 6px
  label
    font-size 0.8rem
    font-weight 600
    color rgba(255,255,255,0.7)

.field-hint
  font-size 0.75rem
  color rgba(255,255,255,0.4)
  margin 0

.text-muted
  color rgba(255,255,255,0.45)

.thumb-grid
  display grid
  grid-template-columns repeat(auto-fill, minmax(72px, 1fr))
  gap 6px

.thumb
  position relative
  width 100%
  aspect-ratio 1 / 1
  padding 0
  background rgba(0,0,0,0.3)
  border 2px solid transparent
  border-radius 8px
  overflow hidden
  cursor pointer
  display grid
  place-items center
  img
    width 100%
    height 100%
    object-fit cover
    display block
  &:hover
    border-color rgba(251,191,36,0.4)

.thumb--on
  border-color #fbbf24

.thumb__level
  position absolute
  bottom 3px
  left 3px
  padding 1px 5px
  border-radius 4px
  background rgba(0,0,0,0.7)
  font-size 0.65rem
  color #fff

</style>
