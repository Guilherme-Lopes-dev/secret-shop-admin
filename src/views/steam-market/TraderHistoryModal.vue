<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import { Icon } from '@iconify/vue'
import { adminService } from '@/services/admin/admin.service'
import type { MarketTraderEvent } from '@/services/admin/types'
import { buildSteamImageUrl } from '@/utils/steamImage'
import {
    amountOf,
    detailRows,
    marginOf,
    signalLabel,
    signedPct,
    topCandidatesOf,
    type EventData,
} from './traderEventDetails'

const POLL_MS = 30_000

const EVENT_KINDS: Record<string, { icon: string; label: string }> = {
    buy: { icon: 'mdi:cart-arrow-down', label: 'Lance' },
    fill: { icon: 'mdi:check-circle-outline', label: 'Comprou' },
    list: { icon: 'mdi:tag-outline', label: 'À venda' },
    sold: { icon: 'mdi:cash-check', label: 'Vendeu' },
    cancel: { icon: 'mdi:close-circle-outline', label: 'Cancelou' },
    skip: { icon: 'mdi:debug-step-over', label: 'Passou' },
    guard: { icon: 'mdi:shield-alert-outline', label: 'Proteção' },
    error: { icon: 'mdi:alert-circle-outline', label: 'Erro' },
    config: { icon: 'mdi:cog-outline', label: 'Config' },
    cycle: { icon: 'mdi:sync', label: 'Ciclo' },
}
const UNKNOWN_KIND = { icon: 'mdi:circle-small', label: 'Evento' }
const eventKind = (kind: string) => EVENT_KINDS[kind] ?? UNKNOWN_KIND

const emit = defineEmits<{ (e: 'close'): void }>()

const dialog = ref<HTMLDialogElement | null>(null)
const events = ref<MarketTraderEvent[]>([])
const loading = ref(true)
const loadError = ref(false)
const expanded = ref(new Set<string>())
let timer: ReturnType<typeof setInterval> | undefined

const load = async () => {
    try {
        const { data } = await adminService.getMarketTraderEvents()
        events.value = data
        loadError.value = false
    } catch {
        loadError.value = true
    } finally {
        loading.value = false
    }
}

// <dialog> nativo: Esc, foco preso e fundo inerte já vêm prontos.
onMounted(() => {
    dialog.value?.showModal()
    load()
    timer = setInterval(load, POLL_MS)
})
onBeforeUnmount(() => clearInterval(timer))

const toggle = (id: string) => {
    const next = new Set(expanded.value)
    if (!next.delete(id)) next.add(id)
    expanded.value = next
}

const dataOf = (event: MarketTraderEvent) => event.data as EventData | null
const thumb = (event: MarketTraderEvent) => buildSteamImageUrl(event.image, '64fx64f')
const steamUrl = (name: string) => `https://steamcommunity.com/market/listings/570/${encodeURIComponent(name)}`
const liveRoute = (name: string) => ({ name: 'steam-market', query: { name } })
const marginClass = (pct: number | null) => (pct === null ? '' : pct >= 0 ? 'gain' : 'loss')
</script>

<template>
    <dialog ref="dialog" class="history" aria-labelledby="trader-history-title" @close="emit('close')">
        <header class="history-header">
            <div>
                <h2 id="trader-history-title" class="history-title">
                    <Icon icon="mdi:history" /> Histórico do trader
                </h2>
                <p class="history-sub">
                    Últimos {{ events.length }} eventos, mais novos primeiro. Clique numa linha pra ver os números da decisão.
                </p>
            </div>
            <button class="close" type="button" aria-label="Fechar histórico" @click="dialog?.close()">
                <Icon icon="mdi:close" />
            </button>
        </header>

        <p v-if="loadError" class="history-state error">Não deu pra ler o histórico. Tentando de novo em 30 segundos.</p>
        <p v-else-if="loading" class="history-state">Lendo o histórico...</p>
        <p v-else-if="!events.length" class="history-state">Nada ainda.</p>

        <div v-if="events.length" class="history-body">
            <table>
                <thead>
                    <tr>
                        <th class="toggle-col"><span class="sr-only">Detalhes</span></th>
                        <th>Quando</th>
                        <th>Tipo</th>
                        <th>Item</th>
                        <th class="num">Valor</th>
                        <th class="num">Margem</th>
                        <th>O que aconteceu</th>
                    </tr>
                </thead>
                <tbody>
                    <template v-for="event in events" :key="event.id">
                        <tr
                            :class="[event.kind, { clickable: event.data, open: expanded.has(event.id) }]"
                            @click="event.data && toggle(event.id)"
                        >
                            <td class="toggle-col">
                                <button
                                    v-if="event.data"
                                    class="toggle"
                                    type="button"
                                    :aria-expanded="expanded.has(event.id)"
                                    :aria-controls="`event-${event.id}`"
                                    :aria-label="expanded.has(event.id) ? 'Esconder detalhes' : 'Ver detalhes'"
                                    @click.stop="toggle(event.id)"
                                >
                                    <Icon :icon="expanded.has(event.id) ? 'mdi:chevron-down' : 'mdi:chevron-right'" />
                                </button>
                            </td>
                            <td class="when">{{ dayjs(event.createdAt).format('DD/MM HH:mm:ss') }}</td>
                            <td class="kind">
                                <Icon :icon="eventKind(event.kind).icon" /> {{ eventKind(event.kind).label }}
                            </td>
                            <td class="name">
                                <div v-if="event.marketHashName" class="item">
                                    <img v-if="thumb(event)" :src="thumb(event)!" alt="" loading="lazy" />
                                    <span>{{ event.marketHashName }}</span>
                                </div>
                                <span v-else class="muted">—</span>
                            </td>
                            <td class="num">{{ amountOf(dataOf(event)) }}</td>
                            <td class="num" :class="marginClass(marginOf(dataOf(event)))">
                                {{ marginOf(dataOf(event)) === null ? '—' : signedPct(marginOf(dataOf(event)) as number) }}
                            </td>
                            <td class="message">{{ event.message }}</td>
                        </tr>

                        <tr v-if="event.data && expanded.has(event.id)" :id="`event-${event.id}`" class="details-row">
                            <td colspan="7">
                                <div class="details">
                                    <dl class="details-grid">
                                        <div v-for="row in detailRows(dataOf(event)!)" :key="row.key" class="detail">
                                            <dt>{{ row.label }}</dt>
                                            <dd>{{ row.value }}</dd>
                                        </div>
                                    </dl>

                                    <div v-if="topCandidatesOf(dataOf(event)).length" class="top">
                                        <h3 class="top-title">Melhores candidatos do ciclo</h3>
                                        <ol class="top-list">
                                            <li v-for="candidate in topCandidatesOf(dataOf(event))" :key="candidate.name">
                                                <span>{{ candidate.name }}</span>
                                                <span class="muted">
                                                    {{ signedPct(candidate.estimatedMarginPct) }} · {{ signalLabel(candidate.signal) }} · {{ candidate.sold7d }} vendas/semana
                                                </span>
                                            </li>
                                        </ol>
                                    </div>

                                    <div v-if="event.marketHashName" class="links">
                                        <RouterLink :to="liveRoute(event.marketHashName)" class="link" @click="dialog?.close()">
                                            <Icon icon="mdi:chart-timeline-variant" /> Market ao vivo
                                        </RouterLink>
                                        <a :href="steamUrl(event.marketHashName)" target="_blank" rel="noopener" class="link">
                                            <Icon icon="mdi:steam" /> Página na Steam
                                        </a>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </template>
                </tbody>
            </table>
        </div>
    </dialog>
</template>

<style scoped lang="stylus">
.history
    position fixed
    inset 0
    width 100%
    height 100dvh
    max-width none
    max-height none
    margin 0
    padding 0
    border none
    background #121214
    color #cbd5e1

    &[open]
        display flex
        flex-direction column

.history-header
    display flex
    align-items flex-start
    justify-content space-between
    gap 1rem
    padding 1.25rem 2rem
    border-bottom 1px solid rgba(255,255,255,0.08)

.history-title
    display flex
    align-items center
    gap 0.5rem
    margin 0
    font-size 1.3rem
    font-weight 700
    color #fff

.history-sub
    margin 0.25rem 0 0
    color #94a3b8
    font-size 0.85rem

.close
    display inline-flex
    align-items center
    justify-content center
    flex none
    width 40px
    height 40px
    font-size 1.3rem
    color #cbd5e1
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.1)
    border-radius 8px
    cursor pointer

    &:hover
        background #2a2a30

.history-state
    padding 3rem 2rem
    text-align center
    color #94a3b8

    &.error
        color #fca5a5

.history-body
    flex 1
    min-height 0
    overflow auto

.sr-only
    position absolute
    width 1px
    height 1px
    overflow hidden
    clip rect(0 0 0 0)
    white-space nowrap

table
    width 100%
    border-collapse collapse
    font-size 0.88rem

th
    position sticky
    top 0
    z-index 1
    padding 0.6rem 0.8rem
    text-align left
    font-size 0.75rem
    font-weight 500
    color #64748b
    white-space nowrap
    background #121214
    border-bottom 1px solid rgba(255,255,255,0.08)

td
    padding 0.5rem 0.8rem
    vertical-align middle
    border-bottom 1px solid rgba(255,255,255,0.04)

.toggle-col
    width 1%
    padding-left 1.5rem
    padding-right 0

.toggle
    display inline-flex
    align-items center
    justify-content center
    width 28px
    height 28px
    font-size 1.1rem
    color #94a3b8
    background none
    border 1px solid transparent
    border-radius 6px
    cursor pointer

    &:hover
        background rgba(255,255,255,0.06)

    &:focus-visible
        border-color #6366f1
        outline none

tr.clickable
    cursor pointer

    &:hover td
        background rgba(255,255,255,0.025)

tr.open td
    background rgba(255,255,255,0.035)
    border-bottom-color transparent

.when
    color #64748b
    white-space nowrap
    font-variant-numeric tabular-nums

.kind
    white-space nowrap
    color #94a3b8

    svg
        vertical-align -2px

.name
    min-width 220px
    color #e2e8f0

.item
    display flex
    align-items center
    gap 0.6rem

    img
        flex none
        width 40px
        height 40px
        object-fit contain
        border-radius 6px
        background rgba(255,255,255,0.04)

.num
    text-align right
    white-space nowrap
    font-variant-numeric tabular-nums

.gain
    color #86efac

.loss
    color #fca5a5

.message
    min-width 260px
    color #cbd5e1

.muted
    color #64748b

tr.sold .kind, tr.fill .kind
    color #86efac

tr.buy .kind, tr.list .kind
    color #a5b4fc

tr.error .kind, tr.guard .kind
    color #fdba74

.details-row td
    padding 0 1.5rem 1.25rem 3.75rem
    background rgba(255,255,255,0.035)

.details
    display flex
    flex-direction column
    gap 1rem

.details-grid
    display grid
    grid-template-columns repeat(auto-fill, minmax(220px, 1fr))
    gap 0.6rem 1.5rem
    margin 0

.detail
    display flex
    flex-direction column
    gap 0.15rem

    dt
        color #64748b
        font-size 0.74rem

    dd
        margin 0
        color #e2e8f0
        font-variant-numeric tabular-nums
        overflow-wrap anywhere

.top-title
    margin 0 0 0.4rem
    font-size 0.8rem
    font-weight 600
    color #94a3b8

.top-list
    margin 0
    padding-left 1.2rem
    display grid
    gap 0.25rem

    li
        display flex
        flex-wrap wrap
        gap 0.25rem 0.75rem
        color #e2e8f0

.links
    display flex
    gap 0.5rem
    flex-wrap wrap

.link
    display inline-flex
    align-items center
    gap 0.35rem
    padding 0.35rem 0.75rem
    color #cbd5e1
    font-size 0.8rem
    text-decoration none
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.1)
    border-radius 8px

    &:hover
        background #2a2a30

@media (max-width: 640px)
    .history-header
        padding 1rem

    .toggle-col
        padding-left 0.75rem

    .details-row td
        padding 0 1rem 1rem
</style>
