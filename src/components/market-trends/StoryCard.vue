<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import type { StoryPick } from '@/services/admin/types'
import { formatCurrency } from '@/utils/formatCurrency'
import { buildSteamImageUrl } from '@/utils/steamImage'

const props = defineProps<{ pick: StoryPick; rank: number }>()

const router = useRouter()
const imageBroken = ref(false)

// O composer do Instagram lê esses parâmetros e já abre em modo story com o item e a frase.
const createStory = () =>
    router.push({
        name: 'instagram',
        query: {
            skin: props.pick.skinId,
            name: props.pick.name,
            hero: props.pick.hero ?? undefined,
            message: props.pick.hook,
        },
    })
</script>

<template>
    <article class="story-card">
        <header class="story-head">
            <span class="story-rank">{{ rank }}</span>
            <img
                v-if="pick.image && !imageBroken"
                :src="buildSteamImageUrl(pick.image) ?? ''"
                :alt="pick.name"
                class="story-image"
                @error="imageBroken = true"
            />
            <span v-else class="story-image image-fallback">
                <Icon icon="mdi:image-off-outline" width="20" />
            </span>
        </header>

        <h3 class="story-name" :title="pick.name">{{ pick.name }}</h3>
        <p class="story-tags">{{ [pick.hero, pick.rarity].filter(Boolean).join(' · ') }}</p>

        <div class="story-profit" title="Preço da vitrine − custo de entrada, por unidade">
            <span class="story-profit-value">{{ formatCurrency(pick.profit) }}</span>
            <span class="muted">de lucro/un. · {{ pick.marginPct }}%</span>
        </div>

        <dl class="story-prices">
            <div><dt>Loja</dt><dd>{{ formatCurrency(pick.sitePrice) }}</dd></div>
            <div><dt>Custo</dt><dd>{{ formatCurrency(pick.avgCost) }}</dd></div>
            <div><dt>Steam</dt><dd>{{ pick.steamPrice != null ? formatCurrency(pick.steamPrice) : '—' }}</dd></div>
            <div><dt>Estoque</dt><dd>{{ pick.stock }}</dd></div>
        </dl>

        <p class="story-hook" title="Frase sugerida pro story — vai pronta pro composer do Instagram">
            <Icon icon="mdi:format-quote-open" width="16" />
            {{ pick.hook }}
        </p>

        <ul class="story-reasons">
            <li v-for="reason in pick.reasons" :key="reason">{{ reason }}</li>
        </ul>

        <button class="story-btn" @click="createStory">
            <Icon icon="mdi:plus-box-outline" width="16" />
            Criar story
        </button>
    </article>
</template>

<style lang="stylus" scoped>
.story-card
    display flex
    flex-direction column
    gap 0.6rem
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 12px
    padding 1rem

.story-head
    position relative
    display flex
    justify-content center
    background rgba(255,255,255,0.03)
    border-radius 8px
    padding 0.75rem

.story-rank
    position absolute
    top 0.5rem
    left 0.5rem
    width 24px
    height 24px
    display flex
    align-items center
    justify-content center
    border-radius 999px
    background rgba(225,48,108,0.2)
    color #f9a8d4
    font-size 0.78rem
    font-weight 700

.story-image
    width 120px
    height 80px
    object-fit contain

.image-fallback
    display flex
    align-items center
    justify-content center
    background rgba(255,255,255,0.04)
    border-radius 4px
    color #475569

.story-name
    font-size 0.92rem
    font-weight 700
    line-height 1.3
    overflow hidden
    text-overflow ellipsis
    white-space nowrap

.story-tags
    margin-top -0.4rem
    font-size 0.72rem
    color #94a3b8

.story-profit
    display flex
    align-items baseline
    gap 0.4rem
    font-size 0.78rem

.muted
    color #64748b

.story-profit-value
    font-size 1.25rem
    font-weight 800
    color #22c55e

.story-prices
    display grid
    grid-template-columns repeat(2, 1fr)
    gap 0.3rem 0.75rem
    margin 0
    font-size 0.76rem

    div
        display flex
        justify-content space-between

    dt
        color #64748b

    dd
        margin 0
        font-weight 600

.story-hook
    display flex
    gap 0.35rem
    padding 0.55rem 0.65rem
    border-left 3px solid #e1306c
    background rgba(225,48,108,0.08)
    border-radius 0 6px 6px 0
    font-size 0.82rem
    font-weight 600
    color #fce7f3

.story-reasons
    margin 0
    padding-left 1rem
    display flex
    flex-direction column
    gap 0.3rem
    font-size 0.74rem
    color #cbd5e1
    line-height 1.4
    flex 1

.story-btn
    display flex
    align-items center
    justify-content center
    gap 0.4rem
    margin-top 0.25rem
    padding 0.5rem
    border-radius 8px
    border 1px solid rgba(225,48,108,0.4)
    background rgba(225,48,108,0.15)
    color #f9a8d4
    font-size 0.82rem
    font-weight 600
    cursor pointer

    &:hover, &:focus-visible
        background rgba(225,48,108,0.25)
</style>
