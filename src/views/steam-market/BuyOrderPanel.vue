<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import ConfirmActionModal from '@/components/common/ConfirmActionModal.vue'
import { adminService } from '@/services/admin/admin.service'
import type { SteamBuyOrderResult } from '@/services/admin/types'
import { toCents } from '@/utils/toCents'
import { formatMoney, formatPct, pctChange } from './marketMath'
import { useSteamBotWallet } from './useSteamBotWallet'

// Mesmos limites que o backend valida.
const MIN_PRICE_CENTS = 3
const MAX_QUANTITY = 100

const props = defineProps<{
    marketHashName: string
    itemName: string
    /** Moeda em que a tela mostrou o mercado. */
    currency: string | null
    minSellCents: number | null
    maxBuyCents: number | null
    referenceCents: number | null
    tradableAfterDays: number
}>()

const toInput = (cents: number | null) => (cents == null ? '' : (cents / 100).toFixed(2).replace('.', ','))

const { bots, botId, botName, wallet, walletError, walletLoading } = useSteamBotWallet()

// Topo do livro + 1 centavo: vira a maior buy order sem comprar na hora.
const priceInput = ref(toInput(props.maxBuyCents != null ? props.maxBuyCents + 1 : props.referenceCents))
const quantity = ref(1)

// Bot e quantidade da criação: o formulário continua editável depois, e cancelar na conta
// errada falha.
type CreatedOrder = SteamBuyOrderResult & { botId: string; quantity: number }

const confirmOpen = ref(false)
const creating = ref(false)
const createError = ref<string | null>(null)
const result = ref<CreatedOrder | null>(null)
const cancelling = ref(false)
const cancelled = ref(false)
const manualOrderId = ref('')

const STATUS_TOAST: Record<SteamBuyOrderResult['status'], string> = {
    filled: 'Comprou na hora.',
    partial: 'Comprou parte na hora; o resto ficou aberto.',
    open: 'Buy order criada.',
    unknown: 'Buy order criada, mas não deu pra conferir se executou.',
}

const errorMessage = (error: unknown, fallback: string) =>
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback

const priceCents = computed(() => toCents(priceInput.value) ?? null)
const validQuantity = computed(() => Number.isInteger(quantity.value) && quantity.value >= 1 && quantity.value <= MAX_QUANTITY)
const totalCents = computed(() => (priceCents.value != null && validQuantity.value ? priceCents.value * quantity.value : null))
const walletCurrency = computed(() => wallet.value?.currency ?? props.currency)

const executesNow = computed(() =>
    priceCents.value != null && props.minSellCents != null && priceCents.value >= props.minSellCents,
)
const overBalance = computed(() =>
    wallet.value != null && totalCents.value != null && totalCents.value > wallet.value.balanceCents,
)
// Tela em uma moeda e carteira em outra: o preço digitado não significaria a mesma coisa.
const currencyMismatch = computed(() =>
    wallet.value != null && props.currency != null && wallet.value.currency !== props.currency,
)
const vsReference = computed(() =>
    walletCurrency.value === 'BRL' ? pctChange(priceCents.value, props.referenceCents) : null,
)

const blockReason = computed(() => {
    if (!botId.value) return 'Escolha o bot.'
    if (!wallet.value) return walletLoading.value ? 'Lendo a carteira do bot...' : 'Carteira do bot indisponível.'
    if (currencyMismatch.value) return `Carteira em ${wallet.value.currency}, mercado em ${props.currency}.`
    if (priceCents.value == null || priceCents.value < MIN_PRICE_CENTS) return 'Preço inválido.'
    if (!validQuantity.value) return `Quantidade entre 1 e ${MAX_QUANTITY}.`
    return null
})

const money = (cents: number | null) => formatMoney(cents, walletCurrency.value)

const confirmDescription = computed(() => {
    const action = executesNow.value
        ? 'O preço cobre a listing mais barata: a Steam compra NA HORA o que estiver nesse valor.'
        : 'A ordem fica aberta na Steam até um vendedor aceitar o preço ou você cancelar.'
    return `${quantity.value}× "${props.itemName}" a ${money(priceCents.value)} cada (total ${money(totalCents.value)}), ` +
        `pela conta ${botName.value}. ${action}`
})

const setPrice = (cents: number | null) => {
    priceInput.value = toInput(cents)
}

const create = async () => {
    if (blockReason.value || priceCents.value == null) return

    const orderBotId = botId.value
    const orderQuantity = quantity.value
    creating.value = true
    createError.value = null
    try {
        const { data } = await adminService.createSteamBuyOrder({
            botId: orderBotId,
            marketHashName: props.marketHashName,
            priceCents: priceCents.value,
            quantity: orderQuantity,
        })
        result.value = { ...data, botId: orderBotId, quantity: orderQuantity }
        cancelled.value = false
        if (data.wallet) wallet.value = data.wallet
        toast.success(STATUS_TOAST[data.status])
    } catch (error) {
        createError.value = errorMessage(error, 'A Steam não aceitou a buy order.')
    } finally {
        creating.value = false
        confirmOpen.value = false
    }
}

const cancelOrder = async (orderBotId: string, buyOrderId: string) => {
    if (cancelling.value) return false

    cancelling.value = true
    try {
        await adminService.cancelSteamBuyOrder(orderBotId, buyOrderId)
        toast.success(`Buy order ${buyOrderId} cancelada.`)
        return true
    } catch (error) {
        toast.error(errorMessage(error, 'Não deu pra cancelar a buy order.'))
        return false
    } finally {
        cancelling.value = false
    }
}

const cancelResult = async () => {
    if (!result.value) return
    cancelled.value = await cancelOrder(result.value.botId, result.value.buyOrderId)
}

// Ordem que a tela não viu nascer (erro no meio, aba fechada): cancela pelo buy_orderid do log.
const cancelManual = async () => {
    const id = manualOrderId.value.trim()
    if (!/^\d{1,20}$/.test(id)) return toast.error('Informe o buy_orderid (só números).')
    if (await cancelOrder(botId.value, id)) manualOrderId.value = ''
}
</script>

<template>
    <section class="panel">
        <h2 class="panel-title"><Icon icon="mdi:cart-arrow-down" /> Criar buy order</h2>

        <div class="fields">
            <label class="field">
                <span class="field-label">Conta (bot)</span>
                <select v-model="botId" :disabled="creating">
                    <option v-if="!bots.length" value="">Nenhum bot ativo</option>
                    <option v-for="bot in bots" :key="bot.id" :value="bot.id">{{ bot.name }}</option>
                </select>
                <span class="field-hint">
                    <template v-if="walletLoading">Lendo carteira...</template>
                    <template v-else-if="wallet">Saldo: <strong>{{ formatMoney(wallet.balanceCents, wallet.currency) }}</strong></template>
                    <span v-else-if="walletError" class="text-error">{{ walletError }}</span>
                </span>
            </label>

            <label class="field">
                <span class="field-label">Preço por unidade (com taxa)</span>
                <input v-model="priceInput" inputmode="decimal" placeholder="0,00" :disabled="creating" />
                <span class="chips">
                    <button v-if="maxBuyCents != null" type="button" class="chip" @click="setPrice(maxBuyCents + 1)">
                        Topo do livro + 0,01
                    </button>
                    <button v-if="minSellCents != null" type="button" class="chip" @click="setPrice(minSellCents)">
                        Menor preço (compra na hora)
                    </button>
                </span>
            </label>

            <label class="field field-small">
                <span class="field-label">Quantidade</span>
                <input v-model.number="quantity" type="number" min="1" :max="MAX_QUANTITY" step="1" :disabled="creating" />
            </label>

            <div class="field summary">
                <span class="field-label">Total se executar tudo</span>
                <span class="total">{{ money(totalCents) }}</span>
                <span class="field-hint">vs referência do banco: {{ formatPct(vsReference) }}</span>
            </div>
        </div>

        <ul class="warnings">
            <li v-if="executesNow" class="warn">
                <Icon icon="mdi:flash" /> Preço ≥ menor listing ({{ money(minSellCents) }}): executa na hora, não fica esperando.
            </li>
            <li v-if="overBalance" class="danger">
                <Icon icon="mdi:wallet-outline" /> Total maior que o saldo da carteira: a Steam deve recusar.
            </li>
            <li v-if="tradableAfterDays" class="info">
                <Icon icon="mdi:lock-clock" /> Item comprado fica {{ tradableAfterDays }} dias sem poder ser trocado.
            </li>
        </ul>

        <p v-if="createError" class="text-error box">{{ createError }}</p>

        <div class="actions">
            <span v-if="blockReason" class="muted">{{ blockReason }}</span>
            <button class="btn-primary" :disabled="!!blockReason || creating" @click="confirmOpen = true">
                Revisar e criar
            </button>
        </div>

        <div v-if="result" class="result" :class="result.status">
            <p v-if="result.status === 'filled'">
                <Icon icon="mdi:check-circle" /> Comprou na hora: {{ result.purchases.length }} item(ns)
                <span v-if="result.purchases.length" class="mono">(asset {{ result.purchases.map(p => p.assetid).join(', ') }})</span>.
            </p>
            <p v-else-if="result.status === 'partial'">
                <Icon icon="mdi:progress-check" /> Comprou {{ result.purchases.length }} de {{ result.quantity }} na hora; o resto segue aberto.
                <span v-if="result.purchases.length" class="mono">(asset {{ result.purchases.map(p => p.assetid).join(', ') }})</span>
            </p>
            <p v-else-if="result.status === 'open'"><Icon icon="mdi:clock-outline" /> Ordem aberta, esperando vendedor.</p>
            <p v-else>
                <Icon icon="mdi:help-circle-outline" /> Ordem criada, mas a Steam não deixou conferir se já executou.
                Veja o inventário do bot daqui a pouco.
            </p>
            <p class="mono muted">buy_orderid {{ result.buyOrderId }}</p>
            <RouterLink :to="{ name: 'steam-buy-orders' }" class="link">Ver todas as buy orders da conta →</RouterLink>
            <p v-if="cancelled" class="muted">Cancelada.</p>
            <button v-else class="btn-secondary" :disabled="cancelling" @click="cancelResult">
                {{ cancelling ? 'Cancelando...' : 'Cancelar ordem' }}
            </button>
        </div>

        <details class="manual-cancel">
            <summary>Cancelar uma ordem pelo buy_orderid</summary>
            <div class="manual-row">
                <input v-model="manualOrderId" inputmode="numeric" placeholder="ex.: 8713689345" aria-label="buy_orderid" />
                <button class="btn-secondary" :disabled="cancelling || !botId" @click="cancelManual">
                    {{ cancelling ? 'Cancelando...' : 'Cancelar' }}
                </button>
            </div>
            <span class="muted">Usa a conta selecionada acima.</span>
        </details>

        <ConfirmActionModal
            v-model:open="confirmOpen"
            title="Criar buy order na Steam"
            :description="confirmDescription"
            confirm-label="Criar buy order"
            loading-label="Falando com a Steam..."
            icon="mdi:cart-arrow-down"
            :delay-seconds="3"
            :loading="creating"
            @confirm="create"
        />
    </section>
</template>

<style lang="stylus" scoped>
@import './order-panel.styl'
</style>
