<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { adminService, type CrmCampaign, type CrmCustomer, type CrmSort, type CrmSource } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { persistedRef } from '@/utils/persistedRef'
import { CAMPAIGN_OPTIONS, campaignMeta, campaignReason, daysLabel } from '@/utils/campaigns'

const router = useRouter()
const customers = ref<CrmCustomer[]>([])
const segments = ref<Partial<Record<CrmCampaign, number>>>({})
const sources = ref<Partial<Record<CrmSource, number>>>({})
const importing = ref(false)
const heroes = ref<Array<{ name: string }>>([])
const loading = ref(true)
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const limit = 20

const search = persistedRef('crm:search', '')
const campaignFilter = persistedRef<CrmCampaign | ''>('crm:campaign', '')
const heroFilter = persistedRef('crm:hero', '')
const sourceFilter = persistedRef<CrmSource | ''>('crm:source', '')
const sortFilter = persistedRef<CrmSort>('crm:sort', 'spent')

const sortOptions: Array<{ label: string; value: CrmSort }> = [
    { label: 'Maior gasto', value: 'spent' },
    { label: 'Mais compras', value: 'orders' },
    { label: 'Comprou mais recente', value: 'recent' },
    { label: 'Mais tempo sem comprar', value: 'inactive' },
    { label: 'Cadastro mais recente', value: 'newest' },
]

const SOURCE_OPTIONS: Array<{ label: string; value: CrmSource }> = [
    { label: 'Clientes Secret', value: 'secret' },
    { label: 'Wix + Secret', value: 'both' },
    { label: 'Clientes Wix', value: 'wix' },
]
const sourceLabel = (option: { label: string; value: CrmSource }) =>
    `${option.label} (${sources.value[option.value] ?? 0})`

const SOURCE_BADGE: Record<CrmSource, { label: string; hint: string } | null> = {
    secret: null,
    both: { label: 'Wix + Secret', hint: 'Comprou na loja antiga (Wix) e tem conta aqui — e-mail ou telefone bateu.' },
    wix: { label: 'Wix', hint: 'Só comprou na loja antiga (Wix). Não tem conta no Secret.' },
}
const UNKNOWN_HINT = 'Pedidos do Wix sem cliente identificado (checkout como convidado). Não dá pra vincular a ninguém.'
const isUnknownWix = (customer: CrmCustomer) => customer.source === 'wix' && !customer.email

// Só-Wix não tem interna: telefone vai na própria linha, já como WhatsApp.
// contact aqui vem só dígitos sem o 55 (normalizePhone do import).
const wixPhone = (customer: CrmCustomer) => (customer.source === 'wix' ? customer.contact : null)
const formatPhone = (digits: string) =>
    digits.length === 11 ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}` : digits

// Lista mostra a soma; o split fica na sub-linha e na interna.
const combinedSpent = (customer: CrmCustomer) => customer.total_spent + customer.wix_spent
const combinedOrders = (customer: CrmCustomer) => customer.orders_count + customer.wix_orders

// Cards de segmento seguem a ordem de prioridade das campanhas.
const segmentCards = computed(() =>
    CAMPAIGN_OPTIONS.map((option) => ({
        ...option,
        count: segments.value[option.value] ?? 0,
        meta: campaignMeta(option.value),
    })),
)

const fetchCustomers = async (page: number) => {
    loading.value = true
    try {
        const { data } = await adminService.getCrmCustomers({
            page,
            limit,
            search: search.value || undefined,
            campaign: campaignFilter.value || undefined,
            hero: heroFilter.value || undefined,
            source: sourceFilter.value || undefined,
            sort: sortFilter.value,
        })
        customers.value = data.data
        segments.value = data.segments
        sources.value = data.sources
        totalPages.value = data.pages
        totalItems.value = data.total
        currentPage.value = data.page
    } catch (error) {
        console.error('Erro ao buscar clientes:', error)
    } finally {
        loading.value = false
    }
}

const fetchHeroes = async () => {
    try {
        const { data } = await adminService.getDotaHeroes()
        heroes.value = data
    } catch (error) {
        console.error('Erro ao buscar heróis:', error)
    }
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null
const onSearchInput = () => {
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => fetchCustomers(1), 250)
}
const onFilterChange = () => fetchCustomers(1)

const toggleSegment = (campaign: CrmCampaign) => {
    campaignFilter.value = campaignFilter.value === campaign ? '' : campaign
    fetchCustomers(1)
}

// Linha só-Wix não tem usuário: tudo que existe dela já está na própria linha.
const openCustomer = (customer: CrmCustomer) => {
    if (!customer.id) return

    router.push(`/crm/${customer.id}`)
}

const onImportWix = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    importing.value = true
    try {
        const { data } = await adminService.importWixCustomers(file)
        toast.success(`Wix: ${data.imported} clientes importados, ${data.matched} com conta no Secret, ${data.wix_only} só Wix.`)
        fetchCustomers(1)
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao importar CSV do Wix.')
    } finally {
        importing.value = false
    }
}

const nextPage = () => { if (currentPage.value < totalPages.value) fetchCustomers(currentPage.value + 1) }
const prevPage = () => { if (currentPage.value > 1) fetchCustomers(currentPage.value - 1) }

onMounted(() => {
    fetchCustomers(1)
    fetchHeroes()
})
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">CRM · Campanhas</h1>
                <p class="page-subtitle">{{ totalItems }} clientes · gasto, recência, heróis e a campanha que faz sentido pra cada um</p>
            </div>
            <label class="btn-import" :class="{ disabled: importing }" title="CSV 'Vendas por cliente' exportado do Wix. Substitui o import anterior.">
                <Icon :icon="importing ? 'mdi:loading' : 'mdi:upload'" :class="{ spin: importing }" />
                {{ importing ? 'Importando...' : 'Importar CSV do Wix' }}
                <input type="file" accept=".csv,text/csv" hidden :disabled="importing" @change="onImportWix" />
            </label>
        </header>

        <div class="segments">
            <button
                v-for="card in segmentCards"
                :key="card.value"
                class="segment-card"
                :class="{ active: campaignFilter === card.value }"
                :style="{ '--accent': card.meta.color }"
                :title="card.meta.hint"
                @click="toggleSegment(card.value)"
            >
                <Icon :icon="card.meta.icon" class="segment-icon" />
                <span class="segment-count">{{ card.count }}</span>
                <span class="segment-label">{{ card.label }}</span>
            </button>
        </div>

        <div class="filters-row">
            <div class="search-wrap">
                <Icon icon="mdi:magnify" class="search-icon" />
                <input
                    v-model="search"
                    @input="onSearchInput"
                    type="search"
                    placeholder="Buscar por nome, e-mail ou Steam ID..."
                    class="search-input"
                />
            </div>
            <select v-model="sourceFilter" @change="onFilterChange" class="filter-select">
                <option value="">Todos os clientes</option>
                <option v-for="opt in SOURCE_OPTIONS" :key="opt.value" :value="opt.value">{{ sourceLabel(opt) }}</option>
            </select>
            <select v-model="campaignFilter" @change="onFilterChange" class="filter-select">
                <option value="">Todas as campanhas</option>
                <option v-for="opt in CAMPAIGN_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <select v-model="heroFilter" @change="onFilterChange" class="filter-select">
                <option value="">Todos os heróis</option>
                <option v-for="hero in heroes" :key="hero.name" :value="hero.name">{{ hero.name }}</option>
            </select>
            <select v-model="sortFilter" @change="onFilterChange" class="filter-select">
                <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
        </div>

        <div class="section">
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Gasto</th>
                            <th>Compras</th>
                            <th>Última compra</th>
                            <th>Preferência</th>
                            <th>Campanha recomendada</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <template v-if="loading">
                            <tr v-for="n in limit" :key="n" class="skeleton-row">
                                <td>
                                    <div class="user-cell">
                                        <div class="skeleton skeleton-avatar" />
                                        <div>
                                            <div class="skeleton skeleton-line" style="width: 110px" />
                                            <div class="skeleton skeleton-line" style="width: 60px; margin-top: 4px" />
                                        </div>
                                    </div>
                                </td>
                                <td><div class="skeleton skeleton-line" style="width: 80px" /></td>
                                <td><div class="skeleton skeleton-line" style="width: 40px" /></td>
                                <td><div class="skeleton skeleton-line" style="width: 90px" /></td>
                                <td><div class="skeleton skeleton-line" style="width: 140px" /></td>
                                <td><div class="skeleton skeleton-line" style="width: 130px" /></td>
                                <td><div class="skeleton skeleton-line" style="width: 40px" /></td>
                            </tr>
                        </template>
                        <template v-else>
                            <tr
                                v-for="(customer, index) in customers"
                                :key="customer.id ?? `wix-${index}`"
                                :class="customer.id ? 'clickable-row' : 'static-row'"
                                @click="openCustomer(customer)"
                            >
                                <td>
                                    <div class="user-cell">
                                        <img v-if="customer.avatar" :src="customer.avatar" class="user-avatar" alt="" />
                                        <div v-else class="user-avatar-placeholder"><Icon :icon="customer.source === 'wix' ? 'mdi:store-outline' : 'mdi:account'" /></div>
                                        <div>
                                            <span class="user-name">
                                                <template v-if="isUnknownWix(customer)">
                                                    Sem cliente
                                                    <Icon icon="mdi:information-outline" class="info-icon" :title="UNKNOWN_HINT" />
                                                </template>
                                                <template v-else>{{ customer.username || '—' }}</template>
                                                <span v-if="SOURCE_BADGE[customer.source]" class="source-badge" :class="customer.source" :title="SOURCE_BADGE[customer.source]!.hint">
                                                    {{ SOURCE_BADGE[customer.source]!.label }}
                                                </span>
                                            </span>
                                            <small class="user-sub">
                                                {{ customer.tier_name || 'Loja antiga' }} · {{ customer.email || customer.steam_id || (wixPhone(customer) ? '' : '—') }}
                                                <a v-if="wixPhone(customer)" :href="`https://wa.me/55${wixPhone(customer)}`" target="_blank" rel="noopener" class="wa-link" @click.stop>
                                                    <Icon icon="mdi:whatsapp" /> {{ formatPhone(wixPhone(customer)!) }}
                                                </a>
                                            </small>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span class="spent">{{ formatCurrency(combinedSpent(customer)) }}</span>
                                    <small v-if="customer.wix_orders && customer.orders_count" class="cell-sub">Secret {{ formatCurrency(customer.total_spent) }} · Wix {{ formatCurrency(customer.wix_spent) }}</small>
                                    <small v-else-if="customer.wix_refunded" class="cell-sub">reembolsado {{ formatCurrency(customer.wix_refunded) }}</small>
                                    <small v-else-if="customer.orders_count" class="cell-sub">ticket {{ formatCurrency(customer.avg_ticket) }}</small>
                                </td>
                                <td>
                                    <span class="count-badge">{{ combinedOrders(customer) }}</span>
                                    <small v-if="customer.wix_orders && customer.orders_count" class="cell-sub">{{ customer.orders_count }} Secret · {{ customer.wix_orders }} Wix</small>
                                    <small v-else-if="customer.avg_days_between_orders != null" class="cell-sub">a cada {{ customer.avg_days_between_orders }}d</small>
                                </td>
                                <td>
                                    <span :class="{ muted: customer.days_since_last_purchase == null }">{{ daysLabel(customer.days_since_last_purchase) }}</span>
                                    <small v-if="customer.last_purchase_at" class="cell-sub">{{ $dayjs(customer.last_purchase_at).format('DD/MM/YYYY') }}</small>
                                </td>
                                <td>
                                    <div v-if="customer.heroes.length" class="hero-chips">
                                        <span v-for="hero in customer.heroes" :key="hero.hero_name" class="hero-chip">{{ hero.hero_name }}</span>
                                    </div>
                                    <span v-else class="muted">—</span>
                                </td>
                                <td>
                                    <template v-if="customer.campaign">
                                        <span class="campaign-badge" :style="{ '--accent': campaignMeta(customer.campaign).color }">
                                            <Icon :icon="campaignMeta(customer.campaign).icon" />
                                            {{ campaignMeta(customer.campaign).label }}
                                        </span>
                                        <small class="cell-sub">{{ campaignReason(customer) }}</small>
                                    </template>
                                    <template v-else>
                                        <span class="muted">—</span>
                                        <small class="cell-sub">sem conta no Secret</small>
                                    </template>
                                </td>
                                <td>
                                    <button v-if="customer.id" class="btn-view" @click.stop="openCustomer(customer)">Ver</button>
                                </td>
                            </tr>
                            <tr v-if="customers.length === 0">
                                <td colspan="7" class="empty-state">Nenhum cliente encontrado.</td>
                            </tr>
                        </template>
                    </tbody>
                </table>
            </div>

            <div class="pagination" v-if="!loading && totalPages > 1">
                <button class="page-btn" :disabled="currentPage === 1" @click="prevPage">Anterior</button>
                <span class="page-info">Página {{ currentPage }} de {{ totalPages }}</span>
                <button class="page-btn" :disabled="currentPage === totalPages" @click="nextPage">Próxima</button>
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
    margin-bottom 1.5rem

.btn-import
    display inline-flex
    align-items center
    gap 0.4rem
    background #2a2a30
    color #fff
    border 1px solid rgba(255,255,255,0.1)
    padding 0.5rem 1rem
    border-radius 8px
    font-size 0.85rem
    cursor pointer
    transition all 0.2s
    white-space nowrap

    &:hover
        background #3a3a42

    &.disabled
        opacity 0.6
        cursor wait

.spin
    animation spin 1s linear infinite

@keyframes spin
    to
        transform rotate(360deg)

.source-badge
    display inline-block
    margin-left 0.4rem
    padding 1px 7px
    border-radius 999px
    font-size 0.68rem
    font-weight 600
    vertical-align middle
    cursor help

    &.wix
        background rgba(251,146,60,0.15)
        color #fb923c

    &.both
        background rgba(74,222,128,0.15)
        color #4ade80

.info-icon
    color #94a3b8
    font-size 0.95rem
    vertical-align middle
    cursor help

.static-row
    cursor default

.page-title
    font-size 1.8rem
    font-weight 700
    margin-bottom 0.25rem

.page-subtitle
    color #94a3b8
    font-size 0.9rem

.segments
    display grid
    grid-template-columns repeat(auto-fit, minmax(140px, 1fr))
    gap 0.75rem
    margin-bottom 1.25rem

.segment-card
    --accent #6366f1
    display flex
    flex-direction column
    align-items flex-start
    gap 0.2rem
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.06)
    border-left 3px solid var(--accent)
    border-radius 10px
    padding 0.85rem 1rem
    color #fff
    cursor pointer
    text-align left
    transition all 0.15s

    &:hover
        background #202026

    &.active
        background rgba(255,255,255,0.06)
        border-color var(--accent)

.segment-icon
    color var(--accent)
    font-size 1.1rem

.segment-count
    font-size 1.4rem
    font-weight 700
    line-height 1.1

.segment-label
    color #94a3b8
    font-size 0.78rem

.filters-row
    display flex
    align-items center
    gap 0.75rem
    flex-wrap wrap
    margin-bottom 1.25rem

.search-wrap
    position relative
    flex 1
    min-width 220px

.search-icon
    position absolute
    left 0.65rem
    top 50%
    transform translateY(-50%)
    color #64748b
    font-size 1rem
    pointer-events none

.search-input
    width 100%
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.5rem 0.75rem 0.5rem 2.1rem
    font-size 0.875rem
    outline none
    box-sizing border-box

    &::placeholder
        color #64748b

    &:focus
        border-color rgba(99,102,241,0.4)

.filter-select
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.5rem 0.75rem
    font-size 0.875rem
    outline none
    cursor pointer

    option
        background #1a1a1e

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

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
        vertical-align middle

.user-cell
    display flex
    align-items center
    gap 0.625rem

.user-avatar
    width 44px
    height 44px
    border-radius 50%
    object-fit cover

.user-avatar-placeholder
    width 44px
    height 44px
    border-radius 50%
    background rgba(255,255,255,0.06)
    display flex
    align-items center
    justify-content center
    color #64748b

.user-name
    display block
    font-weight 500

.user-sub
    display block
    color #64748b
    font-size 0.72rem
    max-width 340px
    overflow hidden
    text-overflow ellipsis
    white-space nowrap

.wa-link
    display inline-flex
    align-items center
    gap 0.25rem
    margin-left 0.35rem
    color #25d366
    text-decoration none

    &:hover
        text-decoration underline

.cell-sub
    display block
    color #64748b
    font-size 0.72rem
    margin-top 2px

.spent
    color #4caf50
    font-weight 600

.muted
    color #64748b

.count-badge
    background rgba(99,102,241,0.12)
    color #818cf8
    padding 2px 8px
    border-radius 4px
    font-size 0.8rem
    font-weight 600

.hero-chips
    display flex
    flex-wrap wrap
    gap 0.3rem

.hero-chip
    background rgba(255,255,255,0.06)
    border 1px solid rgba(255,255,255,0.08)
    color #e2e8f0
    padding 2px 8px
    border-radius 999px
    font-size 0.74rem
    white-space nowrap

.campaign-badge
    --accent #6366f1
    display inline-flex
    align-items center
    gap 0.35rem
    padding 3px 9px
    border-radius 6px
    font-size 0.76rem
    font-weight 600
    color var(--accent)
    background rgba(255,255,255,0.06)
    white-space nowrap

.clickable-row
    cursor pointer
    transition background 0.15s
    &:hover
        background rgba(255,255,255,0.04)

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

.skeleton
    background linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)
    background-size 200% 100%
    border-radius 4px
    animation skeleton-shimmer 1.4s infinite

.skeleton-avatar
    width 44px
    height 44px
    border-radius 50%
    flex-shrink 0

.skeleton-line
    height 12px

@keyframes skeleton-shimmer
    0%
        background-position 200% 0
    100%
        background-position -200% 0
</style>
