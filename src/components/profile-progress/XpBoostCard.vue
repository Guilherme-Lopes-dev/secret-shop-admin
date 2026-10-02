<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import dayjs from 'dayjs'
import { adminService } from '@/services/admin/admin.service'
import type { XpBoostResponse } from '@/services/admin/types'

type Boost = NonNullable<XpBoostResponse['boost']>

const boost = ref<Boost | null>(null)
const multiplier = ref(2)
const startsAt = ref('')
const endsAt = ref('')
const saving = ref(false)

// datetime-local fala hora local; a API guarda ISO em UTC.
const toInputValue = (iso: string) => dayjs(iso).format('YYYY-MM-DD[T]HH:mm')
const toIso = (local: string) => new Date(local).toISOString()
const formatDate = (iso: string) => dayjs(iso).format('DD/MM HH:mm')

const STATUS = {
  active:    { label: 'Ativo agora', cls: 'status--active' },
  scheduled: { label: 'Agendado',    cls: 'status--scheduled' },
  ended:     { label: 'Encerrado',   cls: 'status--ended' },
}

// Relógio da tela: a janela abre e fecha com a página aberta, e o rótulo acompanha.
const now = ref(Date.now())
const clock = setInterval(() => (now.value = Date.now()), 30_000)
onUnmounted(() => clearInterval(clock))

// Mesma regra do backend: início conta, fim não.
const statusOf = (current: Boost) => {
  if (now.value < Date.parse(current.starts_at)) return STATUS.scheduled
  if (now.value < Date.parse(current.ends_at)) return STATUS.active

  return STATUS.ended
}

const status = computed(() => (boost.value ? statusOf(boost.value) : null))

const canSave = computed(() => multiplier.value >= 1 && Boolean(startsAt.value && endsAt.value))

const fillForm = (current: Boost | null) => {
  boost.value = current
  if (!current) return

  multiplier.value = current.multiplier
  startsAt.value = toInputValue(current.starts_at)
  endsAt.value = toInputValue(current.ends_at)
}

const run = async (action: () => Promise<{ data: XpBoostResponse }>, done: string) => {
  saving.value = true
  try {
    const { data } = await action()
    fillForm(data.boost)
    toast.success(done)
  } catch (e: any) {
    toast.error(e?.response?.data?.message || 'Não deu para salvar o boost de XP.')
  } finally {
    saving.value = false
  }
}

const save = () =>
  run(
    () =>
      adminService.setXpBoost({
        multiplier: multiplier.value,
        starts_at: toIso(startsAt.value),
        ends_at: toIso(endsAt.value),
      }),
    'Boost de XP salvo.',
  )

const clear = () => run(() => adminService.clearXpBoost(), 'Boost removido — compras voltam a 1x.')

onMounted(() =>
  adminService
    .getXpBoost()
    .then(({ data }) => fillForm(data.boost))
    .catch(() => undefined),
)
</script>

<template>
  <section class="xp-boost">
    <header class="xp-boost__head">
      <div class="xp-boost__title">
        <Icon icon="mdi:lightning-bolt" />
        Boost de XP
      </div>
      <span v-if="status" class="xp-boost__status" :class="status.cls">{{ status.label }}</span>
      <span v-if="boost" class="xp-boost__summary">
        {{ boost.multiplier }}x · {{ formatDate(boost.starts_at) }} → {{ formatDate(boost.ends_at) }}
      </span>
    </header>

    <p class="xp-boost__hint">
      Multiplica só o XP de compra, nos pedidos confirmados como pagos dentro da janela.
      Conquistas e XP já creditado não mudam.
    </p>

    <div class="xp-boost__fields">
      <label class="field">
        <span>Multiplicador</span>
        <input v-model.number="multiplier" type="number" min="1" max="10" step="0.5" class="field__input field__input--short" />
      </label>
      <label class="field">
        <span>Início</span>
        <input v-model="startsAt" type="datetime-local" class="field__input" />
      </label>
      <label class="field">
        <span title="O horário do fim não conta: 00:00 do dia seguinte cobre o dia inteiro">Fim (não incluso)</span>
        <input v-model="endsAt" type="datetime-local" class="field__input" />
      </label>
      <button class="btn btn--save" :disabled="saving || !canSave" @click="save">
        <Icon icon="mdi:content-save-outline" /> Salvar
      </button>
      <button v-if="boost" class="btn btn--remove" :disabled="saving" @click="clear">
        <Icon icon="mdi:close" /> Remover
      </button>
    </div>
  </section>
</template>

<style lang="stylus" scoped>
.xp-boost
    margin-bottom 1.25rem
    padding 0.9rem 1rem
    border 1px solid rgba(255,255,255,0.06)
    border-radius 10px
    background rgba(251,191,36,0.04)

.xp-boost__head
    display flex
    align-items center
    gap 0.75rem
    flex-wrap wrap

.xp-boost__title
    display inline-flex
    align-items center
    gap 0.4rem
    font-weight 700
    color #fbbf24

.xp-boost__status
    padding 3px 8px
    border-radius 5px
    font-size 0.72rem
    font-weight 600
    text-transform uppercase

.status--active
    background rgba(76,175,80,0.12)
    color #4caf50

.status--scheduled
    background rgba(99,102,241,0.12)
    color #818cf8

.status--ended
    background rgba(148,163,184,0.12)
    color #94a3b8

.xp-boost__summary
    color #94a3b8
    font-size 0.85rem

.xp-boost__hint
    margin 0.4rem 0 0.8rem
    color #64748b
    font-size 0.78rem
    line-height 1.4

.xp-boost__fields
    display flex
    align-items flex-end
    gap 0.75rem
    flex-wrap wrap

.field
    display flex
    flex-direction column
    gap 0.25rem

    > span
        color #64748b
        font-size 0.7rem
        text-transform uppercase
        letter-spacing 0.04em

.field__input
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.5rem 0.6rem
    font-size 0.875rem
    outline none
    box-sizing border-box

    &::-webkit-calendar-picker-indicator
        filter invert(0.6)

.field__input--short
    width 90px

.btn
    display inline-flex
    align-items center
    gap 0.4rem
    padding 0.5rem 0.9rem
    border-radius 8px
    font-size 0.85rem
    font-weight 600
    cursor pointer

    &:disabled
        opacity 0.5
        cursor not-allowed

.btn--save
    background rgba(251,191,36,0.14)
    border 1px solid rgba(251,191,36,0.35)
    color #fbbf24

    &:hover:not(:disabled)
        background rgba(251,191,36,0.22)

.btn--remove
    background transparent
    border 1px solid rgba(244,67,54,0.25)
    color #f44336

    &:hover:not(:disabled)
        background rgba(244,67,54,0.12)
</style>
