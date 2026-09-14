<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'

// Favoritos e carrinho listam os mesmos três catálogos — o card serve os dois.
const CATALOG_LABELS = { skin: 'Skin', collector: 'Collector', physical: 'Físico' } as const
const CATALOG_ICONS = {
    skin: 'mdi:sword-cross',
    collector: 'mdi:trophy-outline',
    physical: 'mdi:package-variant-closed',
} as const

export type CatalogKind = keyof typeof CATALOG_LABELS

export interface CatalogItem {
    kind: CatalogKind
    name: string
    hero: string | null
    /** Skin e collector guardam o hash da Steam; produto físico guarda o path do nosso servidor. */
    image: string | null
}

const API_URL = import.meta.env.VITE_API_URL?.trim() || ''

const props = defineProps<{ item: CatalogItem }>()

// A URL sai do `kind`, não do formato do campo.
const thumb = computed(() => {
    if (!props.item.image) return null
    if (props.item.kind === 'physical') return `${API_URL}${props.item.image}`

    return `https://steamcommunity-a.akamaihd.net/economy/image/${props.item.image}/62fx62f`
})

const label = computed(() => CATALOG_LABELS[props.item.kind] ?? props.item.kind)
const icon = computed(() => CATALOG_ICONS[props.item.kind] ?? 'mdi:heart-outline')
</script>

<template>
    <article class="catalog-card">
        <img v-if="thumb" :src="thumb" class="catalog-thumb" :alt="item.name" />
        <div v-else class="catalog-thumb catalog-thumb--empty">
            <Icon :icon="icon" />
        </div>

        <div class="catalog-info">
            <span class="catalog-name">{{ item.name }}</span>
            <small class="catalog-meta">
                <span class="catalog-kind">{{ label }}</span>
                <slot>· {{ item.hero || 'sem herói' }}</slot>
            </small>
        </div>
    </article>
</template>

<style lang="stylus" scoped>
.catalog-card
    display flex
    align-items center
    gap 0.625rem
    padding 0.625rem
    border 1px solid rgba(255,255,255,0.06)
    border-radius 8px
    background rgba(255,255,255,0.02)
    min-width 0

.catalog-thumb
    width 48px
    height 48px
    flex-shrink 0
    object-fit contain
    border-radius 4px
    background rgba(255,255,255,0.04)

    &--empty
        display flex
        align-items center
        justify-content center
        color #f472b6

.catalog-info
    min-width 0

.catalog-name
    display block
    font-weight 500
    font-size 0.85rem
    overflow hidden
    text-overflow ellipsis
    white-space nowrap

.catalog-meta
    display block
    color #64748b
    font-size 0.73rem

.catalog-kind
    color #94a3b8
    font-weight 600
</style>
