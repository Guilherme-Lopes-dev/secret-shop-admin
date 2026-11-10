<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import type { AutoStoryPlan } from '@/services/admin/types'
import { formatCurrency } from '@/utils/formatCurrency'
import { buildSteamImageUrl } from '@/utils/steamImage'

const props = defineProps<{ plan: AutoStoryPlan }>()

const brokenImages = ref(new Set<string>())

// Mesma ordem das faixas da config; faixa sem nenhuma selecionada aparece vazia (faixa curta).
const groups = computed(() =>
    props.plan.bands.map((band) => ({
        ...band,
        skins: props.plan.skins.filter((skin) => skin.band === band.label),
    })),
)

const imageOf = (image: string | null | undefined, skinUuid: string) =>
    image && !brokenImages.value.has(skinUuid) ? buildSteamImageUrl(image) : null

const markBroken = (skinUuid: string) => {
    brokenImages.value = new Set([...brokenImages.value, skinUuid])
}
</script>

<template>
    <div class="plan-list">
        <div v-for="group in groups" :key="group.label" class="group">
            <h3 class="group-title">
                {{ group.label }}
                <span class="muted">{{ group.selected }}/{{ group.count }} · {{ group.available }} disponíveis</span>
            </h3>
            <p v-if="!group.skins.length" class="muted empty">Nenhuma skin nessa faixa hoje.</p>
            <ul v-else class="skins">
                <li v-for="(skin, index) in group.skins" :key="skin.skin_uuid" class="skin">
                    <span class="rank">{{ index + 1 }}</span>
                    <img
                        v-if="imageOf(skin.image, skin.skin_uuid)"
                        :src="imageOf(skin.image, skin.skin_uuid)!"
                        :alt="skin.name"
                        class="image"
                        @error="markBroken(skin.skin_uuid)"
                    />
                    <span v-else class="image image--empty"><Icon icon="mdi:image-off-outline" width="16" /></span>
                    <div class="info">
                        <strong class="name" :title="skin.name">{{ skin.name }}</strong>
                        <span class="muted">{{ [skin.hero, formatCurrency(skin.price_cents)].filter(Boolean).join(' · ') }}</span>
                    </div>
                    <span
                        class="badge"
                        :class="skin.has_art ? 'badge--art' : 'badge--new'"
                        :title="skin.has_art ? 'Reaproveita arte que já existe: sem custo' : 'A IA gera arte nova (~US$ 0,43)'"
                    >
                        {{ skin.has_art ? 'tem arte' : 'arte nova' }}
                    </span>
                </li>
            </ul>
        </div>
    </div>
</template>

<style lang="stylus" scoped>
.plan-list
    display flex
    flex-direction column
    gap 1rem
    margin-bottom 1.25rem

.group-title
    display flex
    align-items baseline
    gap 0.5rem
    margin 0 0 0.5rem
    font-size 0.85rem
    font-weight 600

.muted
    color #64748b
    font-size 0.75rem
    font-weight 400

.empty
    margin 0

.skins
    list-style none
    margin 0
    padding 0
    display grid
    grid-template-columns repeat(auto-fill, minmax(unquote('min(260px, 100%)'), 1fr))
    gap 0.5rem

.skin
    display flex
    align-items center
    gap 0.6rem
    padding 0.45rem 0.6rem
    background rgba(255,255,255,0.03)
    border 1px solid rgba(255,255,255,0.06)
    border-radius 8px
    min-width 0

.rank
    width 18px
    flex-shrink 0
    color #64748b
    font-size 0.72rem
    text-align center

.image
    width 48px
    height 32px
    flex-shrink 0
    object-fit contain

.image--empty
    display flex
    align-items center
    justify-content center
    color #475569

.info
    flex 1
    min-width 0
    display flex
    flex-direction column

.name
    font-size 0.78rem
    overflow hidden
    text-overflow ellipsis
    white-space nowrap

.badge
    flex-shrink 0
    padding 0.15rem 0.45rem
    border-radius 999px
    font-size 0.68rem
    font-weight 600

.badge--art
    background rgba(74,222,128,0.12)
    color #4ade80

.badge--new
    background rgba(251,191,36,0.12)
    color #fbbf24
</style>
