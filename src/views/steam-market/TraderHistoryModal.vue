<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import { Icon } from '@iconify/vue'
import { adminService } from '@/services/admin/admin.service'
import type { MarketTraderEvent } from '@/services/admin/types'

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
</script>

<template>
    <dialog ref="dialog" class="history" aria-labelledby="trader-history-title" @close="emit('close')">
        <header class="history-header">
            <div>
                <h2 id="trader-history-title" class="history-title">
                    <Icon icon="mdi:history" /> Histórico do trader
                </h2>
                <p class="history-sub">Últimos {{ events.length }} eventos, mais novos primeiro. Atualiza a cada 30 segundos.</p>
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
                        <th>Quando</th>
                        <th>Tipo</th>
                        <th>Item</th>
                        <th>O que aconteceu</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="event in events" :key="event.id" :class="event.kind">
                        <td class="when">{{ dayjs(event.createdAt).format('DD/MM HH:mm:ss') }}</td>
                        <td class="kind">
                            <Icon :icon="eventKind(event.kind).icon" /> {{ eventKind(event.kind).label }}
                        </td>
                        <td class="name">{{ event.marketHashName ?? '—' }}</td>
                        <td class="message">{{ event.message }}</td>
                    </tr>
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

    &:first-child
        padding-left 2rem

td
    padding 0.55rem 0.8rem
    vertical-align top
    border-bottom 1px solid rgba(255,255,255,0.04)

    &:first-child
        padding-left 2rem

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
    min-width 180px
    color #e2e8f0

.message
    min-width 260px
    color #cbd5e1

tr.sold .kind, tr.fill .kind
    color #86efac

tr.buy .kind, tr.list .kind
    color #a5b4fc

tr.error .kind, tr.guard .kind
    color #fdba74

@media (max-width: 640px)
    .history-header
        padding 1rem

    th:first-child, td:first-child
        padding-left 1rem
</style>
