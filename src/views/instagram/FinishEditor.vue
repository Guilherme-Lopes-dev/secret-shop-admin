<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="editor">
      <div class="editor__head">
        <h3>Posicionar — {{ subject ?? 'arte' }}</h3>
        <span class="hint">Arrasta logo, frase e preço. Clica num elemento pra mudar o tamanho.</span>
      </div>

      <div class="editor__body">
        <div class="stage">
          <canvas
            ref="canvas"
            class="stage__canvas"
            :class="{ 'stage__canvas--drag': dragging }"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
          />
          <p v-if="!ready" class="hint stage__loading">Carregando arte...</p>
        </div>

        <aside class="panel">
          <div class="element-tabs">
            <button
              v-for="key in visibleKeys"
              :key="key"
              type="button"
              class="element-tab"
              :class="{ 'element-tab--on': key === active }"
              @click="setActive(key)"
            >
              {{ LABEL[key] }}
            </button>
          </div>

          <label class="field">
            <span>Tamanho</span>
            <input v-model.number="activeSize" type="range" :min="range.min" :max="range.max" step="0.001" />
          </label>

          <p class="hint">Setas do teclado movem o elemento selecionado (Shift = passo maior).</p>
          <p v-if="price == null" class="hint">Sem preço: marca um valor no painel pra ele aparecer.</p>
          <p v-if="!note" class="hint">Sem frase: escreve no painel pra ela aparecer.</p>

          <span class="panel__spacer" />
          <button type="button" class="btn-ghost" @click="resetLayout">Voltar ao padrão</button>
          <button type="button" class="btn-ghost" @click="emit('close')">Cancelar</button>
          <button type="button" class="btn-primary" :disabled="applying" @click="emit('apply', cloneLayout(layout))">
            {{ applying ? 'Aplicando...' : 'Aplicar nesta arte' }}
          </button>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import logoUrl from '@/assets/instagram/logo.png'
import {
  DEFAULT_LAYOUT,
  SIZE_RANGE,
  cloneLayout,
  drawFinish,
  elementRects,
  loadFont,
  type ElementKey,
  type FinishLayout,
  type Kind,
  type Rect,
} from './finishCanvas'

const props = defineProps<{
  kind: Kind
  baseUrl: string
  subject: string | null
  price: number | null
  note: string | null
  initialLayout: FinishLayout
  applying: boolean
}>()
const emit = defineEmits<{ close: []; apply: [layout: FinishLayout] }>()

const LABEL: Record<ElementKey, string> = { logo: 'Logo', note: 'Frase', price: 'Preço' }
const NUDGE = 0.002
const NUDGE_BIG = 0.01

const canvas = ref<HTMLCanvasElement | null>(null)
const layout = reactive(cloneLayout(props.initialLayout))
const active = ref<ElementKey>('price')
const ready = ref(false)
const dragging = ref(false)
let drag: { key: ElementKey; offsetX: number; offsetY: number } | null = null

const base = new Image()
const logo = new Image()

const visibleKeys = computed(() =>
  (['logo', 'note', 'price'] as ElementKey[]).filter((key) => {
    if (key === 'price') return props.price != null
    if (key === 'note') return !!props.note
    return true
  }),
)

const range = computed(() => SIZE_RANGE[active.value])

// Logo guarda largura (w); frase e preço guardam tamanho da fonte (size).
const activeSize = computed({
  get: () => (active.value === 'logo' ? layout.logo.w : layout[active.value].size),
  set: (value: number) => {
    if (active.value === 'logo') {
      layout.logo.w = value
      return
    }
    layout[active.value].size = value
  },
})

const context = () => canvas.value?.getContext('2d') ?? null
const content = () => ({ price: props.price, note: props.note, logo })

const rects = (): Partial<Record<ElementKey, Rect>> => {
  const ctx = context()
  if (!ctx) return {}
  return elementRects(ctx, layout, content())
}

const outline = (ctx: CanvasRenderingContext2D, rect: Rect) => {
  ctx.save()
  ctx.setLineDash([12, 8])
  ctx.lineWidth = 3
  ctx.strokeStyle = '#6366f1'
  ctx.strokeRect(rect.left - 6, rect.top - 6, rect.width + 12, rect.height + 12)
  ctx.restore()
}

const redraw = () => {
  const ctx = context()
  if (!ctx || !ready.value) return
  drawFinish(ctx, base, layout, content())
  const rect = rects()[active.value]
  if (rect) outline(ctx, rect)
}

// Ponteiro em px da arte (o canvas é exibido reduzido).
const toArt = (event: PointerEvent) => {
  const el = canvas.value!
  const box = el.getBoundingClientRect()
  return {
    x: ((event.clientX - box.left) / box.width) * el.width,
    y: ((event.clientY - box.top) / box.height) * el.height,
  }
}

const contains = (rect: Rect, x: number, y: number) =>
  x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height

// De cima pra baixo: logo é desenhado por último, então ganha o clique.
const hitTest = (x: number, y: number) => {
  const all = rects()
  const order: ElementKey[] = ['logo', 'note', 'price']
  return order.find((key) => all[key] && contains(all[key]!, x, y)) ?? null
}

const onPointerDown = (event: PointerEvent) => {
  const point = toArt(event)
  const key = hitTest(point.x, point.y)
  if (!key) return
  const el = canvas.value!
  active.value = key
  drag = { key, offsetX: point.x - layout[key].x * el.width, offsetY: point.y - layout[key].y * el.height }
  dragging.value = true
  el.setPointerCapture(event.pointerId)
}

const onPointerMove = (event: PointerEvent) => {
  if (!drag) return
  const el = canvas.value!
  const point = toArt(event)
  layout[drag.key].x = (point.x - drag.offsetX) / el.width
  layout[drag.key].y = (point.y - drag.offsetY) / el.height
}

const onPointerUp = () => {
  drag = null
  dragging.value = false
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

const onKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape') return emit('close')
  const arrow = ARROWS[event.key]
  if (!arrow) return
  if ((event.target as HTMLElement).tagName === 'INPUT') return
  event.preventDefault()
  const step = event.shiftKey ? NUDGE_BIG : NUDGE
  layout[active.value].x += arrow[0] * step
  layout[active.value].y += arrow[1] * step
}

const setActive = (key: ElementKey) => {
  active.value = key
}

const resetLayout = () => {
  Object.assign(layout, cloneLayout(DEFAULT_LAYOUT[props.kind]))
}

const loadImage = (image: HTMLImageElement, src: string) =>
  new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(`não carregou ${src}`))
    image.referrerPolicy = 'no-referrer'
    image.src = src
  })

// Canvas no tamanho real da arte: posições em fração batem com o que o backend renderiza.
const setup = async () => {
  await Promise.all([loadFont(), loadImage(base, props.baseUrl), loadImage(logo, logoUrl)])
  canvas.value!.width = base.naturalWidth
  canvas.value!.height = base.naturalHeight
  ready.value = true
  if (!visibleKeys.value.includes(active.value)) active.value = 'logo'
  redraw()
}

watch([layout, active], redraw, { deep: true })

onMounted(() => {
  window.addEventListener('keydown', onKey)
  setup().catch(() => undefined)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style lang="stylus" scoped>
.modal-overlay
  position fixed
  inset 0
  background rgba(0,0,0,0.75)
  z-index 100
  display flex
  align-items center
  justify-content center
  padding 1rem

.editor
  background #1e1e24
  border 1px solid rgba(255,255,255,0.1)
  border-radius 14px
  padding 1.25rem
  width 1000px
  max-width 100%
  max-height 96vh
  display flex
  flex-direction column
  gap 12px
  color #fff

.editor__head
  display flex
  align-items baseline
  justify-content space-between
  gap 12px
  flex-wrap wrap
  h3
    margin 0

.editor__body
  display flex
  gap 1rem
  min-height 0
  @media (max-width: 760px)
    flex-direction column

.stage
  flex 1
  min-width 0
  display grid
  place-items center
  background #0f0f12
  border-radius 10px
  position relative

.stage__canvas
  display block
  max-width 100%
  max-height 82vh
  cursor grab
  touch-action none

.stage__canvas--drag
  cursor grabbing

.stage__loading
  position absolute

.panel
  width 240px
  display flex
  flex-direction column
  gap 10px
  @media (max-width: 760px)
    width 100%

.panel__spacer
  flex 1

.element-tabs
  display flex
  gap 4px
  padding 4px
  background rgba(0,0,0,0.25)
  border-radius 8px

.element-tab
  flex 1
  padding 6px
  background transparent
  border none
  border-radius 6px
  color rgba(255,255,255,0.55)
  font-size 0.85rem
  font-weight 600
  cursor pointer
  &:hover
    color #fff

.element-tab--on
  background #6366f1
  color #fff

.field
  display flex
  flex-direction column
  gap 6px
  font-size 0.8rem
  font-weight 600
  color rgba(255,255,255,0.7)
  input
    accent-color #6366f1

.hint
  margin 0
  font-size 0.75rem
  color rgba(255,255,255,0.45)

.btn-primary
  padding 0.5rem 1rem
  background #6366f1
  border none
  border-radius 8px
  color #fff
  font-weight 600
  font-size 0.875rem
  cursor pointer
  &:hover
    background #4f46e5
  &:disabled
    opacity 0.5
    cursor not-allowed

.btn-ghost
  padding 6px 12px
  background transparent
  border 1px solid rgba(255,255,255,0.12)
  border-radius 6px
  color rgba(255,255,255,0.65)
  font-size 0.85rem
  cursor pointer
  &:hover
    background rgba(255,255,255,0.06)
</style>
