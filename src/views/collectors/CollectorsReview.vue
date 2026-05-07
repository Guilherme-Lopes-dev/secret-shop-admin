<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { formatCurrency } from '@/utils/formatCurrency'
import {
    clearCollectorReviewSelection,
    getCollectorItemKey,
    readCollectorReviewSelection,
    saveCollectorReviewSelection,
    type CollectorInventoryItem,
} from '@/utils/collectorsSelection'

const router = useRouter()
const steamId = ref('')
const items = ref<CollectorInventoryItem[]>([])
const priceInputs = ref<Record<string, string>>({})

const parseCents = (value: string): number | undefined => {
    if (!value) return undefined
    const n = parseInt(value, 10)
    return isNaN(n) || n <= 0 ? undefined : n
}

const pricePreview = (value: string): string => {
    const cents = parseCents(value)
    return cents ? formatCurrency(cents) : ''
}

const totalEnteredCents = computed(() =>
    items.value.reduce((sum, item) => {
        const cents = parseCents(priceInputs.value[getCollectorItemKey(item)] ?? '')
        return sum + (cents ?? 0)
    }, 0),
)

function persistSelection() {
    if (items.value.length === 0) {
        clearCollectorReviewSelection()
        return
    }

    saveCollectorReviewSelection({
        steamId: steamId.value,
        items: items.value,
        priceInputs: priceInputs.value,
    })
}

function updatePrice(item: CollectorInventoryItem, value: string) {
    priceInputs.value = {
        ...priceInputs.value,
        [getCollectorItemKey(item)]: value,
    }
    persistSelection()
}

function removeItem(item: CollectorInventoryItem) {
    const itemKey = getCollectorItemKey(item)
    items.value = items.value.filter((entry) => getCollectorItemKey(entry) !== itemKey)

    const nextPriceInputs = { ...priceInputs.value }
    delete nextPriceInputs[itemKey]
    priceInputs.value = nextPriceInputs

    persistSelection()
}

function goBack() {
    persistSelection()
    router.push('/collectors')
}

onMounted(() => {
    const selection = readCollectorReviewSelection()

    if (!selection) {
        return
    }

    steamId.value = selection.steamId
    items.value = selection.items
    priceInputs.value = selection.priceInputs
})
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <button class="btn-back" @click="goBack">
                <Icon icon="mdi:arrow-left" />
                Collectors
            </button>
        </header>

        <div class="hero-card">
            <div>
                <h1 class="page-title">Itens Selecionados</h1>
                <p class="page-subtitle">
                    Defina o valor em centavos para cada item e veja abaixo como ele apareceria no site.
                </p>
            </div>

            <div class="hero-stats" v-if="items.length > 0">
                <span class="meta-chip">
                    <Icon icon="mdi:steam" />
                    {{ steamId }}
                </span>
                <span class="meta-chip">
                    <Icon icon="mdi:shape-outline" />
                    {{ items.length }} item{{ items.length !== 1 ? 's' : '' }}
                </span>
                <span class="meta-chip meta-chip--price">
                    <Icon icon="mdi:currency-usd" />
                    {{ formatCurrency(totalEnteredCents) }}
                </span>
            </div>
        </div>

        <section class="section" v-if="items.length > 0">
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Market Hash</th>
                            <th>Asset ID</th>
                            <th>Class / Instance</th>
                            <th>Valor no Site</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in items" :key="getCollectorItemKey(item)">
                            <td>
                                <div class="item-cell">
                                    <img
                                        v-if="item.iconUrlLarge || item.iconUrl"
                                        :src="item.iconUrlLarge || item.iconUrl || ''"
                                        class="item-thumb"
                                        alt=""
                                    />
                                    <div v-else class="item-thumb-placeholder">
                                        <Icon icon="mdi:trophy-variant-outline" />
                                    </div>

                                    <div>
                                        <span class="item-name">{{ item.name }}</span>
                                        <small class="item-subtitle">Quantidade: {{ item.amount }}</small>
                                    </div>
                                </div>
                            </td>
                            <td class="market-cell">{{ item.marketHashName || '-' }}</td>
                            <td><code class="mono">{{ item.assetId }}</code></td>
                            <td>
                                <div class="code-stack">
                                    <code class="mono">{{ item.classId }}</code>
                                    <code class="mono">{{ item.instanceId }}</code>
                                </div>
                            </td>
                            <td class="price-cell">
                                <label class="field-label">Centavos</label>
                                <input
                                    :value="priceInputs[getCollectorItemKey(item)] ?? ''"
                                    type="number"
                                    min="1"
                                    class="field-input field-input--price"
                                    placeholder="ex: 9934"
                                    @input="updatePrice(item, ($event.target as HTMLInputElement).value)"
                                />
                                <span v-if="pricePreview(priceInputs[getCollectorItemKey(item)] ?? '')" class="field-preview">
                                    O valor <strong>{{ pricePreview(priceInputs[getCollectorItemKey(item)] ?? '') }}</strong> sera exibido na venda
                                </span>
                                <span v-else class="field-hint">Informe em centavos. Ex: 9934 = R$ 99,34</span>
                            </td>
                            <td class="actions-col">
                                <button class="btn-remove" @click="removeItem(item)">
                                    <Icon icon="mdi:trash-can-outline" />
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <section v-else class="empty-panel">
            <Icon icon="mdi:table-off" class="empty-icon" />
            <p>Nenhum item selecionado para revisar.</p>
            <button class="btn-primary" @click="router.push('/collectors')">
                Voltar para Collectors
            </button>
        </section>
    </div>
</template>

<style lang="stylus" scoped>
.view-wrap
    padding 2rem
    color #fff
    background #121214
    min-height 100vh

.page-header
    margin-bottom 1rem

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

.hero-card
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)
    display flex
    justify-content space-between
    gap 1rem
    align-items flex-start
    flex-wrap wrap
    margin-bottom 1.25rem

.page-title
    font-size 1.8rem
    font-weight 700
    margin-bottom 0.25rem

.page-subtitle
    color #94a3b8
    font-size 0.92rem

.hero-stats
    display flex
    flex-wrap wrap
    gap 0.75rem

.meta-chip
    display inline-flex
    align-items center
    gap 0.35rem
    background rgba(255,255,255,0.05)
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    padding 0.45rem 0.7rem
    font-size 0.82rem
    color #cbd5e1

    &--price
        color #4ade80

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.table-wrapper
    overflow-x auto

table
    width 100%
    border-collapse collapse

    th
        text-align left
        color #94a3b8
        font-size 0.78rem
        font-weight 600
        padding 0.75rem
        border-bottom 1px solid rgba(255,255,255,0.05)
        white-space nowrap
        text-transform uppercase

    td
        padding 0.9rem 0.75rem
        font-size 0.875rem
        border-bottom 1px solid rgba(255,255,255,0.04)
        vertical-align top

tr:hover td
    background rgba(255,255,255,0.02)

.item-cell
    display flex
    align-items center
    gap 0.7rem
    min-width 240px

.item-thumb
    width 44px
    height 44px
    object-fit contain
    border-radius 8px
    background rgba(255,255,255,0.04)
    flex-shrink 0

.item-thumb-placeholder
    width 44px
    height 44px
    border-radius 8px
    background rgba(255,255,255,0.05)
    display flex
    align-items center
    justify-content center
    color #64748b
    flex-shrink 0

.item-name
    display block
    font-weight 600
    color #f8fafc

.item-subtitle
    display block
    margin-top 0.2rem
    color #94a3b8
    font-size 0.75rem

.market-cell
    min-width 220px
    color #cbd5e1

.mono
    font-family monospace
    font-size 0.8rem
    color #cbd5e1

.code-stack
    display flex
    flex-direction column
    gap 0.3rem

.price-cell
    min-width 230px

.field-label
    display block
    font-size 0.76rem
    font-weight 500
    color #94a3b8
    text-transform uppercase
    letter-spacing 0.04em
    margin-bottom 0.35rem

.field-input
    width 100%
    background #121214
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.6rem 0.875rem
    font-size 0.9rem
    outline none
    transition border-color 0.2s
    box-sizing border-box

    &:focus
        border-color rgba(99,102,241,0.5)

    &::placeholder
        color #64748b

    &--price
        font-size 1rem
        font-weight 600
        color #4caf50

.field-preview
    display block
    font-size 0.78rem
    color #4caf50
    margin-top 0.35rem

    strong
        font-weight 700

.field-hint
    display block
    font-size 0.73rem
    color #64748b
    margin-top 0.35rem

.actions-col
    width 56px
    text-align right

.btn-remove
    display inline-flex
    align-items center
    justify-content center
    width 34px
    height 34px
    background rgba(239,68,68,0.1)
    color #f87171
    border 1px solid rgba(248,113,113,0.15)
    border-radius 8px
    cursor pointer
    transition all 0.2s

    &:hover
        background rgba(239,68,68,0.18)

.empty-panel
    background #1a1a1e
    padding 3rem 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)
    text-align center
    color #94a3b8

.empty-icon
    font-size 2.5rem
    color #64748b
    margin-bottom 0.75rem

.btn-primary
    margin-top 1rem
    display inline-flex
    align-items center
    justify-content center
    gap 0.45rem
    border-radius 10px
    padding 0.72rem 1rem
    font-size 0.88rem
    font-weight 600
    cursor pointer
    transition all 0.2s
    border 1px solid transparent
    background #6366f1
    color #fff

    &:hover
        background #5457de

@media (max-width: 900px)
    .hero-card
        flex-direction column

    .price-cell
        min-width 200px
</style>
