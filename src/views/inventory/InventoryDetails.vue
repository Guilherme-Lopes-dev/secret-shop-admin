<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'

const router = useRouter()
const route = useRoute()
const uuid = route.params.uuid as string

const item = ref<any>(null)
const loading = ref(true)
const saving = ref(false)
const priceLocked = ref(false)
const lockingPrice = ref(false)

const rarityOptions = [
    'Common', 'Uncommon', 'Rare', 'Mythical', 'Legendary', 'Immortal',
    'Arcana', 'Ancient', 'Genuine', 'Unusual',
]

// Form mirrors all editable fields
const form = ref({
    // Skin-level
    name: '',
    hero: '',
    rarity: '',
    icon_url_large: '',
    manual_price_brl: '',
    median_price_brl: '',
    lowest_price_brl: '',
    // Item-level
    price_brl: '',
    asset_id: '',
    class_id: '',
    instance_id: '',
    tradable: true,
    is_collector: false,
    is_gifted: false,
    trade_cooldown_until: '',
})

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

const itemStatus = computed(() => {
    if (!item.value) return { label: '—', cls: '' }
    if (item.value.is_sold) return { label: 'Vendido', cls: 'badge-sold' }
    if (item.value.is_reserved) return { label: 'Reservado', cls: 'badge-reserved' }
    return { label: 'Disponível', cls: 'badge-available' }
})

const handleToggleLock = async () => {
    const skinUuid = item.value?.skins?.id
    if (!skinUuid) return
    lockingPrice.value = true
    try {
        const locked = !priceLocked.value
        await adminService.toggleSkinPriceLock(skinUuid, locked)
        priceLocked.value = locked
        if (item.value?.skins) item.value.skins.price_locked = locked
        toast.success(locked ? 'Preço bloqueado — sync automático desativado.' : 'Preço desbloqueado — sync automático ativado.')
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao alterar lock.')
    } finally {
        lockingPrice.value = false
    }
}

const populateForm = (data: any) => {
    const s = data.skins ?? {}
    priceLocked.value = s.price_locked ?? false
    form.value = {
        name: s.name ?? '',
        hero: s.hero ?? '',
        rarity: s.rarity ?? '',
        icon_url_large: s.icon_url_large ?? '',
        manual_price_brl: s.manual_price != null ? String(s.manual_price) : '',
        median_price_brl: s.median_price != null ? String(s.median_price) : '',
        lowest_price_brl: s.lowest_price != null ? String(s.lowest_price) : '',
        price_brl: data.price != null ? String(data.price) : '',
        asset_id: data.asset_id ?? '',
        class_id: data.class_id ?? '',
        instance_id: data.instance_id ?? '',
        tradable: data.tradable ?? true,
        is_collector: data.is_collector ?? false,
        is_gifted: data.is_gifted ?? false,
        trade_cooldown_until: data.trade_cooldown_until
            ? new Date(data.trade_cooldown_until).toISOString().slice(0, 16)
            : '',
    }
}

const fetchItem = async () => {
    loading.value = true
    try {
        const response = await adminService.getInventoryItem(uuid)
        item.value = response.data
        populateForm(response.data)
    } catch {
        toast.error('Erro ao carregar item.')
        router.push('/inventory')
    } finally {
        loading.value = false
    }
}

const handleSave = async () => {
    const price = parseCents(form.value.price_brl)
    if (!price || price <= 0) {
        toast.error('Preço de venda inválido.')
        return
    }

    saving.value = true
    try {
        const dto: Record<string, unknown> = {
            name: form.value.name || undefined,
            hero: form.value.hero || undefined,
            rarity: form.value.rarity || undefined,
            icon_url_large: form.value.icon_url_large || undefined,
            manual_price: price,
            median_price: parseCents(form.value.median_price_brl),
            lowest_price: parseCents(form.value.lowest_price_brl),
            price,
            asset_id: form.value.asset_id || undefined,
            class_id: form.value.class_id || undefined,
            instance_id: form.value.instance_id || undefined,
            tradable: form.value.tradable,
            is_collector: form.value.is_collector,
            is_gifted: form.value.is_gifted,
            trade_cooldown_until: form.value.trade_cooldown_until || null,
        }

        const response = await adminService.updateInventoryItem(uuid, dto)
        item.value = response.data
        populateForm(response.data)
        toast.success('Item atualizado com sucesso!')
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao salvar.')
    } finally {
        saving.value = false
    }
}

onMounted(fetchItem)
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <button class="btn-back" @click="router.push('/inventory')">
                <Icon icon="mdi:arrow-left" /> Inventário
            </button>
        </header>

        <div v-if="loading" class="loading-state">Carregando item...</div>

        <template v-else-if="item">
            <div class="item-hero-row">
                <div class="item-thumb-wrap">
                    <img
                        v-if="form.icon_url_large"
                        :src="previewImageUrl(form.icon_url_large)"
                        class="item-hero-img"
                        alt=""
                    />
                    <div v-else class="item-hero-placeholder">
                        <Icon icon="mdi:sword" />
                    </div>
                </div>
                <div class="item-hero-info">
                    <h1 class="page-title">{{ item.skins?.name || '—' }}</h1>
                    <p class="item-hash">{{ item.skins?.market_hash_name }}</p>
                    <div class="meta-row">
                        <span class="status-badge" :class="itemStatus.cls">{{ itemStatus.label }}</span>
                        <span class="meta-chip">
                            <Icon icon="mdi:robot-outline" />
                            {{ item.steam_bots?.name || '—' }}
                        </span>
                        <span class="meta-chip">
                            <Icon icon="mdi:tag-outline" />
                            {{ formatCurrency(item.price) }}
                        </span>
                    </div>
                </div>
            </div>

            <form class="form-card" @submit.prevent="handleSave">

                <!-- Skin -->
                <div class="form-section">
                    <h2 class="form-section-title">
                        <Icon icon="mdi:sword" /> Dados da Skin
                        <span class="section-note">Compartilhado entre todos os itens desta skin</span>
                    </h2>

                    <div class="form-row">
                        <div class="field">
                            <label class="field-label">Nome</label>
                            <input v-model="form.name" type="text" class="field-input" />
                        </div>
                        <div class="field">
                            <label class="field-label">Market Hash Name</label>
                            <input
                                :value="item.skins?.market_hash_name"
                                type="text"
                                class="field-input field-input--readonly"
                                readonly
                            />
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
                            <input v-model="form.icon_url_large" type="text" class="field-input" />
                        </div>
                    </div>
                </div>

                <!-- Preços -->
                <div class="form-section">
                    <h2 class="form-section-title">
                        <Icon icon="mdi:currency-usd" /> Preços (R$)
                        <button
                            type="button"
                            class="lock-toggle"
                            :class="{ 'lock-toggle--locked': priceLocked }"
                            :disabled="lockingPrice"
                            @click="handleToggleLock"
                            :title="priceLocked ? 'Preço bloqueado — clique para permitir sync automático' : 'Preço livre — clique para bloquear sync automático'"
                        >
                            <Icon
                                :icon="lockingPrice ? 'mdi:loading' : priceLocked ? 'mdi:lock' : 'mdi:lock-open-outline'"
                                :class="{ spinning: lockingPrice }"
                            />
                            {{ priceLocked ? 'Bloqueado' : 'Livre para sync' }}
                        </button>
                    </h2>

                    <div class="form-row form-row--4">
                        <div class="field">
                            <label class="field-label">Preço de Venda <span class="required">*</span></label>
                            <input v-model="form.price_brl" type="number" min="1" class="field-input field-input--price" placeholder="ex: 9934" />
                            <span v-if="pricePreview(form.price_brl)" class="field-preview">
                                O valor <strong>{{ pricePreview(form.price_brl) }}</strong> será exibido na venda
                            </span>
                            <span v-else class="field-hint">Informe em centavos (ex: 9934 = R$ 99,34)</span>
                        </div>
                        <div class="field">
                            <label class="field-label">Preço Manual (catálogo)</label>
                            <input v-model="form.manual_price_brl" type="number" min="1" class="field-input" placeholder="ex: 9934" />
                            <span v-if="pricePreview(form.manual_price_brl)" class="field-preview">
                                O valor <strong>{{ pricePreview(form.manual_price_brl) }}</strong> será exibido no catálogo
                            </span>
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

                <!-- Steam -->
                <div class="form-section">
                    <h2 class="form-section-title">
                        <Icon icon="mdi:steam" /> Dados Steam
                    </h2>

                    <div class="form-row form-row--3">
                        <div class="field">
                            <label class="field-label">Asset ID</label>
                            <input v-model="form.asset_id" type="text" class="field-input" />
                        </div>
                        <div class="field">
                            <label class="field-label">Class ID</label>
                            <input v-model="form.class_id" type="text" class="field-input" />
                        </div>
                        <div class="field">
                            <label class="field-label">Instance ID</label>
                            <input v-model="form.instance_id" type="text" class="field-input" />
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="field">
                            <label class="field-label">Cooldown de Trade até</label>
                            <input v-model="form.trade_cooldown_until" type="datetime-local" class="field-input" />
                            <span class="field-hint">Deixe em branco para limpar o cooldown</span>
                        </div>
                        <div class="field">
                            <label class="field-label">Reference</label>
                            <input
                                :value="item.reference || '—'"
                                type="text"
                                class="field-input field-input--readonly"
                                readonly
                            />
                            <span class="field-hint">Gerado automaticamente de class_id + instance_id</span>
                        </div>
                    </div>
                </div>

                <!-- Atributos -->
                <div class="form-section">
                    <h2 class="form-section-title">
                        <Icon icon="mdi:tag-outline" /> Atributos
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

                <!-- Info somente leitura -->
                <div class="form-section">
                    <h2 class="form-section-title">
                        <Icon icon="mdi:information-outline" /> Informações
                    </h2>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">UUID</span>
                            <code class="info-value mono">{{ item.id }}</code>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Bot</span>
                            <span class="info-value">{{ item.steam_bots?.name }} ({{ item.steam_bots?.steam_id }})</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Criado em</span>
                            <span class="info-value">{{ $dayjs(item.created_at).format('DD/MM/YYYY HH:mm') }}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Atualizado em</span>
                            <span class="info-value">{{ $dayjs(item.updated_at).format('DD/MM/YYYY HH:mm') }}</span>
                        </div>
                    </div>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn-cancel" @click="router.push('/inventory')">Cancelar</button>
                    <button type="submit" class="btn-submit" :disabled="saving">
                        <Icon v-if="saving" icon="mdi:loading" class="spinning" />
                        <Icon v-else icon="mdi:content-save-outline" />
                        {{ saving ? 'Salvando...' : 'Salvar alterações' }}
                    </button>
                </div>
            </form>
        </template>
    </div>
</template>

<style lang="stylus" scoped>
.view-wrap
    padding 2rem
    color #fff
    background #121214
    min-height 100vh
    max-width 960px

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

.loading-state
    padding 4rem
    text-align center
    color #94a3b8

.item-hero-row
    display flex
    align-items flex-start
    gap 1.5rem
    margin-bottom 2rem
    padding 1.5rem
    background #1a1a1e
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.item-hero-img
    width 120px
    height 120px
    object-fit contain
    border-radius 8px
    background rgba(255,255,255,0.04)

.item-hero-placeholder
    width 120px
    height 120px
    border-radius 8px
    background rgba(255,255,255,0.05)
    display flex
    align-items center
    justify-content center
    color #64748b
    font-size 2.5rem

.item-hero-info
    flex 1

.page-title
    font-size 1.6rem
    font-weight 700
    margin-bottom 0.25rem

.item-hash
    font-size 0.8rem
    color #64748b
    font-family monospace
    margin-bottom 0.75rem

.meta-row
    display flex
    align-items center
    gap 0.75rem
    flex-wrap wrap

.meta-chip
    display inline-flex
    align-items center
    gap 0.3rem
    background rgba(255,255,255,0.05)
    border 1px solid rgba(255,255,255,0.08)
    border-radius 6px
    padding 0.25rem 0.6rem
    font-size 0.78rem
    color #94a3b8

.status-badge
    padding 3px 10px
    border-radius 5px
    font-size 0.72rem
    font-weight 600
    text-transform uppercase

.badge-available
    background rgba(76,175,80,0.1)
    color #4caf50

.badge-reserved
    background rgba(255,152,0,0.1)
    color #ff9800

.badge-sold
    background rgba(244,67,54,0.1)
    color #f44336

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

.section-note
    font-size 0.72rem
    font-weight 400
    color #64748b
    margin-left auto

.form-row
    display grid
    grid-template-columns 1fr 1fr
    gap 1rem
    margin-bottom 1rem

    &:last-child
        margin-bottom 0

    &--3
        grid-template-columns 1fr 1fr 1fr

    &--4
        grid-template-columns 1fr 1fr 1fr 1fr

.field
    display flex
    flex-direction column
    gap 0.4rem

    &--full
        grid-column 1 / -1

.field-label
    font-size 0.78rem
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
        font-size 1.05rem
        font-weight 600
        color #4caf50

    &--readonly
        opacity 0.5
        cursor default

    option
        background #1a1a1e

.field-hint
    font-size 0.73rem
    color #64748b

.field-preview
    font-size 0.78rem
    color #4caf50

    strong
        font-weight 700

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

.info-grid
    display grid
    grid-template-columns 1fr 1fr
    gap 0.75rem

.info-item
    display flex
    flex-direction column
    gap 0.25rem

.info-label
    font-size 0.73rem
    font-weight 500
    color #64748b
    text-transform uppercase
    letter-spacing 0.04em

.info-value
    font-size 0.875rem
    color #e2e8f0

    &.mono
        font-family monospace
        font-size 0.78rem
        color #94a3b8

.lock-toggle
    display inline-flex
    align-items center
    gap 0.35rem
    margin-left auto
    background rgba(255,255,255,0.04)
    border 1px solid rgba(255,255,255,0.1)
    border-radius 6px
    color #94a3b8
    padding 0.3rem 0.75rem
    font-size 0.78rem
    font-weight 500
    cursor pointer
    transition all 0.2s

    &:hover:not(:disabled)
        border-color rgba(255,152,0,0.35)
        color #ff9800
        background rgba(255,152,0,0.06)

    &--locked
        border-color rgba(244,67,54,0.35)
        color #f44336
        background rgba(244,67,54,0.06)

        &:hover:not(:disabled)
            border-color rgba(76,175,80,0.35)
            color #4caf50
            background rgba(76,175,80,0.06)

    &:disabled
        opacity 0.4
        cursor not-allowed

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

@media (max-width: 800px)
    .form-row--4
        grid-template-columns 1fr 1fr

    .form-row--3
        grid-template-columns 1fr 1fr

    .form-row
        grid-template-columns 1fr

    .item-hero-row
        flex-direction column

    .info-grid
        grid-template-columns 1fr
</style>
