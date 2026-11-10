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
const NOTE_MAX_LENGTH = 60

const TIPS = {
    bands: 'Faixa pelo preço da vitrine (teto incluso). Faixa sem skins suficientes sai menor: a sobra não passa pra outra. Até 20 stories por rodada somando tudo.',
    skip: 'Skin com qualquer post publicado nesse período fica de fora.',
    newArts: 'Arte nova é gerada pela IA (~US$ 0,43 cada). Skin que já tem arte reaproveita sem custo. Conta job e botão juntos no dia.',
    ranking: 'Mesmo ranking da tela Recomendados pra story (lucro × interesse).',
}

type BandForm = { max_brl: number | null; count: number }
type Form = Omit<AutoStoryConfig, 'is_active' | 'auto_publish' | 'layout' | 'bands'> & { bands: BandForm[] }

const toForm = (config: AutoStoryConfig): Form => ({
    weekdays: [...config.weekdays],
    prepare_time: config.prepare_time,
    publish_time: config.publish_time,
    coupon_uuid: config.coupon_uuid,
    note_template: config.note_template,
    bands: config.bands.map((band) => ({ max_brl: band.max_cents === null ? null : band.max_cents / 100, count: band.count })),
    skip_published_days: config.skip_published_days,
    max_per_hero: config.max_per_hero,
    max_new_arts_per_day: config.max_new_arts_per_day,
    period: config.period,
    min_sold_7d: config.min_sold_7d,
})

const fromForm = (form: Form): Partial<AutoStoryConfig> => ({
    ...form,
    bands: form.bands.map((band, index) => ({
        // A última faixa é sempre "sem teto".
        max_cents: index === form.bands.length - 1 || band.max_brl === null ? null : Math.round(Number(band.max_brl) * 100),
        count: Number(band.count) || 0,
    })),
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

const totalCount = computed(() => form.value.bands.reduce((sum, band) => sum + (Number(band.count) || 0), 0))
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

const toggleWeekday = (day: number) => {
    const days = form.value.weekdays
    form.value.weekdays = days.includes(day) ? days.filter((item) => item !== day) : [...days, day].sort()
}

// Nova faixa entra antes da última (a "sem teto"), com teto 100 acima da anterior.
const addBand = () => {
    const bands = form.value.bands
    const open = bands.slice(-1)
    const lastLimit = bands[bands.length - 2]?.max_brl ?? 0
    form.value.bands = [...bands.slice(0, -1), { max_brl: lastLimit + 100, count: 1 }, ...open]
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
                <label>Dias da semana</label>
                <div class="chips">
                    <button
                        v-for="(label, day) in WEEKDAYS"
                        :key="day"
                        type="button"
                        class="preset-btn"
                        :class="{ active: form.weekdays.includes(day) }"
                        @click="toggleWeekday(day)"
                    >
                        {{ label }}
                    </button>
                </div>
            </div>
            <div class="filter-field">
                <label>Preparar às</label>
                <input v-model="form.prepare_time" type="time" />
            </div>
            <div class="filter-field">
                <label>Publicar às</label>
                <input v-model="form.publish_time" type="time" />
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
                <strong>Faixas de preço</strong>
                <InfoTip :text="TIPS.bands" align="left" />
                <span class="muted">{{ totalCount }} stories por rodada</span>
                <span v-if="totalCount > 20" class="warn">máximo 20</span>
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
                <input v-model.number="band.count" type="number" min="0" max="10" class="band-input band-input--count" aria-label="Quantos stories" />
                <span class="muted">stories</span>
                <span v-if="plan?.bands[index]" class="muted">
                    ({{ plan.bands[index].available }} disponíveis hoje)
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

        <div class="filter-grid">
            <div class="filter-field">
                <label>Pular skin publicada nos últimos (dias) <InfoTip :text="TIPS.skip" /></label>
                <input v-model.number="form.skip_published_days" type="number" min="0" max="90" />
            </div>
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
            <button type="button" class="ghost-btn" :disabled="!dirty || saving || noteInvalid || totalCount > 20" @click="save">
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
