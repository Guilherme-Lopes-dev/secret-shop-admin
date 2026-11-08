<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import ConfirmActionModal from '@/components/common/ConfirmActionModal.vue'
import InfoTip from '@/components/common/InfoTip.vue'
import { adminService } from '@/services/admin/admin.service'
import type {
    MarketTraderLimits,
    MarketTraderMode,
    MarketTraderOverview,
    MarketTraderPosition,
} from '@/services/admin/types'
import { formatMoney } from './marketMath'
import TraderHistoryModal from './TraderHistoryModal.vue'
import TraderHoursPanel from './TraderHoursPanel.vue'

const POLL_MS = 30_000

const TIP =
    'A cada 30 minutos: confere o que executou e vendeu, cancela lances velhos, põe à venda o que destravou e, ' +
    'se o mercado não estiver despencando, compra os itens com mais margem depois da taxa de 13%. ' +
    'Decide com o histórico da Steam (preço, volume, tendência), a procura no site e o livro de ofertas ao vivo.'

const MODES: { value: MarketTraderMode; label: string; icon: string }[] = [
    { value: 'off', label: 'Desligado', icon: 'mdi:power' },
    { value: 'paper', label: 'Simulado', icon: 'mdi:flask-outline' },
    { value: 'live', label: 'Real', icon: 'mdi:cash' },
]

const STATUS_LABEL: Record<MarketTraderPosition['status'], string> = {
    bidding: 'Lance aberto',
    unclaimed: 'Conferindo',
    holding: 'Na trava',
    listed: 'À venda',
    sold: 'Vendido',
    cancelled: 'Cancelado',
}

type FieldUnit = 'money' | 'number'
type Field = { key: keyof MarketTraderLimits; label: string; unit: FieldUnit; tip?: string }

const FIELDS: Field[] = [
    { key: 'budgetCents', label: 'Orçamento total (R$)', unit: 'money', tip: 'Soma do custo de tudo aberto: lances, itens e vendas. Zero = só vende, não compra mais.' },
    { key: 'minUnitCents', label: 'Preço mínimo por item (R$)', unit: 'money' },
    { key: 'maxUnitCents', label: 'Preço máximo por item (R$)', unit: 'money' },
    { key: 'minMarginPct', label: 'Margem mínima pra comprar (%)', unit: 'number', tip: 'Depois da taxa, contra o menor entre consenso, mediana de 21 dias e menor venda ao vivo.' },
    { key: 'minSold7d', label: 'Vendas mínimas na semana', unit: 'number' },
    { key: 'minExitMarginPct', label: 'Margem mínima pra vender (%)', unit: 'number' },
    { key: 'patienceDays', label: 'Paciência depois da trava (dias)', unit: 'number', tip: 'Sem margem depois disso, vende no preço do mercado, mesmo com prejuízo.' },
    { key: 'bidTtlHours', label: 'Validade do lance (horas)', unit: 'number', tip: 'Lance velho só executa quando o preço cai: passou disso, cancela.' },
    { key: 'maxPerItem', label: 'Máximo por item', unit: 'number' },
    { key: 'maxOpenBids', label: 'Máximo de lances abertos', unit: 'number' },
    { key: 'maxNewOrdersPerCycle', label: 'Compras novas por ciclo', unit: 'number' },
    { key: 'maxReadsPerCycle', label: 'Leituras na Steam por ciclo', unit: 'number', tip: 'O limite (429) é por IP e vale pra loja inteira. Subir aqui pode atrapalhar as entregas.' },
    { key: 'maxLoss7dCents', label: 'Prejuízo em 7 dias que desliga (R$)', unit: 'money' },
]

const overview = ref<MarketTraderOverview | null>(null)
const loadError = ref<string | null>(null)
const form = ref<Record<string, number>>({})
const saving = ref(false)
const pendingMode = ref<MarketTraderMode | null>(null)
const showClosed = ref(false)
const historyOpen = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

const errorMessage = (error: unknown, fallback: string) =>
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback

const toFormValue = (field: Field, value: number) => (field.unit === 'money' ? value / 100 : value)
const fromFormValue = (field: Field, value: number) => (field.unit === 'money' ? Math.round(value * 100) : value)

const fillForm = (data: MarketTraderOverview) => {
    form.value = Object.fromEntries(FIELDS.map(field => [field.key, toFormValue(field, data.config[field.key])]))
}

const load = async () => {
    try {
        const { data } = await adminService.getMarketTrader()
        // Atualização automática não pode apagar o que o admin está digitando.
        if (!overview.value) fillForm(data)
        overview.value = data
        loadError.value = null
    } catch (error) {
        loadError.value = errorMessage(error, 'Não deu pra ler o trader.')
    }
}

onMounted(() => {
    load()
    timer = setInterval(load, POLL_MS)
})
onBeforeUnmount(() => clearInterval(timer))

const config = computed(() => overview.value?.config ?? null)
const traderBot = computed(() => overview.value?.bots.find(bot => bot.isTrader) ?? null)
const activeSummary = computed(() => (config.value?.mode === 'live' ? overview.value?.summary.live : overview.value?.summary.paper))
const lastCycle = computed(() => overview.value?.events.find(event => event.kind === 'cycle') ?? null)

const isOpen = (position: MarketTraderPosition) => !['sold', 'cancelled'].includes(position.status)
const visiblePositions = computed(() =>
    (overview.value?.positions ?? []).filter(position => isOpen(position) !== showClosed.value),
)

const money = (cents: number | null | undefined) => formatMoney(cents, 'BRL')
const signedMoney = (cents: number) => `${cents > 0 ? '+' : ''}${money(cents)}`
const moment = (date: string | null) => (date ? dayjs(date).format('DD/MM HH:mm') : '—')
const profitOf = (position: MarketTraderPosition) =>
    position.status === 'sold' ? (position.receiveCents ?? 0) - position.bidCents : null

const statusLabel = (position: MarketTraderPosition) => {
    const unlocked = position.unlocksAt && dayjs(position.unlocksAt).isBefore(dayjs())
    if (position.status === 'holding' && unlocked) return 'Esperando margem'

    return STATUS_LABEL[position.status]
}

const reasonOf = (position: MarketTraderPosition) => {
    const decision = position.decision
    if (!decision) return 'Ordem adotada: já estava na conta.'

    return `Margem esperada ${decision.marginPct}% · sinal ${decision.signal} · ${decision.sold7d} vendas/semana · procura no site ${decision.interest.toFixed(1)}`
}

const liveRoute = (name: string) => ({ name: 'steam-market', query: { name } })

const applyMode = async (mode: MarketTraderMode) => {
    saving.value = true
    try {
        await adminService.updateMarketTraderConfig({ mode })
        toast.success(`Trader: ${MODES.find(option => option.value === mode)?.label}.`)
        pendingMode.value = null
        await load()
    } catch (error) {
        toast.error(errorMessage(error, 'Não deu pra mudar o modo.'))
    } finally {
        saving.value = false
    }
}

// Real gasta dinheiro de verdade; sair do real cancela os lances abertos. Os dois pedem confirmação.
const chooseMode = (mode: MarketTraderMode) => {
    if (mode === config.value?.mode) return
    if (mode === 'live' || config.value?.mode === 'live') {
        pendingMode.value = mode
        return
    }
    applyMode(mode)
}

const modeDescription = computed(() => {
    if (pendingMode.value === 'live') {
        const budget = money(config.value?.budgetCents)
        return `A conta ${traderBot.value?.name ?? ''} vai criar ordens reais com o saldo da carteira Steam, até ${budget}. O saldo não pode ser sacado: só vira itens.`
    }
    if (pendingMode.value === 'off') return 'Os lances abertos serão cancelados. Itens e vendas continuam na conta, sem ninguém cuidando até ligar de novo.'

    return 'Compras novas passam a ser simuladas. O que já é real continua sendo vendido.'
})

const closeModeModal = (open: boolean) => {
    if (!open) pendingMode.value = null
}

const saveLimits = async () => {
    saving.value = true
    try {
        const patch = Object.fromEntries(FIELDS.map(field => [field.key, fromFormValue(field, Number(form.value[field.key]))]))
        await adminService.updateMarketTraderConfig(patch)
        toast.success('Limites salvos.')
        await load()
    } catch (error) {
        toast.error(errorMessage(error, 'Não deu pra salvar os limites.'))
    } finally {
        saving.value = false
    }
}

const selectBot = async (event: Event) => {
    const botId = (event.target as HTMLSelectElement).value
    if (!botId) return

    try {
        await adminService.selectMarketTraderBot(botId)
        toast.success('Conta do trader definida: ela saiu do estoque do site.')
    } catch (error) {
        toast.error(errorMessage(error, 'Não deu pra usar essa conta.'))
    }
    await load()
}

const runNow = async () => {
    try {
        await adminService.runMarketTrader()
        toast.success('Ciclo iniciado: acompanhe no Histórico.')
    } catch (error) {
        toast.error(errorMessage(error, 'Não deu pra iniciar o ciclo.'))
    }
    await load()
}
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Trader automático <InfoTip :text="TIP" align="left" /></h1>
                <p class="page-sub">Compra e venda no Steam Market pela conta dedicada.</p>
            </div>
            <div class="header-actions">
                <span v-if="lastCycle" class="fetched">Último ciclo {{ moment(lastCycle.createdAt) }}</span>
                <button class="btn" type="button" @click="historyOpen = true">
                    <Icon icon="mdi:history" /> Histórico
                </button>
                <RouterLink :to="{ name: 'steam-buy-orders' }" class="btn">
                    <Icon icon="mdi:cart-arrow-down" /> Minhas ordens
                </RouterLink>
                <button class="btn" :disabled="!config || config.mode === 'off' || overview?.running" @click="runNow">
                    <Icon icon="mdi:play" :class="{ spin: overview?.running }" />
                    {{ overview?.running ? 'Rodando...' : 'Rodar agora' }}
                </button>
            </div>
        </header>

        <p v-if="loadError" class="panel-error">{{ loadError }}</p>
        <div v-else-if="!overview" class="empty-state">Lendo o trader...</div>

        <template v-else>
            <p v-if="!overview.liveAllowed" class="panel-warn">
                Este servidor não tem <code>MARKET_TRADER_ENABLED=true</code>: o ciclo automático não roda e o modo real não liga.
                "Rodar agora" funciona no simulado.
            </p>
            <p v-if="overview.market?.falling" class="panel-warn">
                O mercado caiu {{ overview.market.movePct?.toFixed(1) }} pontos em 3 dias: sem compras novas e lances cancelados até estabilizar.
            </p>

            <section class="toolbar">
                <div class="kpi mode-card">
                    <span class="kpi-label">Modo</span>
                    <div class="mode-switch" role="group" aria-label="Modo do trader">
                        <button
                            v-for="option in MODES"
                            :key="option.value"
                            class="mode-option"
                            :class="[option.value, { active: config?.mode === option.value }]"
                            :aria-pressed="config?.mode === option.value"
                            :disabled="saving"
                            @click="chooseMode(option.value)"
                        >
                            <Icon :icon="option.icon" /> {{ option.label }}
                        </button>
                    </div>
                </div>

                <label class="field">
                    <span class="field-label">Conta do trader</span>
                    <select :value="traderBot?.id ?? ''" @change="selectBot">
                        <option value="">Escolher conta...</option>
                        <option v-for="bot in overview.bots" :key="bot.id" :value="bot.id">{{ bot.name }}</option>
                    </select>
                    <span class="kpi-sub">Sai do estoque do site. Precisa estar vazia e com identity secret.</span>
                </label>

                <div class="kpi">
                    <span class="kpi-label">Saldo da carteira</span>
                    <span v-if="overview.wallet" class="kpi-value">{{ formatMoney(overview.wallet.balanceCents, overview.wallet.currency) }}</span>
                    <span v-else class="kpi-sub">{{ traderBot ? 'Não deu pra ler' : 'Sem conta definida' }}</span>
                </div>

                <div class="kpi">
                    <span class="kpi-label">Em uso / orçamento</span>
                    <span class="kpi-value">{{ money(activeSummary?.committedCents) }}</span>
                    <span class="kpi-sub">de {{ money(config?.budgetCents) }} · {{ activeSummary?.openCount ?? 0 }} aberta(s)</span>
                </div>

                <div class="kpi">
                    <span class="kpi-label">Resultado real</span>
                    <span class="kpi-value" :class="{ gain: overview.summary.live.realizedCents > 0, danger: overview.summary.live.realizedCents < 0 }">
                        {{ signedMoney(overview.summary.live.realizedCents) }}
                    </span>
                    <span class="kpi-sub">
                        {{ overview.summary.live.wins }}/{{ overview.summary.live.soldCount }} com lucro
                        <template v-if="overview.summary.live.returnPct !== null"> · {{ overview.summary.live.returnPct }}%</template>
                    </span>
                </div>

                <div class="kpi">
                    <span class="kpi-label">
                        Resultado simulado
                        <InfoTip text="Assume que toda ordem executa e vende no consenso −3% quando a trava acaba: é o teto, não uma previsão do real." />
                    </span>
                    <span class="kpi-value">{{ signedMoney(overview.summary.paper.realizedCents) }}</span>
                    <span class="kpi-sub">
                        {{ overview.summary.paper.wins }}/{{ overview.summary.paper.soldCount }} com lucro
                        <template v-if="overview.summary.paper.returnPct !== null"> · {{ overview.summary.paper.returnPct }}%</template>
                    </span>
                </div>
            </section>

            <div class="section-row">
                <h2 class="section-heading"><Icon icon="mdi:briefcase-outline" /> Posições</h2>
                <div class="tabs" role="tablist">
                    <button class="tab" :class="{ active: !showClosed }" role="tab" :aria-selected="!showClosed" @click="showClosed = false">Abertas</button>
                    <button class="tab" :class="{ active: showClosed }" role="tab" :aria-selected="showClosed" @click="showClosed = true">Encerradas</button>
                </div>
            </div>

            <div v-if="!visiblePositions.length" class="empty-state">
                <Icon icon="mdi:briefcase-off-outline" class="empty-icon" />
                <p>{{ showClosed ? 'Nenhuma posição encerrada.' : 'Nenhuma posição aberta.' }}</p>
            </div>

            <section v-else class="section table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Situação</th>
                            <th class="num">Custo</th>
                            <th class="num">Recebe</th>
                            <th class="num">Resultado</th>
                            <th>{{ showClosed ? 'Encerrou' : 'Destrava' }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="position in visiblePositions" :key="position.id">
                            <td class="item-cell">
                                <RouterLink :to="liveRoute(position.marketHashName)" class="item-name">{{ position.marketHashName }}</RouterLink>
                                <span class="item-reason">
                                    <span v-if="position.mode === 'paper'" class="tag">simulado</span>
                                    {{ position.closedReason ?? reasonOf(position) }}
                                </span>
                            </td>
                            <td><span class="status" :class="position.status">{{ statusLabel(position) }}</span></td>
                            <td class="num">{{ money(position.bidCents) }}</td>
                            <td class="num">{{ money(position.receiveCents) }}</td>
                            <td class="num" :class="{ gain: (profitOf(position) ?? 0) > 0, danger: (profitOf(position) ?? 0) < 0 }">
                                {{ profitOf(position) === null ? '—' : signedMoney(profitOf(position) as number) }}
                            </td>
                            <td class="muted">{{ moment(showClosed ? position.closedAt : position.unlocksAt) }}</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <TraderHoursPanel />

            <h2 class="section-heading"><Icon icon="mdi:tune-variant" /> Limites</h2>
            <form class="section limits" @submit.prevent="saveLimits">
                <label v-for="field in FIELDS" :key="field.key" class="limit">
                    <span class="field-label">{{ field.label }} <InfoTip v-if="field.tip" :text="field.tip" /></span>
                    <input v-model.number="form[field.key]" type="number" min="0" :step="field.unit === 'money' ? '0.01' : '1'" required />
                </label>
                <div class="limits-actions">
                    <button class="btn btn-primary" type="submit" :disabled="saving">Salvar limites</button>
                </div>
            </form>
        </template>

        <TraderHistoryModal v-if="historyOpen" @close="historyOpen = false" />

        <ConfirmActionModal
            :open="pendingMode !== null"
            :title="pendingMode === 'live' ? 'Ligar o modo real' : 'Sair do modo real'"
            :description="modeDescription"
            :confirm-label="pendingMode === 'live' ? 'Ligar com dinheiro real' : 'Confirmar'"
            loading-label="Aplicando..."
            :variant="pendingMode === 'live' ? 'danger' : 'primary'"
            :delay-seconds="pendingMode === 'live' ? 5 : 2"
            :loading="saving"
            @update:open="closeModeModal"
            @confirm="applyMode(pendingMode as MarketTraderMode)"
        />
    </div>
</template>

<style scoped lang="stylus">
.view-wrap
    padding 2rem

.page-header
    display flex
    align-items flex-start
    justify-content space-between
    gap 1rem
    flex-wrap wrap
    margin-bottom 1.5rem

.page-title
    font-size 1.75rem
    font-weight 700
    color #fff
    display flex
    align-items center
    gap 0.5rem

.page-sub
    color #94a3b8
    font-size 0.9rem
    margin-top 0.25rem

.header-actions
    display flex
    align-items center
    gap 0.75rem
    flex-wrap wrap

.fetched
    color #64748b
    font-size 0.8rem

.btn
    display inline-flex
    align-items center
    gap 0.4rem
    background #1a1a1e
    color #cbd5e1
    border 1px solid rgba(255,255,255,0.1)
    padding 0.5rem 1rem
    border-radius 8px
    font-size 0.875rem
    cursor pointer
    text-decoration none
    white-space nowrap

    &:hover:not(:disabled)
        background #2a2a30

    &:disabled
        opacity 0.5
        cursor default

.btn-primary
    background #4f46e5
    border-color #4f46e5
    color #fff

    &:hover:not(:disabled)
        background #4338ca

.spin
    animation spin 0.9s linear infinite

@keyframes spin
    to
        transform rotate(360deg)

.toolbar
    display grid
    grid-template-columns repeat(auto-fit, minmax(200px, 1fr))
    gap 0.75rem
    margin-bottom 1rem

.field, .kpi
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 12px
    padding 0.9rem 1.1rem
    display flex
    flex-direction column
    gap 0.3rem

.mode-card
    grid-column span 2

.mode-switch
    display grid
    grid-template-columns repeat(3, 1fr)
    gap 0.35rem
    margin-top 0.2rem

.mode-option
    display inline-flex
    align-items center
    justify-content center
    gap 0.35rem
    background #121214
    border 1px solid rgba(255,255,255,0.1)
    border-radius 8px
    color #94a3b8
    padding 0.5rem
    font-size 0.85rem
    cursor pointer

    &:hover:not(:disabled):not(.active)
        color #e2e8f0

    &.active
        color #fff
        font-weight 600

    &.off.active
        background rgba(148,163,184,0.2)
        border-color #94a3b8

    &.paper.active
        background rgba(99,102,241,0.25)
        border-color #6366f1

    &.live.active
        background rgba(34,197,94,0.2)
        border-color #22c55e

.field select, .limit input
    background #121214
    border 1px solid rgba(255,255,255,0.1)
    border-radius 8px
    color #fff
    padding 0.5rem 0.7rem
    font-size 0.9rem
    outline none
    width 100%

    &:focus
        border-color #6366f1

.field-label, .kpi-label
    color #94a3b8
    font-size 0.78rem
    display flex
    align-items center
    gap 0.3rem

.kpi-value
    font-size 1.3rem
    font-weight 700
    font-variant-numeric tabular-nums
    color #e2e8f0

.kpi-sub
    color #64748b
    font-size 0.78rem

.gain
    color #86efac !important

.danger
    color #fca5a5 !important

.panel-error, .panel-warn
    border-radius 10px
    padding 0.75rem 1rem
    font-size 0.85rem
    margin-bottom 1rem

.panel-error
    background rgba(248,113,113,0.08)
    border 1px solid rgba(248,113,113,0.25)
    color #fca5a5

.panel-warn
    background rgba(255,152,0,0.08)
    border 1px solid rgba(255,152,0,0.25)
    color #fdba74

.empty-state
    background #1a1a1e
    border 1px dashed rgba(255,255,255,0.08)
    border-radius 12px
    padding 2.5rem 1.5rem
    text-align center
    color #94a3b8
    display flex
    flex-direction column
    align-items center
    gap 0.5rem

.empty-icon
    font-size 2.5rem
    color #475569

@media (max-width: 1100px)
    .mode-card
        grid-column auto

.section
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 12px
    padding 1.25rem

.section-row
    display flex
    align-items center
    justify-content space-between
    gap 1rem
    flex-wrap wrap

.section-heading
    display flex
    align-items center
    gap 0.4rem
    font-size 1rem
    font-weight 600
    color #e2e8f0
    margin 1.25rem 0 0.75rem

.tabs
    display flex
    gap 0.25rem

.tab
    background none
    border none
    color #64748b
    padding 0.3rem 0.7rem
    border-radius 6px
    font-size 0.82rem
    cursor pointer

    &.active
        background rgba(255,255,255,0.08)
        color #e2e8f0

.table-wrap
    overflow-x auto

table
    width 100%
    border-collapse collapse
    font-size 0.85rem

th
    text-align left
    color #64748b
    font-weight 500
    font-size 0.72rem
    padding 0.45rem 0.6rem
    border-bottom 1px solid rgba(255,255,255,0.06)
    white-space nowrap

td
    padding 0.55rem 0.6rem
    color #cbd5e1
    border-bottom 1px solid rgba(255,255,255,0.03)
    white-space nowrap

.num
    text-align right
    font-variant-numeric tabular-nums

.muted
    color #64748b

.item-cell
    white-space normal
    min-width 220px

.item-name
    display block
    color #e2e8f0
    text-decoration none

    &:hover
        text-decoration underline

.item-reason
    display block
    color #64748b
    font-size 0.74rem
    margin-top 0.1rem

.tag
    background rgba(99,102,241,0.18)
    color #a5b4fc
    border-radius 4px
    padding 0 0.3rem
    margin-right 0.25rem

.status
    padding 2px 8px
    border-radius 6px
    font-size 0.75rem
    font-weight 600
    background rgba(148,163,184,0.12)
    color #cbd5e1

    &.bidding
        background rgba(99,102,241,0.15)
        color #a5b4fc

    &.holding, &.unclaimed
        background rgba(255,152,0,0.12)
        color #fdba74

    &.listed
        background rgba(56,189,248,0.12)
        color #7dd3fc

    &.sold
        background rgba(74,222,128,0.12)
        color #86efac

.limits
    display grid
    grid-template-columns repeat(auto-fill, minmax(210px, 1fr))
    gap 0.9rem

.limit
    display flex
    flex-direction column
    justify-content flex-end
    gap 0.3rem

.limits-actions
    grid-column 1 / -1
    display flex
    justify-content flex-end

@media (max-width: 640px)
    .view-wrap
        padding 1rem
</style>
