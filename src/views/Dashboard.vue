<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import Chart from 'chart.js/auto'
import { formatCurrency } from '@/utils/formatCurrency'
import { adminService } from '@/services/admin/admin.service'

const salesChart = ref<HTMLCanvasElement | null>(null)
const chartInstance = ref<Chart | null>(null)
const loading = ref(true)

const stats = ref([
    { label: 'Total de Vendas', value: '...', icon: 'mdi:currency-usd', color: '#4caf50' },
    { label: 'Pedidos Realizados', value: '...', icon: 'mdi:cart-outline', color: '#2196f3' },
    { label: 'Novos Usuários', value: '...', icon: 'mdi:account-group', color: '#ff9800' },
    { label: 'Skins Ativas', value: '...', icon: 'mdi:sword', color: '#9c27b0' },
])

const recentSales = ref<any[]>([])

const fetchDashboardData = async () => {
    loading.value = true
    try {
        const [statsRes, performanceRes, ordersRes] = await Promise.all([
            adminService.getSalesStats(),
            adminService.getPerformance(),
            adminService.getRecentOrders(),
        ])

        if (statsRes.data) {
            stats.value = [
                { label: 'Total de Vendas', value: statsRes.data[0].value, icon: 'mdi:currency-usd', color: '#4caf50' },
                { label: 'Pedidos Realizados', value: statsRes.data[1].value, icon: 'mdi:cart-outline', color: '#2196f3' },
                { label: 'Novos Usuários', value: statsRes.data[2].value, icon: 'mdi:account-group', color: '#ff9800' },
                { label: 'Skins Ativas', value: statsRes.data[3].value, icon: 'mdi:sword', color: '#9c27b0' },
            ]
        }

        if (ordersRes.data) recentSales.value = ordersRes.data

        if (performanceRes.data && salesChart.value) {
            const labels = performanceRes.data.labels
            const values = performanceRes.data.datasets[0].data

            if (chartInstance.value) {
                chartInstance.value.destroy()
                chartInstance.value = null
            }

            const ctx = salesChart.value.getContext('2d')
            if (ctx) {
                chartInstance.value = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [{
                            label: 'Desempenho de Vendas',
                            data: values,
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99, 102, 241, 0.2)',
                            fill: true,
                            tension: 0.4,
                        }],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => formatCurrency(Number(ctx.raw) * 100),
                                },
                            },
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: { color: 'rgba(255,255,255,0.07)' },
                                ticks: { color: '#94a3b8' },
                            },
                            x: {
                                grid: { display: false },
                                ticks: { color: '#94a3b8' },
                            },
                        },
                    },
                })
            }
        }
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error)
    } finally {
        loading.value = false
    }
}

onMounted(fetchDashboardData)
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <h1 class="page-title">Dashboard</h1>
            <p class="page-subtitle">Bem-vindo ao painel administrativo</p>
        </header>

        <div class="stats-grid">
            <div v-for="stat in stats" :key="stat.label" class="stat-card">
                <div class="stat-icon" :style="{ backgroundColor: stat.color + '20', color: stat.color }">
                    <Icon :icon="stat.icon" width="24" />
                </div>
                <div class="stat-info">
                    <span class="stat-label">{{ stat.label }}</span>
                    <span class="stat-value">{{ stat.value }}</span>
                </div>
            </div>
        </div>

        <div class="dashboard-grid">
            <div class="section chart-section">
                <div class="section-header">
                    <h2 class="section-title">Desempenho de Vendas</h2>
                    <Icon icon="mdi:trending-up" width="20" color="#4caf50" />
                </div>
                <div class="canvas-wrap">
                    <canvas ref="salesChart"></canvas>
                </div>
            </div>

            <div class="section">
                <div class="section-header">
                    <h2 class="section-title">Últimos Pedidos</h2>
                    <router-link to="/sales" class="view-all">Ver todos</router-link>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>N° Pedido</th>
                                <th>Valor</th>
                                <th>Data</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="sale in recentSales" :key="sale.orderNumber">
                                <td class="fw">{{ sale.orderNumber }}</td>
                                <td>{{ formatCurrency(sale.price) }}</td>
                                <td>{{ $dayjs(sale.date).format('DD/MM/YY HH:mm') }}</td>
                                <td>
                                    <span class="status-badge" :class="sale.status?.toLowerCase()">
                                        {{ sale.status }}
                                    </span>
                                </td>
                            </tr>
                            <tr v-if="!recentSales.length">
                                <td colspan="4" class="empty">Nenhum pedido recente.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="stylus" scoped>
.view-wrap
    padding 2rem
    color #fff
    background #121214
    min-height 100vh

.page-header
    margin-bottom 2rem

.page-title
    font-size 1.8rem
    font-weight 700
    margin-bottom 0.25rem

.page-subtitle
    color #94a3b8
    font-size 0.9rem

.stats-grid
    display grid
    grid-template-columns repeat(auto-fit, minmax(220px, 1fr))
    gap 1.25rem
    margin-bottom 2rem

.stat-card
    background #1a1a1e
    padding 1.25rem
    border-radius 12px
    display flex
    align-items center
    gap 1rem
    border 1px solid rgba(255,255,255,0.05)

.stat-icon
    width 48px
    height 48px
    border-radius 10px
    display flex
    align-items center
    justify-content center
    flex-shrink 0

.stat-info
    display flex
    flex-direction column

.stat-label
    font-size 0.82rem
    color #94a3b8
    margin-bottom 0.2rem

.stat-value
    font-size 1.2rem
    font-weight 700

.dashboard-grid
    display grid
    grid-template-columns 1.5fr 1fr
    gap 1.5rem

    @media (max-width: 1024px)
        grid-template-columns 1fr

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)
    min-width 0

.section-header
    display flex
    justify-content space-between
    align-items center
    margin-bottom 1.25rem

.section-title
    font-size 1rem
    font-weight 600

.view-all
    color #6366f1
    text-decoration none
    font-size 0.875rem

    &:hover
        text-decoration underline

.canvas-wrap
    height 280px
    position relative

.table-wrapper
    overflow-x auto

table
    width 100%
    border-collapse collapse

    th
        text-align left
        color #94a3b8
        font-size 0.78rem
        font-weight 500
        padding 0.6rem 0.5rem
        border-bottom 1px solid rgba(255,255,255,0.05)
        text-transform uppercase

    td
        padding 0.7rem 0.5rem
        font-size 0.875rem
        border-bottom 1px solid rgba(255,255,255,0.04)

.fw
    font-weight 600

.empty
    text-align center
    padding 2rem
    color #64748b

.status-badge
    padding 3px 7px
    border-radius 5px
    font-size 0.72rem
    font-weight 600
    text-transform uppercase

    &.completed, &.paid, &.approved
        background rgba(76,175,80,0.1)
        color #4caf50

    &.pending, &.processing
        background rgba(255,152,0,0.1)
        color #ff9800

    &.canceled, &.failed
        background rgba(244,67,54,0.1)
        color #f44336
</style>
