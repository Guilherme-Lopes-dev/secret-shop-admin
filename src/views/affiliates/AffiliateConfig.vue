<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { affiliatesService, type AffiliateConfig } from '@/services/affiliates/affiliates.service'

const router = useRouter()
const loading = ref(true)
const saving = ref(false)
const config = ref<AffiliateConfig | null>(null)

const FIELDS: { key: keyof AffiliateConfig; label: string; hint: string }[] = [
    { key: 'rateNewBps', label: '% cliente novo (bps)', hint: '800 = 8%. Vale para afiliado sem taxa própria.' },
    { key: 'rateReturningBps', label: '% cliente antigo (bps)', hint: 'Cliente que já era da casa antes do link.' },
    { key: 'windowDays', label: 'Janela de atribuição (dias)', hint: 'Cada clique novo reseta a contagem.' },
    { key: 'minPayout', label: 'Mínimo de saque (centavos)', hint: 'Abaixo disso, rola para o ciclo seguinte.' },
    { key: 'holdPixDays', label: 'Carência PIX (dias)', hint: 'Contada a partir do pagamento.' },
    { key: 'holdCardDays', label: 'Carência cartão (dias)', hint: 'Precisa cobrir a janela de chargeback.' },
    { key: 'clickRetentionDays', label: 'Retenção de cliques (dias)', hint: 'Expurgo automático — os eventos guardam IP.' },
    { key: 'staleDays', label: 'Abandono (dias)', hint: 'Sem entrega confirmada depois disso, a comissão é revertida.' },
]

const fetchConfig = async () => {
    loading.value = true
    try {
        const response = await affiliatesService.getConfig()
        config.value = response.data
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao carregar config.')
    } finally {
        loading.value = false
    }
}

const save = async () => {
    if (!config.value) return

    saving.value = true
    try {
        const response = await affiliatesService.setConfig(config.value)
        config.value = response.data
        toast.success('Config salva.')
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao salvar config.')
    } finally {
        saving.value = false
    }
}

onMounted(fetchConfig)
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <button class="btn-ghost" @click="router.push('/affiliates')">
                    <Icon icon="mdi:arrow-left" /> Afiliados
                </button>
                <h1 class="page-title" style="margin-top: 0.75rem">Config de afiliados</h1>
                <p class="page-subtitle">Defaults globais. Cada afiliado pode sobrescrever as taxas no cadastro dele.</p>
            </div>
        </header>

        <div v-if="loading" class="state">Carregando...</div>

        <section v-else-if="config" class="panel">
            <div class="form-grid">
                <label v-for="field in FIELDS" :key="field.key" class="field">
                    <span>{{ field.label }}</span>
                    <input v-model.number="config[field.key]" type="number" min="0" />
                    <small class="muted" style="font-size: 0.72rem">{{ field.hint }}</small>
                </label>
            </div>
            <button class="btn-primary" :disabled="saving" @click="save">
                {{ saving ? 'Salvando...' : 'Salvar' }}
            </button>
        </section>
    </div>
</template>

<style lang="stylus" scoped>
@import './affiliates.styl'
</style>
