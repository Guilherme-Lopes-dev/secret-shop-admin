<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { catalogIcon, catalogLabel, catalogThumb, type CatalogItem } from '@/utils/catalog'

const props = defineProps<{ item: CatalogItem }>()

const thumb = computed(() => catalogThumb(props.item))
const label = computed(() => catalogLabel(props.item))
const icon = computed(() => catalogIcon(props.item))
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
