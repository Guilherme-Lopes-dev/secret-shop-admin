<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
    <!-- div, não label: vários filtros têm mais de um controle (range, chips) e o label clicaria no primeiro -->
    <div class="filter-field" role="group" :aria-label="label">
        <span class="filter-field__label">{{ label }}</span>
        <slot />
    </div>
</template>

<style lang="stylus" scoped>
.filter-field
    display flex
    flex-direction column
    gap 0.3rem
    min-width 0

.filter-field__label
    color #64748b
    font-size 0.7rem
    font-weight 600
    letter-spacing 0.03em
    text-transform uppercase
    white-space nowrap
</style>
