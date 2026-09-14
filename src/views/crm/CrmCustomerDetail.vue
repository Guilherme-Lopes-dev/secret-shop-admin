<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import { adminService, type CrmCustomerDetail, type CrmOrder } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { campaignMeta, campaignReason, daysLabel, daysSince } from '@/utils/campaigns'
import CatalogCard, { type CatalogItem } from '@/components/users/CatalogCard.vue'

const route = useRoute()
const router = useRouter()
const customer = ref<CrmCustomerDetail | null>(null)

type CartItem = CatalogItem & { id: string; quantity: number; unit_price: number; added_at: string | null }
type FavoriteItem = CatalogItem & { id: string; favorited_at: string }

// Carrinho e favoritos já saem prontos do perfil admin do usuário — mesma
// fonte da tela /users/:id, sem duplicar query no backend.
const cart = ref<CartItem[]>([])
const favorites = ref<FavoriteItem[]>([])

// Quanto está parado no carrinho, a preço de vitrine de hoje.
const cartTotal = computed(() => cart.value.reduce((total, item) => total + item.unit_price * item.quantity, 0))
const loading = ref(true)
const error = ref('')

const MONTHS = 12

const SOURCE_LABELS: Record<string, string> = { manual: 'Escolheu', opendota: 'Joga', purchases: 'Comprou' }
const sourceLabel = (source: string) => SOURCE_LABELS[source] ?? source

// Cada origem de pedido abre numa rota própria.
const ORDER_ORIGINS: Record<CrmOrder['kind'], { label: string; path: string; icon: string }> = {
    sale: { label: 'Skin', path: '/sales', icon: 'mdi:sword-cross' },
    collector: { label: 'Collector', path: '/collector-orders', icon: 'mdi:trophy-outline' },
    physical: { label: 'Físico', path: '/physical-orders', icon: 'mdi:package-variant-closed' },
}
const openOrder = (order: CrmOrder) => router.push(`${ORDER_ORIGINS[order.kind].path}/${order.id}`)

// WhatsApp: wa.me com só dígitos do telefone.
const whatsappHref = computed(() => {
    const digits = (customer.value?.contact || '').replace(/\D/g, '')
    return digits.length >= 10 ? `https://wa.me/${digits}` : null
})

const campaign = computed(() => (customer.value ? campaignMeta(customer.value.campaign) : null))

const formatDate = (date: string | null) => (date ? dayjs(date).format('DD/MM/YYYY') : '—')

// Últimos 12 meses sempre, do mais antigo pro mais novo — mês sem compra vira zero.
const monthlyBars = computed(() => {
    const byMonth = new Map(
        (customer.value?.monthly_spend ?? []).map((row) => [dayjs(row.month).format('YYYY-MM'), row]),
    )
    const months = Array.from({ length: MONTHS }, (_, index) => dayjs().subtract(MONTHS - 1 - index, 'month'))
    const rows = months.map((month) => {
        const found = byMonth.get(month.format('YYYY-MM'))
        return { label: month.format('MMM/YY'), spent: found?.spent ?? 0, orders: found?.orders ?? 0 }
    })
    const max = Math.max(1, ...rows.map((row) => row.spent))

    return rows.map((row) => ({ ...row, height: Math.round((row.spent / max) * 100) }))
})

const purchasedMax = computed(() => Math.max(1, ...(customer.value?.purchased_heroes ?? []).map((hero) => hero.items)))

const kpis = computed(() => {
    const data = customer.value
    if (!data) return []

    return [
        { label: 'Total gasto', value: formatCurrency(data.total_spent), icon: 'mdi:cash-multiple', tone: 'green' },
        { label: 'Compras', value: String(data.orders_count), icon: 'mdi:cart-outline' },
        { label: 'Ticket médio', value: formatCurrency(data.avg_ticket), icon: 'mdi:receipt-text-outline' },
        { label: 'Última compra', value: daysLabel(data.days_since_last_purchase), sub: formatDate(data.last_purchase_at), icon: 'mdi:clock-outline' },
        { label: 'Primeira compra', value: formatDate(data.first_purchase_at), icon: 'mdi:calendar-start' },
        { label: 'Frequência', value: data.avg_days_between_orders != null ? `a cada ${data.avg_days_between_orders} dias` : '—', icon: 'mdi:repeat' },
        { label: 'Carrinho', value: `${data.cart_items} item(ns)`, sub: data.cart_updated_at ? `mexeu ${daysLabel(daysSince(data.cart_updated_at))}` : '', icon: 'mdi:cart-heart' },
        { label: 'Cashback', value: formatCurrency(data.cashback_balance), icon: 'mdi:wallet-giftcard' },
    ]
})

const fetchCustomer = async () => {
    loading.value = true
    error.value = ''
    try {
        const uuid = route.params.uuid as string
        const [crm, profile] = await Promise.all([adminService.getCrmCustomer(uuid), adminService.getUserById(uuid)])
        customer.value = crm.data
        cart.value = profile.data?.cart ?? []
        favorites.value = profile.data?.favorites ?? []
    } catch (e: any) {
        error.value = e?.response?.data?.message || 'Erro ao carregar cliente.'
    } finally {
        loading.value = false
    }
}

onMounted(fetchCustomer)
</script>

<template>
    <div class="view-wrap">
        <button class="back-btn" @click="router.push('/crm')">
            <Icon icon="mdi:arrow-left" /> CRM
        </button>

        <div v-if="loading" class="state">Carregando...</div>
        <div v-else-if="error" class="state error">{{ error }}</div>

        <template v-else-if="customer && campaign">
            <header class="profile">
                <img v-if="customer.avatar" :src="customer.avatar" class="avatar" alt="" />
                <div v-else class="avatar avatar-placeholder"><Icon icon="mdi:account" /></div>
                <div class="profile-info">
                    <h1 class="name">{{ customer.username || '—' }} <span class="tier">{{ customer.tier_name }}</span></h1>
                    <div class="contacts">
                        <span v-if="customer.email"><Icon icon="mdi:email-outline" /> {{ customer.email }}</span>
                        <a v-if="whatsappHref" :href="whatsappHref" target="_blank" rel="noopener" class="wa"><Icon icon="mdi:whatsapp" /> {{ customer.contact }}</a>
                        <span v-else-if="customer.contact"><Icon icon="mdi:phone-outline" /> {{ customer.contact }}</span>
                        <span v-if="customer.steam_id"><Icon icon="mdi:steam" /> <code>{{ customer.steam_id }}</code></span>
                        <span><Icon icon="mdi:calendar-plus" /> cadastro {{ formatDate(customer.created_at) }}</span>
                    </div>
                </div>
                <button class="btn-secondary" @click="router.push(`/users/${customer.id}`)">
                    <Icon icon="mdi:account-details-outline" /> Perfil completo
                </button>
            </header>

            <section class="campaign-card" :style="{ '--accent': campaign.color }">
                <div class="campaign-head">
                    <Icon :icon="campaign.icon" class="campaign-icon" />
                    <div>
                        <small>Campanha recomendada</small>
                        <h2>{{ campaign.label }}</h2>
                        <p class="campaign-reason">{{ campaignReason(customer) }}</p>
                    </div>
                </div>
                <p class="campaign-hint">{{ campaign.hint }}</p>
            </section>

            <section class="kpis">
                <div v-for="kpi in kpis" :key="kpi.label" class="kpi" :class="kpi.tone">
                    <Icon :icon="kpi.icon" class="kpi-icon" />
                    <small>{{ kpi.label }}</small>
                    <strong>{{ kpi.value }}</strong>
                    <span v-if="kpi.sub" class="kpi-sub">{{ kpi.sub }}</span>
                </div>
            </section>

            <div class="two-col">
                <section class="section">
                    <h3 class="section-title"><Icon icon="mdi:star-outline" /> Heróis preferidos</h3>
                    <p class="section-sub">Soma de partidas ganhas (OpenDota), escolha no modal e compras.</p>
                    <ul v-if="customer.heroes.length" class="hero-list">
                        <li v-for="hero in customer.heroes" :key="hero.hero_name" class="hero-row">
                            <img v-if="hero.image" :src="hero.image" class="hero-img" alt="" />
                            <div v-else class="hero-img hero-img-placeholder"><Icon icon="mdi:account-question" /></div>
                            <div class="hero-main">
                                <span class="hero-name">{{ hero.hero_name }}</span>
                                <div class="hero-sources">
                                    <span v-for="source in hero.sources" :key="source" class="source-tag" :class="`source-${source}`">{{ sourceLabel(source) }}</span>
                                </div>
                            </div>
                            <span class="hero-score">{{ hero.score }}</span>
                        </li>
                    </ul>
                    <p v-else class="empty">Sem preferência registrada.</p>
                </section>

                <section class="section">
                    <h3 class="section-title"><Icon icon="mdi:cart-check" /> Heróis comprados</h3>
                    <p class="section-sub">O que ele já pagou, por herói (skin + collector).</p>
                    <ul v-if="customer.purchased_heroes.length" class="bought-list">
                        <li v-for="hero in customer.purchased_heroes" :key="hero.hero" class="bought-row">
                            <div class="bought-head">
                                <span class="hero-name">{{ hero.hero }}</span>
                                <span class="bought-meta">{{ hero.items }} item(ns) · {{ formatCurrency(hero.spent) }}</span>
                            </div>
                            <div class="bar"><div class="bar-fill" :style="{ width: `${(hero.items / purchasedMax) * 100}%` }" /></div>
                        </li>
                    </ul>
                    <p v-else class="empty">Nenhuma compra com herói.</p>
                </section>
            </div>

            <div class="two-col">
                <section class="section">
                    <h3 class="section-title">
                        <Icon icon="mdi:cart-outline" /> Carrinho <span class="count">{{ cart.length }}</span>
                        <span v-if="cart.length" class="section-note">{{ formatCurrency(cartTotal) }}</span>
                    </h3>
                    <p class="section-sub">O que está parado agora, a preço de vitrine de hoje.</p>
                    <div v-if="cart.length" class="catalog-grid">
                        <CatalogCard v-for="item in cart" :key="`${item.kind}-${item.id}`" :item="item">
                            · {{ item.quantity }}× {{ formatCurrency(item.unit_price) }}
                            · {{ daysLabel(daysSince(item.added_at)) }}
                        </CatalogCard>
                    </div>
                    <p v-else class="empty">Carrinho vazio.</p>
                </section>

                <section class="section">
                    <h3 class="section-title">
                        <Icon icon="mdi:heart-outline" /> Lista de desejos <span class="count">{{ favorites.length }}</span>
                    </h3>
                    <p class="section-sub">Favoritou mas não comprou — material de campanha.</p>
                    <div v-if="favorites.length" class="catalog-grid">
                        <CatalogCard v-for="item in favorites" :key="`${item.kind}-${item.id}`" :item="item">
                            · {{ item.hero || 'sem herói' }}
                            · {{ dayjs(item.favorited_at).format('DD/MM/YY') }}
                        </CatalogCard>
                    </div>
                    <p v-else class="empty">Lista de desejos vazia.</p>
                </section>
            </div>

            <section class="section">
                <h3 class="section-title"><Icon icon="mdi:chart-bar" /> Gasto mensal · últimos 12 meses</h3>
                <div class="months">
                    <div v-for="month in monthlyBars" :key="month.label" class="month" :title="`${month.orders} pedido(s) · ${formatCurrency(month.spent)}`">
                        <span class="month-value">{{ month.spent ? formatCurrency(month.spent) : '' }}</span>
                        <div class="month-bar"><div class="month-fill" :style="{ height: `${month.height}%` }" /></div>
                        <span class="month-label">{{ month.label }}</span>
                    </div>
                </div>
            </section>

            <section class="section">
                <h3 class="section-title"><Icon icon="mdi:history" /> Histórico de compras <span class="count">{{ customer.orders.length }}</span></h3>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Pedido</th>
                                <th>Origem</th>
                                <th>Itens</th>
                                <th>Valor</th>
                                <th>Data</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="order in customer.orders" :key="order.id" class="clickable-row" @click="openOrder(order)">
                                <td><code class="mono">{{ order.order_number }}</code></td>
                                <td><span class="origin"><Icon :icon="ORDER_ORIGINS[order.kind].icon" /> {{ ORDER_ORIGINS[order.kind].label }}</span></td>
                                <td class="items-cell">{{ order.items.join(', ') || '—' }}</td>
                                <td class="spent">{{ formatCurrency(order.total_amount) }}</td>
                                <td>{{ order.created_at ? dayjs(order.created_at).format('DD/MM/YYYY HH:mm') : '—' }}</td>
                            </tr>
                            <tr v-if="!customer.orders.length">
                                <td colspan="5" class="empty">Nenhuma compra paga.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </template>
    </div>
</template>

<style lang="stylus" scoped>
.view-wrap
    padding 2rem
    color #fff
    background #121214
    min-height 100vh

.back-btn
    display inline-flex
    align-items center
    gap 0.4rem
    background none
    border none
    color #94a3b8
    cursor pointer
    font-size 0.875rem
    margin-bottom 1.25rem
    padding 0

    &:hover
        color #fff

.state
    padding 3rem
    text-align center
    color #94a3b8

    &.error
        color #f87171

.profile
    display flex
    align-items center
    gap 1.25rem
    flex-wrap wrap
    margin-bottom 1.25rem

.avatar
    width 72px
    height 72px
    border-radius 50%
    object-fit cover

.avatar-placeholder
    background rgba(255,255,255,0.06)
    display flex
    align-items center
    justify-content center
    color #64748b
    font-size 2rem

.profile-info
    flex 1
    min-width 240px

.name
    font-size 1.6rem
    font-weight 700
    margin 0 0 0.35rem
    display flex
    align-items center
    gap 0.6rem

.tier
    font-size 0.72rem
    font-weight 600
    padding 2px 8px
    border-radius 4px
    background rgba(255,255,255,0.06)
    color #94a3b8
    text-transform uppercase

.contacts
    display flex
    flex-wrap wrap
    gap 0.4rem 1.1rem
    color #94a3b8
    font-size 0.85rem

    span, a
        display inline-flex
        align-items center
        gap 0.35rem

    code
        font-family monospace
        font-size 0.8rem

.wa
    color #4ade80
    text-decoration none

    &:hover
        text-decoration underline

.btn-secondary
    display inline-flex
    align-items center
    gap 0.4rem
    background rgba(99,102,241,0.1)
    color #818cf8
    border none
    padding 0.5rem 1rem
    border-radius 8px
    font-size 0.85rem
    font-weight 500
    cursor pointer

    &:hover
        background rgba(99,102,241,0.2)

.campaign-card
    --accent #6366f1
    background #1a1a1e
    border 1px solid var(--accent)
    border-left 4px solid var(--accent)
    border-radius 12px
    padding 1.25rem 1.5rem
    margin-bottom 1.25rem
    display flex
    align-items center
    justify-content space-between
    gap 1.5rem
    flex-wrap wrap

.campaign-head
    display flex
    align-items center
    gap 1rem

    small
        color #94a3b8
        font-size 0.75rem
        text-transform uppercase
        letter-spacing 0.04em

    h2
        margin 0.1rem 0
        font-size 1.4rem
        color var(--accent)

.campaign-icon
    font-size 2.4rem
    color var(--accent)

.campaign-reason
    margin 0
    color #e2e8f0
    font-size 0.9rem

.campaign-hint
    margin 0
    color #94a3b8
    font-size 0.85rem
    max-width 460px

.kpis
    display grid
    grid-template-columns repeat(auto-fit, minmax(150px, 1fr))
    gap 0.75rem
    margin-bottom 1.25rem

.kpi
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 10px
    padding 0.9rem 1rem
    display flex
    flex-direction column
    gap 0.15rem

    small
        color #64748b
        font-size 0.72rem
        text-transform uppercase

    strong
        font-size 1.05rem

    &.green strong
        color #4ade80

.kpi-icon
    color #6366f1
    font-size 1.1rem
    margin-bottom 0.2rem

.kpi-sub
    color #64748b
    font-size 0.72rem

.two-col
    display grid
    grid-template-columns repeat(auto-fit, minmax(320px, 1fr))
    gap 1.25rem
    margin-bottom 1.25rem

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)
    margin-bottom 1.25rem

.two-col .section
    margin-bottom 0

.section-title
    display flex
    align-items center
    gap 0.5rem
    font-size 1rem
    font-weight 600
    margin 0 0 0.25rem

.count
    background rgba(99,102,241,0.12)
    color #818cf8
    padding 1px 8px
    border-radius 999px
    font-size 0.75rem

.section-sub
    color #64748b
    font-size 0.8rem
    margin 0 0 1rem

.section-note
    margin-left auto
    color #4ade80
    font-size 0.85rem
    font-weight 600

.catalog-grid
    display grid
    grid-template-columns repeat(auto-fill, minmax(230px, 1fr))
    gap 0.6rem

.empty
    color #64748b
    font-size 0.85rem
    text-align center
    padding 1.5rem 0

.hero-list, .bought-list
    list-style none
    margin 0
    padding 0
    display flex
    flex-direction column
    gap 0.6rem

.hero-row
    display flex
    align-items center
    gap 0.75rem

.hero-img
    width 44px
    height 25px
    border-radius 4px
    object-fit cover
    flex-shrink 0

.hero-img-placeholder
    background rgba(255,255,255,0.06)
    display flex
    align-items center
    justify-content center
    color #64748b

.hero-main
    flex 1
    display flex
    flex-direction column
    gap 0.2rem

.hero-name
    font-weight 500
    font-size 0.9rem

.hero-sources
    display flex
    gap 0.3rem

.source-tag
    font-size 0.68rem
    padding 1px 6px
    border-radius 999px
    background rgba(148,163,184,0.1)
    color #94a3b8

.source-manual
    background rgba(167,139,250,0.15)
    color #a78bfa

.source-opendota
    background rgba(56,189,248,0.15)
    color #38bdf8

.source-purchases
    background rgba(74,222,128,0.15)
    color #4ade80

.hero-score
    font-weight 700
    color #818cf8

.bought-row
    display flex
    flex-direction column
    gap 0.3rem

.bought-head
    display flex
    justify-content space-between
    align-items baseline

.bought-meta
    color #64748b
    font-size 0.78rem

.bar
    height 6px
    background rgba(255,255,255,0.05)
    border-radius 3px
    overflow hidden

.bar-fill
    height 100%
    background #6366f1
    border-radius 3px

.months
    display grid
    grid-template-columns repeat(12, 1fr)
    gap 0.4rem
    align-items end
    height 160px

.month
    display flex
    flex-direction column
    align-items center
    justify-content flex-end
    height 100%
    gap 0.3rem

.month-value
    color #94a3b8
    font-size 0.62rem
    white-space nowrap
    height 12px

.month-bar
    width 100%
    flex 1
    display flex
    align-items flex-end
    background rgba(255,255,255,0.03)
    border-radius 4px

.month-fill
    width 100%
    background linear-gradient(180deg, #818cf8, #6366f1)
    border-radius 4px
    min-height 2px

.month-label
    color #64748b
    font-size 0.68rem

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
        padding 0.75rem
        border-bottom 1px solid rgba(255,255,255,0.05)
        white-space nowrap
        text-transform uppercase

    td
        padding 0.8rem 0.75rem
        font-size 0.875rem
        border-bottom 1px solid rgba(255,255,255,0.04)
        vertical-align middle

.mono
    font-family monospace
    font-size 0.8rem
    color #94a3b8

.origin
    display inline-flex
    align-items center
    gap 0.35rem
    color #e2e8f0
    font-size 0.82rem

.items-cell
    color #cbd5e1
    max-width 420px

.spent
    color #4ade80
    font-weight 600

.clickable-row
    cursor pointer
    transition background 0.15s

    &:hover
        background rgba(255,255,255,0.04)
</style>
