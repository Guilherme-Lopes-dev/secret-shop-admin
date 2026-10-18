<script setup lang="ts">
import { computed, ref } from 'vue'
import InfoTip from '@/components/common/InfoTip.vue'
import SortableTh from '@/components/common/SortableTh.vue'
import type { SteamOrderLevel } from '@/services/admin/types'
import { nextSort, sortRows, type SortGetters, type SortState } from '@/utils/tableSort'
import { formatMoney, withCumulative } from './marketMath'

const COLLAPSED_LEVELS = 12

type LevelRow = ReturnType<typeof withCumulative>[number]

const SORTS: SortGetters<LevelRow> = {
    priceCents: level => level.priceCents,
    quantity: level => level.quantity,
}

const props = defineProps<{
    title: string
    tip: string
    tone: 'sell' | 'buy'
    levels: SteamOrderLevel[]
    count: number
    currency: string
}>()

const expanded = ref(false)
const sort = ref<SortState>()

// Acumulado sai na ordem do livro; a ordenação só reorganiza as linhas depois.
const rows = computed(() => {
    const all = sortRows(withCumulative(props.levels), SORTS, sort.value)
    return expanded.value ? all : all.slice(0, COLLAPSED_LEVELS)
})
const deepest = computed(() => Math.max(1, ...rows.value.map(row => row.cumulative)))
const toggleSort = (column: string) => {
    sort.value = nextSort(sort.value, column)
}
const depthWidth = (cumulative: number) => `${Math.round((cumulative / deepest.value) * 100)}%`
</script>

<template>
    <section class="side" :class="tone">
        <header class="side-header">
            <h3>{{ title }} <InfoTip :text="tip" align="left" /></h3>
            <span class="count">{{ count.toLocaleString('pt-BR') }} {{ tone === 'sell' ? 'à venda' : 'pedidos' }}</span>
        </header>

        <p v-if="!levels.length" class="empty">Ninguém {{ tone === 'sell' ? 'vendendo' : 'comprando' }} agora.</p>

        <table v-else>
            <thead>
                <tr>
                    <SortableTh column="priceCents" label="Preço (com taxa)" :sort="sort" @toggle="toggleSort" />
                    <SortableTh class="num" column="quantity" label="Qtd" :sort="sort" @toggle="toggleSort" />
                    <th class="num">Acumulado</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="row in rows" :key="row.priceCents">
                    <td class="price">
                        <span class="depth" :style="{ width: depthWidth(row.cumulative) }" aria-hidden="true" />
                        <span class="label">{{ formatMoney(row.priceCents, currency) }}</span>
                    </td>
                    <td class="num">{{ row.quantity }}</td>
                    <td class="num">{{ row.cumulative }}</td>
                </tr>
            </tbody>
        </table>

        <button v-if="levels.length > COLLAPSED_LEVELS" class="btn-more" @click="expanded = !expanded">
            {{ expanded ? 'Mostrar menos' : `Mostrar os ${levels.length} níveis` }}
        </button>
    </section>
</template>

<style lang="stylus" scoped>
.side
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 12px
    padding 1.25rem
    min-width 0

.side-header
    display flex
    justify-content space-between
    align-items baseline
    gap 0.5rem
    margin-bottom 0.75rem

    h3
        font-size 0.95rem
        font-weight 600
        color #e2e8f0
        display inline-flex
        align-items center
        gap 0.35rem

.count
    color #94a3b8
    font-size 0.8rem

.empty
    color #64748b
    font-size 0.85rem

table
    width 100%
    border-collapse collapse
    font-size 0.85rem

th
    text-align left
    color #64748b
    font-weight 500
    font-size 0.72rem
    padding 0.35rem 0.5rem
    border-bottom 1px solid rgba(255,255,255,0.06)

td
    padding 0.35rem 0.5rem
    color #cbd5e1
    border-bottom 1px solid rgba(255,255,255,0.03)

.num
    text-align right
    font-variant-numeric tabular-nums

.price
    position relative
    font-variant-numeric tabular-nums

.depth
    position absolute
    inset 2px auto 2px 0
    border-radius 4px
    opacity 0.16

.label
    position relative

.sell .depth
    background #f87171

.sell .label
    color #fca5a5

.buy .depth
    background #4ade80

.buy .label
    color #86efac

.btn-more
    margin-top 0.75rem
    background none
    border 1px solid rgba(255,255,255,0.1)
    color #cbd5e1
    padding 0.35rem 0.8rem
    border-radius 6px
    font-size 0.78rem
    cursor pointer

    &:hover
        background #2a2a30
</style>
