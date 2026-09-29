import antonUrl from '@/assets/instagram/Anton-Regular.ttf?url'

// Prévia do acabamento no canvas. Espelha secret-shop-backend/src/instagram/finish.ts:
// mesma fonte, mesmas proporções e texto posicionado pela caixa da tinta (o Pango
// corta o vazio em volta da letra; aqui actualBoundingBox* dá a mesma caixa).
// Mudou um, muda o outro.

export type Kind = 'FEED' | 'STORY'
export type ElementKey = 'logo' | 'note' | 'price'
export type FinishLayout = {
  logo: { x: number; y: number; w: number }
  note: { x: number; y: number; size: number }
  price: { x: number; y: number; size: number }
}
export type Rect = { left: number; top: number; width: number; height: number }
export type FinishContent = { price: number | null; note: string | null; logo: HTMLImageElement }

const NOTE_SPACING = 0.04
const NOTE_PAD_X = 0.65
const NOTE_PAD_Y = 0.4
const SHADOW_SIGMA = 0.06
const GOLD = '#fbbf24'

// Story: topo fora da barra de perfil e preço acima da barra de resposta do Instagram.
export const DEFAULT_LAYOUT: Record<Kind, FinishLayout> = {
  FEED: {
    logo: { x: 0.045, y: 0.045, w: 0.12 },
    note: { x: 0.6, y: 0.06, size: 0.034 },
    price: { x: 0.045, y: 0.86, size: 0.1 },
  },
  STORY: {
    logo: { x: 0.045, y: 0.075, w: 0.12 },
    note: { x: 0.6, y: 0.088, size: 0.034 },
    price: { x: 0.045, y: 0.842, size: 0.1 },
  },
}

// Limites do controle de tamanho (fração da largura); o backend valida faixa parecida.
export const SIZE_RANGE: Record<ElementKey, { min: number; max: number }> = {
  logo: { min: 0.04, max: 0.4 },
  note: { min: 0.015, max: 0.08 },
  price: { min: 0.03, max: 0.2 },
}

export const KIND_LABEL: Record<Kind, string> = { FEED: 'feed', STORY: 'story' }

// Padrão salvo por formato: só neste navegador.
const LAYOUT_KEY = 'instagram.finishLayout'

const isBox = (box: any, sizeKey: 'w' | 'size') =>
  typeof box?.x === 'number' && typeof box?.y === 'number' && typeof box?.[sizeKey] === 'number'

// Layout salvo de versão antiga ou corrompido faria o backend recusar o lote inteiro (400).
const isLayout = (value: any): value is FinishLayout =>
  isBox(value?.logo, 'w') && isBox(value?.note, 'size') && isBox(value?.price, 'size')

export const readSavedLayout = (kind: Kind): FinishLayout => {
  try {
    const saved = JSON.parse(localStorage.getItem(`${LAYOUT_KEY}.${kind}`) ?? 'null')
    if (isLayout(saved)) return saved
  } catch {}
  return cloneLayout(DEFAULT_LAYOUT[kind])
}

export const saveLayout = (kind: Kind, layout: FinishLayout) => {
  try {
    localStorage.setItem(`${LAYOUT_KEY}.${kind}`, JSON.stringify(layout))
  } catch {}
}

// JSON e não structuredClone: o layout chega como Proxy reativo do Vue, e structuredClone lança DataCloneError.
export const cloneLayout = (layout: FinishLayout): FinishLayout => JSON.parse(JSON.stringify(layout))

export const formatBrl = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

let fontReady: Promise<void> | null = null
export const loadFont = () => {
  fontReady ??= new FontFace('Anton', `url(${antonUrl})`).load().then((face) => {
    document.fonts.add(face)
  })
  return fontReady
}

const inkOf = (ctx: CanvasRenderingContext2D, text: string) => {
  const m = ctx.measureText(text)
  return {
    left: m.actualBoundingBoxLeft,
    ascent: m.actualBoundingBoxAscent,
    width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
    height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
  }
}

const withFont = (ctx: CanvasRenderingContext2D, size: number, spacing = 0) => {
  ctx.font = `${size}px Anton`
  ctx.letterSpacing = `${spacing}px`
}

const priceRect = (ctx: CanvasRenderingContext2D, layout: FinishLayout, price: number, width: number, height: number) => {
  withFont(ctx, Math.round(layout.price.size * width))
  const ink = inkOf(ctx, formatBrl(price))
  return { left: Math.round(layout.price.x * width), top: Math.round(layout.price.y * height), width: ink.width, height: ink.height, ink }
}

const noteRect = (ctx: CanvasRenderingContext2D, layout: FinishLayout, note: string, width: number, height: number) => {
  const size = Math.round(layout.note.size * width)
  withFont(ctx, size, size * NOTE_SPACING)
  const ink = inkOf(ctx, note.toUpperCase())
  const padX = Math.round(size * NOTE_PAD_X)
  const padY = Math.round(size * NOTE_PAD_Y)
  return {
    left: Math.round(layout.note.x * width),
    top: Math.round(layout.note.y * height),
    width: ink.width + padX * 2,
    height: ink.height + padY * 2,
    ink,
    padX,
    padY,
    size,
  }
}

const logoRect = (layout: FinishLayout, logo: HTMLImageElement, width: number, height: number): Rect => {
  const logoWidth = Math.round(layout.logo.w * width)
  return {
    left: Math.round(layout.logo.x * width),
    top: Math.round(layout.logo.y * height),
    width: logoWidth,
    height: Math.round((logoWidth * logo.naturalHeight) / logo.naturalWidth),
  }
}

// Caixas de cada elemento visível, em px da arte. Ordem = de baixo pra cima (igual ao composite).
export const elementRects = (ctx: CanvasRenderingContext2D, layout: FinishLayout, content: FinishContent) => {
  const { width, height } = ctx.canvas
  const rects: Partial<Record<ElementKey, Rect>> = {}
  if (content.price != null) rects.price = priceRect(ctx, layout, content.price, width, height)
  if (content.note) rects.note = noteRect(ctx, layout, content.note, width, height)
  rects.logo = logoRect(layout, content.logo, width, height)
  return rects
}

// Sombra em duas passadas, como o backend (blur do canvas ≈ 2 × sigma).
const drawPrice = (ctx: CanvasRenderingContext2D, layout: FinishLayout, price: number) => {
  const { width, height } = ctx.canvas
  const rect = priceRect(ctx, layout, price, width, height)
  const text = formatBrl(price)
  const x = rect.left + rect.ink.left
  const y = rect.top + rect.ink.ascent
  ctx.save()
  ctx.shadowColor = '#000'
  ctx.shadowBlur = layout.price.size * width * SHADOW_SIGMA * 2
  ctx.fillStyle = GOLD
  ctx.fillText(text, x, y)
  ctx.fillText(text, x, y)
  ctx.restore()
}

const drawNote = (ctx: CanvasRenderingContext2D, layout: FinishLayout, note: string) => {
  const { width, height } = ctx.canvas
  const rect = noteRect(ctx, layout, note, width, height)
  ctx.beginPath()
  ctx.roundRect(rect.left + 1, rect.top + 1, rect.width - 2, rect.height - 2, (rect.height - 2) / 2)
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(251,191,36,0.7)'
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.fillText(note.toUpperCase(), rect.left + rect.padX + rect.ink.left, rect.top + rect.padY + rect.ink.ascent)
}

export const drawFinish = (ctx: CanvasRenderingContext2D, base: HTMLImageElement, layout: FinishLayout, content: FinishContent) => {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(base, 0, 0, width, height)
  if (content.price != null) drawPrice(ctx, layout, content.price)
  if (content.note) drawNote(ctx, layout, content.note)
  const logo = logoRect(layout, content.logo, width, height)
  ctx.drawImage(content.logo, logo.left, logo.top, logo.width, logo.height)
}
