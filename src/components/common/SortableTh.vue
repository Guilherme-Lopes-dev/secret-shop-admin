<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import type { SortState } from '@/utils/tableSort'

// O slot fica fora do botão: InfoTip é focável e não pode ir dentro de <button>.
const props = defineProps<{ column: string; label: string; sort: SortState | undefined }>()
const emit = defineEmits<{ toggle: [column: string] }>()

const active = computed(() => props.sort?.column === props.column)
const ariaSort = computed(() => {
    if (!active.value) return undefined

    return props.sort?.desc ? 'descending' : 'ascending'
})
</script>

<template>
    <th :aria-sort="ariaSort" class="sortable-th" :class="{ active }">
        <button type="button" class="sort-btn" @click="emit('toggle', column)">
            {{ label }}
            <Icon v-if="active" :icon="sort?.desc ? 'mdi:arrow-down' : 'mdi:arrow-up'" width="12" />
        </button>
        <slot />
    </th>
</template>

<style lang="stylus" scoped>
.sort-btn
    display inline-flex
    align-items center
    gap 0.2rem
    padding 0
    background none
    border none
    color inherit
    font inherit
    text-transform inherit
    letter-spacing inherit
    cursor pointer
    user-select none

    &:hover, &:focus-visible
        color #e2e8f0

.active .sort-btn
    color #a5b4fc
</style>
