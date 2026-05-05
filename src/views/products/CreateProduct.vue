<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'

const router = useRouter()
const bots = ref<any[]>([])
const submitting = ref(false)

const form = ref({
    name: '',
    market_hash_name: '',
    hero: '',
    rarity: '',
    icon_url_large: '',
    manual_price_brl: '',
    median_price_brl: '',
    lowest_price_brl: '',
    bot_uuid: '',
    asset_id: '',
    class_id: '',
    instance_id: '',
    is_collector: true,
    is_gifted: false,
    tradable: true,
    trade_cooldown_until: '',
})

const rarityOptions = [
    'Common', 'Uncommon', 'Rare', 'Mythical', 'Legendary', 'Immortal',
    'Arcana', 'Ancient', 'Genuine', 'Unusual',
]

const parseCents = (value: string): number | undefined => {
    if (!value) return undefined
    const n = parseInt(value, 10)
    return isNaN(n) || n <= 0 ? undefined : n
}

const pricePreview = (value: string): string => {
    if (!value) return ''
    const n = parseInt(value, 10)
    if (isNaN(n) || n <= 0) return ''
    return formatCurrency(n)
}

const previewImageUrl = (hash: string) => {
    if (!hash) return ''
    if (hash.startsWith('http')) return hash
    return `https://steamcommunity-a.akamaihd.net/economy/image/${hash}/184fx184f`
}

const fetchBots = async () => {
    try {
        const response = await adminService.getBots()
        if (response.data) {
            bots.value = response.data
            if (bots.value.length > 0) form.value.bot_uuid = bots.value[0].id
        }
    } catch {
        toast.error('Erro ao carregar bots.')
    }
}

const handleSubmit = async () => {
    const required = [form.value.name, form.value.market_hash_name, form.value.manual_price_brl, form.value.bot_uuid, form.value.asset_id]
    if (required.some(v => !v)) {
        toast.error('Preencha todos os campos obrigatórios.')
        return
    }

    const manual_price = parseCents(form.value.manual_price_brl)
    if (!manual_price || manual_price <= 0) {
        toast.error('Preço manual inválido.')
        return
    }

    submitting.value = true
    try {
        await adminService.createProduct({
            name: form.value.name,
            market_hash_name: form.value.market_hash_name,
            hero: form.value.hero || undefined,
            rarity: form.value.rarity || undefined,
            icon_url_large: form.value.icon_url_large || undefined,
            manual_price,
            median_price: parseCents(form.value.median_price_brl),
            lowest_price: parseCents(form.value.lowest_price_brl),
            bot_uuid: form.value.bot_uuid,
            asset_id: form.value.asset_id,
            class_id: form.value.class_id || undefined,
            instance_id: form.value.instance_id || undefined,
            is_collector: form.value.is_collector,
            is_gifted: form.value.is_gifted,
            tradable: form.value.tradable,
            trade_cooldown_until: form.value.trade_cooldown_until || undefined,
        })
        toast.success('Produto criado com sucesso!')
        router.push('/inventory')
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao criar produto.')
    } finally {
        submitting.value = false
    }
}

onMounted(fetchBots)
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <button class="btn-back" @click="router.push('/inventory')">
                <Icon icon="mdi:arrow-left" /> Inventário
            </button>
        </header>

        <h1 class="page-title">Adicionar Produto</h1>
        <p class="page-subtitle">Cria uma skin no catálogo e adiciona imediatamente ao inventário do bot</p>

        <form class="form-card" @submit.prevent="handleSubmit">

            <!-- Dados da Skin -->
            <div class="form-section">
                <h2 class="form-section-title">
                    <Icon icon="mdi:sword" /> Dados da Skin
                </h2>

                <div class="form-row">
                    <div class="field">
                        <label class="field-label">Nome <span class="required">*</span></label>
                        <input v-model="form.name" type="text" class="field-input" placeholder="ex: Arcana of the Ancient One" />
                    </div>
                    <div class="field">
                        <label class="field-label">Market Hash Name <span class="required">*</span></label>
                        <input v-model="form.market_hash_name" type="text" class="field-input" placeholder="ex: Arcana of the Ancient One" />
                    </div>
                </div>

                <div class="form-row">
                    <div class="field">
                        <label class="field-label">Herói</label>
                        <input v-model="form.hero" type="text" class="field-input" placeholder="ex: Axe" />
                    </div>
                    <div class="field">
                        <label class="field-label">Raridade</label>
                        <select v-model="form.rarity" class="field-input">
                            <option value="">— Selecionar —</option>
                            <option v-for="r in rarityOptions" :key="r" :value="r">{{ r }}</option>
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="field field--full">
                        <label class="field-label">Icon URL / Hash Steam</label>
                        <input v-model="form.icon_url_large" type="text" class="field-input" placeholder="ex: abcdef123... ou URL completa" />
                        <img
                            v-if="form.icon_url_large"
                            :src="previewImageUrl(form.icon_url_large)"
                            class="icon-preview"
                            alt="Preview"
                        />
                    </div>
                </div>
            </div>

            <!-- Preços -->
            <div class="form-section">
                <h2 class="form-section-title">
                    <Icon icon="mdi:currency-usd" /> Preços (R$)
                </h2>

                <div class="form-row form-row--3">
                    <div class="field">
                        <label class="field-label">Preço Manual <span class="required">*</span></label>
                        <input v-model="form.manual_price_brl" type="number" min="1" class="field-input field-input--price" placeholder="ex: 9934" />
                        <span v-if="pricePreview(form.manual_price_brl)" class="field-preview">
                            O valor <strong>{{ pricePreview(form.manual_price_brl) }}</strong> será exibido na venda
                        </span>
                        <span v-else class="field-hint-ok">Informe em centavos (ex: 9934 = R$ 99,34)</span>
                    </div>
                    <div class="field">
                        <label class="field-label">Preço Mediano</label>
                        <input v-model="form.median_price_brl" type="number" min="0" class="field-input" placeholder="ex: 8500" />
                        <span v-if="pricePreview(form.median_price_brl)" class="field-preview">
                            {{ pricePreview(form.median_price_brl) }}
                        </span>
                    </div>
                    <div class="field">
                        <label class="field-label">Menor Preço</label>
                        <input v-model="form.lowest_price_brl" type="number" min="0" class="field-input" placeholder="ex: 7000" />
                        <span v-if="pricePreview(form.lowest_price_brl)" class="field-preview">
                            {{ pricePreview(form.lowest_price_brl) }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Bot & Inventário -->
            <div class="form-section">
                <h2 class="form-section-title">
                    <Icon icon="mdi:robot-outline" /> Bot & Inventário Steam
                </h2>

                <div class="form-row">
                    <div class="field">
                        <label class="field-label">Bot <span class="required">*</span></label>
                        <select v-model="form.bot_uuid" class="field-input">
                            <option value="">— Selecionar bot —</option>
                            <option v-for="bot in bots" :key="bot.id" :value="bot.id">
                                {{ bot.name }} ({{ bot.steam_id }})
                            </option>
                        </select>
                        <p v-if="bots.length === 0" class="field-hint-error">Nenhum bot cadastrado.</p>
                    </div>
                    <div class="field">
                        <label class="field-label">Asset ID <span class="required">*</span></label>
                        <input v-model="form.asset_id" type="text" class="field-input" placeholder="ex: 12345678901234567" />
                    </div>
                </div>

                <div class="form-row">
                    <div class="field">
                        <label class="field-label">Class ID</label>
                        <input v-model="form.class_id" type="text" class="field-input" placeholder="Opcional" />
                    </div>
                    <div class="field">
                        <label class="field-label">Instance ID</label>
                        <input v-model="form.instance_id" type="text" class="field-input" placeholder="Opcional" />
                    </div>
                </div>

                <div class="form-row">
                    <div class="field">
                        <label class="field-label">Cooldown de Trade até</label>
                        <input v-model="form.trade_cooldown_until" type="datetime-local" class="field-input" />
                        <span class="field-hint-ok">Deixe em branco se não houver cooldown</span>
                    </div>
                </div>
            </div>

            <!-- Flags -->
            <div class="form-section">
                <h2 class="form-section-title">
                    <Icon icon="mdi:tag-outline" /> Atributos do Item
                </h2>

                <div class="flags-row">
                    <label class="flag-toggle" :class="{ active: form.is_collector }">
                        <input type="checkbox" v-model="form.is_collector" class="flag-checkbox" />
                        <Icon icon="mdi:star-circle-outline" />
                        <span>Collector</span>
                    </label>

                    <label class="flag-toggle" :class="{ active: form.is_gifted }">
                        <input type="checkbox" v-model="form.is_gifted" class="flag-checkbox" />
                        <Icon icon="mdi:gift-outline" />
                        <span>Gift</span>
                    </label>

                    <label class="flag-toggle" :class="{ active: form.tradable }">
                        <input type="checkbox" v-model="form.tradable" class="flag-checkbox" />
                        <Icon icon="mdi:swap-horizontal" />
                        <span>Tradable</span>
                    </label>
                </div>
            </div>

            <div class="form-actions">
                <button type="button" class="btn-cancel" @click="router.push('/inventory')">Cancelar</button>
                <button type="submit" class="btn-submit" :disabled="submitting">
                    <Icon v-if="submitting" icon="mdi:loading" class="spinning" />
                    <Icon v-else icon="mdi:plus-circle-outline" />
                    {{ submitting ? 'Criando...' : 'Criar Produto' }}
                </button>
            </div>
        </form>
    </div>
</template>

<style lang="stylus" scoped>
.view-wrap
    padding 2rem
    color #fff
    background #121214
    min-height 100vh
    max-width 900px

.page-header
    margin-bottom 1.5rem

.btn-back
    display inline-flex
    align-items center
    gap 0.4rem
    background transparent
    border none
    color #94a3b8
    cursor pointer
    font-size 0.875rem
    padding 0.4rem 0.5rem
    border-radius 6px
    transition all 0.15s

    &:hover
        color #fff
        background rgba(255,255,255,0.05)

.page-title
    font-size 1.8rem
    font-weight 700
    margin-bottom 0.25rem

.page-subtitle
    color #94a3b8
    font-size 0.9rem
    margin-bottom 2rem

.form-card
    display flex
    flex-direction column
    gap 1.5rem

.form-section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.form-section-title
    display flex
    align-items center
    gap 0.5rem
    font-size 1rem
    font-weight 600
    color #cbd5e1
    margin-bottom 1.25rem

.form-row
    display grid
    grid-template-columns 1fr 1fr
    gap 1rem
    margin-bottom 1rem

    &:last-child
        margin-bottom 0

    &--3
        grid-template-columns 1fr 1fr 1fr

.field
    display flex
    flex-direction column
    gap 0.4rem

    &--full
        grid-column 1 / -1

.field-label
    font-size 0.8rem
    font-weight 500
    color #94a3b8
    text-transform uppercase
    letter-spacing 0.04em

.required
    color #f44336

.field-input
    background #121214
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.6rem 0.875rem
    font-size 0.9rem
    outline none
    transition border-color 0.2s

    &:focus
        border-color rgba(99,102,241,0.5)

    &::placeholder
        color #64748b

    &--price
        font-size 1.1rem
        font-weight 600
        color #4caf50

    option
        background #1a1a1e

.field-hint-ok
    font-size 0.75rem
    color #64748b

.field-preview
    font-size 0.78rem
    color #4caf50

    strong
        font-weight 700

.field-hint-error
    font-size 0.78rem
    color #f44336
    margin 0

.icon-preview
    width 80px
    height 80px
    object-fit contain
    border-radius 8px
    background rgba(255,255,255,0.03)
    border 1px solid rgba(255,255,255,0.06)
    margin-top 0.5rem

.flags-row
    display flex
    gap 0.75rem
    flex-wrap wrap

.flag-toggle
    display inline-flex
    align-items center
    gap 0.5rem
    padding 0.6rem 1rem
    border-radius 8px
    border 1px solid rgba(255,255,255,0.08)
    background #121214
    cursor pointer
    font-size 0.875rem
    color #94a3b8
    user-select none
    transition all 0.2s

    &.active
        border-color rgba(99,102,241,0.5)
        background rgba(99,102,241,0.08)
        color #818cf8

    &:hover
        border-color rgba(255,255,255,0.15)

.flag-checkbox
    display none

.form-actions
    display flex
    justify-content flex-end
    gap 0.75rem
    padding-top 0.5rem

.btn-cancel
    background transparent
    border 1px solid rgba(255,255,255,0.1)
    color #94a3b8
    padding 0.6rem 1.5rem
    border-radius 8px
    font-size 0.9rem
    cursor pointer
    transition all 0.2s

    &:hover
        border-color rgba(255,255,255,0.2)
        color #fff

.btn-submit
    display inline-flex
    align-items center
    gap 0.5rem
    background #6366f1
    color #fff
    border none
    padding 0.6rem 1.75rem
    border-radius 8px
    font-size 0.9rem
    font-weight 600
    cursor pointer
    transition all 0.2s

    &:hover:not(:disabled)
        background #4f52d4

    &:disabled
        opacity 0.5
        cursor not-allowed

.spinning
    animation spin 1s linear infinite

@keyframes spin
    from transform rotate(0deg)
    to transform rotate(360deg)

@media (max-width: 700px)
    .form-row
        grid-template-columns 1fr

    .form-row--3
        grid-template-columns 1fr
</style>
