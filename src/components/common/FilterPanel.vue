<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { persistedRef } from '@/utils/persistedRef'
import type { ActiveFilter } from '@/utils/activeFilters'

const props = defineProps<{ storageKey: string; filters: ActiveFilter[] }>()
const emit = defineEmits<{ change: [] }>()

const open = persistedRef(`${props.storageKey}:panel-open`, true)

const removeFilter = (filter: ActiveFilter) => {
    filter.clear()
    emit('change')
}

const clearAll = () => {
    props.filters.forEach(filter => filter.clear())
    emit('change')
}
</script>

<template>
    <section class="filter-panel" aria-label="Filtros">
        <div class="filter-panel__bar">
            <div class="filter-panel__search">
                <slot name="search" />
            </div>
            <slot name="sort" />
            <button
                type="button"
                class="filter-panel__toggle"
                :class="{ 'filter-panel__toggle--open': open }"
                :aria-expanded="open"
                @click="open = !open"
            >
                <Icon icon="mdi:tune-variant" width="16" />
                Filtros
                <span v-if="filters.length" class="filter-panel__count">{{ filters.length }}</span>
                <Icon icon="mdi:chevron-down" width="16" class="filter-panel__chevron" />
            </button>
        </div>

        <div v-show="open" class="filter-panel__body">
            <slot />
        </div>

        <div v-if="filters.length" class="filter-panel__active">
            <span class="filter-panel__active-label">Ativos</span>
            <ul class="filter-panel__chips">
                <li v-for="filter in filters" :key="filter.key">
                    <button
                        type="button"
                        class="filter-chip"
                        :aria-label="`Remover filtro ${filter.label}`"
                        @click="removeFilter(filter)"
                    >
                        {{ filter.label }}
                        <Icon icon="mdi:close" width="14" />
                    </button>
                </li>
            </ul>
            <button type="button" class="filter-panel__clear" @click="clearAll">Limpar tudo</button>
        </div>
    </section>
</template>

<style lang="stylus" scoped>
.filter-panel
    background #17171a
    border 1px solid rgba(255,255,255,0.06)
    border-radius 12px
    padding 0.9rem 1rem
    margin-bottom 1.25rem
    display flex
    flex-direction column
    gap 0.9rem

.filter-panel__bar
    display flex
    align-items flex-end
    gap 0.75rem
    flex-wrap wrap

.filter-panel__search
    flex 1
    min-width 240px

.filter-panel__toggle
    display inline-flex
    align-items center
    gap 0.4rem
    height 38px
    padding 0 0.85rem
    background #1f1f24
    border 1px solid rgba(255,255,255,0.1)
    border-radius 8px
    color #cbd5e1
    font-size 0.85rem
    font-weight 500
    cursor pointer
    transition border-color 0.15s, color 0.15s, background 0.15s

    &:hover
        color #fff
        border-color rgba(255,255,255,0.22)

    &:active
        transform translateY(1px)

    &:focus-visible
        outline 2px solid #00bcd4
        outline-offset 2px

.filter-panel__chevron
    transition transform 0.2s

.filter-panel__toggle--open .filter-panel__chevron
    transform rotate(180deg)

.filter-panel__count
    min-width 18px
    height 18px
    padding 0 5px
    border-radius 9px
    background #00bcd4
    color #0b0b0d
    font-size 0.7rem
    font-weight 700
    display inline-flex
    align-items center
    justify-content center

.filter-panel__body
    display flex
    flex-direction column
    gap 1rem
    padding-top 0.9rem
    border-top 1px solid rgba(255,255,255,0.06)

.filter-panel__active
    display flex
    align-items center
    gap 0.5rem
    flex-wrap wrap

.filter-panel__active-label
    color #64748b
    font-size 0.7rem
    font-weight 600
    letter-spacing 0.03em
    text-transform uppercase

.filter-panel__chips
    display flex
    flex-wrap wrap
    gap 0.4rem
    list-style none
    margin 0
    padding 0

.filter-chip
    display inline-flex
    align-items center
    gap 0.3rem
    height 28px
    padding 0 0.55rem 0 0.7rem
    background rgba(0,188,212,0.12)
    border 1px solid rgba(0,188,212,0.35)
    border-radius 14px
    color #a5f3fc
    font-size 0.78rem
    cursor pointer
    transition background 0.15s

    &:hover
        background rgba(0,188,212,0.22)

    &:focus-visible
        outline 2px solid #00bcd4
        outline-offset 2px

.filter-panel__clear
    background none
    border none
    color #94a3b8
    font-size 0.78rem
    text-decoration underline
    text-underline-offset 3px
    cursor pointer
    padding 0.25rem

    &:hover
        color #fff

@media (prefers-reduced-motion: reduce)
    .filter-panel__chevron, .filter-panel__toggle, .filter-chip
        transition none
</style>
