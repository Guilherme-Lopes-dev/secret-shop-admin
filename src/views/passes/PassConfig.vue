<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { adminService } from '@/services/admin/admin.service'

const errorMessage = (err: unknown, fallback: string): string => {
    const e = err as { response?: { data?: { message?: string } } }
    return e?.response?.data?.message ?? fallback
}

// ── types ──────────────────────────────────────────────────────

interface Benefit {
    id: string
    benefit_type: string
    config: Record<string, unknown>
    active: boolean
    created_at: string
}

interface Tier {
    rank: number
    name: string
    min_points: number
    benefits: Benefit[]
}

interface PassConfig {
    pass_active:           boolean
    points_per_brl:        number
    decay_inactivity_days: number
    decay_points_per_week: number
    season_start:          string
    season_end:            string
}

const TIER_COLORS: Record<number, string> = {
    0: '#B0C3D9',
    1: '#5E98D9',
    2: '#4B69FF',
    3: '#8847FF',
    4: '#D32CE6',
    5: '#EB4B4B',
    6: '#E4AE33',
}

// ── state ──────────────────────────────────────────────────────

const loading = ref(true)
const savingConfig = ref(false)
const savingSchedule = ref(false)
const tiers = ref<Tier[]>([])

const config = reactive<PassConfig>({
    pass_active:           true,
    points_per_brl:        1,
    decay_inactivity_days: 30,
    decay_points_per_week: 50,
    season_start:          '',
    season_end:            '',
})

const scheduleFrom  = ref('')
const scheduleUntil = ref('')

const addingTo = ref<number | null>(null)
const newBenefit = reactive({ benefit_type: 'cashback', percentage: '' })
const submittingBenefit = ref(false)

const editingThreshold = ref<number | null>(null)
const thresholdInput = ref('')
const savingThreshold = ref(false)

// ── data loading ───────────────────────────────────────────────

const toInputValue = (iso: string | null): string => {
    if (!iso) return ''
    const d = new Date(iso)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

const toISOValue = (local: string): string => {
    if (!local) return ''
    return new Date(local).toISOString()
}

const scheduleStatus = computed<'none' | 'active' | 'scheduled' | 'expired'>(() => {
    if (!scheduleFrom.value || !scheduleUntil.value) return 'none'
    const now  = new Date()
    const from = new Date(toISOValue(scheduleFrom.value))
    const until = new Date(toISOValue(scheduleUntil.value))
    if (now >= from && now <= until) return 'active'
    if (now < from) return 'scheduled'
    return 'expired'
})

const loadData = async () => {
    loading.value = true
    try {
        const [cfgRes, tiersRes] = await Promise.all([
            adminService.getPassConfig(),
            adminService.getPassTiers(),
        ])
        if (cfgRes.data) {
            config.pass_active           = cfgRes.data.pass_active ?? true
            config.points_per_brl        = cfgRes.data.points_per_brl
            config.decay_inactivity_days = cfgRes.data.decay_inactivity_days
            config.decay_points_per_week = cfgRes.data.decay_points_per_week
            config.season_start          = toInputValue(cfgRes.data.season_start)
            config.season_end            = toInputValue(cfgRes.data.season_end)
            scheduleFrom.value           = toInputValue(cfgRes.data.inactive_from)
            scheduleUntil.value          = toInputValue(cfgRes.data.inactive_until)
        }
        if (tiersRes.data) tiers.value = tiersRes.data
    } catch (err) {
        console.error('Erro ao carregar configuração do passe:', err)
    } finally {
        loading.value = false
    }
}

onMounted(loadData)

// ── config ─────────────────────────────────────────────────────

const seasonValidation = computed<{ ok: boolean; reason: string | null }>(() => {
    if (!config.pass_active) return { ok: true, reason: null }
    if (!config.season_start) return { ok: false, reason: 'Defina a data de início da season.' }
    if (!config.season_end)   return { ok: false, reason: 'Defina a data de fim da season.' }
    if (new Date(config.season_start) >= new Date(config.season_end)) {
        return { ok: false, reason: 'A data de início deve ser anterior à data de fim.' }
    }
    return { ok: true, reason: null }
})

const canSaveConfig = computed(() => !savingConfig.value && seasonValidation.value.ok)

const saveConfig = async () => {
    if (!seasonValidation.value.ok) {
        toast.error(seasonValidation.value.reason ?? 'Preencha os campos obrigatórios.')
        return
    }

    savingConfig.value = true
    try {
        await adminService.setPassConfig({
            pass_active:           config.pass_active,
            points_per_brl:        config.points_per_brl,
            decay_inactivity_days: config.decay_inactivity_days,
            decay_points_per_week: config.decay_points_per_week,
            season_start:          config.season_start ? toISOValue(config.season_start) : null,
            season_end:            config.season_end   ? toISOValue(config.season_end)   : null,
        })
        toast.success(config.pass_active ? 'Passe ativado e configuração salva.' : 'Passe desativado e configuração salva.')
    } catch (err) {
        toast.error(errorMessage(err, 'Erro ao salvar configuração.'))
    } finally {
        savingConfig.value = false
    }
}

const saveSchedule = async () => {
    if (!scheduleFrom.value || !scheduleUntil.value) return
    savingSchedule.value = true
    try {
        await adminService.setPassConfig({
            inactive_from:  toISOValue(scheduleFrom.value),
            inactive_until: toISOValue(scheduleUntil.value),
        })
        toast.success('Agendamento de inatividade aplicado.')
    } catch (err) {
        toast.error(errorMessage(err, 'Erro ao salvar agendamento.'))
    } finally {
        savingSchedule.value = false
    }
}

const clearSchedule = async () => {
    savingSchedule.value = true
    try {
        await adminService.setPassConfig({ inactive_from: '', inactive_until: '' })
        scheduleFrom.value  = ''
        scheduleUntil.value = ''
        toast.success('Agendamento removido.')
    } catch (err) {
        toast.error(errorMessage(err, 'Erro ao limpar agendamento.'))
    } finally {
        savingSchedule.value = false
    }
}

// ── benefits ───────────────────────────────────────────────────

const openAdd = (rank: number) => {
    addingTo.value = rank
    newBenefit.benefit_type = 'cashback'
    newBenefit.percentage   = ''
}

const cancelAdd = () => { addingTo.value = null }

const submitBenefit = async () => {
    if (addingTo.value === null) return
    const pct = parseFloat(newBenefit.percentage)
    if (isNaN(pct) || pct <= 0 || pct > 100) {
        toast.error('Informe uma porcentagem entre 0 e 100.')
        return
    }

    submittingBenefit.value = true
    const targetRank = addingTo.value
    try {
        const res = await adminService.createPassBenefit(
            targetRank,
            newBenefit.benefit_type,
            { percentage: pct },
        )
        const tier = tiers.value.find(t => t.rank === targetRank)
        if (tier && res.data) tier.benefits.push(res.data)
        addingTo.value = null
        toast.success(`Benefício adicionado ao tier ${tier?.name ?? targetRank}.`)
    } catch (err) {
        toast.error(errorMessage(err, 'Erro ao criar benefício.'))
    } finally {
        submittingBenefit.value = false
    }
}

const toggleBenefit = async (tier: Tier, benefit: Benefit) => {
    const prev = benefit.active
    benefit.active = !prev
    try {
        await adminService.updatePassBenefit(benefit.id, { active: benefit.active })
        toast.success(`Benefício ${benefit.active ? 'ativado' : 'desativado'}.`)
    } catch (err) {
        benefit.active = prev
        toast.error(errorMessage(err, 'Erro ao atualizar benefício.'))
    }
}

const removeBenefit = async (tier: Tier, benefit: Benefit) => {
    if (!confirm(`Remover benefício "${benefitLabel(benefit)}" do tier ${tier.name}?`)) return
    try {
        await adminService.deletePassBenefit(benefit.id)
        tier.benefits = tier.benefits.filter(b => b.id !== benefit.id)
        toast.success('Benefício removido.')
    } catch (err) {
        toast.error(errorMessage(err, 'Erro ao remover benefício.'))
    }
}

// ── helpers ────────────────────────────────────────────────────

const benefitLabel = (b: Benefit) => {
    if (b.benefit_type === 'cashback') return `Cashback ${b.config.percentage}%`
    return b.benefit_type
}

const openEditThreshold = (tier: Tier) => {
    editingThreshold.value = tier.rank
    thresholdInput.value   = String(tier.min_points)
}

const cancelEditThreshold = () => { editingThreshold.value = null }

const saveThreshold = async (tier: Tier) => {
    const val = parseInt(thresholdInput.value, 10)
    if (isNaN(val) || val < 0) {
        toast.error('Informe um valor de pontos válido.')
        return
    }

    savingThreshold.value = true
    try {
        await adminService.setTierThreshold(tier.rank, val)
        tier.min_points        = val
        editingThreshold.value = null
        toast.success(`Threshold do tier ${tier.name} atualizado para ${val.toLocaleString('pt-BR')} pts.`)
    } catch (err) {
        toast.error(errorMessage(err, 'Erro ao salvar threshold.'))
    } finally {
        savingThreshold.value = false
    }
}
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Secret Pass</h1>
                <p class="page-subtitle">Configuração de parâmetros e benefícios por tier</p>
            </div>
        </header>

        <div v-if="loading" class="loading-state">
            <Icon icon="mdi:loading" class="spin" />
            Carregando...
        </div>

        <template v-else>
            <!-- Global config -->
            <div class="section config-section">
                <h2 class="section-title">
                    <Icon icon="mdi:cog-outline" />
                    Parâmetros Globais
                </h2>
                <div class="config-grid">
                    <div class="config-field config-field--full">
                        <button
                            class="toggle-btn"
                            :class="config.pass_active ? 'toggle-btn--on' : 'toggle-btn--off'"
                            @click="config.pass_active = !config.pass_active"
                        >
                            <span class="toggle-track">
                                <span class="toggle-thumb"></span>
                            </span>
                            <span>Secret Pass {{ config.pass_active ? 'Ativo' : 'Inativo' }}</span>
                        </button>
                    </div>
                    <div class="config-field">
                        <label class="field-label">
                            Início da season
                            <span v-if="config.pass_active" class="field-required">*</span>
                        </label>
                        <input
                            v-model="config.season_start"
                            type="datetime-local"
                            class="field-input field-input--wide"
                            :class="{ 'field-input--invalid': config.pass_active && !config.season_start }"
                            :required="config.pass_active"
                        />
                    </div>
                    <div class="config-field">
                        <label class="field-label">
                            Fim da season
                            <span v-if="config.pass_active" class="field-required">*</span>
                        </label>
                        <input
                            v-model="config.season_end"
                            type="datetime-local"
                            class="field-input field-input--wide"
                            :class="{ 'field-input--invalid': config.pass_active && !config.season_end }"
                            :required="config.pass_active"
                        />
                    </div>
                    <div v-if="seasonValidation.reason" class="config-field config-field--full">
                        <p class="field-error">
                            <Icon icon="mdi:alert-circle-outline" />
                            {{ seasonValidation.reason }}
                        </p>
                    </div>
                    <div class="config-field">
                        <label class="field-label">Pontos por R$ 1,00</label>
                        <input v-model.number="config.points_per_brl" type="number" min="0.1" step="0.1" class="field-input" />
                    </div>
                    <div class="config-field">
                        <label class="field-label">Dias de inatividade para decay</label>
                        <input v-model.number="config.decay_inactivity_days" type="number" min="1" class="field-input" />
                    </div>
                    <div class="config-field">
                        <label class="field-label">Pontos perdidos por semana</label>
                        <input v-model.number="config.decay_points_per_week" type="number" min="0" class="field-input" />
                    </div>
                    <div class="config-field config-field--action">
                        <button class="btn-save" :disabled="!canSaveConfig" @click="saveConfig">
                            <Icon v-if="savingConfig" icon="mdi:loading" class="spin" />
                            <Icon v-else icon="mdi:content-save-outline" />
                            {{ savingConfig ? 'Salvando...' : 'Salvar' }}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Schedule -->
            <div class="section">
                <h2 class="section-title">
                    <Icon icon="mdi:calendar-clock-outline" />
                    Agendamento de Inatividade
                </h2>
                <p class="section-desc">
                    O passe será desativado automaticamente no período configurado,
                    independente do toggle acima.
                </p>

                <div class="schedule-status" v-if="scheduleStatus !== 'none'">
                    <span class="status-dot" :class="`status-dot--${scheduleStatus}`"></span>
                    <span v-if="scheduleStatus === 'active'">Em andamento agora</span>
                    <span v-else-if="scheduleStatus === 'scheduled'">Agendado</span>
                    <span v-else>Expirado</span>
                </div>

                <div class="schedule-grid">
                    <div class="config-field">
                        <label class="field-label">Início</label>
                        <input v-model="scheduleFrom" type="datetime-local" class="field-input field-input--wide" />
                    </div>
                    <div class="config-field">
                        <label class="field-label">Fim</label>
                        <input v-model="scheduleUntil" type="datetime-local" class="field-input field-input--wide" />
                    </div>
                    <div class="config-field config-field--action schedule-actions">
                        <button class="btn-save" :disabled="savingSchedule || !scheduleFrom || !scheduleUntil" @click="saveSchedule">
                            <Icon v-if="savingSchedule" icon="mdi:loading" class="spin" />
                            <Icon v-else icon="mdi:calendar-check-outline" />
                            {{ savingSchedule ? 'Salvando...' : 'Aplicar' }}
                        </button>
                        <button v-if="scheduleFrom || scheduleUntil" class="btn-clear" :disabled="savingSchedule" @click="clearSchedule">
                            <Icon icon="mdi:calendar-remove-outline" />
                            Limpar
                        </button>
                    </div>
                </div>
            </div>

            <!-- Tier list -->
            <div class="section">
                <h2 class="section-title">
                    <Icon icon="mdi:trophy-outline" />
                    Tiers & Benefícios
                </h2>

                <div class="tier-list">
                    <div v-for="tier in tiers" :key="tier.rank" class="tier-row">
                        <div class="tier-header">
                            <div class="tier-badge" :style="{ borderColor: TIER_COLORS[tier.rank], color: TIER_COLORS[tier.rank] }">
                                <span class="tier-rank">#{{ tier.rank }}</span>
                                <span class="tier-name">{{ tier.name }}</span>
                            </div>

                            <template v-if="editingThreshold === tier.rank">
                                <div class="threshold-edit">
                                    <input
                                        v-model="thresholdInput"
                                        type="number"
                                        min="0"
                                        class="threshold-input"
                                        @keyup.enter="saveThreshold(tier)"
                                        @keyup.esc="cancelEditThreshold"
                                    />
                                    <span class="threshold-unit">pts</span>
                                    <button class="btn-confirm" :disabled="savingThreshold" @click="saveThreshold(tier)">
                                        <Icon v-if="savingThreshold" icon="mdi:loading" class="spin" />
                                        <Icon v-else icon="mdi:check" />
                                    </button>
                                    <button class="btn-cancel" @click="cancelEditThreshold">
                                        <Icon icon="mdi:close" />
                                    </button>
                                </div>
                            </template>
                            <template v-else>
                                <button class="tier-threshold-btn" @click="openEditThreshold(tier)">
                                    {{ tier.min_points.toLocaleString('pt-BR') }} pts
                                    <Icon icon="mdi:pencil-outline" class="threshold-edit-icon" />
                                </button>
                            </template>
                        </div>

                        <div class="benefits-wrap">
                            <div v-for="b in tier.benefits" :key="b.id" class="benefit-chip" :class="{ 'benefit-chip--inactive': !b.active }">
                                <Icon icon="mdi:cash-multiple" class="benefit-icon" />
                                <span>{{ benefitLabel(b) }}</span>
                                <button class="chip-toggle" :title="b.active ? 'Desativar' : 'Ativar'" @click="toggleBenefit(tier, b)">
                                    <Icon :icon="b.active ? 'mdi:eye-outline' : 'mdi:eye-off-outline'" />
                                </button>
                                <button class="chip-remove" title="Remover" @click="removeBenefit(tier, b)">
                                    <Icon icon="mdi:close" />
                                </button>
                            </div>

                            <!-- Add form -->
                            <template v-if="addingTo === tier.rank">
                                <div class="add-form">
                                    <select v-model="newBenefit.benefit_type" class="add-select">
                                        <option value="cashback">Cashback</option>
                                    </select>
                                    <div class="add-pct-wrap">
                                        <input
                                            v-model="newBenefit.percentage"
                                            type="number"
                                            min="0.1"
                                            max="100"
                                            step="0.5"
                                            placeholder="%"
                                            class="add-pct-input"
                                        />
                                        <span class="add-pct-symbol">%</span>
                                    </div>
                                    <button class="btn-confirm" :disabled="submittingBenefit" @click="submitBenefit">
                                        <Icon v-if="submittingBenefit" icon="mdi:loading" class="spin" />
                                        <Icon v-else icon="mdi:check" />
                                    </button>
                                    <button class="btn-cancel" @click="cancelAdd">
                                        <Icon icon="mdi:close" />
                                    </button>
                                </div>
                            </template>

                            <button v-else class="btn-add" @click="openAdd(tier.rank)">
                                <Icon icon="mdi:plus" />
                                Adicionar benefício
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<style lang="stylus" scoped>
.view-wrap
    padding 2rem
    color #fff
    background #121214
    min-height 100vh

.page-header
    margin-bottom 2rem

.page-title
    font-size 1.8rem
    font-weight 700
    margin-bottom 0.25rem

.page-subtitle
    color #94a3b8
    font-size 0.9rem

.loading-state
    display flex
    align-items center
    gap 0.5rem
    color #94a3b8
    padding 3rem

.section
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 12px
    padding 1.5rem
    margin-bottom 1.25rem

.section-title
    display flex
    align-items center
    gap 0.5rem
    font-size 1rem
    font-weight 600
    color #e2e8f0
    margin-bottom 1.25rem

// ── config grid ───────────────────────────────────────────────

.config-grid
    display flex
    flex-wrap wrap
    gap 1rem
    align-items flex-end

.config-field
    display flex
    flex-direction column
    gap 0.4rem

.field-label
    font-size 0.78rem
    color #94a3b8
    text-transform uppercase
    letter-spacing 0.04em

.field-input
    background #121214
    border 1px solid rgba(255,255,255,0.1)
    border-radius 8px
    color #fff
    padding 0.5rem 0.75rem
    font-size 0.9rem
    width 180px
    outline none

    &:focus
        border-color rgba(99,102,241,0.5)

    &--invalid
        border-color rgba(244,63,94,0.5)

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button
        -webkit-appearance none

.field-required
    color #f43f5e
    margin-left 0.2rem

.field-error
    display flex
    align-items center
    gap 0.35rem
    font-size 0.78rem
    color #f43f5e
    margin 0

.config-field--full
    width 100%

.config-field--action
    justify-content flex-end

.toggle-btn
    display inline-flex
    align-items center
    gap 0.6rem
    background transparent
    border 1px solid rgba(255,255,255,0.1)
    border-radius 8px
    padding 0.5rem 1rem
    cursor pointer
    font-size 0.875rem
    font-weight 600
    transition all 0.2s

    &--on
        border-color rgba(99,102,241,0.4)
        color #a5b4fc

        .toggle-track
            background rgba(99,102,241,0.5)

        .toggle-thumb
            transform translateX(16px)
            background #818cf8

    &--off
        color #64748b

        .toggle-track
            background rgba(255,255,255,0.08)

        .toggle-thumb
            transform translateX(0)
            background #475569

.toggle-track
    position relative
    width 36px
    height 20px
    border-radius 99px
    transition background 0.2s
    flex-shrink 0

.toggle-thumb
    position absolute
    top 3px
    left 3px
    width 14px
    height 14px
    border-radius 50%
    transition transform 0.2s, background 0.2s

.btn-save
    display flex
    align-items center
    gap 0.4rem
    background #6366f1
    color #fff
    border none
    border-radius 8px
    padding 0.5rem 1.25rem
    font-size 0.875rem
    font-weight 500
    cursor pointer
    transition background 0.2s

    &:hover:not(:disabled)
        background #4f46e5

    &:disabled
        opacity 0.5
        cursor not-allowed

// ── schedule ──────────────────────────────────────────────────

.section-desc
    font-size 0.82rem
    color #64748b
    margin-bottom 1rem
    line-height 1.5

.schedule-status
    display inline-flex
    align-items center
    gap 0.4rem
    font-size 0.78rem
    font-weight 600
    margin-bottom 1rem
    padding 0.3rem 0.75rem
    border-radius 999px
    background rgba(255,255,255,0.04)
    border 1px solid rgba(255,255,255,0.08)
    color #94a3b8

.status-dot
    width 8px
    height 8px
    border-radius 50%
    flex-shrink 0

    &--active
        background #22c55e
        box-shadow 0 0 6px rgba(34,197,94,0.6)

    &--scheduled
        background #f59e0b

    &--expired
        background #64748b

.schedule-grid
    display flex
    flex-wrap wrap
    gap 1rem
    align-items flex-end

.field-input--wide
    width 220px

.schedule-actions
    display flex
    gap 0.5rem
    align-items center

.btn-clear
    display flex
    align-items center
    gap 0.4rem
    background transparent
    border 1px solid rgba(255,255,255,0.1)
    color #64748b
    border-radius 8px
    padding 0.5rem 1rem
    font-size 0.875rem
    font-weight 500
    cursor pointer
    transition all 0.2s

    &:hover:not(:disabled)
        border-color rgba(244,63,94,0.4)
        color #f43f5e

    &:disabled
        opacity 0.5
        cursor not-allowed

// ── tier list ─────────────────────────────────────────────────

.tier-list
    display flex
    flex-direction column
    gap 0.75rem

.tier-row
    background #121214
    border 1px solid rgba(255,255,255,0.06)
    border-radius 10px
    padding 1rem 1.25rem
    display flex
    flex-direction column
    gap 0.75rem

.tier-header
    display flex
    align-items center
    gap 1rem

.tier-badge
    display flex
    align-items center
    gap 0.5rem
    border 1px solid
    border-radius 6px
    padding 0.3rem 0.75rem

.tier-rank
    font-size 0.72rem
    opacity 0.6

.tier-name
    font-size 0.875rem
    font-weight 700

.tier-threshold-btn
    display inline-flex
    align-items center
    gap 0.3rem
    background transparent
    border none
    color #64748b
    font-size 0.78rem
    cursor pointer
    padding 0.2rem 0.4rem
    border-radius 4px
    transition all 0.15s

    &:hover
        color #e2e8f0
        background rgba(255,255,255,0.05)

        .threshold-edit-icon
            opacity 1

.threshold-edit-icon
    font-size 0.7rem
    opacity 0

.threshold-edit
    display flex
    align-items center
    gap 0.3rem

.threshold-input
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.15)
    border-radius 6px
    color #fff
    padding 0.25rem 0.5rem
    font-size 0.8rem
    width 90px
    outline none

    &:focus
        border-color rgba(99,102,241,0.5)

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button
        -webkit-appearance none

.threshold-unit
    font-size 0.75rem
    color #64748b

// ── benefits ──────────────────────────────────────────────────

.benefits-wrap
    display flex
    flex-wrap wrap
    align-items center
    gap 0.5rem

.benefit-chip
    display flex
    align-items center
    gap 0.35rem
    background rgba(99,102,241,0.12)
    border 1px solid rgba(99,102,241,0.25)
    border-radius 6px
    padding 0.3rem 0.6rem
    font-size 0.8rem
    color #a5b4fc

    &--inactive
        background rgba(255,255,255,0.04)
        border-color rgba(255,255,255,0.08)
        color #64748b

.benefit-icon
    font-size 0.9rem

.chip-toggle,
.chip-remove
    background transparent
    border none
    cursor pointer
    padding 0
    display flex
    align-items center
    font-size 0.85rem
    color #64748b
    transition color 0.15s

    &:hover
        color #e2e8f0

.chip-remove:hover
    color #f44336

// ── add form ─────────────────────────────────────────────────

.add-form
    display flex
    align-items center
    gap 0.4rem

.add-select
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.1)
    border-radius 6px
    color #fff
    padding 0.35rem 0.6rem
    font-size 0.8rem
    outline none
    cursor pointer

    option
        background #1a1a1e

.add-pct-wrap
    position relative
    display flex
    align-items center

.add-pct-input
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.1)
    border-radius 6px
    color #fff
    padding 0.35rem 1.5rem 0.35rem 0.6rem
    font-size 0.8rem
    width 70px
    outline none

    &:focus
        border-color rgba(99,102,241,0.5)

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button
        -webkit-appearance none

.add-pct-symbol
    position absolute
    right 0.4rem
    font-size 0.75rem
    color #64748b
    pointer-events none

.btn-confirm
    background rgba(99,102,241,0.15)
    border 1px solid rgba(99,102,241,0.3)
    color #818cf8
    border-radius 6px
    padding 0.35rem 0.6rem
    cursor pointer
    display flex
    align-items center
    font-size 0.9rem
    transition all 0.15s

    &:hover:not(:disabled)
        background rgba(99,102,241,0.25)

    &:disabled
        opacity 0.5
        cursor not-allowed

.btn-cancel
    background transparent
    border 1px solid rgba(255,255,255,0.08)
    color #64748b
    border-radius 6px
    padding 0.35rem 0.6rem
    cursor pointer
    display flex
    align-items center
    font-size 0.9rem
    transition all 0.15s

    &:hover
        color #e2e8f0
        border-color rgba(255,255,255,0.2)

.btn-add
    display flex
    align-items center
    gap 0.3rem
    background transparent
    border 1px dashed rgba(255,255,255,0.12)
    color #64748b
    border-radius 6px
    padding 0.3rem 0.75rem
    font-size 0.78rem
    cursor pointer
    transition all 0.15s

    &:hover
        color #e2e8f0
        border-color rgba(255,255,255,0.25)

.spin
    animation spin 0.8s linear infinite

@keyframes spin
    from transform rotate(0deg)
    to   transform rotate(360deg)
</style>
