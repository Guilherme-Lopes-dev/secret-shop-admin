import { computed, onMounted, ref, watch } from 'vue'
import { adminService } from '@/services/admin/admin.service'
import type { SteamBotWallet } from '@/services/admin/types'
import { persistedRef } from '@/utils/persistedRef'

type BotOption = { id: string; name: string; is_active: boolean | null }

const errorMessage = (error: unknown, fallback: string) =>
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback

// Estado do módulo, não do componente: painel de compra, de venda e a tela de ordens mostram o
// mesmo bot e a mesma carteira. Cada um com o seu, trocar o bot num não mudava no outro.
const bots = ref<BotOption[]>([])
const botId = persistedRef('steam-market:bot', '')
/** true depois que a lista de bots chegou e o bot lembrado foi conferido. */
const botsReady = ref(false)
const wallet = ref<SteamBotWallet | null>(null)
const walletError = ref<string | null>(null)
const walletLoading = ref(false)
let botsRequest: Promise<void> | null = null

const botName = computed(() => bots.value.find(bot => bot.id === botId.value)?.name ?? '—')

const applyBots = (list: BotOption[]) => {
    bots.value = list.filter(bot => bot.is_active !== false)
    if (bots.value.some(bot => bot.id === botId.value)) return
    botId.value = bots.value[0]?.id ?? ''
}

const loadBots = async () => {
    const response = await adminService.getSteamBots().catch(() => null)
    botsReady.value = true
    // Falhou: mantém o bot lembrado e a próxima tela que montar tenta de novo.
    if (!response) {
        botsRequest = null
        return
    }
    applyBots(response.data as BotOption[])
}

// Trocar de bot rápido: a resposta do anterior não pode pintar o saldo do atual
// (o saldo decide o bloqueio de moeda e o aviso de "maior que o saldo").
const loadWallet = async () => {
    const id = botId.value
    wallet.value = null
    walletError.value = null
    if (!id) return

    walletLoading.value = true
    try {
        const { data } = await adminService.getSteamBotWallet(id)
        if (id === botId.value) wallet.value = data
    } catch (error) {
        if (id === botId.value) walletError.value = errorMessage(error, 'Não deu pra ler a carteira do bot.')
    } finally {
        if (id === botId.value) walletLoading.value = false
    }
}

watch(botId, loadWallet)

// Bots: uma vez por sessão do admin (F5 recarrega). Carteira: a cada tela, pro saldo vir fresco.
const start = async () => {
    const remembered = botId.value
    botsRequest ??= loadBots()
    await botsRequest
    // Se o bot lembrado sumiu, loadBots troca o id e o watch já carrega a carteira.
    if (botId.value === remembered) loadWallet()
}

/**
 * Bot escolhido (lembrado entre telas) + saldo da carteira Steam dele, lido pelo TradeBot.
 * Quem lê dado do bot (inventário, ordens) espera `botsReady`: antes disso o id pode ser de um
 * bot lembrado que já não existe, e a leitura sairia duas vezes (bot velho e bot certo).
 */
export function useSteamBotWallet() {
    onMounted(start)

    return { bots, botId, botName, botsReady, wallet, walletError, walletLoading }
}
