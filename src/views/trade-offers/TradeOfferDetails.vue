<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminService } from '@/services/admin/admin.service'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'

const route = useRoute()
const router = useRouter()
const offer = ref<any>(null)
const loading = ref(true)
const error = ref('')
const expandedPayload = ref<string | null>(null)
const retrying = ref(false)
const syncing = ref(false)
const payloadSections = [
    { key: 'send_request_payload', label: 'Send Request' },
    { key: 'send_response_payload', label: 'Send Response' },
    { key: 'last_sync_payload', label: 'Último Sync' },
] as const

const fetchOffer = async () => {
    loading.value = true
    error.value = ''
    try {
        const response = await adminService.getTradeOfferById(route.params.uuid as string)
        if (response.data) offer.value = response.data
    } catch (e: any) {
        error.value = e?.response?.data?.message || 'Erro ao carregar trade offer.'
    } finally {
        loading.value = false
    }
}

const retrySale = async () => {
    if (!offer.value?.sales?.id) return
    retrying.value = true
    try {
        await adminService.retrySaleTrade(offer.value.sales.id)
        toast.success('Trade reenfileirado com sucesso!')
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao reenviar trade.')
    } finally {
        retrying.value = false
    }
}

const syncOffer = async () => {
    if (!offer.value?.trade_offer_id) return
    syncing.value = true
    try {
        await adminService.syncTradeOffer(offer.value.trade_offer_id)
        toast.success('Sincronizado!')
        await fetchOffer()
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao sincronizar.')
    } finally {
        syncing.value = false
    }
}

const getStatusClass = (status: string) => {
    if (!status) return ''
    const s = status.toUpperCase()
    if (['ACCEPTED', 'COMPLETED'].includes(s)) return 'status-completed'
    if (['SENT', 'ACTIVE', 'PENDING'].includes(s)) return 'status-pending'
    return 'status-canceled'
}

const formatJson = (val: any) => {
    try { return JSON.stringify(val, null, 2) } catch { return String(val) }
}

const statusHistory = computed(() => {
    if (!offer.value?.offer_status_history) return []
    try {
        const h = typeof offer.value.offer_status_history === 'string'
            ? JSON.parse(offer.value.offer_status_history)
            : offer.value.offer_status_history
        return Array.isArray(h) ? h : []
    } catch { return [] }
})

const togglePayload = (key: string) => {
    expandedPayload.value = expandedPayload.value === key ? null : key
}

onMounted(fetchOffer)
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <button class="btn-back" @click="router.push('/trade-offers')">
                <Icon icon="mdi:arrow-left" /> Trade Offers
            </button>
            <div class="header-actions" v-if="offer">
                <button
                    v-if="offer.sales?.id"
                    class="btn-action btn-retry"
                    :disabled="retrying"
                    @click="retrySale"
                >
                    <Icon :icon="retrying ? 'mdi:loading' : 'mdi:refresh'" :class="{ spinning: retrying }" />
                    {{ retrying ? 'Reenfileirando...' : 'Reenviar Trade' }}
                </button>
                <button
                    v-if="offer.trade_offer_id"
                    class="btn-action btn-sync"
                    :disabled="syncing"
                    @click="syncOffer"
                >
                    <Icon :icon="syncing ? 'mdi:loading' : 'mdi:cloud-sync-outline'" :class="{ spinning: syncing }" />
                    {{ syncing ? 'Sincronizando...' : 'Sincronizar' }}
                </button>
            </div>
        </header>

        <div v-if="loading" class="loading-state">Carregando trade offer...</div>
        <div v-else-if="error" class="error-state">{{ error }}</div>

        <template v-else-if="offer">
            <!-- Hero -->
            <div class="offer-hero">
                <div class="hero-left">
                    <span class="status-badge large" :class="getStatusClass(offer.offer_status || offer.status)">
                        {{ offer.offer_status || offer.status || '—' }}
                    </span>
                    <div>
                        <h1 class="hero-id">
                            Trade #{{ offer.trade_offer_id || offer.id?.substring(0, 8) || '—' }}
                        </h1>
                        <p class="hero-meta">
                            <span v-if="offer.steam_bots">Bot: <strong>{{ offer.steam_bots.name }}</strong></span>
                            <span v-if="offer.sales">
                                &nbsp;· Pedido:
                                <router-link :to="`/sales/${offer.sales.id}`" class="link" @click.stop>
                                    {{ offer.sales.order_number }}
                                </router-link>
                            </span>
                        </p>
                    </div>
                </div>
                <div class="hero-stats">
                    <div class="stat">
                        <span class="stat-label">Tentativas</span>
                        <span class="stat-value">{{ offer.attempt_count ?? 0 }}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Syncs</span>
                        <span class="stat-value">{{ offer.sync_attempt_count ?? 0 }}</span>
                    </div>
                    <div class="stat" v-if="offer.steam_status_code">
                        <span class="stat-label">Steam Code</span>
                        <span class="stat-value">{{ offer.steam_status_code }}</span>
                    </div>
                </div>
            </div>

            <div class="content-grid">
                <!-- Info -->
                <div class="section">
                    <h2 class="section-title">Informações</h2>
                    <div class="info-list">
                        <div class="info-row">
                            <span class="info-label">UUID</span>
                            <code class="info-value mono small">{{ offer.id }}</code>
                        </div>
                        <div class="info-row" v-if="offer.steam_trade_id">
                            <span class="info-label">Steam Trade ID</span>
                            <code class="info-value mono">{{ offer.steam_trade_id }}</code>
                        </div>
                        <div class="info-row" v-if="offer.user_steam_id">
                            <span class="info-label">Steam do usuário</span>
                            <code class="info-value mono">{{ offer.user_steam_id }}</code>
                        </div>
                        <div class="info-row" v-if="offer.steam_status_label">
                            <span class="info-label">Status Steam</span>
                            <span class="info-value">{{ offer.steam_status_label }}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Enviado em</span>
                            <span class="info-value">{{ offer.sent_at ? $dayjs(offer.sent_at).format('DD/MM/YY HH:mm:ss') : '—' }}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Status alterado em</span>
                            <span class="info-value">{{ offer.offer_status_changed_at ? $dayjs(offer.offer_status_changed_at).format('DD/MM/YY HH:mm:ss') : '—' }}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Último sync</span>
                            <span class="info-value">{{ offer.last_status_sync_at ? $dayjs(offer.last_status_sync_at).format('DD/MM/YY HH:mm:ss') : '—' }}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Última tentativa</span>
                            <span class="info-value">{{ offer.last_attempt_at ? $dayjs(offer.last_attempt_at).format('DD/MM/YY HH:mm:ss') : '—' }}</span>
                        </div>
                        <div class="info-row" v-if="offer.next_retry_at">
                            <span class="info-label">Próxima tentativa</span>
                            <span class="info-value highlight">{{ $dayjs(offer.next_retry_at).format('DD/MM/YY HH:mm:ss') }}</span>
                        </div>
                        <div class="info-row" v-if="offer.last_error">
                            <span class="info-label">Último erro</span>
                            <span class="info-value error-text">{{ offer.last_error }}</span>
                        </div>
                        <div class="info-row" v-if="offer.last_sync_error">
                            <span class="info-label">Erro de sync</span>
                            <span class="info-value error-text">{{ offer.last_sync_error }}</span>
                        </div>
                    </div>
                </div>

                <!-- Status History -->
                <div class="section">
                    <h2 class="section-title">Histórico de Status</h2>
                    <div v-if="!statusHistory.length" class="empty-state">Sem histórico registrado.</div>
                    <div v-else class="timeline">
                        <div
                            v-for="(entry, i) in statusHistory"
                            :key="i"
                            class="timeline-item"
                        >
                            <div class="timeline-dot" :class="getStatusClass(entry.status || entry.offer_status || '')"></div>
                            <div class="timeline-content">
                                <span class="status-badge small" :class="getStatusClass(entry.status || entry.offer_status || '')">
                                    {{ entry.status || entry.offer_status || '?' }}
                                </span>
                                <span class="timeline-time" v-if="entry.changed_at || entry.at || entry.timestamp">
                                    {{ $dayjs(entry.changed_at || entry.at || entry.timestamp).format('DD/MM/YY HH:mm:ss') }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Events -->
            <div class="section" v-if="offer.trade_offer_events?.length">
                <h2 class="section-title">Eventos ({{ offer.trade_offer_events.length }})</h2>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Status</th>
                                <th>Provider</th>
                                <th>Event ID</th>
                                <th>Timestamp</th>
                                <th>Processado em</th>
                                <th>Payload</th>
                            </tr>
                        </thead>
                        <tbody>
                            <template v-for="event in offer.trade_offer_events" :key="event.id">
                                <tr>
                                    <td>
                                        <span class="status-badge small" :class="getStatusClass(event.event_status)">
                                            {{ event.event_status }}
                                        </span>
                                    </td>
                                    <td><code class="mono">{{ event.provider }}</code></td>
                                    <td><code class="mono small">{{ event.provider_event_id }}</code></td>
                                    <td>{{ event.event_timestamp ? $dayjs(event.event_timestamp).format('DD/MM/YY HH:mm:ss') : '—' }}</td>
                                    <td>{{ $dayjs(event.processed_at).format('DD/MM/YY HH:mm:ss') }}</td>
                                    <td>
                                        <button class="btn-expand" @click="togglePayload(event.id)">
                                            <Icon :icon="expandedPayload === event.id ? 'mdi:chevron-up' : 'mdi:code-json'" />
                                        </button>
                                    </td>
                                </tr>
                                <tr v-if="expandedPayload === event.id" class="payload-row">
                                    <td colspan="6">
                                        <pre class="json-block">{{ formatJson(event.payload) }}</pre>
                                    </td>
                                </tr>
                            </template>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="section muted-section" v-else>
                <p class="empty-state">Nenhum evento registrado para esta offer.</p>
            </div>

            <!-- Payloads -->
            <div class="section">
                <h2 class="section-title">Payloads</h2>
                <div class="payloads-grid">
                    <div v-for="section in payloadSections" :key="section.key">
                        <button class="payload-toggle" @click="togglePayload(section.key)" :disabled="!offer[section.key]">
                            <Icon icon="mdi:code-json" />
                            {{ section.label }}
                            <Icon :icon="expandedPayload === section.key ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="chevron" />
                        </button>
                        <pre v-if="expandedPayload === section.key && offer[section.key]" class="json-block">{{ formatJson(offer[section.key]) }}</pre>
                        <p v-else-if="!offer[section.key]" class="payload-empty">Vazio</p>
                    </div>
                </div>
            </div>
        </template>
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
    align-items center
    justify-content space-between
    gap 1rem
    flex-wrap wrap
    margin-bottom 2rem

.btn-back
    display inline-flex
    align-items center
    gap 0.4rem
    background transparent
    border none
    color #94a3b8
    font-size 0.875rem
    cursor pointer
    padding 0.4rem 0.75rem
    border-radius 6px
    transition all 0.15s

    &:hover
        color #fff
        background rgba(255,255,255,0.05)

.header-actions
    display flex
    gap 0.5rem

.btn-action
    display inline-flex
    align-items center
    gap 0.4rem
    padding 0.5rem 1rem
    border-radius 8px
    font-size 0.85rem
    font-weight 500
    cursor pointer
    border none
    transition all 0.2s

    &:disabled
        opacity 0.5
        cursor not-allowed

.btn-retry
    background rgba(255,152,0,0.1)
    color #ff9800
    border 1px solid rgba(255,152,0,0.2)

    &:hover:not(:disabled)
        background rgba(255,152,0,0.2)

.btn-sync
    background rgba(99,102,241,0.12)
    color #6366f1
    border 1px solid rgba(99,102,241,0.25)

    &:hover:not(:disabled)
        background rgba(99,102,241,0.22)

.loading-state, .error-state
    padding 3rem
    text-align center
    color #94a3b8

.error-state
    color #f44336

.offer-hero
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 12px
    padding 1.5rem
    display flex
    align-items center
    justify-content space-between
    flex-wrap wrap
    gap 1.5rem
    margin-bottom 1.5rem

.hero-left
    display flex
    align-items center
    gap 1.25rem

.hero-id
    font-size 1.4rem
    font-weight 700
    margin-bottom 0.25rem

.hero-meta
    color #94a3b8
    font-size 0.875rem

.link
    color #6366f1
    text-decoration none

    &:hover
        text-decoration underline

.hero-stats
    display flex
    gap 2rem

.stat
    text-align center

.stat-label
    display block
    font-size 0.72rem
    color #64748b
    text-transform uppercase
    margin-bottom 0.25rem

.stat-value
    font-size 1.5rem
    font-weight 700

.content-grid
    display grid
    grid-template-columns 1fr 1fr
    gap 1.5rem
    margin-bottom 1.5rem

    @media (max-width: 900px)
        grid-template-columns 1fr

.section
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 12px
    padding 1.5rem
    margin-bottom 1.5rem

.muted-section
    margin-bottom 0

.section-title
    font-size 0.85rem
    font-weight 600
    text-transform uppercase
    color #64748b
    letter-spacing 0.05em
    margin-bottom 1rem

.info-list
    display flex
    flex-direction column
    gap 0.6rem

.info-row
    display flex
    justify-content space-between
    align-items flex-start
    gap 1rem
    padding-bottom 0.6rem
    border-bottom 1px solid rgba(255,255,255,0.04)

    &:last-child
        border-bottom none
        padding-bottom 0

.info-label
    color #64748b
    font-size 0.8rem
    white-space nowrap
    flex-shrink 0

.info-value
    font-size 0.85rem
    text-align right
    word-break break-all

    &.highlight
        color #ff9800

.error-text
    color #f44336

.mono
    font-family monospace
    color #94a3b8

    &.small
        font-size 0.75rem

.timeline
    display flex
    flex-direction column
    gap 0.75rem

.timeline-item
    display flex
    align-items center
    gap 0.75rem

.timeline-dot
    width 10px
    height 10px
    border-radius 50%
    flex-shrink 0
    background #64748b

    &.status-completed
        background #4caf50

    &.status-pending
        background #ff9800

    &.status-canceled
        background #f44336

.timeline-content
    display flex
    align-items center
    gap 0.75rem

.timeline-time
    color #64748b
    font-size 0.78rem

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
        padding 0.65rem 0.75rem
        border-bottom 1px solid rgba(255,255,255,0.05)
        white-space nowrap
        text-transform uppercase

    td
        padding 0.75rem
        font-size 0.85rem
        border-bottom 1px solid rgba(255,255,255,0.04)
        vertical-align middle

.payload-row td
    padding 0

.btn-expand
    background transparent
    border none
    color #6366f1
    cursor pointer
    padding 0.3rem
    border-radius 4px
    display flex
    align-items center
    font-size 1rem
    transition all 0.15s

    &:hover
        background rgba(99,102,241,0.1)

.json-block
    background #0e0e10
    border 1px solid rgba(255,255,255,0.06)
    border-radius 8px
    padding 1rem
    font-size 0.78rem
    font-family monospace
    color #94a3b8
    overflow-x auto
    white-space pre
    margin 0.5rem 0 0

.payloads-grid
    display grid
    grid-template-columns repeat(3, 1fr)
    gap 1rem

    @media (max-width: 900px)
        grid-template-columns 1fr

.payload-toggle
    display flex
    align-items center
    gap 0.5rem
    background rgba(255,255,255,0.04)
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #cbd5e1
    font-size 0.85rem
    padding 0.6rem 1rem
    cursor pointer
    width 100%
    transition all 0.15s

    &:hover:not(:disabled)
        background rgba(255,255,255,0.07)

    &:disabled
        opacity 0.4
        cursor default

    .chevron
        margin-left auto

.payload-empty
    color #64748b
    font-size 0.8rem
    margin-top 0.5rem
    padding-left 0.25rem

.status-badge
    padding 3px 8px
    border-radius 5px
    font-size 0.72rem
    font-weight 600
    text-transform uppercase

    &.large
        font-size 0.85rem
        padding 5px 12px

    &.small
        font-size 0.68rem
        padding 2px 6px

.status-completed
    background rgba(76,175,80,0.1)
    color #4caf50

.status-pending
    background rgba(255,152,0,0.1)
    color #ff9800

.status-canceled
    background rgba(244,67,54,0.1)
    color #f44336

.empty-state
    text-align center
    padding 2rem
    color #64748b

.spinning
    animation spin 1s linear infinite

@keyframes spin
    from transform rotate(0deg)
    to transform rotate(360deg)
</style>
