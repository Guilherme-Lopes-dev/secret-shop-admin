<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { affiliatesService, COMMISSIONS_LIMIT, type CommissionRow } from '@/services/affiliates/affiliates.service'
import { formatCurrency } from '@/utils/formatCurrency'

const router = useRouter()
const commissions = ref<CommissionRow[]>([])
const loading = ref(true)
const activeStatus = ref('')

const STATUSES = [
    { value: '', label: 'Todas' },
    { value: 'PENDING', label: 'Pendentes' },
    { value: 'SUSPECT', label: 'Em revisão' },
    { value: 'APPROVED', label: 'Liberadas' },
    { value: 'PAID', label: 'Pagas' },
    { value: 'REVERSED', label: 'Revertidas' },
]

const BADGES: Record<string, string> = {
    PENDING: 'badge--info',
    SUSPECT: 'badge--warn',
    APPROVED: 'badge--ok',
    PAID: 'badge--ok',
    REVERSED: 'badge--danger',
}

const fetchCommissions = async () => {
    loading.value = true
    try {
        const response = await affiliatesService.commissions(activeStatus.value || undefined)
        commissions.value = response.data ?? []
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao carregar comissões.')
    } finally {
        loading.value = false
    }
}

const setStatus = (status: string) => {
    activeStatus.value = status
    void fetchCommissions()
}

const review = async (uuid: string, approve: boolean) => {
    try {
        await affiliatesService.reviewCommission(uuid, approve)
        toast.success(approve ? 'Comissão liberada para carência.' : 'Comissão revertida.')
        await fetchCommissions()
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao revisar.')
    }
}

onMounted(fetchCommissions)
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <button class="btn-ghost" @click="router.push('/affiliates')">
                    <Icon icon="mdi:arrow-left" /> Afiliados
                </button>
                <h1 class="page-title" style="margin-top: 0.75rem">Comissões</h1>
                <p class="page-subtitle">
                    SUSPECT não entra em payout sem você resolver. Liberar devolve para a carência normal.
                </p>
            </div>
        </header>

        <div class="filters">
            <button
                v-for="status in STATUSES"
                :key="status.value"
                class="chip"
                :class="{ active: activeStatus === status.value }"
                @click="setStatus(status.value)"
            >{{ status.label }}</button>
        </div>

        <div v-if="loading" class="state">Carregando...</div>
        <div v-else-if="!commissions.length" class="state">Nenhuma comissão neste filtro.</div>

        <div v-else class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Pedido</th><th>Afiliado</th><th>Link</th><th>Cliente</th>
                        <th>Base</th><th>Taxa</th><th>Comissão</th>
                        <th>Status</th><th>Libera em</th><th></th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="commission in commissions" :key="commission.id">
                        <td><strong>{{ commission.orderNumber || '—' }}</strong></td>
                        <td>{{ commission.affiliateName || '—' }}</td>
                        <td class="muted">{{ commission.linkCode }}</td>
                        <td>
                            <span class="badge" :class="commission.customerKind === 'NEW' ? 'badge--ok' : 'badge--off'">
                                {{ commission.customerKind === 'NEW' ? 'novo' : 'antigo' }}
                            </span>
                        </td>
                        <td class="muted">{{ formatCurrency(commission.baseAmount) }}</td>
                        <td class="muted">{{ (commission.rateBps / 100).toFixed(2) }}%</td>
                        <td class="accent">{{ formatCurrency(commission.amount) }}</td>
                        <td>
                            <span class="badge" :class="BADGES[commission.status] || 'badge--off'">
                                {{ commission.status }}
                            </span>
                            <div v-if="commission.reason" class="muted" style="font-size: 0.72rem">
                                {{ commission.reason }}
                            </div>
                        </td>
                        <td class="muted">
                            {{ commission.holdUntil ? $dayjs(commission.holdUntil).format('DD/MM/YYYY') : '—' }}
                        </td>
                        <td>
                            <div v-if="commission.status === 'SUSPECT'" class="header-actions">
                                <button class="btn-ghost" @click="review(commission.id, true)">Liberar</button>
                                <button class="btn-danger" @click="review(commission.id, false)">Reverter</button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
            <p v-if="commissions.length >= COMMISSIONS_LIMIT" class="panel-hint">
                Mostrando as {{ COMMISSIONS_LIMIT }} mais recentes deste filtro. Filtre por status para ver o resto.
            </p>
        </div>
    </div>
</template>

<style lang="stylus" scoped>
@import './affiliates.styl'
</style>
