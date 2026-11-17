<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { DIRECTION_LABELS, type DirectionLabels, type SortDirection } from '@/utils/tableSort'

const props = withDefaults(defineProps<{ labels?: DirectionLabels }>(), { labels: () => DIRECTION_LABELS.amount })
const direction = defineModel<SortDirection>({ required: true })
const emit = defineEmits<{ change: [] }>()

const DIRECTIONS: Record<SortDirection, { icon: string; next: SortDirection }> = {
    desc: { icon: 'mdi:sort-descending', next: 'asc' },
    asc: { icon: 'mdi:sort-ascending', next: 'desc' },
}

// valor salvo no localStorage pode ser lixo: cai no padrão em vez de quebrar a tela
const currentDirection = computed<SortDirection>(() => (direction.value === 'asc' ? 'asc' : 'desc'))
const current = computed(() => ({
    ...DIRECTIONS[currentDirection.value],
    label: props.labels[currentDirection.value],
}))

const toggle = () => {
    direction.value = current.value.next
    emit('change')
}
</script>

<template>
    <button
        type="button"
        class="sort-direction"
        :title="`${current.label} (clique pra inverter)`"
        :aria-label="`Direção: ${current.label}`"
        @click="toggle"
    >
        <Icon :icon="current.icon" width="18" />
        {{ current.label }}
    </button>
</template>

<style lang="stylus" scoped>
.sort-direction
    display inline-flex
    align-items center
    gap 0.35rem
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #cbd5e1
    padding 0.5rem 0.75rem
    font-size 0.8rem
    white-space nowrap
    cursor pointer

    &:hover
        color #fff
        border-color rgba(255,255,255,0.18)
</style>
