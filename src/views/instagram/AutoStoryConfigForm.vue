<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import InfoTip from '@/components/common/InfoTip.vue'
import type { AutoStoryConfig, AutoStoryCoupon, AutoStoryPlan } from '@/services/admin/types'
import { mediaUrl } from '@/utils/mediaUrl'
import FinishEditor from './FinishEditor.vue'
import { DEFAULT_LAYOUT, type FinishLayout } from './finishCanvas'

const props = defineProps<{
    config: AutoStoryConfig
    coupons: AutoStoryCoupon[]
    couponProblem: string | null
    plan: AutoStoryPlan | null
    sampleArtUrl: string | null
    saving: boolean
}>()

const emit = defineEmits<{ save: [data: Partial<AutoStoryConfig>] }>()

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const PERIODS = [
    { value: 1, label: 'Dia' },
    { value: 7, label: 'Semana' },
    { value: 30, label: 'Mês' },
]
const SAMPLE_PRICE_BRL = 89.9
// Limites do UpdateAutoStoryDto / service.
const MAX_BANDS = 5
const MAX_PUBLISH_TIMES = 6
const MAX_TOTAL_COUNT = 30
const NOTE_MAX_LENGTH = 60
const NEW_ART_COST_USD = 0.43
const WEEKS_PER_MONTH = 4.3

const TIPS = {
    bands: 'Faixa pelo preço da vitrine (teto incluso). Faixa curta sai menor, a menos que "completar com estoque" esteja ligado. Até 30 stories por dia somando skins, combos e collectors.',
    skip: 'Skin com qualquer post publicado (inclusive manual) há menos dias que isso fica de fora da faixa. Faixa com pouco estoque pede prazo menor.',
    fill: 'Faixa curta completa com skin em estoque que ficou fora do ranking (mais cara primeiro, sem exigir custo nem lucro). Só bots da loja.',
    newArts: 'Arte nova é gerada pela IA (~US$ 0,43 cada). Skin que já tem arte reaproveita sem custo. Conta job e botão juntos no dia.',
    ranking: 'Mesmo ranking da tela Recomendados pra story (lucro × interesse).',
    times: 'O lote do dia se divide entre os horários, misturando skin, combo e collector. Mudança de horário vale a partir da próxima rodada; o que já está pronto sai no próximo horário.',
    kits: 'Só combos com todas as peças em estoque (sem encomenda). Arte montada sem IA, no fundo do story das runas. Roda pelos combos que saíram há mais tempo.',
    collectors: 'Só sets que qualquer seguidor compra (sem prazo de presente). Ordem: interesse no site, depois estoque. 1 por herói. Arte montada sem IA.',
}

type BandForm = { max_brl: number | null; count: number; skip_days: number; fill_from_stock: boolean }
const DEFAULT_SKIP_DAYS = 30
type Form = Omit<AutoStoryConfig, 'is_active' | 'auto_publish' | 'layout' | 'bands'> & { bands: BandForm[] }

const toForm = (config: AutoStoryConfig): Form => ({
    weekdays: [...config.weekdays],
    prepare_time: config.prepare_time,
    publish_times: [...config.publish_times],
    coupon_uuid: config.coupon_uuid,
    note_template: config.note_template,
    bands: config.bands.map((band) => ({
        max_brl: band.max_cents === null ? null : band.max_cents / 100,
        count: band.count,
        skip_days: band.skip_days,
        fill_from_stock: band.fill_from_stock,
    })),
    max_per_hero: config.max_per_hero,
    max_new_arts_per_day: config.max_new_arts_per_day,
    period: config.period,
    min_sold_7d: config.min_sold_7d,
    kit_count: config.kit_count,
    kit_weekdays: [...config.kit_weekdays],
    kit_skip_days: config.kit_skip_days,
    collector_count: config.collector_count,
    collector_weekdays: [...config.collector_weekdays],
    collector_skip_days: config.collector_skip_days,
})

// Só campos que o DTO conhece (o backend recusa campo a mais).
const fromForm = (form: Form): Partial<AutoStoryConfig> => ({
    ...form,
    publish_times: [...form.publish_times].sort(),
    bands: form.bands.map((band, index) => ({
        // A última faixa é sempre "sem teto".
        max_cents: index === form.bands.length - 1 || band.max_brl === null ? null : Math.round(Number(band.max_brl) * 100),
        count: Number(band.count) || 0,
        skip_days: Number(band.skip_days) || 0,
        fill_from_stock: band.fill_from_stock,
    })),
    kit_count: Number(form.kit_count) || 0,
    kit_skip_days: Number(form.kit_skip_days) || 0,
    collector_count: Number(form.collector_count) || 0,
    collector_skip_days: Number(form.collector_skip_days) || 0,
})

const form = ref<Form>(toForm(props.config))
const editorOpen = ref(false)

const dirty = computed(() => JSON.stringify(fromForm(form.value)) !== JSON.stringify(fromForm(toForm(props.config))))

// Config nova do servidor (polling, outra aba) só sobrescreve se não tem edição em andamento.
watch(
    () => props.config,
    (config) => {
        if (!dirty.value) form.value = toForm(config)
    },
)

const skinCount = computed(() => form.value.bands.reduce((sum, band) => sum + (Number(band.count) || 0), 0))
const totalCount = computed(
    () => skinCount.value + (Number(form.value.kit_count) || 0) + (Number(form.value.collector_count) || 0),
)

const daysLabel = (days: number[]) => {
    if (days.length === 7) return 'todo dia'
    if (!days.length) return 'nenhum dia'
    return days.map((day) => WEEKDAYS[day]?.toLowerCase()).join('/')
}

// "Até 15 skins (sex/sáb/dom) + 2 collectors (todo dia) + 3 combos (sáb/dom) por dia, em 3 horários."
const dailyLabel = computed(() => {
    const parts = [
        skinCount.value && `${skinCount.value} skins (${daysLabel(form.value.weekdays)})`,
        form.value.collector_count && `${form.value.collector_count} collectors (${daysLabel(form.value.collector_weekdays)})`,
        form.value.kit_count && `${form.value.kit_count} combos (${daysLabel(form.value.kit_weekdays)})`,
    ].filter(Boolean)
    const times = form.value.publish_times.length
    if (!parts.length) return 'Nada por dia: todas as quantidades estão em 0.'
    return `Até ${parts.join(' + ')} por dia, em ${times} ${times === 1 ? 'horário' : 'horários'}.`
})

// Só arte de skin paga; montagem de combo/collector é de graça.
const monthlyCeilingUsd = computed(() =>
    (form.value.max_new_arts_per_day * NEW_ART_COST_USD * form.value.weekdays.length * WEEKS_PER_MONTH).toFixed(2),
)

const kindWarnings = computed(() =>
    [
        { label: 'Skins', count: skinCount.value, days: form.value.weekdays },
        { label: 'Combos', count: form.value.kit_count, days: form.value.kit_weekdays },
        { label: 'Collectors', count: form.value.collector_count, days: form.value.collector_weekdays },
    ]
        .filter(({ count, days }) => count && !days.length)
        .map(({ label }) => `${label}: quantidade sem nenhum dia marcado (não sai).`),
)

const timesInvalid = computed(() => {
    const [first, ...rest] = [...form.value.publish_times].sort()
    if (!first) return true
    const unique = new Set([first, ...rest]).size === rest.length + 1
    return !unique || first <= form.value.prepare_time
})
const couponCode = computed(() => props.coupons.find((coupon) => coupon.id === form.value.coupon_uuid)?.code ?? 'CUPOM')
const notePreview = computed(() => form.value.note_template.split('{cupom}').join(couponCode.value))
const noteInvalid = computed(() => !form.value.note_template.includes('{cupom}') || notePreview.value.length > NOTE_MAX_LENGTH)
const selectedMissing = computed(
    () => !!form.value.coupon_uuid && !props.coupons.some((coupon) => coupon.id === form.value.coupon_uuid),
)

const bandLabel = (index: number) => {
    const previous = form.value.bands[index - 1]?.max_brl
    const isLast = index === form.value.bands.length - 1
    if (isLast) return previous == null ? 'Todas' : `Acima de R$ ${previous}`
    if (previous == null) return 'Até'

    return `De R$ ${previous} até`
}

type DaysField = 'weekdays' | 'kit_weekdays' | 'collector_weekdays'
const toggleDay = (field: DaysField, day: number) => {
    const days = form.value[field]
    form.value[field] = days.includes(day) ? days.filter((item) => item !== day) : [...days, day].sort()
}

// Horário novo 3h depois do último (ou 12:00), no máximo 23:00.
const addTime = () => {
    const last = form.value.publish_times[form.value.publish_times.length - 1] ?? '09:00'
    const hour = Math.min(Number(last.slice(0, 2)) + 3, 23)
    form.value.publish_times = [...form.value.publish_times, `${String(hour).padStart(2, '0')}:00`]
}

const removeTime = (index: number) => {
    form.value.publish_times = form.value.publish_times.filter((_, position) => position !== index)
}

// Nova faixa entra antes da última (a "sem teto"), com teto 100 acima da anterior.
const addBand = () => {
    const bands = form.value.bands
    const open = bands.slice(-1)
    const lastLimit = bands[bands.length - 2]?.max_brl ?? 0
    const band = { max_brl: lastLimit + 100, count: 1, skip_days: DEFAULT_SKIP_DAYS, fill_from_stock: false }
    form.value.bands = [...bands.slice(0, -1), band, ...open]
}

const removeBand = (index: number) => {
    form.value.bands = form.value.bands.filter((_, position) => position !== index)
}

const save = () => emit('save', fromForm(form.value))
const reset = () => {
    form.value = toForm(props.config)
}

// Sem arte crua ainda: fundo liso só pra posicionar.
const placeholderArt = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1920
    const context = canvas.getContext('2d')!
    context.fillStyle = '#2a2a3a'
    context.fillRect(0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg')
}

const editorBase = computed(() => (props.sampleArtUrl ? mediaUrl(props.sampleArtUrl) : placeholderArt()))

const applyLayout = (layout: FinishLayout) => {
    editorOpen.value = false
    emit('save', { layout })
}
</script>

<template>
    <div class="config">
        <div class="switches">
            <label class="switch">
                <button
                    type="button"
                    class="toggle"
                    :class="{ 'toggle--on': config.is_active }"
                    :disabled="saving"
                    @click="emit('save', { is_active: !config.is_active })"
                >
                    <span class="toggle-knob" />
                </button>
                <span>
                    <strong>Rodar nos dias marcados</strong>
                    <small>Prepara os rascunhos sozinho no horário.</small>
                </span>
            </label>
            <label class="switch">
                <button
                    type="button"
                    class="toggle"
                    :class="{ 'toggle--on': config.auto_publish }"
                    :disabled="saving"
                    @click="emit('save', { auto_publish: !config.auto_publish })"
                >
                    <span class="toggle-knob" />
                </button>
                <span>
                    <strong>Publicar sozinho</strong>
                    <small>Desligado: os rascunhos esperam você publicar.</small>
                </span>
            </label>
            <button type="button" class="ghost-btn" @click="editorOpen = true">
                <Icon icon="mdi:cursor-move" width="16" />
                {{ config.layout ? 'Posição do logo, preço e cupom' : 'Definir posição do logo, preço e cupom' }}
            </button>
        </div>

        <div class="filter-grid">
            <div class="filter-field filter-field--wide">
                <label>Dias das skins</label>
                <div class="chips">
                    <button
                        v-for="(label, day) in WEEKDAYS"
                        :key="day"
                        type="button"
                        class="preset-btn"
                        :class="{ active: form.weekdays.includes(day) }"
                        @click="toggleDay('weekdays', day)"
                    >
                        {{ label }}
                    </button>
                </div>
            </div>
            <div class="filter-field">
                <label>Preparar às</label>
                <input v-model="form.prepare_time" type="time" />
            </div>
            <div class="filter-field filter-field--wide">
                <label>Publicar às <InfoTip :text="TIPS.times" /></label>
                <div class="times">
                    <span v-for="(_, index) in form.publish_times" :key="index" class="time-chip">
                        <input v-model="form.publish_times[index]" type="time" aria-label="Horário de publicar" />
                        <button
                            v-if="form.publish_times.length > 1"
                            type="button"
                            class="icon-btn"
                            title="Remover horário"
                            @click="removeTime(index)"
                        >
                            <Icon icon="mdi:close" width="14" />
                        </button>
                    </span>
                    <button v-if="form.publish_times.length < MAX_PUBLISH_TIMES" type="button" class="link-btn" @click="addTime">
                        + horário
                    </button>
                </div>
                <small v-if="timesInvalid" class="warn">Horários sem repetir e todos depois do de preparar.</small>
            </div>
            <div class="filter-field">
                <label>Cupom</label>
                <select v-model="form.coupon_uuid">
                    <option :value="null">Escolha um cupom</option>
                    <option v-if="selectedMissing" :value="form.coupon_uuid">Cupom atual (não serve mais)</option>
                    <option v-for="coupon in coupons" :key="coupon.id" :value="coupon.id">
                        {{ coupon.code }}{{ coupon.description ? ` — ${coupon.description}` : '' }}
                    </option>
                </select>
                <small v-if="couponProblem" class="warn">{{ couponProblem }}</small>
            </div>
            <div class="filter-field">
                <label>Frase do cupom</label>
                <input v-model="form.note_template" type="text" :maxlength="NOTE_MAX_LENGTH" />
                <small :class="noteInvalid ? 'warn' : 'muted'">
                    {{ noteInvalid ? 'Precisa ter {cupom} e caber em 60 letras.' : `Fica: ${notePreview}` }}
                </small>
            </div>
        </div>

        <div class="bands">
            <div class="bands-head">
                <strong>Faixas de preço (skins)</strong>
                <InfoTip :text="TIPS.bands" align="left" />
                <span class="muted">{{ skinCount }} skins por dia</span>
            </div>
            <div v-for="(band, index) in form.bands" :key="index" class="band">
                <span class="band-label">{{ bandLabel(index) }}</span>
                <input
                    v-if="index < form.bands.length - 1"
                    v-model.number="band.max_brl"
                    type="number"
                    min="1"
                    step="50"
                    class="band-input"
                    aria-label="Teto da faixa em reais"
                />
                <span class="band-label">→</span>
                <input v-model.number="band.count" type="number" min="0" max="30" class="band-input band-input--count" aria-label="Quantos stories" />
                <span class="muted">stories · pula publicadas há</span>
                <input
                    v-model.number="band.skip_days"
                    type="number"
                    min="0"
                    max="90"
                    class="band-input band-input--count"
                    aria-label="Pular skin publicada há menos de quantos dias"
                />
                <span class="muted">dias</span>
                <InfoTip v-if="index === 0" :text="TIPS.skip" />
                <label class="check">
                    <input v-model="band.fill_from_stock" type="checkbox" />
                    completar com estoque
                </label>
                <InfoTip v-if="index === 0" :text="TIPS.fill" />
                <span v-if="plan?.bands[index]" class="muted">
                    ({{ plan.bands[index].available }} no ranking hoje)
                </span>
                <button
                    v-if="index < form.bands.length - 1 && form.bands.length > 1"
                    type="button"
                    class="icon-btn"
                    title="Remover faixa"
                    @click="removeBand(index)"
                >
                    <Icon icon="mdi:close" width="14" />
                </button>
            </div>
            <button v-if="form.bands.length < MAX_BANDS" type="button" class="link-btn" @click="addBand">+ faixa</button>
        </div>

        <div class="extras">
            <div class="extra">
                <div class="bands-head">
                    <strong>Combos</strong>
                    <InfoTip :text="TIPS.kits" align="left" />
                </div>
                <div class="band">
                    <input v-model.number="form.kit_count" type="number" min="0" max="30" class="band-input band-input--count" aria-label="Combos por dia" />
                    <span class="muted">por dia · pula postados há</span>
                    <input v-model.number="form.kit_skip_days" type="number" min="0" max="90" class="band-input band-input--count" aria-label="Pular combo postado há menos de quantos dias" />
                    <span class="muted">dias</span>
                </div>
                <div class="chips">
                    <button
                        v-for="(label, day) in WEEKDAYS"
                        :key="day"
                        type="button"
                        class="preset-btn"
                        :class="{ active: form.kit_weekdays.includes(day) }"
                        @click="toggleDay('kit_weekdays', day)"
                    >
                        {{ label }}
                    </button>
                </div>
            </div>
            <div class="extra">
                <div class="bands-head">
                    <strong>Collectors</strong>
                    <InfoTip :text="TIPS.collectors" align="left" />
                </div>
                <div class="band">
                    <input v-model.number="form.collector_count" type="number" min="0" max="30" class="band-input band-input--count" aria-label="Collectors por dia" />
                    <span class="muted">por dia · pula postados há</span>
                    <input v-model.number="form.collector_skip_days" type="number" min="0" max="90" class="band-input band-input--count" aria-label="Pular collector postado há menos de quantos dias" />
                    <span class="muted">dias</span>
                </div>
                <div class="chips">
                    <button
                        v-for="(label, day) in WEEKDAYS"
                        :key="day"
                        type="button"
                        class="preset-btn"
                        :class="{ active: form.collector_weekdays.includes(day) }"
                        @click="toggleDay('collector_weekdays', day)"
                    >
                        {{ label }}
                    </button>
                </div>
            </div>
        </div>

        <div class="daily">
            <span>{{ dailyLabel }}</span>
            <span v-if="totalCount > MAX_TOTAL_COUNT" class="warn">Máximo {{ MAX_TOTAL_COUNT }} por dia somando tudo ({{ totalCount }} agora).</span>
            <span v-for="warning in kindWarnings" :key="warning" class="warn">{{ warning }}</span>
            <span class="muted">Teto de gasto com arte nova (só skins): até US$ {{ monthlyCeilingUsd }}/mês.</span>
        </div>

        <div class="filter-grid">
            <div class="filter-field">
                <label>Máximo por herói em cada faixa</label>
                <input v-model.number="form.max_per_hero" type="number" min="0" max="10" />
            </div>
            <div class="filter-field">
                <label>Artes novas por dia <InfoTip :text="TIPS.newArts" /></label>
                <input v-model.number="form.max_new_arts_per_day" type="number" min="0" max="20" />
            </div>
            <div class="filter-field">
                <label>Ranking: período <InfoTip :text="TIPS.ranking" /></label>
                <select v-model.number="form.period">
                    <option v-for="option in PERIODS" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
            </div>
            <div class="filter-field">
                <label>Ranking: vendas mínimas na Steam (7d)</label>
                <input v-model.number="form.min_sold_7d" type="number" min="0" max="1000" />
            </div>
        </div>

        <div class="form-actions">
            <button type="button" class="ghost-btn" :disabled="!dirty || saving || noteInvalid || timesInvalid || totalCount > MAX_TOTAL_COUNT" @click="save">
                <Icon :icon="saving ? 'mdi:loading' : 'mdi:content-save-outline'" :class="{ spin: saving }" width="16" />
                Salvar configuração
            </button>
            <button v-if="dirty" type="button" class="link-btn" @click="reset">Descartar mudanças</button>
        </div>

        <FinishEditor
            v-if="editorOpen"
            kind="STORY"
            :base-url="editorBase"
            subject="story automático"
            :price="SAMPLE_PRICE_BRL"
            :note="notePreview"
            :initial-layout="config.layout ?? DEFAULT_LAYOUT.STORY"
            :default-layout="DEFAULT_LAYOUT.STORY"
            :applying="saving"
            @close="editorOpen = false"
            @apply="applyLayout"
            @save-default="applyLayout"
        />
    </div>
</template>

<style lang="stylus" scoped>
@import '../../styles/report-view.styl'

.config
    display flex
    flex-direction column
    gap 1.25rem

.switches
    display flex
    flex-wrap wrap
    align-items center
    gap 1rem 2rem

.switch
    display flex
    align-items center
    gap 0.6rem
    font-size 0.85rem

    span
        display flex
        flex-direction column

    small
        color #64748b

.filter-field--wide
    grid-column span 2

    @media (max-width: 640px)
        grid-column auto

.filter-field label
    display inline-flex
    align-items center
    gap 0.35rem

.chips
    display flex
    flex-wrap wrap
    gap 0.35rem

    .preset-btn
        padding 0.4rem 0.7rem

.bands
    display flex
    flex-direction column
    gap 0.5rem

.bands-head
    display flex
    align-items center
    gap 0.5rem
    font-size 0.85rem

.band
    display flex
    flex-wrap wrap
    align-items center
    gap 0.5rem
    font-size 0.82rem

.band-label
    color #94a3b8
    min-width 3rem

.band-input
    width 6rem
    background #2a2a30
    border 1px solid rgba(255,255,255,0.08)
    border-radius 6px
    color #fff
    padding 0.4rem 0.6rem

.band-input--count
    width 4rem

.check
    display inline-flex
    align-items center
    gap 0.3rem
    color #94a3b8
    cursor pointer

.times
    display flex
    flex-wrap wrap
    align-items center
    gap 0.5rem

.time-chip
    display inline-flex
    align-items center
    gap 0.15rem

    input
        width 7rem

.extras
    display grid
    grid-template-columns repeat(auto-fit, minmax(280px, 1fr))
    gap 1rem

.extra
    display flex
    flex-direction column
    gap 0.5rem

.daily
    display flex
    flex-direction column
    gap 0.25rem
    font-size 0.85rem

.icon-btn
    background none
    border none
    color #64748b
    cursor pointer
    padding 0.2rem

    &:hover
        color #fc8181

.link-btn
    align-self flex-start
    background none
    border none
    color #a5b4fc
    font-size 0.8rem
    cursor pointer
    padding 0

.form-actions
    display flex
    align-items center
    gap 1rem

.warn
    color #fbbf24

.muted
    color #64748b

.toggle
    width 40px
    height 22px
    background rgba(255,255,255,0.12)
    border none
    border-radius 999px
    position relative
    cursor pointer
    transition background 0.2s
    padding 0
    flex-shrink 0

    &:disabled
        opacity 0.4
        cursor not-allowed

.toggle--on
    background #6366f1

.toggle-knob
    display block
    width 16px
    height 16px
    background #fff
    border-radius 50%
    position absolute
    top 3px
    left 3px
    transition transform 0.2s

.toggle--on .toggle-knob
    transform translateX(18px)
</style>
