<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { toast } from 'vue3-toastify'
import { Icon } from '@iconify/vue'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { generateBulkSalesReportPdf } from '@/utils/pdf/bulkSalesReport'
import { generateBulkReceiptsPdf, type ReceiptRow } from '@/utils/pdf/bulkReceipts'

const today = dayjs()
const dateFrom = ref(today.startOf('month').format('YYYY-MM-DD'))
const dateTo = ref(today.format('YYYY-MM-DD'))
const paymentStatus = ref('PAID')

const previewSales = ref<any[]>([])
const previewMeta = ref<{ total: number; returned: number; capped: boolean } | null>(null)
const receipts = ref<ReceiptRow[]>([])

const loadingPreview = ref(false)
const loadingReport = ref(false)
const loadingReceipts = ref(false)

const filtersValid = computed(() => Boolean(dateFrom.value && dateTo.value))
const filtersPayload = computed(() => ({
    from: dateFrom.value || undefined,
    to: dateTo.value || undefined,
    paymentStatus: paymentStatus.value || undefined,
}))

const totalSum = computed(() => previewSales.value.reduce((acc, s) => acc + (s.total_amount || 0), 0))

const setPreset = (preset: 'today' | '7d' | '30d' | 'month' | 'lastMonth') => {
    const now = dayjs()
    if (preset === 'today') {
        dateFrom.value = now.format('YYYY-MM-DD')
        dateTo.value = now.format('YYYY-MM-DD')
        return
    }
    if (preset === '7d') {
        dateFrom.value = now.subtract(6, 'day').format('YYYY-MM-DD')
        dateTo.value = now.format('YYYY-MM-DD')
        return
    }
    if (preset === '30d') {
        dateFrom.value = now.subtract(29, 'day').format('YYYY-MM-DD')
        dateTo.value = now.format('YYYY-MM-DD')
        return
    }
    if (preset === 'month') {
        dateFrom.value = now.startOf('month').format('YYYY-MM-DD')
        dateTo.value = now.format('YYYY-MM-DD')
        return
    }
    if (preset === 'lastMonth') {
        const last = now.subtract(1, 'month')
        dateFrom.value = last.startOf('month').format('YYYY-MM-DD')
        dateTo.value = last.endOf('month').format('YYYY-MM-DD')
    }
}

const fetchPreview = async () => {
    if (!filtersValid.value) {
        toast.warning('Selecione um periodo valido.')
        return
    }
    loadingPreview.value = true
    try {
        const { data } = await adminService.exportSalesReport(filtersPayload.value)
        if (!data) return
        previewSales.value = data.data
        previewMeta.value = { total: data.total, returned: data.returned, capped: data.capped }
        if (data.capped) {
            toast.info(`Cap atingido: ${data.returned} de ${data.total} vendas retornadas.`)
        }
    } catch (err: any) {
        console.error('Erro pre-visualizar:', err)
        toast.error(err?.response?.data?.message || 'Falha ao carregar vendas.')
    } finally {
        loadingPreview.value = false
    }
}

const exportConsolidatedPdf = async () => {
    if (!filtersValid.value) {
        toast.warning('Selecione um periodo valido.')
        return
    }
    loadingReport.value = true
    try {
        let salesData = previewSales.value
        if (!salesData.length) {
            const { data } = await adminService.exportSalesReport(filtersPayload.value)
            if (!data) return
            salesData = data.data
            previewSales.value = data.data
            previewMeta.value = { total: data.total, returned: data.returned, capped: data.capped }
        }
        if (!salesData.length) {
            toast.warning('Nenhuma venda no periodo.')
            return
        }
        generateBulkSalesReportPdf(salesData, {
            from: dateFrom.value,
            to: dateTo.value,
            payment_status: paymentStatus.value,
        })
    } catch (err: any) {
        console.error('Erro PDF consolidado:', err)
        toast.error(err?.response?.data?.message || 'Falha ao gerar PDF consolidado.')
    } finally {
        loadingReport.value = false
    }
}

const exportReceiptsPdf = async () => {
    if (!filtersValid.value) {
        toast.warning('Selecione um periodo valido.')
        return
    }
    loadingReceipts.value = true
    try {
        const { data } = await adminService.getBulkAsaasReceipts({
            from: dateFrom.value,
            to: dateTo.value,
        })
        if (!data) return
        receipts.value = data.data
        if (!data.data.length) {
            toast.warning('Nenhuma venda paga com Asaas no periodo.')
            return
        }
        generateBulkReceiptsPdf(data.data, { from: dateFrom.value, to: dateTo.value })
    } catch (err: any) {
        console.error('Erro comprovantes:', err)
        toast.error(err?.response?.data?.message || 'Falha ao gerar PDF de comprovantes.')
    } finally {
        loadingReceipts.value = false
    }
}

const formatStatusText = (status: string) => {
    const map: Record<string, string> = {
        PENDING: 'Pendente',
        COMPLETED: 'Concluido',
        APPROVED: 'Aprovado',
        PAID: 'Pago',
        CANCELED: 'Cancelado',
        FAILED: 'Falho',
    }
    return map[status?.toUpperCase()] || status || '-'
}
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Relatorios</h1>
                <p class="page-subtitle">Exporta vendas pagas em bulk por periodo</p>
            </div>
        </header>

        <div class="section">
            <h2 class="section-title">Filtros</h2>
            <div class="filter-grid">
                <div class="filter-field">
                    <label>De</label>
                    <input type="date" v-model="dateFrom" />
                </div>
                <div class="filter-field">
                    <label>Ate</label>
                    <input type="date" v-model="dateTo" />
                </div>
                <div class="filter-field">
                    <label>Status</label>
                    <select v-model="paymentStatus">
                        <option value="PAID">Pago</option>
                        <option value="PENDING">Pendente</option>
                        <option value="APPROVED">Aprovado</option>
                        <option value="CANCELED">Cancelado</option>
                        <option value="FAILED">Falho</option>
                        <option value="">Todos</option>
                    </select>
                </div>
            </div>

            <div class="preset-row">
                <button class="preset-btn" @click="setPreset('today')">Hoje</button>
                <button class="preset-btn" @click="setPreset('7d')">7 dias</button>
                <button class="preset-btn" @click="setPreset('30d')">30 dias</button>
                <button class="preset-btn" @click="setPreset('month')">Mes atual</button>
                <button class="preset-btn" @click="setPreset('lastMonth')">Mes passado</button>
            </div>

            <div class="actions">
                <button class="btn-primary" :disabled="loadingPreview" @click="fetchPreview">
                    <Icon icon="mdi:magnify" />
                    {{ loadingPreview ? 'Buscando...' : 'Pre-visualizar' }}
                </button>
                <button class="btn-primary" :disabled="loadingReport" @click="exportConsolidatedPdf">
                    <Icon icon="mdi:file-pdf-box" />
                    {{ loadingReport ? 'Gerando...' : 'Exportar Relatorios (PDF)' }}
                </button>
                <button class="btn-secondary" :disabled="loadingReceipts" @click="exportReceiptsPdf">
                    <Icon icon="mdi:receipt-text-outline" />
                    {{ loadingReceipts ? 'Gerando...' : 'Exportar Comprovantes (PDF)' }}
                </button>
            </div>
        </div>

        <div class="section" v-if="previewMeta">
            <h2 class="section-title">Resumo</h2>
            <div class="summary-grid">
                <div class="summary-card">
                    <label>Vendas encontradas</label>
                    <p>{{ previewMeta.returned }} / {{ previewMeta.total }}</p>
                </div>
                <div class="summary-card highlight">
                    <label>Somatoria total</label>
                    <p>{{ formatCurrency(totalSum) }}</p>
                </div>
                <div class="summary-card">
                    <label>Periodo</label>
                    <p>{{ dateFrom }} a {{ dateTo }}</p>
                </div>
            </div>
            <p v-if="previewMeta.capped" class="cap-warning">
                Resultado limitado pelo cap do backend. Restrinja o periodo para incluir todas.
            </p>
        </div>

        <div class="section" v-if="previewSales.length">
            <h2 class="section-title">Vendas no relatorio</h2>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Pedido</th>
                            <th>Cliente</th>
                            <th>Data</th>
                            <th>Status</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="sale in previewSales" :key="sale.id">
                            <td><strong>{{ sale.order_number }}</strong></td>
                            <td>{{ sale.users?.username || '-' }}</td>
                            <td>{{ $dayjs(sale.created_at).format('DD/MM/YYYY HH:mm') }}</td>
                            <td>{{ formatStatusText(sale.payment_status) }}</td>
                            <td class="price">{{ formatCurrency(sale.total_amount) }}</td>
                        </tr>
                    </tbody>
                </table>
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
    margin-bottom 1.5rem

.page-title
    font-size 1.8rem
    font-weight 700

.page-subtitle
    color #94a3b8
    font-size 0.9rem

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)
    margin-bottom 1.25rem

.section-title
    font-size 1rem
    font-weight 600
    margin-bottom 1rem
    padding-bottom 0.6rem
    border-bottom 1px solid rgba(255,255,255,0.05)

.filter-grid
    display grid
    grid-template-columns repeat(auto-fit, minmax(180px, 1fr))
    gap 1rem
    margin-bottom 1rem

.filter-field
    display flex
    flex-direction column
    gap 0.35rem

    label
        font-size 0.78rem
        color #94a3b8

    input,
    select
        background #2a2a30
        border 1px solid rgba(255,255,255,0.08)
        border-radius 6px
        color #fff
        padding 0.55rem 0.75rem
        font-size 0.875rem
        outline none

        &:focus
            border-color rgba(99,102,241,0.4)

.preset-row
    display flex
    flex-wrap wrap
    gap 0.5rem
    margin-bottom 1rem

.preset-btn
    background rgba(255,255,255,0.05)
    color #cbd5e1
    border 1px solid rgba(255,255,255,0.08)
    padding 0.4rem 0.85rem
    border-radius 6px
    font-size 0.8rem
    cursor pointer
    transition all 0.15s

    &:hover
        color #fff
        background rgba(255,255,255,0.1)

.actions
    display flex
    gap 0.6rem
    flex-wrap wrap

.btn-primary,
.btn-secondary
    display inline-flex
    align-items center
    gap 0.4rem
    border none
    padding 0.6rem 1rem
    border-radius 8px
    font-size 0.85rem
    font-weight 600
    cursor pointer
    transition background 0.2s, opacity 0.2s

    &:disabled
        opacity 0.5
        cursor not-allowed

.btn-primary
    background #6366f1
    color #fff

    &:hover:not(:disabled)
        background #4f46e5

.btn-secondary
    background rgba(255,255,255,0.06)
    color #fff
    border 1px solid rgba(255,255,255,0.1)

    &:hover:not(:disabled)
        background rgba(255,255,255,0.12)

.summary-grid
    display grid
    grid-template-columns repeat(auto-fit, minmax(200px, 1fr))
    gap 1rem

.summary-card
    background rgba(255,255,255,0.03)
    padding 1rem
    border-radius 8px
    border 1px solid rgba(255,255,255,0.05)

    label
        display block
        color #94a3b8
        font-size 0.78rem
        margin-bottom 0.35rem

    p
        margin 0
        font-size 1.15rem
        font-weight 700

    &.highlight p
        color #4caf50
        font-size 1.4rem

.cap-warning
    margin-top 1rem
    color #f59e0b
    font-size 0.85rem

.table-wrapper
    overflow-x auto

table
    width 100%
    border-collapse collapse

    th
        text-align left
        color #94a3b8
        font-size 0.75rem
        font-weight 500
        padding 0.6rem 0.5rem
        border-bottom 1px solid rgba(255,255,255,0.05)
        text-transform uppercase

    td
        padding 0.6rem 0.5rem
        font-size 0.875rem
        border-bottom 1px solid rgba(255,255,255,0.04)

        &.price
            font-weight 600
            color #4caf50
</style>
