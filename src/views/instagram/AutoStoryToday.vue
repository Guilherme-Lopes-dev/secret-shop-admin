<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { AutoStoryRow } from '@/services/admin/types'
import { formatCurrency } from '@/utils/formatCurrency'
import { mediaUrl } from '@/utils/mediaUrl'

defineProps<{
    rows: AutoStoryRow[]
    /** false = backend local: publicar daqui é bloqueado. */
    canPublish: boolean
    publishing: boolean
}>()

const emit = defineEmits<{
    publish: [row: AutoStoryRow]
    remove: [row: AutoStoryRow]
    discardArt: [row: AutoStoryRow]
}>()

const STATUS: Record<AutoStoryRow['status'], string> = {
    GENERATING: 'Gerando arte',
    DRAFT: 'Pronto',
    PUBLISHING: 'Publicando',
    PUBLISHED: 'Publicado',
    FAILED: 'Falhou',
}

const priceChanged = (row: AutoStoryRow) =>
    row.status === 'DRAFT' &&
    row.current_price_cents !== null &&
    row.current_price_cents !== row.auto_meta?.price_cents

// Falha de publicação (tem imagem) pode ter saído na Meta mesmo assim: não oferece republicar
// nem apagar — a linha é o que segura a skin fora da próxima rodada de hoje.
const publishFailed = (row: AutoStoryRow) => row.status === 'FAILED' && !!row.image_url
const canRemove = (row: AutoStoryRow) => row.status === 'DRAFT' || (row.status === 'FAILED' && !row.image_url)
</script>

<template>
    <p v-if="!rows.length" class="empty">Nenhum story automático hoje.</p>

    <ul v-else class="rows">
        <li v-for="row in rows" :key="row.id" class="row" :class="`row--${row.status.toLowerCase()}`">
            <a v-if="row.image_url" :href="mediaUrl(row.image_url)" target="_blank" rel="noopener" class="thumb">
                <img :src="mediaUrl(row.image_url)" referrerpolicy="no-referrer" alt="" />
            </a>
            <span v-else class="thumb thumb--empty">
                <Icon :icon="row.status === 'GENERATING' ? 'mdi:loading' : 'mdi:image-off-outline'" :class="{ spin: row.status === 'GENERATING' }" width="20" />
            </span>

            <div class="info">
                <strong class="name" :title="row.skin?.market_hash_name">{{ row.skin?.market_hash_name ?? 'Skin removida' }}</strong>
                <span class="muted">{{ row.auto_meta?.band_label ?? '—' }} · #{{ row.auto_meta?.rank ?? '—' }} · estoque {{ row.stock }}</span>
                <span>
                    {{ formatCurrency(row.auto_meta?.price_cents) }} na arte
                    <span v-if="priceChanged(row)" class="warn" title="Na publicação a arte é refeita com o preço atual">
                        → agora {{ formatCurrency(row.current_price_cents) }}
                    </span>
                </span>
                <span class="muted">{{ row.auto_meta?.note }}</span>
                <span class="status" :class="`status--${row.status.toLowerCase()}`">{{ STATUS[row.status] }}</span>
                <span v-if="row.error" class="error">{{ row.error }}</span>
                <span v-if="publishFailed(row)" class="warn">Confere no Instagram antes de publicar de novo pelo /instagram.</span>
            </div>

            <div class="actions">
                <a v-if="row.permalink" :href="row.permalink" target="_blank" rel="noopener" class="action">
                    <Icon icon="mdi:open-in-new" width="15" /> Ver
                </a>
                <button
                    v-if="row.status === 'DRAFT'"
                    class="action action--primary"
                    :disabled="!canPublish || publishing"
                    :title="canPublish ? '' : 'Só em produção'"
                    @click="emit('publish', row)"
                >
                    <Icon icon="mdi:send" width="15" /> Publicar
                </button>
                <button v-if="row.status === 'DRAFT'" class="action" title="A próxima rodada gera outra arte pra essa skin" @click="emit('discardArt', row)">
                    <Icon icon="mdi:image-remove-outline" width="15" /> Descartar arte
                </button>
                <button v-if="canRemove(row)" class="action action--danger" @click="emit('remove', row)">
                    <Icon icon="mdi:trash-can-outline" width="15" /> Apagar
                </button>
            </div>
        </li>
    </ul>
</template>

<style lang="stylus" scoped>
.empty
    color #64748b
    font-size 0.85rem

.rows
    list-style none
    margin 0
    padding 0
    display grid
    grid-template-columns repeat(auto-fill, minmax(unquote('min(320px, 100%)'), 1fr))
    gap 0.75rem

.row
    display flex
    gap 0.75rem
    padding 0.75rem
    background rgba(255,255,255,0.03)
    border 1px solid rgba(255,255,255,0.06)
    border-radius 10px

.thumb
    width 72px
    aspect-ratio 9 / 16
    flex-shrink 0
    border-radius 6px
    overflow hidden
    background rgba(0,0,0,0.25)

    img
        width 100%
        height 100%
        object-fit cover
        display block

.thumb--empty
    display flex
    align-items center
    justify-content center
    color #475569

.info
    flex 1
    min-width 0
    display flex
    flex-direction column
    gap 0.2rem
    font-size 0.78rem

.name
    font-size 0.85rem
    overflow hidden
    text-overflow ellipsis
    white-space nowrap

.muted
    color #64748b

.warn
    color #fbbf24

.error
    color #fc8181

.status
    font-weight 600
    color #94a3b8

.status--draft
    color #a5b4fc

.status--published
    color #4ade80

.status--failed
    color #fc8181

.status--publishing, .status--generating
    color #fbbf24

.actions
    display flex
    flex-direction column
    gap 0.35rem

.action
    display inline-flex
    align-items center
    gap 0.3rem
    padding 0.3rem 0.6rem
    border-radius 6px
    border 1px solid rgba(255,255,255,0.1)
    background transparent
    color #cbd5e1
    font-size 0.75rem
    cursor pointer
    white-space nowrap
    text-decoration none

    &:hover:not(:disabled)
        background rgba(255,255,255,0.06)

    &:disabled
        opacity 0.4
        cursor not-allowed

.action--primary
    border-color rgba(225,48,108,0.4)
    background rgba(225,48,108,0.15)
    color #f9a8d4

.action--danger
    color #fc8181

.spin
    animation spin 1s linear infinite

@keyframes spin
    to
        transform rotate(360deg)
</style>
