<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'

const API_URL = import.meta.env.VITE_API_URL?.trim() || ''

const products = ref<any[]>([])
const loading = ref(true)
const submitting = ref(false)
const uploading = ref(false)

const emptyForm = () => ({
    name: '',
    description: '',
    price_brl: '',
    weight_grams: '',
    height_cm: '',
    width_cm: '',
    length_cm: '',
})

const form = ref(emptyForm())
const pendingMedia = ref<{ url: string; media_type: 'image' | 'video'; previewUrl: string }[]>([])

const editingUuid = ref<string | null>(null)
const existingMedia = ref<{ id: string; url: string; media_type: string }[]>([])

const mediaUrl = (path: string) => `${API_URL}${path}`

const parseIntOrUndefined = (value: string): number | undefined => {
    const n = parseInt(value, 10)
    return isNaN(n) || n <= 0 ? undefined : n
}

const pricePreview = (value: string): string => {
    const n = parseInt(value, 10)
    if (isNaN(n) || n <= 0) return ''
    return formatCurrency(n)
}

const fetchProducts = async () => {
    loading.value = true
    try {
        const res = await adminService.listPhysicalProductsAdmin({ page: 1, limit: 50 })
        products.value = res.data?.data ?? []
    } catch {
        toast.error('Erro ao carregar produtos físicos.')
    } finally {
        loading.value = false
    }
}

const onFilesSelected = async (e: Event) => {
    const files = Array.from((e.target as HTMLInputElement).files ?? [])
    if (files.length === 0) return
    uploading.value = true
    try {
        for (const file of files) {
            const { data } = await adminService.uploadMedia(file)
            const media_type: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image'

            if (editingUuid.value) {
                const { data: added } = await adminService.addPhysicalProductMedia(editingUuid.value, { url: data.url, media_type })
                existingMedia.value.push(added)
                continue
            }

            pendingMedia.value.push({
                url: data.url,
                media_type,
                previewUrl: URL.createObjectURL(file),
            })
        }
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro no upload de mídia.')
    } finally {
        uploading.value = false
        ;(e.target as HTMLInputElement).value = ''
    }
}

const removePendingMedia = (index: number) => {
    pendingMedia.value.splice(index, 1)
}

const removeExistingMedia = async (mediaUuid: string) => {
    if (!confirm('Remover esta mídia do produto?')) return
    try {
        await adminService.removePhysicalProductMedia(mediaUuid)
        existingMedia.value = existingMedia.value.filter((m) => m.id !== mediaUuid)
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao remover mídia.')
    }
}

const editProduct = (p: any) => {
    editingUuid.value = p.id
    form.value = {
        name: p.name ?? '',
        description: p.description ?? '',
        price_brl: String(p.price ?? ''),
        weight_grams: p.weight_grams ? String(p.weight_grams) : '',
        height_cm: p.height_cm ? String(p.height_cm) : '',
        width_cm: p.width_cm ? String(p.width_cm) : '',
        length_cm: p.length_cm ? String(p.length_cm) : '',
    }
    existingMedia.value = p.media ?? []
    pendingMedia.value = []
    window.scrollTo({ top: 0, behavior: 'smooth' })
}

const cancelEdit = () => {
    editingUuid.value = null
    form.value = emptyForm()
    pendingMedia.value = []
    existingMedia.value = []
}

const handleSubmit = async () => {
    if (!form.value.name || !form.value.price_brl) {
        toast.error('Preencha nome e preço.')
        return
    }
    const price = parseInt(form.value.price_brl, 10)
    if (isNaN(price) || price <= 0) {
        toast.error('Preço inválido.')
        return
    }
    if (!editingUuid.value && pendingMedia.value.length === 0) {
        toast.error('Adicione ao menos uma mídia.')
        return
    }

    submitting.value = true
    try {
        const payload = {
            name: form.value.name,
            description: form.value.description || undefined,
            price,
            weight_grams: parseIntOrUndefined(form.value.weight_grams),
            height_cm: parseIntOrUndefined(form.value.height_cm),
            width_cm: parseIntOrUndefined(form.value.width_cm),
            length_cm: parseIntOrUndefined(form.value.length_cm),
        }

        if (editingUuid.value) {
            await adminService.updatePhysicalProduct(editingUuid.value, payload)
            toast.success('Produto atualizado!')
        } else {
            await adminService.createPhysicalProduct({
                ...payload,
                media: pendingMedia.value.map(({ url, media_type }) => ({ url, media_type })),
            })
            toast.success('Produto físico cadastrado!')
        }

        cancelEdit()
        await fetchProducts()
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao salvar produto.')
    } finally {
        submitting.value = false
    }
}

const handleDelete = async (uuid: string) => {
    if (!confirm('Remover este produto físico?')) return
    try {
        await adminService.deletePhysicalProduct(uuid)
        toast.success('Produto removido.')
        await fetchProducts()
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao remover produto.')
    }
}

const statusLabel = (s: string) => ({ AVAILABLE: 'Disponível', RESERVED: 'Reservado', SOLD: 'Vendido' }[s] ?? s)
const statusBadgeClass = (s: string) => ({
    AVAILABLE: 'badge-available',
    RESERVED: 'badge-reserved',
    SOLD: 'badge-sold',
}[s] ?? '')

onMounted(fetchProducts)
</script>

<template>
    <div class="view-wrap">
        <h1 class="page-title">
            <Icon icon="mdi:trophy-award" class="title-icon" /> Produtos Físicos
        </h1>
        <p class="page-subtitle">Itens únicos sem trade Steam (ex: Aegis) — cadastro com múltiplas mídias</p>

        <form class="form-card" @submit.prevent="handleSubmit">
            <div v-if="editingUuid" class="editing-banner">
                <Icon icon="mdi:pencil-outline" />
                Editando produto existente
            </div>

            <div class="form-row">
                <div class="field field--full">
                    <label class="field-label">Nome <span class="required">*</span></label>
                    <input v-model="form.name" type="text" class="field-input" placeholder="ex: Aegis of the Immortal — TI11" />
                </div>
            </div>

            <div class="form-row">
                <div class="field field--full">
                    <label class="field-label">Descrição</label>
                    <textarea v-model="form.description" class="field-input field-textarea" rows="3" placeholder="Detalhes, procedência, condição..." />
                </div>
            </div>

            <div class="form-row">
                <div class="field">
                    <label class="field-label">Preço <span class="required">*</span></label>
                    <input v-model="form.price_brl" type="number" min="1" class="field-input field-input--price" placeholder="ex: 500000" />
                    <span v-if="pricePreview(form.price_brl)" class="field-preview">{{ pricePreview(form.price_brl) }}</span>
                    <span v-else class="field-hint-ok">Em centavos (ex: 500000 = R$ 5.000,00)</span>
                </div>
            </div>

            <div class="form-row">
                <div class="field field--full">
                    <label class="field-label">Peso e dimensões (opcional)</label>
                    <span class="field-hint-ok">Usado pra cotar frete real via Correios. Sem isso, o frete cai na taxa fixa.</span>
                </div>
            </div>
            <div class="form-row">
                <div class="field">
                    <label class="field-label">Peso (g)</label>
                    <input v-model="form.weight_grams" type="number" min="1" class="field-input" placeholder="ex: 350" />
                </div>
                <div class="field">
                    <label class="field-label">Altura (cm)</label>
                    <input v-model="form.height_cm" type="number" min="1" class="field-input" placeholder="ex: 10" />
                </div>
                <div class="field">
                    <label class="field-label">Largura (cm)</label>
                    <input v-model="form.width_cm" type="number" min="1" class="field-input" placeholder="ex: 15" />
                </div>
                <div class="field">
                    <label class="field-label">Comprimento (cm)</label>
                    <input v-model="form.length_cm" type="number" min="1" class="field-input" placeholder="ex: 20" />
                </div>
            </div>

            <div class="form-row">
                <div class="field field--full">
                    <label class="field-label">Mídias (fotos/vídeo) <span v-if="!editingUuid" class="required">*</span></label>
                    <input type="file" multiple accept="image/png,image/jpeg,image/webp" @change="onFilesSelected" class="field-file" :disabled="uploading" />
                    <span v-if="uploading" class="field-hint-ok"><Icon icon="mdi:loading" class="spinning" /> Enviando...</span>

                    <div v-if="existingMedia.length" class="media-grid">
                        <div v-for="media in existingMedia" :key="media.id" class="media-thumb">
                            <video v-if="media.media_type === 'video'" :src="mediaUrl(media.url)" class="media-preview" muted />
                            <img v-else :src="mediaUrl(media.url)" class="media-preview" alt="Mídia" />
                            <button type="button" class="media-remove" @click="removeExistingMedia(media.id)">
                                <Icon icon="mdi:close" />
                            </button>
                        </div>
                    </div>

                    <div v-if="pendingMedia.length" class="media-grid">
                        <div v-for="(media, i) in pendingMedia" :key="media.url" class="media-thumb">
                            <video v-if="media.media_type === 'video'" :src="media.previewUrl" class="media-preview" muted />
                            <img v-else :src="media.previewUrl" class="media-preview" alt="Preview" />
                            <button type="button" class="media-remove" @click="removePendingMedia(i)">
                                <Icon icon="mdi:close" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="form-actions">
                <button v-if="editingUuid" type="button" class="btn-cancel" @click="cancelEdit">
                    Cancelar
                </button>
                <button type="submit" class="btn-submit" :disabled="submitting || uploading">
                    <Icon v-if="submitting" icon="mdi:loading" class="spinning" />
                    <Icon v-else-if="editingUuid" icon="mdi:content-save-outline" />
                    <Icon v-else icon="mdi:plus-circle-outline" />
                    {{ submitting ? 'Salvando...' : (editingUuid ? 'Salvar Alterações' : 'Cadastrar Produto') }}
                </button>
            </div>
        </form>

        <div class="section">
            <h2 class="section-title">Cadastrados</h2>

            <div v-if="loading" class="loading-state">
                <Icon icon="mdi:loading" class="spin" /> Carregando...
            </div>

            <template v-else>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Mídia</th>
                                <th>Nome</th>
                                <th>Preço</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="p in products" :key="p.id">
                                <td>
                                    <img v-if="p.media?.[0]" :src="mediaUrl(p.media[0].url)" class="item-thumb" alt="" />
                                    <div v-else class="item-thumb-placeholder"><Icon icon="mdi:image-off-outline" /></div>
                                </td>
                                <td>{{ p.name }}</td>
                                <td class="price-col">{{ formatCurrency(p.price) }}</td>
                                <td>
                                    <span class="status-badge" :class="statusBadgeClass(p.status)">{{ statusLabel(p.status) }}</span>
                                </td>
                                <td>
                                    <div class="action-row">
                                        <button class="btn-edit" @click="editProduct(p)">
                                            <Icon icon="mdi:pencil-outline" />
                                        </button>
                                        <button v-if="p.status === 'AVAILABLE'" class="btn-delete" @click="handleDelete(p.id)">
                                            <Icon icon="mdi:trash-can-outline" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            <tr v-if="products.length === 0">
                                <td colspan="5" class="empty-state">Nenhum produto físico cadastrado.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </template>
        </div>
    </div>
</template>

<style lang="stylus" scoped>
.view-wrap
    padding 2rem
    color #fff
    background #121214
    min-height 100vh
    max-width 900px

.page-title
    font-size 1.8rem
    font-weight 700
    margin-bottom 0.25rem
    display flex
    align-items center
    gap 0.5rem

.title-icon
    color #f59e0b

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
    margin-bottom 2rem

.form-row
    display grid
    grid-template-columns 1fr 1fr
    gap 1rem

.field
    display flex
    flex-direction column
    gap 0.4rem

    &--full
        grid-column 1 / -1

.field-label
    font-size 0.8rem
    font-weight 500
    color #94a3b8
    text-transform uppercase
    letter-spacing 0.04em

.required
    color #f44336

.field-input
    background #121214
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.6rem 0.875rem
    font-size 0.9rem
    outline none
    font-family inherit

    &:focus
        border-color rgba(99,102,241,0.5)

    &--price
        font-size 1.1rem
        font-weight 600
        color #4caf50

.field-textarea
    resize vertical

.field-file
    color #94a3b8

.field-hint-ok
    font-size 0.75rem
    color #64748b
    display flex
    align-items center
    gap 0.3rem

.field-preview
    font-size 0.78rem
    color #4caf50
    font-weight 600

.media-grid
    display flex
    flex-wrap wrap
    gap 0.75rem
    margin-top 0.75rem

.media-thumb
    position relative
    width 90px
    height 90px

.media-preview
    width 100%
    height 100%
    object-fit cover
    border-radius 8px
    background rgba(255,255,255,0.03)
    border 1px solid rgba(255,255,255,0.06)

.media-remove
    position absolute
    top -6px
    right -6px
    width 20px
    height 20px
    border-radius 50%
    background #ef4444
    color #fff
    border none
    cursor pointer
    display flex
    align-items center
    justify-content center
    font-size 0.7rem

.editing-banner
    display flex
    align-items center
    gap 0.5rem
    background rgba(99,102,241,0.1)
    border 1px solid rgba(99,102,241,0.3)
    color #a5b4fc
    padding 0.6rem 0.9rem
    border-radius 8px
    font-size 0.85rem
    font-weight 600

.form-actions
    display flex
    justify-content flex-end
    gap 0.75rem

.btn-cancel
    background transparent
    color #94a3b8
    border 1px solid rgba(255,255,255,0.1)
    padding 0.6rem 1.5rem
    border-radius 8px
    font-size 0.9rem
    font-weight 600
    cursor pointer

    &:hover
        background rgba(255,255,255,0.05)
        color #fff

.btn-submit
    display inline-flex
    align-items center
    gap 0.5rem
    background #6366f1
    color #fff
    border none
    padding 0.6rem 1.75rem
    border-radius 8px
    font-size 0.9rem
    font-weight 600
    cursor pointer

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

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.section-title
    font-size 1rem
    font-weight 600
    color #cbd5e1
    margin-bottom 1.25rem

.loading-state
    padding 3rem
    text-align center
    color #94a3b8
    display flex
    align-items center
    justify-content center
    gap 0.5rem

.spin
    animation spin 1s linear infinite

.table-wrapper
    overflow-x auto

table
    width 100%
    border-collapse collapse

    th
        text-align left
        color #94a3b8
        font-size 0.75rem
        font-weight 500
        padding 0.6rem 0.75rem
        border-bottom 1px solid rgba(255,255,255,0.06)
        text-transform uppercase

    td
        padding 0.6rem 0.75rem
        font-size 0.875rem
        border-bottom 1px solid rgba(255,255,255,0.04)
        vertical-align middle

.item-thumb
    width 44px
    height 44px
    object-fit cover
    border-radius 6px

.item-thumb-placeholder
    width 44px
    height 44px
    border-radius 6px
    background rgba(255,255,255,0.06)
    display flex
    align-items center
    justify-content center
    color #64748b

.price-col
    font-weight 600
    color #4caf50

.status-badge
    display inline-flex
    padding 0.2rem 0.55rem
    border-radius 999px
    font-size 0.72rem
    font-weight 600
    text-transform uppercase

.badge-available
    background rgba(76,175,80,0.12)
    color #4caf50
    border 1px solid rgba(76,175,80,0.25)

.badge-reserved
    background rgba(245,158,11,0.12)
    color #f59e0b
    border 1px solid rgba(245,158,11,0.25)

.badge-sold
    background rgba(100,116,139,0.12)
    color #64748b
    border 1px solid rgba(100,116,139,0.25)

.action-row
    display flex
    gap 0.25rem

.btn-edit
    background transparent
    border none
    color #94a3b8
    cursor pointer
    padding 0.3rem
    border-radius 6px

    &:hover
        background rgba(255,255,255,0.08)
        color #fff

.btn-delete
    background transparent
    border none
    color #ef4444
    cursor pointer
    padding 0.3rem
    border-radius 6px

    &:hover
        background rgba(239,68,68,0.1)

.empty-state
    text-align center
    padding 3rem
    color #64748b

@media (max-width: 700px)
    .form-row
        grid-template-columns 1fr
</style>
