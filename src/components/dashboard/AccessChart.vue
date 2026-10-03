<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import Chart from 'chart.js/auto'
import dayjs from 'dayjs'
import { adminService, type DashboardAccess } from '@/services/admin/admin.service'
import { persistedRef } from '@/utils/persistedRef'

type Mode = 'day' | 'hour'
type Series = 'visitors' | 'users'
type Point = { label: string; visitors: number; users: number }

const PERIODS = [7, 30, 90]
const VISITORS_COLOR = 'rgba(0, 188, 212, 0.3)'
const VISITORS_PEAK_COLOR = '#00bcd4'
const USERS_COLOR = '#6366f1'

const modes: Record<Mode, { label: string; suffix: string; points: (data: DashboardAccess) => Point[] }> = {
    day: {
        label: 'Por dia',
        suffix: '',
        points: data => data.byDay.map(point => ({ ...point, label: dayjs(point.day).format('DD/MM') })),
    },
    hour: {
        label: 'Por hora',
        suffix: ' em média',
        points: data => data.byHour.map(point => ({ ...point, label: `${point.hour}h` })),
    },
}

const series: Record<Series, { label: string; color: string }> = {
    visitors: { label: 'Visitantes', color: VISITORS_PEAK_COLOR },
    users: { label: 'Logados', color: USERS_COLOR },
}

const days = persistedRef('dashboard:access-days', 30)
const mode = persistedRef<Mode>('dashboard:access-mode', 'day')
const access = ref<DashboardAccess | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
let chart: Chart | undefined

const points = computed(() => (access.value ? modes[mode.value].points(access.value) : []))

const peakOf = (key: Series) =>
    points.value.reduce<Point | null>((best, point) => (!best || point[key] > best[key] ? point : best), null)

const peaks = computed(() =>
    (Object.keys(series) as Series[])
        .map(key => ({ key, point: peakOf(key) }))
        .filter(peak => peak.point && peak.point[peak.key] > 0),
)

const fetchAccess = async () => {
    try {
        const { data } = await adminService.getDashboardAccess(days.value)
        access.value = data
    } catch (error) {
        console.error('Erro ao carregar acessos:', error)
    }
}

const visitorBarColors = () => {
    const peak = peakOf('visitors')
    return points.value.map(point => (point === peak ? VISITORS_PEAK_COLOR : VISITORS_COLOR))
}

const renderChart = () => {
    chart?.destroy()
    if (!canvas.value || !points.value.length) return

    const suffix = modes[mode.value].suffix
    chart = new Chart(canvas.value, {
        type: 'bar',
        data: {
            labels: points.value.map(point => point.label),
            datasets: [
                {
                    label: series.visitors.label,
                    data: points.value.map(point => point.visitors),
                    backgroundColor: visitorBarColors(),
                    borderRadius: 4,
                    order: 2,
                },
                {
                    type: 'line',
                    label: series.users.label,
                    data: points.value.map(point => point.users),
                    borderColor: USERS_COLOR,
                    backgroundColor: USERS_COLOR,
                    pointRadius: 2,
                    tension: 0.3,
                    order: 1,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#94a3b8', boxWidth: 12 } },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw}${suffix}` } },
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.07)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
            },
        },
    })
}

watch(days, fetchAccess)
watch([points, canvas], renderChart)
onMounted(fetchAccess)
onUnmounted(() => chart?.destroy())
</script>

<template>
    <div class="section">
        <div class="section-header">
            <div>
                <h2 class="section-title">Pico de acesso</h2>
                <p class="section-hint">Visitantes = navegadores distintos (inclui anônimos) · Logados = contas com sessão ativa</p>
            </div>
            <div class="controls">
                <div class="toggle">
                    <button
                        v-for="(def, key) in modes"
                        :key="key"
                        type="button"
                        :class="{ active: mode === key }"
                        @click="mode = key"
                    >
                        {{ def.label }}
                    </button>
                </div>
                <div class="toggle">
                    <button
                        v-for="period in PERIODS"
                        :key="period"
                        type="button"
                        :class="{ active: days === period }"
                        @click="days = period"
                    >
                        {{ period }}d
                    </button>
                </div>
            </div>
        </div>

        <div v-if="peaks.length" class="peaks">
            <p v-for="peak in peaks" :key="peak.key" class="peak">
                <Icon icon="mdi:trending-up" width="16" :color="series[peak.key].color" />
                Pico {{ series[peak.key].label.toLowerCase() }}:
                <strong :style="{ color: series[peak.key].color }">{{ peak.point!.label }}</strong>
                · {{ peak.point![peak.key].toLocaleString('pt-BR') }}{{ modes[mode].suffix }}
            </p>
        </div>

        <div class="canvas-wrap">
            <canvas ref="canvas"></canvas>
        </div>
    </div>
</template>

<style lang="stylus" scoped>
.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)
    margin-top 1.5rem
    min-width 0

.section-header
    display flex
    justify-content space-between
    align-items flex-start
    flex-wrap wrap
    gap 0.75rem
    margin-bottom 1rem

.section-title
    font-size 1rem
    font-weight 600

.section-hint
    font-size 0.75rem
    color #64748b
    margin-top 0.2rem

.controls
    display flex
    gap 0.5rem
    flex-wrap wrap

.toggle
    display flex
    border 1px solid rgba(255,255,255,0.1)
    border-radius 7px
    overflow hidden

    button
        background transparent
        border none
        color #94a3b8
        font-size 0.78rem
        padding 0.35rem 0.7rem
        cursor pointer
        transition background 0.15s, color 0.15s

        &:hover
            color #e2e8f0

        &.active
            background rgba(0,188,212,0.18)
            color #00bcd4

.peaks
    display flex
    flex-wrap wrap
    gap 0.4rem 1.5rem
    margin-bottom 0.75rem

.peak
    display flex
    align-items center
    gap 0.35rem
    font-size 0.85rem
    color #94a3b8

.canvas-wrap
    height 260px
    position relative
</style>
