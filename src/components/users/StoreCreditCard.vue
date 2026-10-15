<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import dayjs from 'dayjs'
import { adminService, type StoreCreditStatement } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'

const props = defineProps<{ userUuid: string }>()
const emit = defineEmits<{ balance: [cents: number] }>()

const statement = ref<StoreCreditStatement | null>(null)
const amountInput = ref('')
const note = ref('')
const saving = ref(false)

const KIND_LABELS: Record<string, string> = {
    skin_sale: 'Venda de skins',
    purchase: 'Compra',
    purchase_returned: 'Saldo devolvido (pedido não pago)',
    purchase_reclaimed: 'Pago após expirar (descontado de novo)',
    swap_surplus: 'Sobra de troca',
    admin_adjustment: 'Ajuste manual',
}

/** Com vírgula, ponto é milhar ("1.500,56"); sem vírgula, ponto é decimal ("25.50"). */
const toDecimalString = (value: string) => {
    const compact = value.replace(/\s|R\$/g, '')
    if (!compact.includes(',')) return compact

    return compact.replace(/\./g, '').replace(',', '.')
}

/** "-25,50" → -2550. Vazio ou inválido → null. */
const parseSignedCents = (value: string): number | null => {
    const normalized = toDecimalString(value)
    if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null
    return Math.round(Number(normalized) * 100)
}

const amountCents = computed(() => parseSignedCents(amountInput.value))
const projectedBalance = computed(() => (statement.value?.balance_cents ?? 0) + (amountCents.value ?? 0))
const canSave = computed(
    () => !saving.value && !!amountCents.value && projectedBalance.value >= 0 && note.value.trim().length >= 3,
)

// Prévia do que foi digitado, em reais, e de como o saldo fica.
const amountHint = computed(() => {
    if (!amountInput.value.trim()) return null

    const cents = amountCents.value
    if (cents === null) return { tone: 'bad', text: 'Valor inválido (ex: 25,00 ou -25,00)' }
    if (cents === 0) return { tone: 'bad', text: 'Valor zero não lança nada' }
    if (projectedBalance.value < 0) return { tone: 'bad', text: `Debita ${formatCurrency(-cents)}: maior que o saldo` }

    const verb = cents > 0 ? 'Credita' : 'Debita'
    return {
        tone: cents > 0 ? 'credit' : 'debit',
        text: `${verb} ${formatCurrency(Math.abs(cents))} · saldo fica ${formatCurrency(projectedBalance.value)}`,
    }
})

const load = async () => {
    try {
        statement.value = (await adminService.getUserStoreCredit(props.userUuid)).data
    } catch {
        toast.error('Falha ao carregar o saldo de vendas.')
    }
}

const save = async () => {
    if (!canSave.value || amountCents.value == null) return
    saving.value = true
    try {
        const { data } = await adminService.adjustUserStoreCredit(props.userUuid, {
            amount: amountCents.value,
            note: note.value.trim(),
        })
        statement.value = data
        // Quem mostra o saldo fora do card (topo da tela do usuário) acompanha o ajuste.
        emit('balance', data.balance_cents)
        amountInput.value = ''
        note.value = ''
        toast.success('Ajuste lançado no extrato do cliente.')
    } catch (err: any) {
        toast.error(err?.response?.data?.message ?? 'Falha ao ajustar o saldo.')
    } finally {
        saving.value = false
    }
}

onMounted(load)
</script>

<template>
    <div v-if="statement" class="credit">
        <div class="credit-stats">
            <div class="credit-stat">
                <span>Disponível</span>
                <strong class="credit-stat__balance">{{ formatCurrency(statement.balance_cents) }}</strong>
            </div>
            <div class="credit-stat">
                <span>Vendas em análise</span>
                <strong>{{ formatCurrency(statement.pending_cents) }}</strong>
            </div>
        </div>

        <form class="credit-adjust" @submit.prevent="save">
            <div class="credit-amount">
                <input
                    v-model="amountInput"
                    class="credit-input"
                    inputmode="decimal"
                    placeholder="R$ (ex: 25,00 ou -25,00)"
                />
                <small v-if="amountHint" class="credit-hint" :class="`credit-hint--${amountHint.tone}`" aria-live="polite">
                    {{ amountHint.text }}
                </small>
            </div>
            <input
                v-model="note"
                class="credit-input"
                maxlength="255"
                placeholder="Motivo — o cliente vê no extrato"
            />
            <button type="submit" class="credit-save" :disabled="!canSave">
                <Icon icon="mdi:plus-minus-variant" />
                {{ saving ? 'Lançando...' : 'Lançar ajuste' }}
            </button>
        </form>

        <div v-if="!statement.entries.length" class="credit-empty">Nenhuma movimentação.</div>
        <ul v-else class="credit-entries">
            <li v-for="entry in statement.entries" :key="entry.id">
                <div class="credit-entry__text">
                    <span>{{ KIND_LABELS[entry.kind] ?? entry.kind }}</span>
                    <small>
                        {{ entry.note || entry.reference }}
                        <template v-if="entry.admin_name"> · por {{ entry.admin_name }}</template>
                        · {{ dayjs(entry.created_at).format('DD/MM/YYYY HH:mm') }}
                    </small>
                </div>
                <strong :class="entry.amount > 0 ? 'credit-in' : 'credit-out'">
                    {{ entry.amount > 0 ? '+' : '−' }}{{ formatCurrency(Math.abs(entry.amount)) }}
                </strong>
            </li>
        </ul>
    </div>
</template>

<style lang="stylus" scoped>
.credit
    display flex
    flex-direction column
    gap 1rem

.credit-stats
    display grid
    grid-template-columns repeat(auto-fit, minmax(160px, 1fr))
    gap 0.75rem

.credit-stat
    display flex
    flex-direction column
    gap 0.25rem
    padding 0.75rem 1rem
    border 1px solid rgba(255,255,255,0.06)
    border-radius 8px
    background rgba(255,255,255,0.02)

    span
        color #94a3b8
        font-size 0.75rem

    strong
        font-size 1.15rem

    &__balance
        color #4ade80

.credit-adjust
    display flex
    flex-wrap wrap
    align-items flex-start
    gap 0.5rem

.credit-amount
    flex 0 1 220px
    display flex
    flex-direction column
    gap 4px

    .credit-input
        flex none

.credit-hint
    font-size 0.72rem
    padding-left 2px

    &--credit
        color #4ade80

    &--debit
        color #fbbf24

    &--bad
        color #f87171

.credit-input
    flex 1 1 220px
    padding 0.5rem 0.75rem
    border 1px solid rgba(255,255,255,0.1)
    border-radius 8px
    background rgba(255,255,255,0.04)
    color inherit
    font-size 0.85rem

    &:focus
        outline none
        border-color rgba(124, 77, 255, 0.6)

.credit-save
    display inline-flex
    align-items center
    gap 0.4rem
    padding 0.5rem 1rem
    border none
    border-radius 8px
    background rgba(124, 77, 255, 0.18)
    color #c4b5fd
    font-size 0.82rem
    font-weight 600
    cursor pointer

    &:hover:not(:disabled)
        background rgba(124, 77, 255, 0.3)

    &:disabled
        opacity 0.5
        cursor not-allowed

.credit-empty
    color #64748b
    font-size 0.85rem

.credit-entries
    display flex
    flex-direction column
    gap 0.4rem
    margin 0
    padding 0
    list-style none
    max-height 320px
    overflow-y auto

    li
        display flex
        align-items center
        justify-content space-between
        gap 0.75rem
        padding 0.5rem 0.75rem
        border 1px solid rgba(255,255,255,0.05)
        border-radius 8px

.credit-entry__text
    display flex
    flex-direction column
    min-width 0

    span
        font-size 0.85rem

    small
        overflow hidden
        color #94a3b8
        font-size 0.72rem
        text-overflow ellipsis
        white-space nowrap

.credit-in
    color #4ade80

.credit-out
    color #f87171
</style>
