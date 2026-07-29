<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import {
    affiliatesService,
    describeCents,
    describeRate,
    optionalInt,
    type AffiliateDetail,
} from '@/services/affiliates/affiliates.service'
import { formatCurrency } from '@/utils/formatCurrency'

const route = useRoute()
const router = useRouter()
const uuid = route.params.uuid as string

const affiliate = ref<AffiliateDetail | null>(null)
const loading = ref(true)
const saving = ref(false)

const form = ref({
    displayName: '',
    document: '',
    pixKey: '',
    rateNewBps: '' as string | number,
    rateReturningBps: '' as string | number,
    monthlyCap: '' as string | number,
    status: 'ACTIVE',
})

const linkForm = ref({ code: '', label: '', couponCode: '' })
const savingLink = ref(false)

// O /r/:code é servido pelo backend; a loja faz proxy desse path (vercel.json).
// ponytail: domínio fixo — só existe uma loja. Vira env var quando houver outra.
const redirectOrigin = 'https://secretshopgg.com'

const fetchDetail = async () => {
    loading.value = true
    try {
        const response = await affiliatesService.detail(uuid)
        affiliate.value = response.data
        form.value = {
            displayName: response.data.displayName,
            document: response.data.document,
            pixKey: response.data.pixKey ?? '',
            rateNewBps: response.data.rateNewBps ?? '',
            rateReturningBps: response.data.rateReturningBps ?? '',
            monthlyCap: response.data.monthlyCap ?? '',
            status: response.data.status,
        }
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao carregar afiliado.')
    } finally {
        loading.value = false
    }
}

const save = async () => {
    saving.value = true
    try {
        await affiliatesService.update(uuid, {
            displayName: form.value.displayName.trim(),
            document: form.value.document.trim(),
            pixKey: form.value.pixKey.trim() || null,
            rateNewBps: optionalInt(form.value.rateNewBps),
            rateReturningBps: optionalInt(form.value.rateReturningBps),
            monthlyCap: optionalInt(form.value.monthlyCap),
            status: form.value.status,
        })
        toast.success('Afiliado atualizado.')
        await fetchDetail()
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao salvar.')
    } finally {
        saving.value = false
    }
}

const createLink = async () => {
    if (!linkForm.value.code.trim()) return toast.error('Informe o código do link.')

    savingLink.value = true
    try {
        await affiliatesService.createLink(uuid, {
            code: linkForm.value.code.trim(),
            label: linkForm.value.label.trim() || undefined,
            couponCode: linkForm.value.couponCode.trim() || undefined,
        })
        toast.success('Link criado.')
        linkForm.value = { code: '', label: '', couponCode: '' }
        await fetchDetail()
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao criar link.')
    } finally {
        savingLink.value = false
    }
}

const confirmingLink = ref('')

const removeLink = async (linkUuid: string) => {
    if (confirmingLink.value !== linkUuid) {
        confirmingLink.value = linkUuid
        return
    }

    confirmingLink.value = ''
    try {
        await affiliatesService.removeLink(linkUuid)
        toast.success('Link desativado.')
        await fetchDetail()
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao desativar link.')
    }
}

const linkUrl = (code: string) => `${redirectOrigin}/r/${code}`

const copyLink = async (code: string) => {
    try {
        await navigator.clipboard.writeText(linkUrl(code))
        toast.success('Link copiado.')
    } catch {
        toast.error(`Não consegui copiar. Link: ${linkUrl(code)}`)
    }
}

onMounted(fetchDetail)
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <button class="btn-ghost" @click="router.push('/affiliates')">
                <Icon icon="mdi:arrow-left" /> Afiliados
            </button>
        </header>

        <div v-if="loading" class="state">Carregando...</div>

        <template v-else-if="affiliate">
            <div class="page-header">
                <div>
                    <h1 class="page-title">{{ affiliate.displayName }}</h1>
                    <p class="page-subtitle">{{ affiliate.username || '—' }} · {{ affiliate.steam_id || 'sem steam id' }}</p>
                </div>
            </div>

            <div class="balances">
                <div class="balance-card">
                    <span>Pendente</span><strong>{{ formatCurrency(affiliate.balances.pending) }}</strong>
                </div>
                <div class="balance-card">
                    <span>Liberado</span><strong class="accent">{{ formatCurrency(affiliate.balances.approved) }}</strong>
                </div>
                <div class="balance-card">
                    <span>Pago</span><strong>{{ formatCurrency(affiliate.balances.paid) }}</strong>
                </div>
                <div class="balance-card">
                    <span>Revertido</span><strong class="muted">{{ formatCurrency(affiliate.balances.reversed) }}</strong>
                </div>
            </div>

            <section class="panel">
                <h2 class="panel-title">Cadastro e taxas</h2>
                <p class="panel-hint">Taxa em branco herda o default global. Valores em basis points: 800 = 8%.</p>
                <div class="form-grid">
                    <label class="field"><span>Nome de exibição</span><input v-model="form.displayName" /></label>
                    <label class="field"><span>CPF / CNPJ</span><input v-model="form.document" /></label>
                    <label class="field"><span>Chave PIX</span><input v-model="form.pixKey" /></label>
                    <label class="field">
                        <span>% cliente novo (bps)</span>
                        <input v-model="form.rateNewBps" type="number" placeholder="global" />
                        <small class="field-hint">{{ describeRate(form.rateNewBps) }}</small>
                    </label>
                    <label class="field">
                        <span>% cliente antigo (bps)</span>
                        <input v-model="form.rateReturningBps" type="number" placeholder="global" />
                        <small class="field-hint">{{ describeRate(form.rateReturningBps) }}</small>
                    </label>
                    <label class="field">
                        <span>Teto mensal (centavos)</span>
                        <input v-model="form.monthlyCap" type="number" placeholder="sem teto" />
                        <small class="field-hint">{{ describeCents(form.monthlyCap, 'Sem teto por ciclo.') }}</small>
                    </label>
                    <label class="field">
                        <span>Status</span>
                        <select v-model="form.status">
                            <option value="ACTIVE">Ativo</option>
                            <option value="SUSPENDED">Suspenso</option>
                        </select>
                    </label>
                </div>
                <button class="btn-primary" :disabled="saving" @click="save">
                    {{ saving ? 'Salvando...' : 'Salvar' }}
                </button>
            </section>

            <section class="panel">
                <h2 class="panel-title">Links de campanha</h2>
                <p class="panel-hint">Cupom vinculado é aplicado sozinho no checkout de quem chegar pelo link.</p>

                <div class="form-grid">
                    <label class="field"><span>Código</span><input v-model="linkForm.code" placeholder="FULANO-YT" /></label>
                    <label class="field"><span>Campanha</span><input v-model="linkForm.label" placeholder="youtube janeiro" /></label>
                    <label class="field"><span>Cupom (opcional)</span><input v-model="linkForm.couponCode" placeholder="SAVE10" /></label>
                </div>
                <button class="btn-primary" :disabled="savingLink" @click="createLink">
                    {{ savingLink ? 'Criando...' : 'Criar link' }}
                </button>

                <div v-if="affiliate.links.length" class="table-wrapper" style="margin-top: 1rem">
                    <table>
                        <thead>
                            <tr>
                                <th>Código</th><th>Campanha</th><th>Cupom</th>
                                <th>Cliques</th><th>Vendas</th><th>Status</th><th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="link in affiliate.links" :key="link.id">
                                <td>
                                    <span class="code-cell">
                                        {{ link.code }}
                                        <button class="icon-btn" title="Copiar link" @click="copyLink(link.code)">
                                            <Icon icon="mdi:content-copy" />
                                        </button>
                                    </span>
                                </td>
                                <td class="muted">{{ link.label || '—' }}</td>
                                <td class="muted">{{ link.couponCode || '—' }}</td>
                                <td>{{ link.clicks }}</td>
                                <td>{{ link.conversions }}</td>
                                <td>
                                    <span class="badge" :class="link.isActive ? 'badge--ok' : 'badge--off'">
                                        {{ link.isActive ? 'Ativo' : 'Inativo' }}
                                    </span>
                                </td>
                                <td>
                                    <button v-if="link.isActive" class="btn-danger" @click="removeLink(link.id)">
                                        {{ confirmingLink === link.id ? 'Confirmar?' : 'Desativar' }}
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p v-else class="panel-hint">Nenhum link ainda.</p>
            </section>

            <section class="panel">
                <h2 class="panel-title">Ciclos de pagamento</h2>
                <div v-if="affiliate.payouts.length" class="table-wrapper">
                    <table>
                        <thead><tr><th>Ciclo</th><th>Valor</th><th>Status</th><th>Pago em</th></tr></thead>
                        <tbody>
                            <tr v-for="payout in affiliate.payouts" :key="payout.id">
                                <td>{{ payout.cycle }}</td>
                                <td>{{ formatCurrency(payout.amount) }}</td>
                                <td><span class="badge badge--info">{{ payout.status }}</span></td>
                                <td class="muted">{{ payout.paid_at ? $dayjs(payout.paid_at).format('DD/MM/YYYY') : '—' }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p v-else class="panel-hint">Nenhum ciclo fechado ainda.</p>
            </section>
        </template>
    </div>
</template>

<style lang="stylus" scoped>
@import './affiliates.styl'
</style>
