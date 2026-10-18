import { computed, onMounted, ref, watch } from 'vue'
import { adminService } from '@/services/admin/admin.service'
import type { SteamBotWallet } from '@/services/admin/types'
import { persistedRef } from '@/utils/persistedRef'

type BotOption = { id: string; name: string; is_active: boolean | null }

const errorMessage = (error: unknown, fallback: string) =>
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback

/** Bot escolhido (lembrado entre telas) + saldo da carteira Steam dele, lido pelo TradeBot. */
export function useSteamBotWallet() {
    const bots = ref<BotOption[]>([])
    const botId = persistedRef('steam-market:bot', '')
    const wallet = ref<SteamBotWallet | null>(null)
    const walletError = ref<string | null>(null)
    const walletLoading = ref(false)

    const botName = computed(() => bots.value.find(bot => bot.id === botId.value)?.name ?? '—')

    const loadBots = async () => {
        const response = await adminService.getSteamBots().catch(() => null)
        bots.value = ((response?.data ?? []) as BotOption[]).filter(bot => bot.is_active !== false)
        if (bots.value.some(bot => bot.id === botId.value)) return
        botId.value = bots.value[0]?.id ?? ''
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
    onMounted(async () => {
        const remembered = botId.value
        await loadBots()
        // Se o bot lembrado sumiu, loadBots troca o id e o watch já carrega a carteira.
        if (botId.value === remembered) loadWallet()
    })

    return { bots, botId, botName, wallet, walletError, walletLoading }
}
