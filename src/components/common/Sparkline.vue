<script setup lang="ts">
import { computed } from 'vue'

// Mini-gráfico de tendência em SVG puro: sem eixo, só a forma. Verde se terminou acima
// de onde começou, vermelho se abaixo. Menos de 2 pontos (ou nenhum) não desenha nada —
// nunca derruba a tela pai por dado ausente.
const props = withDefaults(defineProps<{ values?: number[] | null; width?: number; height?: number }>(), {
    values: () => [],
    width: 90,
    height: 28,
})

const PADDING = 2

const series = computed(() => props.values ?? [])

const points = computed(() => {
    if (series.value.length < 2) return ''

    const min = Math.min(...series.value)
    const range = Math.max(...series.value) - min || 1
    const stepX = (props.width - PADDING * 2) / (series.value.length - 1)
    const usableHeight = props.height - PADDING * 2

    return series.value
        .map((value, index) => {
            const x = PADDING + index * stepX
            const y = PADDING + usableHeight - ((value - min) / range) * usableHeight

            return `${x.toFixed(1)},${y.toFixed(1)}`
        })
        .join(' ')
})

const trend = computed(() => {
    const first = series.value[0] ?? 0
    const last = series.value[series.value.length - 1] ?? 0
    if (last > first) return 'up'
    if (last < first) return 'down'

    return 'flat'
})
</script>

<template>
    <svg
        v-if="points"
        class="sparkline"
        :class="trend"
        :width="width"
        :height="height"
        :viewBox="`0 0 ${width} ${height}`"
        role="img"
        :aria-label="`Tendência: ${trend === 'up' ? 'alta' : trend === 'down' ? 'queda' : 'estável'}`"
    >
        <polyline :points="points" fill="none" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
    </svg>
</template>

<style lang="stylus" scoped>
.sparkline
    display block

    &.up polyline
        stroke #22c55e

    &.down polyline
        stroke #f43f5e

    &.flat polyline
        stroke #94a3b8
</style>
