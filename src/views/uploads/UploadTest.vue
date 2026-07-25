<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { adminService } from '@/services/admin/admin.service'

const router = useRouter()
const API_URL = import.meta.env.VITE_API_URL?.trim() || ''

const selectedFile = ref<File | null>(null)
const localPreview = ref('')
const uploading = ref(false)
const uploadedUrl = ref('')

const isVideo = computed(() => selectedFile.value?.type.startsWith('video/'))

const onFileChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    uploadedUrl.value = ''
    selectedFile.value = file ?? null
    localPreview.value = file ? URL.createObjectURL(file) : ''
}

const handleUpload = async () => {
    if (!selectedFile.value) return
    uploading.value = true
    try {
        const { data } = await adminService.uploadMedia(selectedFile.value)
        uploadedUrl.value = `${API_URL}${data.url}`
        toast.success('Upload feito com sucesso!')
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro no upload.')
    } finally {
        uploading.value = false
    }
}
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <button class="btn-back" @click="router.push('/')">
                <Icon icon="mdi:arrow-left" /> Dashboard
            </button>
        </header>

        <h1 class="page-title">Teste de Upload</h1>
        <p class="page-subtitle">Envia imagem ou vídeo pro /uploads/media do backend, pra validar o fluxo de mídia de produtos físicos</p>

        <div class="form-card">
            <input type="file" accept="image/png,image/jpeg,image/webp,video/mp4" @change="onFileChange" class="field-file" />

            <div v-if="localPreview" class="preview-box">
                <p class="preview-label">Preview local</p>
                <video v-if="isVideo" :src="localPreview" controls class="preview-media" />
                <img v-else :src="localPreview" class="preview-media" alt="Preview" />
            </div>

            <button class="btn-submit" :disabled="!selectedFile || uploading" @click="handleUpload">
                <Icon v-if="uploading" icon="mdi:loading" class="spinning" />
                <Icon v-else icon="mdi:cloud-upload-outline" />
                {{ uploading ? 'Enviando...' : 'Enviar' }}
            </button>

            <div v-if="uploadedUrl" class="preview-box">
                <p class="preview-label">Servido pelo backend</p>
                <video v-if="isVideo" :src="uploadedUrl" controls class="preview-media" />
                <img v-else :src="uploadedUrl" class="preview-media" alt="Uploaded" />
                <p class="uploaded-url">{{ uploadedUrl }}</p>
            </div>
        </div>
    </div>
</template>

<style lang="stylus" scoped>
.view-wrap
    padding 2rem
    color #fff
    background #121214
    min-height 100vh
    max-width 700px

.page-header
    margin-bottom 1.5rem

.btn-back
    display inline-flex
    align-items center
    gap 0.4rem
    background transparent
    border none
    color #94a3b8
    cursor pointer
    font-size 0.875rem
    padding 0.4rem 0.5rem
    border-radius 6px
    transition all 0.15s

    &:hover
        color #fff
        background rgba(255,255,255,0.05)

.page-title
    font-size 1.8rem
    font-weight 700
    margin-bottom 0.25rem

.page-subtitle
    color #94a3b8
    font-size 0.9rem
    margin-bottom 2rem

.form-card
    display flex
    flex-direction column
    gap 1.25rem
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.field-file
    color #94a3b8

.preview-box
    display flex
    flex-direction column
    gap 0.5rem

.preview-label
    font-size 0.8rem
    font-weight 500
    color #94a3b8
    text-transform uppercase
    letter-spacing 0.04em

.preview-media
    max-width 100%
    max-height 320px
    border-radius 8px
    background rgba(255,255,255,0.03)
    border 1px solid rgba(255,255,255,0.06)

.uploaded-url
    font-size 0.78rem
    color #64748b
    word-break break-all

.btn-submit
    display inline-flex
    align-items center
    justify-content center
    gap 0.5rem
    background #6366f1
    color #fff
    border none
    padding 0.6rem 1.75rem
    border-radius 8px
    font-size 0.9rem
    font-weight 600
    cursor pointer
    transition all 0.2s

    &:hover:not(:disabled)
        background #4f52d4

    &:disabled
        opacity 0.5
        cursor not-allowed

.spinning
    animation spin 1s linear infinite

@keyframes spin
    from transform rotate(0deg)
    to transform rotate(360deg)
</style>
