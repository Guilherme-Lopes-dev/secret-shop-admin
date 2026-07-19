<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { adminService, type ArcanaHeroMultiplier } from '@/services/admin/admin.service'

const errorMessage = (err: unknown, fallback: string): string => {
    const e = err as { response?: { data?: { message?: string } } }
    return e?.response?.data?.message ?? fallback
}

const loading = ref(true)
const saving = ref(false)

const config = reactive({
    priceSyncDiscount: 0.85,
    dropshipPriceMultiplier: 1,
    arcanaLevel1Multiplier: 1,
    arcanaLevel2Multiplier: 1,
    arcanaLevel3Multiplier: 1,
})

const discountPercentLabel = computed(() => {
    const delta = (1 - config.priceSyncDiscount) * 100
    if (delta === 0) return 'preço cheio'
    return delta > 0 ? `-${delta.toFixed(1)}%` : `+${(-delta).toFixed(1)}%`
})

const allPositive = computed(() =>
    Object.values(config).every((value) => Number.isFinite(value) && value > 0),
)

const loadConfig = async () => {
    loading.value = true
    try {
        const res = await adminService.getPricingConfig()
        if (res.data) {
            config.priceSyncDiscount = res.data.priceSyncDiscount
            config.dropshipPriceMultiplier = res.data.dropshipPriceMultiplier
            config.arcanaLevel1Multiplier = res.data.arcanaLevelMultipliers[1]
            config.arcanaLevel2Multiplier = res.data.arcanaLevelMultipliers[2]
            config.arcanaLevel3Multiplier = res.data.arcanaLevelMultipliers[3]
            heroRows.value = res.data.arcanaHeroes ?? []
            heroOptions.value = res.data.heroOptions ?? []
        }
    } catch (err) {
        toast.error(errorMessage(err, 'Erro ao carregar configuração de preços.'))
    } finally {
        loading.value = false
    }
}

onMounted(loadConfig)

const saveConfig = async () => {
    if (!allPositive.value) {
        toast.error('Todos os valores devem ser maiores que zero.')
        return
    }
    saving.value = true
    try {
        await adminService.setPricingConfig({ ...config })
        toast.success('Configuração salva. Preços do site sendo recalculados...')
    } catch (err) {
        toast.error(errorMessage(err, 'Erro ao salvar configuração.'))
    } finally {
        saving.value = false
    }
}

// ── overrides por herói ────────────────────────────────────────

const heroRows = ref<ArcanaHeroMultiplier[]>([])
const heroOptions = ref<string[]>([])
const newHero = reactive({ hero: '', level1: 1, level2: 1, level3: 1 })
const savingHero = ref(false)

// Só heróis com arcana no catálogo e ainda sem override cadastrado.
const availableHeroOptions = computed(() => {
    const taken = new Set(heroRows.value.map((row) => row.hero.toLowerCase()))
    return heroOptions.value.filter((hero) => !taken.has(hero.toLowerCase()))
})

const heroValid = computed(() =>
    newHero.hero.trim().length > 0 &&
    [newHero.level1, newHero.level2, newHero.level3].every((v) => Number.isFinite(v) && v > 0),
)

const addHero = async () => {
    if (!heroValid.value) {
        toast.error('Informe o herói e multiplicadores maiores que zero.')
        return
    }
    savingHero.value = true
    try {
        const res = await adminService.upsertArcanaHeroMultiplier({ ...newHero, hero: newHero.hero.trim() })
        if (res.data) heroRows.value = res.data
        toast.success(`Override de "${newHero.hero.trim()}" salvo.`)
        newHero.hero = ''
        newHero.level1 = 1
        newHero.level2 = 1
        newHero.level3 = 1
    } catch (err) {
        toast.error(errorMessage(err, 'Erro ao salvar herói.'))
    } finally {
        savingHero.value = false
    }
}

// Edição inline marca a linha como suja; um botão salva tudo de uma vez
// (evita 1 POST + recálculo de preços por célula editada).
const dirtyHeroes = ref(new Set<string>())
const savingRows = ref(false)

const markDirty = (row: ArcanaHeroMultiplier) => {
    dirtyHeroes.value.add(row.hero)
}

const rowValid = (row: ArcanaHeroMultiplier) =>
    [row.level1, row.level2, row.level3].every((v) => Number.isFinite(v) && v > 0)

const saveDirtyHeroes = async () => {
    const rows = heroRows.value.filter((row) => dirtyHeroes.value.has(row.hero))
    if (rows.some((row) => !rowValid(row))) {
        toast.error('Multiplicadores devem ser maiores que zero.')
        return
    }
    savingRows.value = true
    try {
        for (const row of rows) {
            const res = await adminService.upsertArcanaHeroMultiplier(row)
            if (res.data) heroRows.value = res.data
        }
        dirtyHeroes.value = new Set()
        toast.success(`${rows.length} herói(s) atualizado(s).`)
    } catch (err) {
        toast.error(errorMessage(err, 'Erro ao atualizar heróis.'))
    } finally {
        savingRows.value = false
    }
}

const toggleHeroRow = async (row: ArcanaHeroMultiplier) => {
    try {
        const res = await adminService.upsertArcanaHeroMultiplier({ ...row, active: !row.active })
        if (res.data) heroRows.value = res.data
        toast.success(`"${row.hero}" ${row.active ? 'desativado' : 'ativado'}.`)
    } catch (err) {
        toast.error(errorMessage(err, 'Erro ao atualizar herói.'))
    }
}

const removeHeroRow = async (row: ArcanaHeroMultiplier) => {
    if (!confirm(`Remover override de "${row.hero}"? Volta pro padrão global.`)) return
    try {
        const res = await adminService.deleteArcanaHeroMultiplier(row.hero)
        if (res.data) heroRows.value = res.data
        toast.success(`Override de "${row.hero}" removido.`)
    } catch (err) {
        toast.error(errorMessage(err, 'Erro ao remover herói.'))
    }
}
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Config de Preços</h1>
                <p class="page-subtitle">
                    Desconto do sync, dropship e multiplicadores de arcana por level
                </p>
            </div>
        </header>

        <div v-if="loading" class="loading-state">
            <Icon icon="mdi:loading" class="spin" />
            Carregando...
        </div>

        <template v-else>
            <div class="section">
                <h2 class="section-title">
                    <Icon icon="mdi:percent-outline" />
                    Fatores Gerais
                </h2>
                <div class="config-grid">
                    <div class="config-field">
                        <label class="field-label">Desconto do sync (skins normais)</label>
                        <input
                            v-model.number="config.priceSyncDiscount"
                            type="number" min="0.01" step="0.01" class="field-input"
                        />
                        <p class="field-hint">median × {{ config.priceSyncDiscount }} = {{ discountPercentLabel }}</p>
                    </div>
                    <div class="config-field">
                        <label class="field-label">Multiplicador dropship</label>
                        <input
                            v-model.number="config.dropshipPriceMultiplier"
                            type="number" min="0.01" step="0.01" class="field-input"
                        />
                        <p class="field-hint">preço Steam × fator nas skins dropship</p>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2 class="section-title">
                    <Icon icon="mdi:auto-fix" />
                    Arcana por Level
                </h2>
                <p class="section-hint">
                    O level é o <strong>estado de evolução</strong> lido no bloco de styles da
                    description do item, não a quantidade de styles da arcana.
                    Aplica em cima do preço já com desconto.
                    Arcana sem bloco de styles (só gemas) não recebe multiplicador — fica no preço normal.
                </p>
                <div class="config-grid">
                    <div class="config-field">
                        <label class="field-label">Level 1</label>
                        <input
                            v-model.number="config.arcanaLevel1Multiplier"
                            type="number" min="0.01" step="0.01" class="field-input"
                        />
                        <p class="field-hint">Só 1 style liberado, resto bloqueado</p>
                    </div>
                    <div class="config-field">
                        <label class="field-label">Level 2</label>
                        <input
                            v-model.number="config.arcanaLevel2Multiplier"
                            type="number" min="0.01" step="0.01" class="field-input"
                        />
                        <p class="field-hint">Arcana de 3 styles com 2 liberados (ex: Manifold no meio)</p>
                    </div>
                    <div class="config-field">
                        <label class="field-label">Level 3 (full)</label>
                        <input
                            v-model.number="config.arcanaLevel3Multiplier"
                            type="number" min="0.01" step="0.01" class="field-input"
                        />
                        <p class="field-hint">Nenhum style bloqueado — vale pra arcana de 2 OU 3 styles completa</p>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2 class="section-title">
                    <Icon icon="mdi:account-star-outline" />
                    Override por Herói
                </h2>
                <p class="section-hint">
                    Herói cadastrado (e ativo) usa os multiplicadores da linha dele em vez do padrão acima.
                    Herói fora da lista usa o padrão.
                </p>

                <div class="hero-add">
                    <select v-model="newHero.hero" class="field-input hero-add-name">
                        <option value="" disabled>Selecione o herói...</option>
                        <option v-for="hero in availableHeroOptions" :key="hero" :value="hero">
                            {{ hero }}
                        </option>
                    </select>
                    <input v-model.number="newHero.level1" type="number" min="0.01" step="0.01" class="field-input hero-add-mult" title="Level 1" />
                    <input v-model.number="newHero.level2" type="number" min="0.01" step="0.01" class="field-input hero-add-mult" title="Level 2" />
                    <input v-model.number="newHero.level3" type="number" min="0.01" step="0.01" class="field-input hero-add-mult" title="Level 3 (full)" />
                    <button class="btn-save" :disabled="savingHero || !heroValid" @click="addHero">
                        <Icon v-if="savingHero" icon="mdi:loading" class="spin" />
                        <Icon v-else icon="mdi:plus" />
                        Adicionar
                    </button>
                </div>

                <table v-if="heroRows.length" class="hero-table">
                    <thead>
                        <tr>
                            <th>Herói</th>
                            <th>Lvl 1</th>
                            <th>Lvl 2</th>
                            <th>Lvl 3 (full)</th>
                            <th>Ativo</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in heroRows" :key="row.hero" :class="{ 'hero-row--inactive': !row.active }">
                            <td class="hero-name">{{ row.hero }}</td>
                            <td><input v-model.number="row.level1" type="number" min="0.01" step="0.01" class="field-input hero-cell" @input="markDirty(row)" /></td>
                            <td><input v-model.number="row.level2" type="number" min="0.01" step="0.01" class="field-input hero-cell" @input="markDirty(row)" /></td>
                            <td><input v-model.number="row.level3" type="number" min="0.01" step="0.01" class="field-input hero-cell" @input="markDirty(row)" /></td>
                            <td>
                                <button class="btn-icon" :title="row.active ? 'Desativar (volta pro padrão)' : 'Ativar'" @click="toggleHeroRow(row)">
                                    <Icon :icon="row.active ? 'mdi:toggle-switch' : 'mdi:toggle-switch-off-outline'" :class="row.active ? 'toggle-on' : 'toggle-off'" />
                                </button>
                            </td>
                            <td>
                                <button class="btn-icon btn-icon--danger" title="Remover override" @click="removeHeroRow(row)">
                                    <Icon icon="mdi:trash-can-outline" />
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <p v-else class="hero-empty">Nenhum herói cadastrado — todas as arcanas usam o padrão acima.</p>

                <div v-if="dirtyHeroes.size" class="hero-save-bar">
                    <button class="btn-save" :disabled="savingRows" @click="saveDirtyHeroes">
                        <Icon v-if="savingRows" icon="mdi:loading" class="spin" />
                        <Icon v-else icon="mdi:content-save-outline" />
                        {{ savingRows ? 'Salvando...' : `Salvar heróis (${dirtyHeroes.size})` }}
                    </button>
                </div>
            </div>

            <div class="actions">
                <button class="btn-save" :disabled="saving || !allPositive" @click="saveConfig">
                    <Icon v-if="saving" icon="mdi:loading" class="spin" />
                    <Icon v-else icon="mdi:content-save-outline" />
                    {{ saving ? 'Salvando...' : 'Salvar' }}
                </button>
                <p class="actions-hint">
                    <Icon icon="mdi:information-outline" />
                    Qualquer save (config ou herói) já recalcula os preços do catálogo e do inventário
                    em background — o site atualiza sozinho em instantes.
                </p>
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

.spin
    animation spin 1s linear infinite

@keyframes spin
    from
        transform rotate(0deg)
    to
        transform rotate(360deg)

.section
    background #1b1b1f
    border 1px solid #2a2a30
    border-radius 12px
    padding 1.5rem
    margin-bottom 1.5rem

.section-title
    display flex
    align-items center
    gap 0.5rem
    font-size 1.05rem
    font-weight 600
    margin-bottom 1rem

.section-hint
    color #94a3b8
    font-size 0.85rem
    margin -0.5rem 0 1rem

.config-grid
    display grid
    grid-template-columns repeat(auto-fit, minmax(220px, 1fr))
    gap 1rem

.config-field
    display flex
    flex-direction column
    gap 0.35rem

.field-label
    font-size 0.85rem
    color #cbd5e1

.field-input
    background #121214
    border 1px solid #2a2a30
    border-radius 8px
    color #fff
    padding 0.5rem 0.75rem
    font-size 0.95rem
    width 100%

    &:focus
        outline none
        border-color #6366f1

.field-hint
    color #64748b
    font-size 0.78rem

.actions
    display flex
    align-items center
    gap 1rem

.btn-save
    display inline-flex
    align-items center
    gap 0.5rem
    background #6366f1
    color #fff
    border none
    border-radius 8px
    padding 0.6rem 1.2rem
    font-size 0.95rem
    font-weight 600
    cursor pointer

    &:disabled
        opacity 0.5
        cursor not-allowed

    &:hover:not(:disabled)
        background #4f52e0

.actions-hint
    display flex
    align-items center
    gap 0.4rem
    color #94a3b8
    font-size 0.82rem

.hero-add
    display flex
    gap 0.6rem
    margin-bottom 1rem
    flex-wrap wrap

.hero-add-name
    flex 1
    min-width 220px

.hero-add-mult
    width 90px

.hero-table
    width 100%
    border-collapse collapse

    th
        text-align left
        color #94a3b8
        font-size 0.8rem
        font-weight 600
        padding 0.4rem 0.6rem
        border-bottom 1px solid #2a2a30

    td
        padding 0.4rem 0.6rem
        border-bottom 1px solid #1f1f24

.hero-name
    font-weight 600

.hero-cell
    width 90px

.hero-row--inactive
    opacity 0.45

.btn-icon
    background none
    border none
    color #94a3b8
    font-size 1.3rem
    cursor pointer
    display inline-flex
    align-items center

    &:hover
        color #fff

.btn-icon--danger:hover
    color #ef4444

.toggle-on
    color #22c55e

.toggle-off
    color #64748b

.hero-empty
    color #64748b
    font-size 0.85rem

.hero-save-bar
    margin-top 1rem
</style>
