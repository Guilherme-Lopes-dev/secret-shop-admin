<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { affiliatesService, type AffiliatePayoutRow } from '@/services/affiliates/affiliates.service'
import { formatCurrency } from '@/utils/formatCurrency'

const router = useRouter()
const payouts = ref<AffiliatePayoutRow[]>([])
const loading = ref(true)
const working = ref('')
const notes = ref<Record<string, string>>({})

const BADGES: Record<string, string> = {
    OPEN: 'badge--info',
    REQUESTED: 'badge--warn',
    PAID: 'badge--ok',
    CANCELED: 'badge--danger',
}

const fetchPayouts = async () => {
    loading.value = true
    try {
        const response = await affiliatesService.payouts()
        payouts.value = response.data ?? []
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao carregar payouts.')
    } finally {
        loading.value = false
    }
}

const closeCycle = async () => {
    working.value = 'cycle'
    try {
        const response = await affiliatesService.closeCycle()
        toast.success(`Ciclo fechado: ${response.data?.created ?? 0} payout(s).`)
        await fetchPayouts()
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao fechar o ciclo.')
    } finally {
        working.value = ''
    }
}

const markPaid = async (payout: AffiliatePayoutRow) => {
    working.value = payout.id
    try {
        await affiliatesService.markPayoutPaid(payout.id, notes.value[payout.id]?.trim() || undefined)
        delete notes.value[payout.id]
        toast.success('Payout marcado como pago.')
        await fetchPayouts()
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao marcar como pago.')
    } finally {
        working.value = ''
    }
}

const cancel = async (payout: AffiliatePayoutRow) => {
    working.value = payout.id
    try {
        await affiliatesService.cancelPayout(payout.id, notes.value[payout.id]?.trim() || undefined)
        delete notes.value[payout.id]
        toast.success('Payout cancelado. Comissões voltaram para a fila.')
        await fetchPayouts()
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao cancelar.')
    } finally {
        working.value = ''
    }
}

const copyPix = async (key: string | null) => {
    if (!key) return toast.error('Afiliado sem chave PIX cadastrada.')

    try {
        await navigator.clipboard.writeText(key)
        toast.success('Chave PIX copiada.')
    } catch {
        toast.error(`Não consegui copiar. Chave: ${key}`)
    }
}

onMounted(fetchPayouts)
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <button class="btn-ghost" @click="router.push('/affiliates')">
                    <Icon icon="mdi:arrow-left" /> Afiliados
                </button>
                <h1 class="page-title" style="margin-top: 0.75rem">Payouts</h1>
                <p class="page-subtitle">
                    O PIX sai da sua mão. Marcar como pago é o que transforma as comissões em PAID.
                </p>
            </div>
            <button class="btn-primary" :disabled="working === 'cycle'" @click="closeCycle">
                <Icon icon="mdi:calendar-check" />
                {{ working === 'cycle' ? 'Fechando...' : 'Fechar ciclo agora' }}
            </button>
        </header>

        <div v-if="loading" class="state">Carregando...</div>
        <div v-else-if="!payouts.length" class="state">Nenhum payout. Feche um ciclo para gerar.</div>

        <div v-else class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Afiliado</th><th>Ciclo</th><th>Valor</th>
                        <th>PIX</th><th>Status</th><th>Comprovante</th><th></th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="payout in payouts" :key="payout.id">
                        <td><strong>{{ payout.affiliate?.display_name || '—' }}</strong></td>
                        <td>{{ payout.cycle }}</td>
                        <td class="accent">{{ formatCurrency(payout.amount) }}</td>
                        <td>
                            <span class="code-cell">
                                {{ payout.affiliate?.pix_key || 'sem chave' }}
                                <button class="icon-btn" title="Copiar" @click="copyPix(payout.affiliate?.pix_key ?? null)">
                                    <Icon icon="mdi:content-copy" />
                                </button>
                            </span>
                        </td>
                        <td><span class="badge" :class="BADGES[payout.status]">{{ payout.status }}</span></td>
                        <td>
                            <input
                                v-if="payout.status !== 'PAID' && payout.status !== 'CANCELED'"
                                v-model="notes[payout.id]"
                                placeholder="id do PIX"
                            />
                            <span v-else class="muted">—</span>
                        </td>
                        <td>
                            <div v-if="payout.status !== 'PAID' && payout.status !== 'CANCELED'" class="header-actions">
                                <button class="btn-primary" :disabled="working === payout.id" @click="markPaid(payout)">
                                    Marcar pago
                                </button>
                                <button class="btn-danger" :disabled="working === payout.id" @click="cancel(payout)">
                                    Cancelar
                                </button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<style lang="stylus" scoped>
@import './affiliates.styl'
</style>
