<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
    <div class="filter-group" role="group" :aria-label="title">
        <h3 class="filter-group__title">{{ title }}</h3>
        <div class="filter-group__grid">
            <slot />
        </div>
    </div>
</template>

<style lang="stylus" scoped>
.filter-group
    display flex
    flex-direction column
    gap 0.5rem

.filter-group__title
    margin 0
    color #94a3b8
    font-size 0.75rem
    font-weight 600

.filter-group__grid
    display grid
    grid-template-columns repeat(auto-fill, minmax(190px, 1fr))
    gap 0.75rem 1rem
    align-items end
</style>
