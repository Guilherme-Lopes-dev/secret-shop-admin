<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { buildSteamImageUrl } from '@/utils/steamImage'
import { adminService, type BulkReleaseGift } from '@/services/admin/admin.service'

/**
 * Quantos brindes por chamada durante o envio. Fatiar é o que dá barra de
 * progresso de verdade: cada resposta é um pedaço confirmado pelo servidor.
 * Lote curto vai de um em um; lote longo agrupa pra não virar 100 requests.
 */
const chunkSizeFor = (total: number) => (total > 40 ? 5 : 1)

/**
 * Respiro entre uma chamada e outra. O bot envia uma trade por vez e a Steam
 * corta conta que despeja oferta em rajada — soltar tudo de uma vez não entrega
 * mais rápido, só empilha retentativa.
 */
const CHUNK_DELAY_SECONDS = 5

// Tela cheia de verdade (Fullscreen API), não overlay grande: a ideia é o admin
// sair do resto da interface antes de disparar trade que não volta atrás.
const props = withDefaults(defineProps<{
  open: boolean
  gifts: BulkReleaseGift[]
  /** Segundos até o botão armar. Tempo de ler a lista antes de poder clicar. */
  armSeconds?: number
  note?: string
}>(), {
  armSeconds: 5,
  note: '',
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  /** Terminou o envio — o pai recarrega a fila. */
  (e: 'finished'): void
}>()

const screen = ref<HTMLElement | null>(null)
const excluded = ref<Set<string>>(new Set())
const remaining = ref(props.armSeconds)
let timer: ReturnType<typeof setInterval> | null = null

type Phase = 'review' | 'sending' | 'done'

const phase = ref<Phase>('review')
const processed = ref(0)
const releasedNumbers = ref<string[]>([])
const failures = ref<{ order_number: string; reason: string }[]>([])
// Parar entre blocos: o que já foi liberado não volta, o resto nem sai. Sem isso
// o admin fica preso na tela cheia até o último bloco responder.
const aborted = ref(false)
/** Segundos até o próximo bloco — a barra parada precisa dizer que está esperando. */
const cooldown = ref(0)

const sending = computed(() => phase.value === 'sending')

const included = computed(() =>
  props.gifts.filter(gift => !excluded.value.has(gift.order_uuid)),
)

const withoutTradeLink = computed(() => included.value.filter(gift => !gift.has_trade_link).length)

const armed = computed(() => remaining.value <= 0 && included.value.length > 0)

const isExcluded = (gift: BulkReleaseGift) => excluded.value.has(gift.order_uuid)

// `icon_url_large` chega como fragmento do Steam; resolver aqui vale pros dois
// caminhos (prévia do backend e seleção da tabela) sem o chamador se preocupar.
const skinImage = (gift: BulkReleaseGift) => buildSteamImageUrl(gift.item.icon_url_large, '62fx62f')

const toggle = (gift: BulkReleaseGift) => {
  const next = new Set(excluded.value)
  if (!next.delete(gift.order_uuid)) next.add(gift.order_uuid)

  excluded.value = next
}

const stopTimer = () => {
  if (!timer) return
  clearInterval(timer)
  timer = null
}

const startTimer = () => {
  stopTimer()
  remaining.value = props.armSeconds
  if (remaining.value <= 0) return

  timer = setInterval(() => {
    remaining.value -= 1
    if (remaining.value <= 0) stopTimer()
  }, 1_000)
}

const enterFullscreen = async () => {
  await nextTick()
  // Navegador pode recusar (permissão, iframe): o overlay já cobre a viewport,
  // então a recusa degrada pra tela cheia "falsa" em vez de quebrar o fluxo.
  await screen.value?.requestFullscreen?.().catch(() => {})
}

const exitFullscreen = () => {
  if (!document.fullscreenElement) return

  void document.exitFullscreen().catch(() => {})
}

const close = () => {
  exitFullscreen()
  emit('update:open', false)
}

// Esc sai da tela cheia sem passar pelo nosso close — sem isso o overlay ficaria
// aberto por cima da tela normal. Com liberação em curso é o contrário: volta pra
// tela cheia, porque sumir no meio do POST esconde o resultado do lote.
const onFullscreenChange = () => {
  if (document.fullscreenElement) return
  if (!props.open) return

  if (sending.value) return void enterFullscreen()

  emit('update:open', false)
}

document.addEventListener('fullscreenchange', onFullscreenChange)

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  stopTimer()
})

watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    stopTimer()
    return
  }

  excluded.value = new Set()
  phase.value = 'review'
  processed.value = 0
  cooldown.value = 0
  releasedNumbers.value = []
  failures.value = []
  startTimer()
  void enterFullscreen()
}, { immediate: true })

const total = ref(0)

const percent = computed(() =>
  total.value ? Math.round((processed.value / total.value) * 100) : 0,
)

const numberOf = (orderUuid: string) =>
  props.gifts.find(gift => gift.order_uuid === orderUuid)?.order_number ?? orderUuid

const sendChunk = async (orderUuids: string[]) => {
  try {
    const { data } = await adminService.releaseRewardClaimsBulk({
      order_uuids: orderUuids,
      limit: orderUuids.length,
    })
    releasedNumbers.value.push(...data.order_numbers)
    failures.value.push(...data.failed)
  } catch (err: any) {
    // Rede caiu ou o servidor recusou o bloco inteiro: marca só este pedaço e
    // segue — parar aqui deixaria o resto da fila sem tentativa nenhuma.
    const reason = err?.response?.data?.message || 'Falha de rede ao liberar.'
    failures.value.push(...orderUuids.map(uuid => ({ order_number: numberOf(uuid), reason })))
  }
}

const fire = async () => {
  if (!armed.value || sending.value) return

  const orderUuids = included.value.map(gift => gift.order_uuid)
  const size = chunkSizeFor(orderUuids.length)

  phase.value = 'sending'
  aborted.value = false
  total.value = orderUuids.length
  processed.value = 0
  releasedNumbers.value = []
  failures.value = []

  for (let index = 0; index < orderUuids.length; index += size) {
    if (aborted.value) break

    await sendChunk(orderUuids.slice(index, index + size))
    processed.value = Math.min(index + size, orderUuids.length)

    if (processed.value < orderUuids.length) await waitBetweenChunks()
  }

  cooldown.value = 0
  phase.value = 'done'
  emit('finished')
}

/** Espera contando na tela, e o "Parar" corta a espera em vez de esperar o fim. */
const waitBetweenChunks = async () => {
  cooldown.value = CHUNK_DELAY_SECONDS

  while (cooldown.value > 0 && !aborted.value) {
    await new Promise(resolve => setTimeout(resolve, 1_000))
    cooldown.value -= 1
  }

  cooldown.value = 0
}

const stopSending = () => (aborted.value = true)
</script>

<template>
  <div v-if="open" ref="screen" class="release-console">
    <header class="console-head">
      <button v-if="phase === 'sending'" class="console-exit" :disabled="aborted" @click="stopSending">
        <Icon icon="mdi:stop-circle-outline" />
        {{ aborted ? 'Parando...' : 'Parar depois deste bloco' }}
      </button>
      <button v-else class="console-exit" @click="close">
        <Icon icon="mdi:close" /> {{ phase === 'done' ? 'Fechar' : 'Sair (Esc)' }}
      </button>
    </header>

    <!-- Envio: barra andando conforme o servidor confirma cada pedaço -->
    <section v-if="phase === 'sending'" class="console-progress">
      <h2>Enviando brindes</h2>
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: `${percent}%` }" />
      </div>
      <p class="progress-label">
        {{ processed }} de {{ total }} · {{ percent }}%
        <span v-if="failures.length" class="progress-fail">· {{ failures.length }} falha(s)</span>
      </p>
      <p class="progress-hint">
        <template v-if="aborted">Parando — o bloco atual ainda termina.</template>
        <template v-else-if="cooldown">
          Próximo bloco em {{ cooldown }}s — ritmo para não estourar o limite da Steam.
        </template>
        <template v-else>A trade entra na fila do bot, que envia uma por vez.</template>
      </p>
    </section>

    <!-- Resumo: o que saiu e o que ficou pra trás, com motivo -->
    <section v-else-if="phase === 'done'" class="console-summary">
      <Icon class="summary-icon" :icon="failures.length ? 'mdi:alert-circle' : 'mdi:check-circle'" />
      <h2>{{ releasedNumbers.length }} brinde(s) liberado(s)</h2>
      <p v-if="processed < total" class="summary-stopped">
        Envio interrompido em {{ processed }} de {{ total }} — o restante continua na fila de análise.
      </p>
      <p v-if="!failures.length" class="summary-ok">
        Todas as trades entraram na fila. O status vai de "Liberado" para "Entregue"
        conforme o usuário aceita.
      </p>

      <div v-if="failures.length" class="summary-fails">
        <h3>{{ failures.length }} não saiu(íram)</h3>
        <ul>
          <li v-for="fail in failures" :key="fail.order_number">
            <b>{{ fail.order_number }}</b> — {{ fail.reason }}
          </li>
        </ul>
        <p class="summary-hint">Continuam na fila de análise para tentar de novo.</p>
      </div>
    </section>

    <div v-if="withoutTradeLink && phase === 'review'" class="console-warn">
      <Icon icon="mdi:alert" />
      {{ withoutTradeLink }} sem trade link — vão falhar e continuar na fila.
    </div>

    <div v-if="phase === 'review'" class="console-grid">
      <button
        v-for="gift in gifts"
        :key="gift.order_uuid"
        class="gift-card"
        :class="{ 'gift-card--out': isExcluded(gift), 'gift-card--warn': !gift.has_trade_link }"
        type="button"
        @click="toggle(gift)"
      >
        <img v-if="gift.avatar" :src="gift.avatar" class="gift-avatar" alt="" />

        <img v-if="skinImage(gift)" :src="skinImage(gift)!" class="gift-skin" alt="" />
        <div v-else class="gift-skin gift-skin--empty"><Icon icon="mdi:gift-outline" /></div>

        <strong class="gift-name">{{ gift.item.name || '—' }}</strong>
      </button>
    </div>

    <footer class="console-foot">
      <span v-if="note && phase === 'review'" class="console-note">{{ note }}</span>

      <template v-if="phase === 'review'">
        <button class="console-cancel" @click="close">Cancelar</button>
        <button class="console-fire" :disabled="!armed" @click="fire">
          <Icon icon="mdi:send-check" />
          <template v-if="!included.length">Nenhum brinde no lote</template>
          <template v-else-if="!armed">Aguarde {{ remaining }}s</template>
          <template v-else>Liberar {{ included.length }} brinde(s)</template>
        </button>
      </template>

      <button v-else-if="phase === 'sending'" class="console-fire" disabled>
        <Icon :icon="cooldown ? 'mdi:timer-sand' : 'mdi:loading'" :class="{ spin: !cooldown }" />
        <template v-if="cooldown">Aguardando {{ cooldown }}s · {{ processed }}/{{ total }}</template>
        <template v-else>Liberando {{ processed }}/{{ total }}...</template>
      </button>

      <button v-else class="console-fire" @click="close">
        <Icon icon="mdi:check" /> Fechar
      </button>
    </footer>
  </div>
</template>

<style lang="stylus" scoped>
.release-console
    position fixed
    inset 0
    z-index 9999
    display flex
    flex-direction column
    gap 1rem
    padding 1.75rem 2rem
    background #0d0d10
    color #fff
    overflow hidden

.console-head
    display flex
    justify-content flex-end

.console-note
    margin-right auto
    color #64748b
    font-size 0.8rem

.console-exit
    display inline-flex
    align-items center
    gap 0.35rem
    background transparent
    border 1px solid rgba(255,255,255,0.14)
    border-radius 8px
    color #94a3b8
    padding 0.5rem 0.85rem
    font-size 0.85rem
    cursor pointer

    &:hover
        color #fff

    &:disabled
        opacity 0.5
        cursor not-allowed

.console-progress
    flex 1
    display flex
    flex-direction column
    align-items center
    justify-content center
    gap 0.9rem
    text-align center

    h2
        font-size 1.5rem
        font-weight 700

.progress-track
    width min(680px, 90vw)
    height 14px
    border-radius 999px
    background rgba(255,255,255,0.07)
    overflow hidden

.progress-fill
    height 100%
    border-radius 999px
    background linear-gradient(90deg, #2edc8a, #22c55e)
    transition width 0.25s ease

.progress-label
    font-size 1.05rem
    font-weight 600

.progress-fail
    color #ff9800

.progress-hint
    color #64748b
    font-size 0.85rem

.console-summary
    flex 1
    display flex
    flex-direction column
    align-items center
    gap 0.75rem
    padding-top 3vh
    overflow-y auto
    text-align center

    h2
        font-size 1.6rem
        font-weight 700

.summary-icon
    font-size 3.5rem
    color #2edc8a

.console-summary .summary-fails
    width min(680px, 92vw)
    margin-top 0.75rem
    padding 0.9rem 1rem
    border 1px solid rgba(255,152,0,0.25)
    border-radius 10px
    background rgba(255,152,0,0.06)
    text-align left

    h3
        color #ff9800
        font-size 0.95rem
        margin-bottom 0.5rem

    li
        color #cbd5e1
        font-size 0.85rem
        list-style none
        padding 0.15rem 0

.summary-stopped
    color #ff9800
    font-size 0.88rem

.summary-ok
    color #94a3b8
    font-size 0.9rem
    max-width 560px

.summary-hint
    margin-top 0.5rem
    color #64748b
    font-size 0.78rem

.console-warn
    display flex
    align-items center
    gap 0.5rem
    padding 0.6rem 0.9rem
    border-radius 8px
    background rgba(255,152,0,0.12)
    color #ff9800
    font-size 0.85rem

.console-grid
    flex 1
    overflow-y auto
    display grid
    grid-template-columns repeat(auto-fill, minmax(320px, 1fr))
    gap 0.75rem
    align-content start
    padding-right 0.25rem

.gift-card
    display flex
    align-items center
    gap 0.75rem
    padding 0.7rem 0.85rem
    border 1px solid rgba(46,220,138,0.35)
    border-radius 12px
    background rgba(46,220,138,0.06)
    color inherit
    text-align left
    cursor pointer
    transition all 0.15s

    &:hover
        border-color rgba(46,220,138,0.6)

    &--warn
        border-color rgba(255,152,0,0.4)
        background rgba(255,152,0,0.06)

    &--out
        border-color rgba(255,255,255,0.08)
        background transparent
        opacity 0.45

.gift-skin
    width 56px
    height 56px
    object-fit contain
    flex-shrink 0

    &--empty
        display flex
        align-items center
        justify-content center
        border-radius 8px
        background rgba(255,255,255,0.05)
        color #64748b

.gift-name
    flex 1
    min-width 0
    font-size 0.9rem
    white-space nowrap
    overflow hidden
    text-overflow ellipsis

.gift-avatar
    width 40px
    height 40px
    border-radius 50%
    flex-shrink 0

.console-foot
    display flex
    align-items center
    justify-content flex-end
    gap 0.75rem
    padding-top 0.75rem
    border-top 1px solid rgba(255,255,255,0.06)

.console-cancel
    background transparent
    border 1px solid rgba(255,255,255,0.14)
    border-radius 10px
    color #94a3b8
    padding 0.85rem 1.4rem
    font-size 0.95rem
    cursor pointer

.console-fire
    display inline-flex
    align-items center
    gap 0.5rem
    background #2edc8a
    border none
    border-radius 10px
    color #06231a
    padding 0.9rem 2rem
    font-size 1.05rem
    font-weight 700
    cursor pointer

    &:disabled
        background rgba(255,255,255,0.08)
        color #64748b
        cursor not-allowed

.spin
    animation spin 1s linear infinite

@keyframes spin
    to
        transform rotate(360deg)
</style>
