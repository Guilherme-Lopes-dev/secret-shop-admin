<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import { Icon } from '@iconify/vue'
import InfoTip from '@/components/common/InfoTip.vue'
import { adminService } from '@/services/admin/admin.service'
import type { MarketTraderBookHour, MarketTraderHours } from '@/services/admin/types'

// ~20 leituras por hora (umas 2 semanas de ciclos) antes de uma hora poder ser a "melhor".
const MIN_SAMPLES = 20

const TIP =
    'Todo ciclo lê 1 item líquido de uma lista fixa, em rodízio, pra cobrir todas as horas por igual. ' +
    'As leituras de compra e venda ficam de fora: elas só acontecem quando o spread já está largo e enviesariam a conta. ' +
    'Cada leitura é comparada com o normal do próprio item: "−3%" no lance quer dizer que, naquela hora, o maior lance costuma estar 3% abaixo do normal. ' +
    'Só entram itens com 8+ leituras nos últimos 30 dias. Horário de Brasília.'

const data = ref<MarketTraderHours | null>(null)
const loading = ref(false)
const loadError = ref(false)

const load = async () => {
    loading.value = true
    try {
        const response = await adminService.getMarketTraderHours()
        data.value = response.data
        loadError.value = false
    } catch {
        loadError.value = true
    } finally {
        loading.value = false
    }
}

onMounted(load)

const reliable = computed(() => (data.value?.hours ?? []).filter(row => row.samples >= MIN_SAMPLES))
const pick = (rows: MarketTraderBookHour[], better: (a: MarketTraderBookHour, b: MarketTraderBookHour) => boolean) =>
    rows.reduce<MarketTraderBookHour | null>((best, row) => (!best || better(row, best) ? row : best), null)

// Comprar: lance mais barato que o normal. Vender: menor venda mais cara que o normal.
const bestBuy = computed(() => pick(reliable.value, (a, b) => a.bidVsItemPct < b.bidVsItemPct))
const bestSell = computed(() => pick(reliable.value, (a, b) => a.askVsItemPct > b.askVsItemPct))

const pct = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}h`
</script>

<template>
    <div class="section-row">
        <h2 class="section-heading">
            <Icon icon="mdi:clock-outline" /> Livro por hora <InfoTip :text="TIP" />
        </h2>
        <button class="refresh" type="button" :disabled="loading" aria-label="Atualizar livro por hora" @click="load">
            <Icon icon="mdi:refresh" :class="{ spin: loading }" />
        </button>
    </div>

    <p v-if="loadError" class="state error">Não deu pra ler a medição por hora.</p>
    <p v-else-if="!data" class="state">Lendo a medição...</p>
    <p v-else-if="!data.hours.length" class="state">
        Ainda sem leituras suficientes. Cada item precisa de 8 leituras; com o trader ligado, os primeiros números aparecem em 1 a 2 dias.
    </p>

    <section v-else class="panel">
        <p class="summary">
            {{ data.samples }} leituras do rodízio, {{ data.items }} itens, nos últimos 30 dias
            <template v-if="data.since">(a mais antiga de {{ dayjs(data.since).format('DD/MM') }})</template>.
            <template v-if="bestBuy || bestSell">
                <span v-if="bestBuy" class="best buy">Melhor pra dar lance: {{ hourLabel(bestBuy.hour) }} ({{ pct(bestBuy.bidVsItemPct) }})</span>
                <span v-if="bestSell" class="best sell">Melhor pra vender: {{ hourLabel(bestSell.hour) }} ({{ pct(bestSell.askVsItemPct) }})</span>
            </template>
            <span v-else class="muted">Ainda pouco dado pra apontar horário: falta chegar a {{ MIN_SAMPLES }} leituras por hora.</span>
        </p>

        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Hora</th>
                        <th class="num">Leituras</th>
                        <th class="num">Itens</th>
                        <th class="num">Lance vs. normal</th>
                        <th class="num">Venda vs. normal</th>
                        <th class="num">Spread após taxa</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="row in data.hours"
                        :key="row.hour"
                        :class="{ thin: row.samples < MIN_SAMPLES, 'is-buy': row === bestBuy, 'is-sell': row === bestSell }"
                    >
                        <td>{{ hourLabel(row.hour) }}</td>
                        <td class="num">{{ row.samples }}</td>
                        <td class="num">{{ row.items }}</td>
                        <td class="num">{{ pct(row.bidVsItemPct) }}</td>
                        <td class="num">{{ pct(row.askVsItemPct) }}</td>
                        <td class="num">{{ pct(row.spreadPct) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <p class="footnote">Linhas apagadas têm menos de {{ MIN_SAMPLES }} leituras e não entram na escolha do melhor horário.</p>
    </section>
</template>

<style scoped lang="stylus">
.section-row
    display flex
    align-items center
    justify-content space-between
    gap 1rem

.section-heading
    display flex
    align-items center
    gap 0.4rem
    font-size 1rem
    font-weight 600
    color #e2e8f0
    margin 1.25rem 0 0.75rem

.refresh
    display inline-flex
    align-items center
    justify-content center
    width 32px
    height 32px
    font-size 1.05rem
    color #cbd5e1
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.1)
    border-radius 8px
    cursor pointer

    &:hover:not(:disabled)
        background #2a2a30

    &:disabled
        opacity 0.5
        cursor default

.spin
    animation spin 0.9s linear infinite

@keyframes spin
    to
        transform rotate(360deg)

.state
    background #1a1a1e
    border 1px dashed rgba(255,255,255,0.08)
    border-radius 12px
    padding 1.5rem
    color #94a3b8
    text-align center

    &.error
        color #fca5a5

.panel
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 12px
    padding 1.25rem

.summary
    display flex
    flex-wrap wrap
    align-items center
    gap 0.5rem 1rem
    margin 0 0 1rem
    color #cbd5e1
    font-size 0.88rem

.best
    padding 2px 8px
    border-radius 6px
    font-size 0.8rem
    font-weight 600

    &.buy
        background rgba(99,102,241,0.15)
        color #a5b4fc

    &.sell
        background rgba(74,222,128,0.12)
        color #86efac

.muted
    color #64748b

.table-wrap
    overflow-x auto

table
    width 100%
    border-collapse collapse
    font-size 0.85rem

th
    text-align left
    color #64748b
    font-weight 500
    font-size 0.72rem
    padding 0.45rem 0.6rem
    border-bottom 1px solid rgba(255,255,255,0.06)
    white-space nowrap

td
    padding 0.4rem 0.6rem
    color #cbd5e1
    border-bottom 1px solid rgba(255,255,255,0.03)
    white-space nowrap

.num
    text-align right
    font-variant-numeric tabular-nums

tr.thin td
    color #475569

tr.is-buy td
    background rgba(99,102,241,0.08)

tr.is-sell td
    background rgba(74,222,128,0.07)

.footnote
    margin 0.75rem 0 0
    color #64748b
    font-size 0.76rem
</style>
