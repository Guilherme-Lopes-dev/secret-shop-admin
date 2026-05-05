<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { useRouter } from 'vue-router'

const router = useRouter()
const sales = ref<any[]>([])
const loading = ref(true)
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const limit = ref(20)
const saleSearch = ref('')

const filteredSales = computed(() => {
    const q = saleSearch.value.trim().toLowerCase()
    if (!q) return sales.value
    return sales.value.filter(s =>
        s.order_number?.toLowerCase().includes(q) ||
        s.users?.username?.toLowerCase().includes(q)
    )
})

const fetchSales = async (page: number) => {
    loading.value = true
    try {
        const response = await adminService.getAllSales(page, limit.value)
        if (response.data) {
            sales.value = response.data.data
            totalPages.value = response.data.pages
            totalItems.value = response.data.total
            currentPage.value = response.data.page
        }
    } catch (error) {
        console.error('Erro ao buscar vendas:', error)
    } finally {
        loading.value = false
    }
}

const nextPage = () => { if (currentPage.value < totalPages.value) fetchSales(currentPage.value + 1) }
const prevPage = () => { if (currentPage.value > 1) fetchSales(currentPage.value - 1) }

const getStatusClass = (status: string) => {
    if (!status) return ''
    const s = status.toLowerCase()
    if (['completed', 'approved', 'paid'].includes(s)) return 'status-completed'
    if (['pending', 'processing'].includes(s)) return 'status-pending'
    return 'status-canceled'
}

const formatStatusText = (status: string) => {
    if (!status) return '-'
    const map: Record<string, string> = {
        PENDING: 'Pendente', COMPLETED: 'Concluído', APPROVED: 'Aprovado',
        PAID: 'Pago', CANCELED: 'Cancelado', FAILED: 'Falho',
    }
    return map[status.toUpperCase()] || status
}

onMounted(() => fetchSales(1))
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Vendas</h1>
                <p class="page-subtitle">{{ totalItems }} pedidos no sistema</p>
            </div>
            <input
                v-model="saleSearch"
                class="filter-input"
                placeholder="Buscar por pedido ou cliente..."
            />
        </header>

        <div class="section">
            <div v-if="loading" class="loading-state">Carregando vendas...</div>
            <div v-else>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>N° Pedido</th>
                                <th>Cliente</th>
                                <th>Data</th>
                                <th>Valor Total</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="sale in filteredSales"
                                :key="sale.id"
                                class="row-clickable"
                                @click="router.push(`/sales/${sale.uuid}`)"
                            >
                                <td><strong>{{ sale.order_number }}</strong></td>
                                <td>
                                    <div class="user-cell">
                                        <span>{{ sale.users?.username || 'Desconhecido' }}</span>
                                        <small v-if="sale.users?.uuid" class="muted">{{ sale.users.uuid.substring(0, 8) }}...</small>
                                    </div>
                                </td>
                                <td>{{ $dayjs(sale.created_at).format('DD/MM/YYYY HH:mm') }}</td>
                                <td class="price">{{ formatCurrency(sale.total_amount) }}</td>
                                <td>
                                    <span class="status-badge" :class="getStatusClass(sale.payment_status)">
                                        {{ formatStatusText(sale.payment_status) }}
                                    </span>
                                </td>
                                <td>
                                    <button class="btn-view" @click.stop="router.push(`/sales/${sale.uuid}`)">
                                        Ver Detalhes
                                    </button>
                                </td>
                            </tr>
                            <tr v-if="filteredSales.length === 0">
                                <td colspan="6" class="empty-state">Nenhuma venda encontrada.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="pagination" v-if="totalPages > 1">
                    <button class="page-btn" :disabled="currentPage === 1" @click="prevPage">Anterior</button>
                    <span class="page-info">Página {{ currentPage }} de {{ totalPages }}</span>
                    <button class="page-btn" :disabled="currentPage === totalPages" @click="nextPage">Próxima</button>
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
    display flex
    align-items flex-start
    justify-content space-between
    gap 1rem
    flex-wrap wrap
    margin-bottom 2rem

.filter-input
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.5rem 0.75rem
    font-size 0.875rem
    outline none
    min-width 240px

    &::placeholder
        color #64748b

    &:focus
        border-color rgba(99,102,241,0.4)

.page-title
    font-size 1.8rem
    font-weight 700
    margin-bottom 0.25rem

.page-subtitle
    color #94a3b8
    font-size 0.9rem

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.loading-state
    padding 3rem
    text-align center
    color #94a3b8

.table-wrapper
    overflow-x auto
    margin-bottom 1.5rem

table
    width 100%
    border-collapse collapse

    th
        text-align left
        color #94a3b8
        font-size 0.78rem
        font-weight 500
        padding 0.75rem
        border-bottom 1px solid rgba(255,255,255,0.05)
        white-space nowrap
        text-transform uppercase

    td
        padding 0.85rem 0.75rem
        font-size 0.875rem
        border-bottom 1px solid rgba(255,255,255,0.04)
        white-space nowrap
        vertical-align middle

        &.price
            font-weight 600
            color #4caf50

.row-clickable
    cursor pointer

    &:hover td
        background rgba(255,255,255,0.03)

.user-cell
    display flex
    flex-direction column

.muted
    color #64748b
    font-size 0.72rem

.status-badge
    padding 3px 8px
    border-radius 5px
    font-size 0.72rem
    font-weight 600
    text-transform uppercase

.status-completed
    background rgba(76,175,80,0.1)
    color #4caf50

.status-pending
    background rgba(255,152,0,0.1)
    color #ff9800

.status-canceled
    background rgba(244,67,54,0.1)
    color #f44336

.btn-view
    background rgba(99,102,241,0.1)
    color #6366f1
    border none
    padding 0.4rem 0.9rem
    border-radius 6px
    font-size 0.82rem
    font-weight 500
    cursor pointer
    transition all 0.2s

    &:hover
        background rgba(99,102,241,0.2)

.empty-state
    text-align center
    padding 3rem
    color #94a3b8

.pagination
    display flex
    justify-content flex-end
    align-items center
    gap 1rem
    padding-top 1rem
    border-top 1px solid rgba(255,255,255,0.05)

.page-btn
    background #2a2a30
    color #fff
    border 1px solid rgba(255,255,255,0.1)
    padding 0.45rem 1rem
    border-radius 6px
    cursor pointer
    font-size 0.85rem
    transition all 0.2s

    &:hover:not(:disabled)
        background #3a3a42

    &:disabled
        opacity 0.4
        cursor not-allowed

.page-info
    color #94a3b8
    font-size 0.875rem
</style>
