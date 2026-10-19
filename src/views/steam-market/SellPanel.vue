<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import ConfirmActionModal from '@/components/common/ConfirmActionModal.vue'
import { adminService } from '@/services/admin/admin.service'
import type { SteamInventoryItem, SteamSellResult } from '@/services/admin/types'
import { toCents } from '@/utils/toCents'
import { buyerPays, formatMoney, formatPct, pctChange, sellerReceives } from './marketMath'
import { useSteamBotWallet } from './useSteamBotWallet'

// Menor preço que a Steam aceita pro comprador: 1 centavo + 1 de cada taxa.
const MIN_BUYER_CENTS = 3

const props = defineProps<{
    marketHashName: string
    itemName: string
    /** Moeda em que a tela mostrou o mercado. */
    currency: string | null
    minSellCents: number | null
    maxBuyCents: number | null
    referenceCents: number | null
}>()

const toInput = (cents: number | null) => (cents == null ? '' : (cents / 100).toFixed(2).replace('.', ','))

const { bots, botId, botName, botsReady, wallet, walletError, walletLoading } = useSteamBotWallet()

const items = ref<SteamInventoryItem[]>([])
const itemsLoading = ref(false)
const itemsError = ref<string | null>(null)
const assetId = ref('')

// 1 centavo abaixo do menor preço: vira a listing mais barata do Market.
const priceInput = ref(toInput(props.minSellCents ? props.minSellCents - 1 : props.referenceCents))

const confirmOpen = ref(false)
const selling = ref(false)
const sellError = ref<string | null>(null)
const result = ref<SteamSellResult | null>(null)

const SELL_TOAST: Record<SteamSellResult['status'], string> = {
    listed: 'Item à venda no Market.',
    awaiting_confirmation: 'Venda criada, esperando a confirmação mobile.',
}

const errorMessage = (error: unknown, fallback: string) =>
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback

const isSellable = (item: SteamInventoryItem) => item.marketable && item.siteStatus !== 'committed'
// Primeiro o que é só do trader (o site não conhece), depois o que está na vitrine.
const firstSellable = () => {
    const sellable = items.value.filter(isSellable)
    return (sellable.find(item => item.siteStatus === null) ?? sellable[0])?.assetId ?? ''
}

const itemNote = (item: SteamInventoryItem) => {
    if (!item.marketable) return 'travado (comprado há menos de 7 dias)'
    if (item.siteStatus === 'committed') return 'reservado/vendido no site'
    if (item.siteStatus === 'on_sale') return 'à venda no site'
    return 'livre'
}

const loadItems = async () => {
    const id = botId.value
    items.value = []
    itemsError.value = null
    assetId.value = ''
    if (!id) return

    itemsLoading.value = true
    try {
        const { data } = await adminService.getSteamInventory(id, props.marketHashName)
        if (id !== botId.value) return
        items.value = data.items
        assetId.value = firstSellable()
    } catch (error) {
        if (id === botId.value) itemsError.value = errorMessage(error, 'Não deu pra ler o inventário do bot.')
    } finally {
        // Trocou de bot no meio: quem desliga o loading é a consulta nova.
        if (id === botId.value) itemsLoading.value = false
    }
}

// Abrir/fechar o painel relê, mas o TradeBot guarda o inventário 60s: não volta na Steam.
watch([botId, botsReady], () => {
    if (botsReady.value) loadItems()
}, { immediate: true })

const selectedItem = computed(() => items.value.find(item => item.assetId === assetId.value) ?? null)
const sellableCount = computed(() => items.value.filter(isSellable).length)

const buyerInputCents = computed(() => toCents(priceInput.value) ?? null)
const receiveCents = computed(() =>
    buyerInputCents.value != null && buyerInputCents.value >= MIN_BUYER_CENTS ? sellerReceives(buyerInputCents.value) : null,
)
// Nem todo total fecha com as taxas arredondadas: este é o preço que o comprador vai ver de fato.
const listedCents = computed(() => (receiveCents.value != null ? buyerPays(receiveCents.value) : null))
const walletCurrency = computed(() => wallet.value?.currency ?? props.currency)

const sellsNow = computed(() =>
    listedCents.value != null && !!props.maxBuyCents && listedCents.value <= props.maxBuyCents,
)
// Tela em uma moeda e carteira em outra: o preço digitado não significaria a mesma coisa.
const currencyMismatch = computed(() =>
    wallet.value != null && props.currency != null && wallet.value.currency !== props.currency,
)
const vsReference = computed(() =>
    walletCurrency.value === 'BRL' ? pctChange(listedCents.value, props.referenceCents) : null,
)

const blockReason = computed(() => {
    if (!botId.value) return 'Escolha o bot.'
    if (!wallet.value) return walletLoading.value ? 'Lendo a carteira do bot...' : 'Carteira do bot indisponível.'
    if (currencyMismatch.value) return `Carteira em ${wallet.value.currency}, mercado em ${props.currency}.`
    if (!selectedItem.value) return itemsLoading.value ? 'Lendo o inventário do bot...' : 'Nenhum desse item pra vender.'
    if (!isSellable(selectedItem.value)) return 'Esse item não pode ser vendido agora.'
    if (receiveCents.value == null) return 'Preço inválido (mínimo 0,03).'
    return null
})

const money = (cents: number | null) => formatMoney(cents, walletCurrency.value)

const confirmDescription = computed(() => {
    const action = sellsNow.value
        ? 'O preço cobre a maior buy order: a Steam vende NA HORA pra ela.'
        : 'A venda fica aberta no Market até alguém comprar ou você retirar.'
    return `"${props.itemName}" (asset ${assetId.value}) a ${money(listedCents.value)} pro comprador; ` +
        `o bot recebe ${money(receiveCents.value)}, pela conta ${botName.value}. ${action}`
})

const setPrice = (cents: number | null) => {
    priceInput.value = toInput(cents)
}

const sell = async () => {
    if (blockReason.value || receiveCents.value == null) return

    const soldAssetId = assetId.value
    selling.value = true
    sellError.value = null
    try {
        const { data } = await adminService.sellSteamItem({
            botId: botId.value,
            assetId: soldAssetId,
            receiveCents: receiveCents.value,
        })
        result.value = data
        // Virou listing: o item sai do inventário do bot.
        items.value = items.value.filter(item => item.assetId !== soldAssetId)
        assetId.value = firstSellable()
        toast.success(SELL_TOAST[data.status])
        if (data.siteWarning) toast.warning(data.siteWarning)
    } catch (error) {
        sellError.value = errorMessage(error, 'A Steam não aceitou a venda.')
    } finally {
        selling.value = false
        confirmOpen.value = false
    }
}
</script>

<template>
    <section class="panel sell">
        <h2 class="panel-title"><Icon icon="mdi:tag-outline" /> Vender no Market</h2>

        <div class="fields">
            <label class="field">
                <span class="field-label">Conta (bot)</span>
                <select v-model="botId" :disabled="selling">
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
                <span class="field-label">Item no inventário do bot</span>
                <select v-model="assetId" :disabled="selling || itemsLoading">
                    <option v-if="!items.length" value="">{{ itemsLoading ? 'Lendo inventário...' : 'Nenhum no inventário' }}</option>
                    <option v-for="item in items" :key="item.assetId" :value="item.assetId" :disabled="!isSellable(item)">
                        asset {{ item.assetId }} · {{ itemNote(item) }}
                    </option>
                </select>
                <span class="field-hint">
                    <span v-if="itemsError" class="text-error">{{ itemsError }}</span>
                    <template v-else-if="items.length">{{ sellableCount }} de {{ items.length }} podem ir pro Market</template>
                </span>
            </label>

            <label class="field">
                <span class="field-label">Comprador paga (com taxa)</span>
                <input v-model="priceInput" inputmode="decimal" placeholder="0,00" :disabled="selling" />
                <span class="chips">
                    <button v-if="minSellCents" type="button" class="chip" @click="setPrice(minSellCents - 1)">
                        Menor preço − 0,01
                    </button>
                    <button v-if="maxBuyCents" type="button" class="chip" @click="setPrice(maxBuyCents)">
                        Maior buy order (vende na hora)
                    </button>
                </span>
            </label>

            <div class="field summary">
                <span class="field-label">Bot recebe (sem taxa)</span>
                <span class="total">{{ money(receiveCents) }}</span>
                <span class="field-hint">comprador vê {{ money(listedCents) }} · vs referência do banco: {{ formatPct(vsReference) }}</span>
            </div>
        </div>

        <ul class="warnings">
            <li v-if="sellsNow" class="warn">
                <Icon icon="mdi:flash" /> Preço ≤ maior buy order ({{ money(maxBuyCents) }}): vende na hora, não fica esperando.
            </li>
            <li v-if="selectedItem?.siteStatus === 'on_sale'" class="warn">
                <Icon icon="mdi:store-remove-outline" /> Esse item está à venda no site: ao pôr no Market, ele sai da vitrine na hora.
            </li>
            <li class="info">
                <Icon icon="mdi:wallet-outline" /> O dinheiro da venda cai na carteira Steam do bot e não dá pra sacar.
            </li>
        </ul>

        <p v-if="sellError" class="text-error box">{{ sellError }}</p>

        <div class="actions">
            <span v-if="blockReason" class="muted">{{ blockReason }}</span>
            <button class="btn-primary" :disabled="!!blockReason || selling" @click="confirmOpen = true">
                Revisar e vender
            </button>
        </div>

        <div v-if="result" class="result" :class="result.status === 'listed' ? 'open' : 'unknown'">
            <p v-if="result.status === 'listed'"><Icon icon="mdi:check-circle" /> Item à venda no Market.</p>
            <p v-else>
                <Icon icon="mdi:cellphone-check" /> Venda criada, falta a confirmação mobile. O bot aprova sozinho em ~10s;
                se ele não tiver identity secret, aprove no app da Steam.
            </p>
            <p v-if="result.siteWarning" class="text-error"><Icon icon="mdi:store-alert-outline" /> {{ result.siteWarning }}</p>
            <RouterLink :to="{ name: 'steam-buy-orders' }" class="link">Ver as vendas abertas da conta →</RouterLink>
        </div>

        <ConfirmActionModal
            v-model:open="confirmOpen"
            title="Vender no Steam Market"
            :description="confirmDescription"
            confirm-label="Pôr à venda"
            loading-label="Falando com a Steam..."
            icon="mdi:tag-outline"
            :delay-seconds="3"
            :loading="selling"
            @confirm="sell"
        />
    </section>
</template>

<style lang="stylus" scoped>
@import './order-panel.styl'
</style>
