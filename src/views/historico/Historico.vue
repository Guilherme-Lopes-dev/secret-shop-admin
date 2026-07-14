<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { adminService } from '@/services/admin/admin.service'
import { toast } from 'vue3-toastify'

type TradeItem = {
    assetId: string
    newAssetId: string | null
    classId: string
    instanceId: string
    appId: number
    contextId: string
    amount: number
    name: string | null
    marketHashName: string | null
    iconUrl: string | null
}

type TradeEntry = {
    tradeId: string
    steamIdOther: string
    timeInit: number
    tradeOfferId: string | null
    status: number
    assetsReceived: TradeItem[]
    assetsGiven: TradeItem[]
}

const CACHE_PREFIX = 'steam_trade_history_key_'
const PAGE_SIZE = 25

const apiKeyInput = ref('')
const loadedKeyLabel = ref('')
const activeApiKey = ref('')
const trades = ref<TradeEntry[]>([])
const rawDebugResponse = ref<string | null>(null)
const debugUrl = ref<string | null>(null)
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(false)
const lastTradeId = ref<string | null>(null)
const cacheTimestamp = ref<number | null>(null)

const searchItem = ref('')
const searchTradeId = ref('')
const directionFilter = ref<'all' | 'received' | 'given'>('all')
const statusFilter = ref('')
const currentPage = ref(1)

function keyLabel(key: string) {
    if (key.length <= 8) return key
    return `${key.slice(0, 4)}...${key.slice(-4)}`
}

function cacheId(key: string) {
    return key.trim().toLowerCase()
}

const TRADE_STATUS_LABELS: Record<number, string> = {
    1: 'Iniciado',
    2: 'Aguardando',
    3: 'Concluído',
    4: 'Envio falhou',
    5: 'Parcialmente concluído',
    6: 'Cancelado',
    7: 'Cancelado (expirado)',
    8: 'Revertido',
    9: 'Em escrow',
    10: 'Bloqueado por escrow',
    11: 'Falha no rollback',
    12: 'Inativo',
    13: 'Email inválido',
    14: 'Expirado',
}

const statusOptions = [
    { label: 'Todos status', value: '' },
    ...Object.entries(TRADE_STATUS_LABELS).map(([v, l]) => ({ label: l, value: v })),
]

const storageKey = (key: string) => `${CACHE_PREFIX}${cacheId(key)}`

function loadFromCache(key: string): { trades: TradeEntry[]; timestamp: number; more: boolean; lastTradeId: string | null } | null {
    try {
        const raw = localStorage.getItem(storageKey(key))
        if (!raw) return null
        return JSON.parse(raw)
    } catch {
        return null
    }
}

function saveToCache(key: string, data: TradeEntry[], more: boolean, lastId: string | null) {
    try {
        localStorage.setItem(
            storageKey(key),
            JSON.stringify({ trades: data, timestamp: Date.now(), more, lastTradeId: lastId }),
        )
    } catch {
        // localStorage full or unavailable
    }
}

function clearCache() {
    if (!activeApiKey.value) return
    localStorage.removeItem(storageKey(activeApiKey.value))
    trades.value = []
    hasMore.value = false
    lastTradeId.value = null
    cacheTimestamp.value = null
    activeApiKey.value = ''
    loadedKeyLabel.value = ''
    toast.info('Cache limpo.')
}

async function fetchHistory(force = false) {
    const key = apiKeyInput.value.trim()
    if (!key) return

    if (!force) {
        const cached = loadFromCache(key)
        if (cached) {
            trades.value = cached.trades
            hasMore.value = cached.more
            lastTradeId.value = cached.lastTradeId
            cacheTimestamp.value = cached.timestamp
            activeApiKey.value = key
            loadedKeyLabel.value = keyLabel(key)
            currentPage.value = 1
            return
        }
    }

    loading.value = true
    try {
        const res = await adminService.getSteamTradeHistory(key)
        const data = res.data
        trades.value = data.trades ?? []
        hasMore.value = data.more ?? false
        lastTradeId.value = data.lastTradeId ?? null
        rawDebugResponse.value = data.rawResponse ?? null
        debugUrl.value = data.debugUrl ?? null
        activeApiKey.value = key
        loadedKeyLabel.value = keyLabel(key)
        cacheTimestamp.value = Date.now()
        currentPage.value = 1
        saveToCache(key, trades.value, hasMore.value, lastTradeId.value)
        toast.success(`${trades.value.length} trades carregados.`)
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao buscar histórico.')
    } finally {
        loading.value = false
    }
}

async function loadMore() {
    if (!lastTradeId.value || !activeApiKey.value) return
    loadingMore.value = true
    try {
        const res = await adminService.getSteamTradeHistory(activeApiKey.value, lastTradeId.value)
        const data = res.data
        const newTrades = data.trades ?? []
        trades.value = [...trades.value, ...newTrades]
        hasMore.value = data.more ?? false
        lastTradeId.value = data.lastTradeId ?? null
        cacheTimestamp.value = Date.now()
        saveToCache(activeApiKey.value, trades.value, hasMore.value, lastTradeId.value)
        toast.success(`+${newTrades.length} trades carregados.`)
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao carregar mais.')
    } finally {
        loadingMore.value = false
    }
}

const filteredTrades = computed(() => {
    const q = searchItem.value.trim().toLowerCase()
    const tradeIdQ = searchTradeId.value.trim().toLowerCase()
    const status = statusFilter.value

    return trades.value.filter((t) => {
        if (status && String(t.status) !== status) return false

        const hasReceived = t.assetsReceived.length > 0
        const hasGiven = t.assetsGiven.length > 0
        if (directionFilter.value === 'received' && !hasReceived) return false
        if (directionFilter.value === 'given' && !hasGiven) return false

        if (tradeIdQ && !t.tradeId.toLowerCase().includes(tradeIdQ) && !(t.tradeOfferId?.toLowerCase().includes(tradeIdQ))) return false

        if (!q) return true

        const allItems = [...t.assetsReceived, ...t.assetsGiven]
        return allItems.some(
            (item) =>
                item.name?.toLowerCase().includes(q) ||
                item.marketHashName?.toLowerCase().includes(q),
        )
    })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredTrades.value.length / PAGE_SIZE)))

const paginatedTrades = computed(() => {
    const start = (currentPage.value - 1) * PAGE_SIZE
    return filteredTrades.value.slice(start, start + PAGE_SIZE)
})

watch([searchItem, searchTradeId, directionFilter, statusFilter], () => {
    currentPage.value = 1
})

const prevPage = () => { if (currentPage.value > 1) currentPage.value-- }
const nextPage = () => { if (currentPage.value < totalPages.value) currentPage.value++ }

function formatDate(unix: number) {
    return new Date(unix * 1000).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function formatCacheAge(ts: number) {
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'agora'
    if (mins < 60) return `${mins}min atrás`
    return `${Math.floor(mins / 60)}h atrás`
}

function statusClass(status: number) {
    if (status === 3) return 'status-completed'
    if ([1, 2, 9, 10].includes(status)) return 'status-pending'
    return 'status-canceled'
}

function directionLabel(trade: TradeEntry) {
    const r = trade.assetsReceived.length
    const g = trade.assetsGiven.length
    if (r > 0 && g > 0) return 'Troca'
    if (r > 0) return 'Recebido'
    if (g > 0) return 'Enviado'
    return '—'
}

function directionClass(trade: TradeEntry) {
    const r = trade.assetsReceived.length
    const g = trade.assetsGiven.length
    if (r > 0 && g > 0) return 'dir-both'
    if (r > 0) return 'dir-received'
    if (g > 0) return 'dir-given'
    return ''
}

function itemsLabel(items: TradeItem[]) {
    if (items.length === 0) return '—'
    const names = items.slice(0, 2).map(i => i.name || i.marketHashName || 'Item').join(', ')
    return items.length > 2 ? `${names} +${items.length - 2}` : names
}
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Histórico Steam</h1>
                <p class="page-subtitle">Histórico de trocas por conta Steam64</p>
            </div>
        </header>

        <div class="search-bar-section">
            <input
                v-model="apiKeyInput"
                class="steam-input"
                type="text"
                placeholder="Steam Web API Key (32 chars)"
                autocomplete="off"
                spellcheck="false"
                @keydown.enter="fetchHistory()"
            />
            <span class="key-len" :class="{ ok: apiKeyInput.trim().length === 32, warn: apiKeyInput.trim().length > 0 && apiKeyInput.trim().length !== 32 }">
                {{ apiKeyInput.trim().length }}/32
            </span>
            <button class="btn-primary" :disabled="loading || !apiKeyInput.trim()" @click="fetchHistory()">
                <Icon v-if="loading" icon="mdi:loading" class="spin" />
                <Icon v-else icon="mdi:magnify" />
                Buscar
            </button>
            <button class="btn-refresh" :disabled="loading || !apiKeyInput.trim()" @click="fetchHistory(true)" title="Recarregar ignorando cache">
                <Icon icon="mdi:refresh" />
            </button>
            <button v-if="activeApiKey" class="btn-danger-ghost" @click="clearCache" title="Limpar cache">
                <Icon icon="mdi:trash-can-outline" />
                Limpar cache
            </button>
        </div>

        <div v-if="rawDebugResponse || debugUrl" class="debug-block">
            <div class="debug-header">
                <span>Debug</span>
                <button class="debug-close" @click="rawDebugResponse = null; debugUrl = null">✕</button>
            </div>
            <div v-if="debugUrl" class="debug-url">
                <span class="debug-label">URL</span>
                <code>{{ debugUrl }}</code>
            </div>
            <div class="debug-url">
                <span class="debug-label">Trades</span>
                <code>{{ trades.length }} recebidas</code>
            </div>
            <div v-if="rawDebugResponse" class="debug-label" style="padding: 0.4rem 0.75rem 0.2rem">Response</div>
            <pre v-if="rawDebugResponse" class="debug-pre">{{ rawDebugResponse }}</pre>
        </div>

        <div v-if="cacheTimestamp && loadedKeyLabel" class="cache-info">
            <Icon icon="mdi:database-outline" />
            {{ trades.length }} trades em cache para key <code>{{ loadedKeyLabel }}</code>
            — atualizado {{ formatCacheAge(cacheTimestamp) }}
        </div>

        <div v-if="trades.length > 0" class="section">
            <div class="filters-row">
                <input
                    v-model="searchItem"
                    type="search"
                    class="filter-input"
                    placeholder="Filtrar por nome do item..."
                />
                <input
                    v-model="searchTradeId"
                    type="search"
                    class="filter-input filter-input--id"
                    placeholder="Trade ID ou Offer ID..."
                    spellcheck="false"
                />
                <select v-model="directionFilter" class="filter-select">
                    <option value="all">Todos</option>
                    <option value="received">Recebidos</option>
                    <option value="given">Enviados</option>
                </select>
                <select v-model="statusFilter" class="filter-select">
                    <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
                <span class="results-count">{{ filteredTrades.length }} resultados</span>
            </div>

            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Data</th>
                            <th>Tipo</th>
                            <th>Parceiro Steam64</th>
                            <th>Itens recebidos</th>
                            <th>Itens enviados</th>
                            <th>Status</th>
                            <th>Trade ID</th>
                        </tr>
                    </thead>
                    <tbody>
                        <template v-for="(trade, idx) in paginatedTrades" :key="trade.tradeId">
                            <tr class="trade-row">
                                <td class="muted">{{ (currentPage - 1) * PAGE_SIZE + idx + 1 }}</td>
                                <td class="nowrap">{{ formatDate(trade.timeInit) }}</td>
                                <td>
                                    <span class="dir-badge" :class="directionClass(trade)">
                                        {{ directionLabel(trade) }}
                                    </span>
                                </td>
                                <td><code class="mono">{{ trade.steamIdOther }}</code></td>
                                <td>
                                    <div class="items-cell">
                                        <div v-if="trade.assetsReceived.length === 0" class="muted">—</div>
                                        <div v-else class="items-preview">
                                            <template v-for="item in trade.assetsReceived.slice(0, 4)" :key="item.assetId">
                                                <img
                                                    v-if="item.iconUrl"
                                                    :src="item.iconUrl"
                                                    :title="item.name || item.marketHashName || ''"
                                                    class="item-icon"
                                                />
                                            </template>
                                            <span class="items-names">{{ itemsLabel(trade.assetsReceived) }}</span>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div class="items-cell">
                                        <div v-if="trade.assetsGiven.length === 0" class="muted">—</div>
                                        <div v-else class="items-preview">
                                            <template v-for="item in trade.assetsGiven.slice(0, 4)" :key="item.assetId">
                                                <img
                                                    v-if="item.iconUrl"
                                                    :src="item.iconUrl"
                                                    :title="item.name || item.marketHashName || ''"
                                                    class="item-icon"
                                                />
                                            </template>
                                            <span class="items-names">{{ itemsLabel(trade.assetsGiven) }}</span>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span class="status-badge" :class="statusClass(trade.status)">
                                        {{ TRADE_STATUS_LABELS[trade.status] || `Status ${trade.status}` }}
                                    </span>
                                </td>
                                <td><code class="mono small">{{ trade.tradeId }}</code></td>
                            </tr>
                        </template>
                        <tr v-if="paginatedTrades.length === 0">
                            <td colspan="8" class="empty-state">Nenhum trade encontrado com esses filtros.</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="pagination-row">
                <button class="page-btn" :disabled="currentPage === 1" @click="prevPage">Anterior</button>
                <span class="page-info">Página {{ currentPage }} de {{ totalPages }}</span>
                <button class="page-btn" :disabled="currentPage === totalPages" @click="nextPage">Próxima</button>

                <button
                    v-if="hasMore"
                    class="btn-load-more"
                    :disabled="loadingMore"
                    @click="loadMore"
                >
                    <Icon v-if="loadingMore" icon="mdi:loading" class="spin" />
                    {{ loadingMore ? 'Carregando...' : 'Carregar mais 100 trades' }}
                </button>
            </div>
        </div>

        <div v-else-if="!loading && activeApiKey" class="empty-full">
            <Icon icon="mdi:history" class="empty-icon" />
            <p>Nenhum trade encontrado para essa conta.</p>
        </div>

        <div v-else-if="loading" class="empty-full">
            <Icon icon="mdi:loading" class="spin empty-icon" />
            <p>Buscando histórico na Steam...</p>
        </div>

        <div v-else class="empty-full hint">
            <Icon icon="mdi:steam" class="empty-icon" />
            <p>Cole sua Steam Web API Key e clique em Buscar.</p>
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
    margin-bottom 0.25rem

.page-subtitle
    color #94a3b8
    font-size 0.9rem

.search-bar-section
    display flex
    gap 0.75rem
    align-items center
    flex-wrap wrap
    margin-bottom 0.75rem

.steam-input
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.55rem 0.9rem
    font-size 0.9rem
    outline none
    width 320px
    font-family monospace
    letter-spacing 0.04em
    font-family monospace

    &::placeholder
        color #64748b

    &:focus
        border-color rgba(99,102,241,0.4)

.key-len
    font-size 0.78rem
    font-family monospace
    color #64748b

    &.ok
        color #4ade80

    &.warn
        color #fb923c

.btn-primary
    background #6366f1
    color #fff
    border none
    border-radius 8px
    padding 0.55rem 1.1rem
    font-size 0.875rem
    font-weight 600
    cursor pointer
    display flex
    align-items center
    gap 0.4rem
    transition background 0.15s

    &:hover:not(:disabled)
        background #5254cc

    &:disabled
        opacity 0.45
        cursor not-allowed

.btn-refresh
    background #1a1a1e
    color #94a3b8
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    padding 0.55rem 0.7rem
    cursor pointer
    display flex
    align-items center
    font-size 1.1rem
    transition all 0.15s

    &:hover:not(:disabled)
        color #fff
        border-color rgba(99,102,241,0.3)

    &:disabled
        opacity 0.45
        cursor not-allowed

.btn-danger-ghost
    background transparent
    color #f87171
    border 1px solid rgba(248,113,113,0.3)
    border-radius 8px
    padding 0.5rem 0.9rem
    font-size 0.85rem
    cursor pointer
    display flex
    align-items center
    gap 0.4rem
    transition all 0.15s

    &:hover
        background rgba(248,113,113,0.08)

.debug-block
    background #0d1117
    border 1px solid rgba(99,102,241,0.3)
    border-radius 8px
    margin-bottom 1rem
    overflow hidden

.debug-header
    display flex
    justify-content space-between
    align-items center
    padding 0.5rem 0.75rem
    background rgba(99,102,241,0.08)
    font-size 0.78rem
    color #818cf8
    font-weight 600

.debug-close
    background transparent
    border none
    color #64748b
    cursor pointer
    font-size 0.9rem
    padding 0
    line-height 1

    &:hover
        color #fff

.debug-url
    display flex
    align-items flex-start
    gap 0.5rem
    padding 0.5rem 0.75rem
    border-bottom 1px solid rgba(255,255,255,0.05)

    code
        font-size 0.72rem
        color #94a3b8
        word-break break-all
        font-family monospace

.debug-label
    font-size 0.7rem
    color #6366f1
    font-weight 700
    text-transform uppercase
    letter-spacing 0.05em
    flex-shrink 0

.debug-pre
    margin 0
    padding 0.75rem
    font-size 0.72rem
    color #94a3b8
    font-family monospace
    overflow-x auto
    max-height 300px
    overflow-y auto
    white-space pre-wrap
    word-break break-all

.cache-info
    display flex
    align-items center
    gap 0.4rem
    font-size 0.8rem
    color #64748b
    margin-bottom 1.25rem

    code
        color #94a3b8
        font-size 0.8rem

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.filters-row
    display flex
    gap 0.75rem
    align-items center
    flex-wrap wrap
    margin-bottom 1.25rem

.filter-input
    background #121214
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.5rem 0.75rem
    font-size 0.875rem
    outline none
    min-width 220px

    &::placeholder
        color #64748b

    &:focus
        border-color rgba(99,102,241,0.4)

    &--id
        min-width 180px
        font-family monospace
        font-size 0.8rem

.filter-select
    background #121214
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.5rem 0.75rem
    font-size 0.875rem
    outline none
    cursor pointer

    option
        background #121214

.results-count
    color #64748b
    font-size 0.8rem
    margin-left auto

.table-wrapper
    overflow-x auto
    margin-bottom 1.25rem

table
    width 100%
    border-collapse collapse

    th
        text-align left
        color #64748b
        font-size 0.72rem
        font-weight 600
        padding 0.65rem 0.75rem
        border-bottom 1px solid rgba(255,255,255,0.05)
        white-space nowrap
        text-transform uppercase
        letter-spacing 0.04em

    td
        padding 0.75rem
        font-size 0.85rem
        border-bottom 1px solid rgba(255,255,255,0.04)
        vertical-align middle

.trade-row
    &:hover td
        background rgba(255,255,255,0.02)

.muted
    color #64748b

.nowrap
    white-space nowrap

.mono
    font-family monospace
    font-size 0.78rem
    color #94a3b8

    &.small
        font-size 0.72rem

.dir-badge
    padding 2px 8px
    border-radius 4px
    font-size 0.72rem
    font-weight 600
    text-transform uppercase

.dir-received
    background rgba(74,222,128,0.1)
    color #4ade80

.dir-given
    background rgba(251,146,60,0.1)
    color #fb923c

.dir-both
    background rgba(99,102,241,0.12)
    color #818cf8

.items-cell
    max-width 280px

.items-preview
    display flex
    flex-direction column
    gap 0.25rem

.item-icon
    width 28px
    height 28px
    border-radius 4px
    object-fit contain
    background rgba(255,255,255,0.04)
    display inline-block
    margin-right 2px

.items-names
    font-size 0.78rem
    color #94a3b8
    white-space nowrap
    overflow hidden
    text-overflow ellipsis
    max-width 260px
    display block

.status-badge
    padding 3px 8px
    border-radius 4px
    font-size 0.72rem
    font-weight 600
    white-space nowrap

.status-completed
    background rgba(74,222,128,0.1)
    color #4ade80

.status-pending
    background rgba(251,146,60,0.1)
    color #fb923c

.status-canceled
    background rgba(248,113,113,0.1)
    color #f87171

.empty-state
    text-align center
    padding 3rem
    color #64748b

.pagination-row
    display flex
    align-items center
    gap 1rem
    flex-wrap wrap
    padding-top 1rem
    border-top 1px solid rgba(255,255,255,0.05)

.page-btn
    background #2a2a30
    color #fff
    border 1px solid rgba(255,255,255,0.08)
    padding 0.45rem 1rem
    border-radius 6px
    cursor pointer
    font-size 0.85rem
    transition all 0.15s

    &:hover:not(:disabled)
        background #3a3a42

    &:disabled
        opacity 0.4
        cursor not-allowed

.page-info
    color #64748b
    font-size 0.85rem

.btn-load-more
    margin-left auto
    background #1e1e28
    color #818cf8
    border 1px solid rgba(99,102,241,0.3)
    border-radius 8px
    padding 0.5rem 1.1rem
    font-size 0.85rem
    cursor pointer
    display flex
    align-items center
    gap 0.4rem
    transition all 0.15s

    &:hover:not(:disabled)
        background rgba(99,102,241,0.1)

    &:disabled
        opacity 0.45
        cursor not-allowed

.empty-full
    display flex
    flex-direction column
    align-items center
    justify-content center
    gap 1rem
    padding 6rem 2rem
    color #64748b

    &.hint
        color #3d4454

.empty-icon
    font-size 3.5rem
    opacity 0.4

.spin
    animation spin 0.8s linear infinite

@keyframes spin
    from transform rotate(0deg)
    to transform rotate(360deg)

// Fix: v-if inside v-for img flickers — let browser handle missing src
img[src=""]
    display none
</style>
