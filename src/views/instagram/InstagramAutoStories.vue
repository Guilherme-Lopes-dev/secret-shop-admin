<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import dayjs from 'dayjs'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { adminService } from '@/services/admin/admin.service'
import type {
    AutoStoryConfig,
    AutoStoryCoupon,
    AutoStoryOverview,
    AutoStoryPlan,
    AutoStoryRow,
} from '@/services/admin/types'
import AutoStoryConfigForm from './AutoStoryConfigForm.vue'
import AutoStoryPlanList from './AutoStoryPlanList.vue'
import AutoStoryToday from './AutoStoryToday.vue'
import FinishEditor from './FinishEditor.vue'
import { DEFAULT_LAYOUT, type FinishLayout } from './finishCanvas'
import { mediaUrl } from '@/utils/mediaUrl'

const POLL_MS = 4000
const BUSY_STATUSES: AutoStoryRow['status'][] = ['GENERATING', 'PUBLISHING']

const overview = ref<AutoStoryOverview | null>(null)
const plan = ref<AutoStoryPlan | null>(null)
const coupons = ref<AutoStoryCoupon[]>([])
const loadError = ref('')
const saving = ref(false)
const planLoading = ref(false)

// class-validator manda `message` como lista.
const apiMessage = (err: any, fallback: string) => [err?.response?.data?.message ?? fallback].flat().join(' ')

const busy = computed(() => {
    const data = overview.value
    if (!data) return false
    return data.preparing || data.publishing || data.today.some((row) => BUSY_STATUSES.includes(row.status))
})

const readyCount = computed(() => overview.value?.today.filter((row) => row.status === 'DRAFT').length ?? 0)

const load = async () => {
    try {
        overview.value = (await adminService.getAutoStories()).data
        loadError.value = ''
    } catch (err) {
        loadError.value = apiMessage(err, 'Não deu pra carregar o story automático.')
    }
}

const PLAN_RETRY_MS = 15_000
let planRetry: ReturnType<typeof setTimeout> | undefined

// Ranking ainda calculando (deploy/sync recalcula o snapshot da Steam): pergunta de novo sozinho.
const loadPlan = async () => {
    clearTimeout(planRetry)
    planLoading.value = true
    try {
        plan.value = (await adminService.getAutoStoryPlan()).data
        if (plan.value.ranking_pending) planRetry = setTimeout(loadPlan, PLAN_RETRY_MS)
    } catch (err) {
        plan.value = null
        toast.error(apiMessage(err, 'Não deu pra simular a próxima rodada.'))
    } finally {
        planLoading.value = false
    }
}

const loadCoupons = async () => {
    coupons.value = (await adminService.getAutoStoryCoupons()).data
}

const act = async (request: () => Promise<{ data: AutoStoryOverview }>, fallback: string) => {
    try {
        overview.value = (await request()).data
    } catch (err) {
        toast.error(apiMessage(err, fallback))
    }
}

const saveConfig = async (data: Partial<AutoStoryConfig>) => {
    saving.value = true
    await act(() => adminService.updateAutoStoryConfig(data), 'Não deu pra salvar.')
    saving.value = false
    void loadPlan()
}

const runNow = async () => {
    const preview = plan.value
    // Sem prévia (falhou ao simular) não dá pra prometer número nem custo.
    const detail = preview
        ? ` ${preview.skins.length} stories, ${preview.new_arts} artes novas (~US$ ${preview.estimated_cost_usd.toFixed(2)}).`
        : ' Sem prévia: quantidade e custo dependem do ranking de agora.'
    if (!confirm(`Preparar a rodada agora?${detail} Conta como a rodada de hoje.`)) return

    await act(() => adminService.runAutoStories(), 'Não deu pra começar a rodada.')
}

const publishAll = async () => {
    if (!confirm(`Publicar no Instagram os ${readyCount.value} stories prontos de hoje, um por vez?`)) return
    await act(() => adminService.publishAutoStoriesToday(), 'Não deu pra publicar.')
}

const publishOne = async (row: AutoStoryRow) => {
    if (!confirm(`Publicar "${row.skin?.market_hash_name}" no Instagram?`)) return
    await act(() => adminService.publishAutoStory(row.id), 'Não deu pra publicar.')
}

const discardArt = async (row: AutoStoryRow) => {
    if (!confirm('Descartar a arte dessa skin? A próxima rodada gera outra (custo da IA). O rascunho de hoje continua até você apagar.')) return
    await act(() => adminService.discardAutoStoryArt(row.id), 'Não deu pra descartar a arte.')
}

const removeRow = async (row: AutoStoryRow) => {
    if (!confirm('Apagar esse rascunho? A arte da skin continua guardada.')) return
    try {
        await adminService.deleteInstagramPost(row.id)
        await load()
    } catch (err) {
        toast.error(apiMessage(err, 'Não deu pra apagar.'))
    }
}

// ── Ajuste de posição de um rascunho ─────────────────────────────────────────
const editing = ref<AutoStoryRow | null>(null)
const applyingLayout = ref(false)
const configLayout = computed(() => overview.value?.config.layout ?? DEFAULT_LAYOUT.STORY)
// Mesmo preço que já está na arte: quem confere o preço atual é a publicação.
const editingPrice = computed(() => (editing.value?.auto_meta ? editing.value.auto_meta.price_cents / 100 : null))

const applyLayout = async (layout: FinishLayout) => {
    const row = editing.value
    if (!row) return
    applyingLayout.value = true
    try {
        await adminService.finishInstagramPost(row.id, {
            layout,
            price_brl: editingPrice.value ?? undefined,
            note: row.auto_meta?.note || undefined,
        })
        editing.value = null
        await load()
        toast.success('Arte ajustada.')
    } catch (err) {
        toast.error(apiMessage(err, 'Não deu pra ajustar a arte.'))
    } finally {
        applyingLayout.value = false
    }
}

// "Salvar como padrão" aqui = posição da config (próximas rodadas).
const saveLayoutAsDefault = async (layout: FinishLayout) => {
    await act(() => adminService.updateAutoStoryConfig({ layout }), 'Não deu pra salvar o padrão.')
    toast.success('Padrão do story automático salvo. Vale pras próximas rodadas.')
}

const bandSummary = (band: AutoStoryPlan['bands'][number]) => {
    const prepared = band.prepared ?? 0
    const filled = `${band.label}: ${prepared + band.selected}/${band.count}`
    if (!prepared) return filled

    return `${filled} (${prepared} já prontas)`
}

const formatTime = (value: string | null | undefined) => (value ? dayjs(value).format('DD/MM HH:mm') : '—')

const runSummary = computed(() => {
    const run = overview.value?.last_run
    if (!run) return 'Nenhuma rodada ainda.'
    if (!run.finished_at) return `Rodando desde ${formatTime(run.started_at)}...`
    const result = run.result
    if (result?.error) return `${formatTime(run.started_at)}: não rodou — ${result.error}`
    if (!result) return formatTime(run.started_at)

    const origin = run.trigger === 'job' ? 'agendada' : 'manual'
    const skipped = result.skipped.cap_reached + result.skipped.error
    return (
        `${formatTime(run.started_at)} (${origin}${run.interrupted ? ', interrompida' : ''}): ` +
        `${result.created} prontos, ${result.reused} com arte reaproveitada, ${result.generated} artes novas, ` +
        `${result.failed} falhas, ${skipped} puladas`
    )
})

const publishSummary = computed(() => {
    const publish = overview.value?.last_publish
    if (!publish) return 'Nenhuma publicação automática ainda.'
    if (!publish.finished_at) return `Publicando desde ${formatTime(publish.started_at)}...`
    const result = publish.result
    if (result?.error) return `${formatTime(publish.started_at)}: parou — ${result.error}`

    return `${formatTime(publish.started_at)}: ${result?.published ?? 0} publicados, ${result?.skipped_stock ?? 0} sem estoque ou fora da vitrine, ${result?.failed ?? 0} falharam`
})

let timer: ReturnType<typeof setInterval> | undefined

const poll = () => {
    if (busy.value) void load()
}

onMounted(() => {
    void load()
    void loadPlan()
    void loadCoupons()
    timer = setInterval(poll, POLL_MS)
})

onUnmounted(() => {
    clearInterval(timer)
    clearTimeout(planRetry)
})
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Story automático</h1>
                <p class="page-subtitle">{{ overview?.next_run ?? 'Carregando...' }}</p>
            </div>
            <button class="ghost-btn" @click="load(); loadPlan()">
                <Icon icon="mdi:refresh" width="18" :class="{ spin: busy }" />
                Atualizar
            </button>
        </header>

        <div v-if="loadError" class="error-banner">
            <Icon icon="mdi:alert-circle-outline" width="20" />
            {{ loadError }}
        </div>

        <div v-if="overview && !overview.automation_enabled" class="local-banner">
            <Icon icon="mdi:laptop" width="18" />
            Backend local: o cron não roda e publicar daqui fica bloqueado (a conta e a OpenAI são as de produção).
            "Preparar agora" funciona e gasta OpenAI.
        </div>

        <template v-if="overview">
            <section class="section">
                <div class="section-head">
                    <div>
                        <h2 class="section-title">Hoje</h2>
                        <p class="section-hint">{{ runSummary }}</p>
                        <p class="section-hint">{{ publishSummary }}</p>
                    </div>
                    <div class="head-actions">
                        <button class="ghost-btn" :disabled="overview.preparing || planLoading" @click="runNow">
                            <Icon :icon="overview.preparing ? 'mdi:loading' : 'mdi:play'" :class="{ spin: overview.preparing }" width="16" />
                            {{ overview.preparing ? 'Preparando...' : 'Preparar agora' }}
                        </button>
                        <button
                            class="ghost-btn"
                            :disabled="!overview.automation_enabled || overview.publishing || !readyCount"
                            @click="publishAll"
                        >
                            <Icon :icon="overview.publishing ? 'mdi:loading' : 'mdi:send'" :class="{ spin: overview.publishing }" width="16" />
                            Publicar todos de hoje ({{ readyCount }})
                        </button>
                    </div>
                </div>

                <p v-if="planLoading && !plan" class="plan">
                    <Icon icon="mdi:loading" class="spin" width="14" /> Simulando a próxima rodada...
                </p>
                <p v-if="plan && !overview.preparing" class="plan">
                    <template v-if="plan.coupon_problem">Próxima rodada não roda: {{ plan.coupon_problem }}</template>
                    <template v-else-if="plan.ranking_pending">
                        <Icon icon="mdi:loading" class="spin" width="14" />
                        Ranking da Steam ainda calculando (acontece logo depois de deploy ou do sync de estoque). Tento de novo sozinho.
                    </template>
                    <template v-else>
                        Próxima rodada pega {{ plan.skins.length }} skins
                        ({{ plan.bands.map(bandSummary).join(', ') }})
                        — {{ plan.new_arts }} sem arte, {{ plan.new_arts_left_today }} artes novas ainda liberadas hoje,
                        ~US$ {{ plan.estimated_cost_usd.toFixed(2) }}.
                    </template>
                </p>

                <details v-if="plan && !plan.coupon_problem && !plan.ranking_pending && !overview.preparing" class="plan-details" open>
                    <summary>Selecionadas pra próxima rodada ({{ plan.skins.length }})</summary>
                    <AutoStoryPlanList :plan="plan" />
                </details>

                <AutoStoryToday
                    :rows="overview.today"
                    :can-publish="overview.automation_enabled"
                    :publishing="overview.publishing"
                    @publish="publishOne"
                    @remove="removeRow"
                    @discard-art="discardArt"
                    @adjust="editing = $event"
                />

                <FinishEditor
                    v-if="editing?.base_image_url"
                    kind="STORY"
                    :base-url="mediaUrl(editing.base_image_url)"
                    :subject="editing.skin?.market_hash_name ?? null"
                    :price="editingPrice"
                    :note="editing.auto_meta?.note ?? null"
                    :initial-layout="editing.finish_layout ?? configLayout"
                    :default-layout="configLayout"
                    :applying="applyingLayout"
                    @close="editing = null"
                    @apply="applyLayout"
                    @save-default="saveLayoutAsDefault"
                />
            </section>

            <section class="section">
                <div class="section-head">
                    <h2 class="section-title">Configuração</h2>
                    <span class="section-hint">Salvar não mexe nos rascunhos já feitos.</span>
                </div>
                <AutoStoryConfigForm
                    :config="overview.config"
                    :coupons="coupons"
                    :coupon-problem="overview.coupon_problem"
                    :plan="plan"
                    :sample-art-url="overview.sample_art_url"
                    :saving="saving"
                    @save="saveConfig"
                />
            </section>
        </template>

        <div v-else-if="!loadError" class="loading-state">
            <Icon icon="mdi:loading" class="spin" width="28" />
            Carregando...
        </div>
    </div>
</template>

<style lang="stylus" scoped>
@import '../../styles/report-view.styl'

.head-actions
    display flex
    flex-wrap wrap
    gap 0.5rem

.section-hint
    margin 0.2rem 0 0

.plan
    margin 0 0 1rem
    color #94a3b8
    font-size 0.8rem

.plan-details
    margin-bottom 1.25rem
    padding-bottom 1rem
    border-bottom 1px solid rgba(255,255,255,0.05)

    summary
        cursor pointer
        color #a5b4fc
        font-size 0.82rem
        margin-bottom 0.75rem

.local-banner
    display flex
    align-items center
    gap 0.5rem
    margin-bottom 1.25rem
    padding 0.75rem 1rem
    border-radius 8px
    background rgba(251,191,36,0.08)
    border 1px solid rgba(251,191,36,0.25)
    color #fcd34d
    font-size 0.82rem
</style>
