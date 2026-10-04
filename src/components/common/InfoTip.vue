<script setup lang="ts">
import { Icon } from '@iconify/vue'

// Ícone "i" com explicação no hover e no foco (Tab). O texto vai no aria-label,
// então leitor de tela lê sem depender do balão visual.
withDefaults(defineProps<{ text: string; align?: 'center' | 'left' | 'right' }>(), {
    align: 'center',
})
</script>

<template>
    <span class="info-tip" tabindex="0" role="note" :aria-label="text">
        <Icon icon="mdi:information-outline" width="15" />
        <span class="bubble" :class="align" aria-hidden="true">{{ text }}</span>
    </span>
</template>

<style lang="stylus" scoped>
.info-tip
    position relative
    display inline-flex
    align-items center
    color #64748b
    cursor help
    vertical-align middle
    outline none

    &:hover, &:focus-visible
        color #a5b4fc

    &:hover .bubble, &:focus-visible .bubble
        opacity 1
        visibility visible

.bubble
    position absolute
    top calc(100% + 8px)
    z-index 50
    width max-content
    max-width 300px
    padding 0.6rem 0.75rem
    background #0b0b0e
    border 1px solid rgba(255,255,255,0.12)
    border-radius 8px
    box-shadow 0 8px 24px rgba(0,0,0,0.45)
    color #cbd5e1
    font-size 0.76rem
    font-weight 400
    line-height 1.45
    text-align left
    text-transform none
    letter-spacing normal
    white-space normal
    pointer-events none
    opacity 0
    visibility hidden
    transition opacity 0.12s

    &.center
        left 50%
        transform translateX(-50%)

    &.left
        left -8px

    &.right
        right -8px
</style>
