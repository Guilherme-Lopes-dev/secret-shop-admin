<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { adminService, type MediaAsset, type MediaLink, type MediaTarget } from '@/services/admin/admin.service'
import { buildSteamImageUrl } from '@/utils/steamImage'

const API_URL = import.meta.env.VITE_API_URL?.trim() || ''
const mediaUrl = (path: string) => `${API_URL}${path}`

type Level = 1 | 2 | 3 | null
const ARCANA_LEVELS: Level[] = [null, 1, 2, 3]
const levelLabel = (level: Level) => (level ? `Nível ${level}` : 'Sem nível')
const typeLabel: Record<MediaTarget['type'], string> = { skin: 'Skin', collector: 'Collector', physical: 'Físico' }

const fileName = (url: string) => url.split('/').pop() ?? url

const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${Math.round(bytes / 1024)} KB`
}

// --- Busca do alvo ---------------------------------------------------------
const query = ref('')
const suggestions = ref<MediaTarget[]>([])
const target = ref<MediaTarget | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const onQueryInput = () => {
    if (searchTimer) clearTimeout(searchTimer)
    if (query.value.trim().length < 2) {
        suggestions.value = []
        return
    }
    searchTimer = setTimeout(async () => {
        const { data } = await adminService.searchMediaTargets(query.value.trim())
        suggestions.value = data
    }, 250)
}

const selectTarget = async (item: MediaTarget) => {
    target.value = item
    query.value = item.label
    suggestions.value = []
    await loadGallery()
}

const isArcana = computed(() => target.value?.type === 'skin' && target.value.rarity?.toLowerCase() === 'arcana')
const levels = computed<Level[]>(() => (isArcana.value ? ARCANA_LEVELS : [null]))

const linkFor = (level: Level = null): MediaLink => {
    if (!target.value) return {}
    if (target.value.type === 'physical') return { physical_product_uuid: target.value.key }
    return { market_hash_name: target.value.key, level: level ?? undefined }
}

// --- Galeria do alvo ---------------------------------------------------------
const gallery = ref<MediaAsset[]>([])
const uploadingLevel = ref<Level | 'none'>('none')

const loadGallery = async () => {
    if (!target.value) return
    const params = target.value.type === 'physical'
        ? { physical_product_uuid: target.value.key }
        : { market_hash_name: target.value.key }
    const { data } = await adminService.mediaGallery(params)
    gallery.value = data
}

const groupOf = (level: Level) => gallery.value.filter((m) => (m.level ?? null) === level)

const onUpload = async (e: Event, level: Level) => {
    const input = e.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    if (!files.length) return
    uploadingLevel.value = level
    try {
        for (const file of files) await adminService.uploadMedia(file, linkFor(level))
        toast.success(`${files.length} arquivo(s) enviado(s).`)
        await loadGallery()
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro no upload.')
    } finally {
        uploadingLevel.value = 'none'
        input.value = ''
    }
}

const move = async (item: MediaAsset, direction: -1 | 1) => {
    const group = groupOf(item.level as Level)
    const index = group.findIndex((m) => m.id === item.id)
    const swapWith = group[index + direction]
    if (!swapWith) return
    const uuids = group.map((m) => m.id)
    ;[uuids[index], uuids[index + direction]] = [swapWith.id, item.id]
    await adminService.reorderMedia(uuids)
    await loadGallery()
}

const remove = async (item: MediaAsset) => {
    if (!confirm('Apagar do disco? Não tem volta.')) return
    try {
        await adminService.deleteMedia(item.id)
        await Promise.all([loadGallery(), loadUnlinked()])
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao apagar.')
    }
}

// --- Órfãos / dono sumiu -----------------------------------------------------
const orphans = ref<MediaAsset[]>([])
const ownerGone = ref<MediaAsset[]>([])
const orphanLevel = ref<Record<string, Level>>({})
const syncing = ref(false)

const loadUnlinked = async () => {
    const [a, b] = await Promise.all([adminService.listMedia('orphans'), adminService.listMedia('owner_gone')])
    orphans.value = a.data
    ownerGone.value = b.data
}

const linkOrphan = async (item: MediaAsset) => {
    if (!target.value) return toast.error('Escolha um alvo na busca primeiro.')
    try {
        await adminService.relinkMedia(item.id, linkFor(orphanLevel.value[item.id] ?? null))
        await Promise.all([loadGallery(), loadUnlinked()])
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao vincular.')
    }
}

const sync = async () => {
    syncing.value = true
    try {
        const { data } = await adminService.syncMedia()
        toast.success(`Sync: ${data.created} novos órfãos, ${data.removed} linhas sem arquivo removidas, ${data.updated} tamanhos preenchidos, ${data.skipped} ignorados (extensão desconhecida).`)
        await Promise.all([loadGallery(), loadUnlinked()])
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro no sync.')
    } finally {
        syncing.value = false
    }
}

onMounted(loadUnlinked)
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title"><Icon icon="mdi:multimedia" class="title-icon" /> Mídia</h1>
                <p class="page-subtitle">Fotos e vídeos servidos em /media. Vincule a uma skin, collector ou produto físico.</p>
            </div>
            <button class="btn-ghost" :disabled="syncing" @click="sync">
                <Icon :icon="syncing ? 'mdi:loading' : 'mdi:sync'" :class="{ spinning: syncing }" /> Sincronizar disco
            </button>
        </header>

        <div class="search-box">
            <Icon icon="mdi:magnify" class="search-icon" />
            <input v-model="query" type="text" class="field-input" placeholder="Buscar skin, collector ou produto físico..." @input="onQueryInput" />
            <ul v-if="suggestions.length" class="suggestions">
                <li v-for="s in suggestions" :key="`${s.type}:${s.key}`" @click="selectTarget(s)">
                    <img v-if="s.icon" :src="buildSteamImageUrl(s.icon, '64fx64f') ?? ''" class="suggestion-icon" alt="" />
                    <span v-else class="suggestion-icon suggestion-icon--empty"><Icon icon="mdi:package-variant" /></span>
                    <span class="suggestion-label">{{ s.label }}</span>
                    <span class="badge" :class="`badge--${s.type}`">{{ typeLabel[s.type] }}</span>
                    <span v-if="s.rarity" class="suggestion-rarity">{{ s.rarity }}</span>
                </li>
            </ul>
        </div>

        <section v-if="target" class="card">
            <header class="card-header">
                <img v-if="target.icon" :src="buildSteamImageUrl(target.icon, '96fx96f') ?? ''" class="target-icon" alt="" />
                <div>
                    <h2 class="card-title">{{ target.label }}</h2>
                    <span class="badge" :class="`badge--${target.type}`">{{ typeLabel[target.type] }}</span>
                    <span v-if="isArcana" class="badge badge--arcana">Arcana · 1 galeria por nível</span>
                </div>
            </header>

            <div v-for="level in levels" :key="String(level)" class="level-group">
                <div class="level-header">
                    <span class="level-label">{{ isArcana ? levelLabel(level) : 'Galeria' }}</span>
                    <label class="btn-upload" :class="{ disabled: uploadingLevel !== 'none' }">
                        <Icon :icon="uploadingLevel === level ? 'mdi:loading' : 'mdi:plus'" :class="{ spinning: uploadingLevel === level }" />
                        {{ uploadingLevel === level ? 'Enviando...' : 'Upload' }}
                        <input type="file" multiple accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" hidden :disabled="uploadingLevel !== 'none'" @change="onUpload($event, level)" />
                    </label>
                </div>

                <p v-if="!groupOf(level).length" class="empty">—</p>
                <div v-else class="media-grid">
                    <div v-for="(m, i) in groupOf(level)" :key="m.id" class="media-thumb">
                        <video v-if="m.media_type === 'video'" :src="mediaUrl(m.url)" class="media-preview" muted preload="metadata" />
                        <img v-else :src="mediaUrl(m.url)" class="media-preview" alt="" />
                        <span class="media-name" :title="fileName(m.url)">{{ fileName(m.url) }}</span>
                        <span class="media-meta">{{ m.media_type === 'video' ? '▶ ' : '' }}{{ formatSize(m.size) }}</span>
                        <div class="media-actions">
                            <button type="button" :disabled="i === 0" @click="move(m, -1)"><Icon icon="mdi:chevron-left" /></button>
                            <button type="button" :disabled="i === groupOf(level).length - 1" @click="move(m, 1)"><Icon icon="mdi:chevron-right" /></button>
                            <button type="button" class="danger" @click="remove(m)"><Icon icon="mdi:trash-can-outline" /></button>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="card">
            <header class="card-header">
                <h2 class="card-title">Órfãos <span class="count">{{ orphans.length }}</span></h2>
                <p class="card-hint">No disco, sem dono. Escolha um alvo acima e vincule, ou apague.</p>
            </header>
            <p v-if="!orphans.length" class="empty">Nenhum.</p>
            <div v-else class="media-grid">
                <div v-for="m in orphans" :key="m.id" class="media-thumb media-thumb--wide">
                    <video v-if="m.media_type === 'video'" :src="mediaUrl(m.url)" class="media-preview" muted preload="metadata" />
                    <img v-else :src="mediaUrl(m.url)" class="media-preview" alt="" />
                    <span class="media-name" :title="fileName(m.url)">{{ fileName(m.url) }}</span>
                        <span class="media-meta">{{ m.media_type === 'video' ? '▶ ' : '' }}{{ formatSize(m.size) }}</span>
                    <div class="media-actions">
                        <select v-if="isArcana" v-model="orphanLevel[m.id]" class="level-select">
                            <option v-for="level in ARCANA_LEVELS" :key="String(level)" :value="level">{{ levelLabel(level) }}</option>
                        </select>
                        <button type="button" :disabled="!target" :title="target ? `Vincular a ${target.label}` : 'Escolha um alvo'" @click="linkOrphan(m)"><Icon icon="mdi:link-variant" /></button>
                        <button type="button" class="danger" @click="remove(m)"><Icon icon="mdi:trash-can-outline" /></button>
                    </div>
                </div>
            </div>
        </section>

        <section v-if="ownerGone.length" class="card">
            <header class="card-header">
                <h2 class="card-title">Dono sumiu <span class="count">{{ ownerGone.length }}</span></h2>
                <p class="card-hint">Vinculadas a um nome que não existe mais em skins nem collectors. Skin que voltar reaproveita; senão, apague.</p>
            </header>
            <div class="media-grid">
                <div v-for="m in ownerGone" :key="m.id" class="media-thumb media-thumb--wide">
                    <video v-if="m.media_type === 'video'" :src="mediaUrl(m.url)" class="media-preview" muted preload="metadata" />
                    <img v-else :src="mediaUrl(m.url)" class="media-preview" alt="" />
                    <span class="media-name" :title="fileName(m.url)">{{ fileName(m.url) }}</span>
                    <span class="media-meta" :title="m.market_hash_name ?? ''">{{ m.market_hash_name }}{{ m.level ? ` · N${m.level}` : '' }}</span>
                    <div class="media-actions">
                        <button type="button" class="danger" @click="remove(m)"><Icon icon="mdi:trash-can-outline" /></button>
                    </div>
                </div>
            </div>
        </section>
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
    align-items flex-start
    gap 1rem
    margin-bottom 1.5rem

.page-title
    font-size 1.8rem
    font-weight 700
    margin-bottom 0.25rem
    display flex
    align-items center
    gap 0.5rem

.title-icon
    color #6366f1

.page-subtitle
    color #94a3b8
    font-size 0.9rem

.btn-ghost
    display inline-flex
    align-items center
    gap 0.4rem
    background transparent
    border 1px solid rgba(255,255,255,0.12)
    color #cbd5e1
    padding 0.5rem 0.9rem
    border-radius 8px
    cursor pointer
    font-size 0.85rem
    white-space nowrap

    &:hover
        background rgba(255,255,255,0.05)

    &:disabled
        opacity 0.5
        cursor default

.search-box
    position relative
    margin-bottom 1.5rem

.search-icon
    position absolute
    left 0.8rem
    top 50%
    transform translateY(-50%)
    color #64748b
    pointer-events none

.field-input
    width 100%
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    color #fff
    padding 0.7rem 0.9rem 0.7rem 2.4rem
    border-radius 10px
    font-size 0.95rem
    outline none

    &:focus
        border-color #6366f1

.suggestions
    position absolute
    top calc(100% + 4px)
    left 0
    right 0
    z-index 20
    list-style none
    margin 0
    padding 0.35rem
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.1)
    border-radius 10px
    max-height 360px
    overflow-y auto

    li
        display flex
        align-items center
        gap 0.6rem
        padding 0.45rem 0.6rem
        border-radius 6px
        cursor pointer
        font-size 0.88rem

        &:hover
            background rgba(99,102,241,0.15)

.suggestion-icon
    width 32px
    height 32px
    border-radius 6px
    object-fit contain
    background rgba(255,255,255,0.04)
    display flex
    align-items center
    justify-content center
    color #64748b
    flex-shrink 0

.suggestion-label
    flex 1
    overflow hidden
    text-overflow ellipsis
    white-space nowrap

.suggestion-rarity
    font-size 0.72rem
    color #94a3b8

.badge
    font-size 0.68rem
    text-transform uppercase
    letter-spacing 0.04em
    padding 0.15rem 0.45rem
    border-radius 999px
    background rgba(255,255,255,0.08)
    color #cbd5e1
    margin-right 0.35rem

    &--skin
        background rgba(99,102,241,0.2)
        color #a5b4fc

    &--collector
        background rgba(210,168,90,0.2)
        color #e9c77b

    &--physical
        background rgba(34,197,94,0.18)
        color #86efac

    &--arcana
        background rgba(236,72,153,0.18)
        color #f9a8d4

.card
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 12px
    padding 1.25rem 1.5rem
    margin-bottom 1.25rem

.card-header
    display flex
    align-items center
    gap 0.9rem
    margin-bottom 1rem
    flex-wrap wrap

.card-title
    font-size 1.1rem
    font-weight 600
    margin 0 0 0.3rem

.count
    font-size 0.8rem
    color #94a3b8
    font-weight 400
    margin-left 0.3rem

.card-hint
    color #94a3b8
    font-size 0.82rem
    margin 0
    flex-basis 100%

.target-icon
    width 56px
    height 56px
    border-radius 8px
    object-fit contain
    background rgba(255,255,255,0.04)

.level-group
    padding 0.85rem 0
    border-top 1px solid rgba(255,255,255,0.05)

.level-header
    display flex
    justify-content space-between
    align-items center
    margin-bottom 0.6rem

.level-label
    font-size 0.8rem
    font-weight 600
    text-transform uppercase
    letter-spacing 0.05em
    color #94a3b8

.btn-upload
    display inline-flex
    align-items center
    gap 0.35rem
    background #6366f1
    color #fff
    padding 0.4rem 0.8rem
    border-radius 8px
    font-size 0.8rem
    cursor pointer

    &:hover
        background #4f46e5

    &.disabled
        opacity 0.5
        cursor default

.empty
    color #475569
    font-size 0.85rem
    margin 0

.media-grid
    display flex
    flex-wrap wrap
    gap 0.75rem

.media-thumb
    position relative
    width 160px
    display flex
    flex-direction column
    gap 0.3rem

    &--wide
        width 180px

.media-preview
    width 100%
    height 120px
    object-fit cover
    border-radius 8px
    background rgba(255,255,255,0.03)
    border 1px solid rgba(255,255,255,0.06)

.media-name
    font-size 0.72rem
    color #94a3b8
    font-family ui-monospace, monospace
    overflow hidden
    text-overflow ellipsis
    white-space nowrap

.media-meta
    font-size 0.7rem
    color #64748b
    overflow hidden
    text-overflow ellipsis
    white-space nowrap

.media-actions
    display flex
    gap 0.25rem
    align-items center

    button
        flex 1
        background rgba(255,255,255,0.06)
        border none
        color #cbd5e1
        border-radius 6px
        padding 0.3rem
        cursor pointer
        display flex
        align-items center
        justify-content center

        &:hover
            background rgba(255,255,255,0.12)

        &:disabled
            opacity 0.3
            cursor default

        &.danger:hover
            background #ef4444
            color #fff

.level-select
    flex 2
    background #121214
    color #cbd5e1
    border 1px solid rgba(255,255,255,0.1)
    border-radius 6px
    font-size 0.72rem
    padding 0.25rem

.spinning
    animation spin 1s linear infinite

@keyframes spin
    to
        transform rotate(360deg)
</style>
