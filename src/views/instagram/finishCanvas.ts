import interBoldUrl from '@/assets/instagram/Inter-Bold.ttf?url'
import interSemiBoldUrl from '@/assets/instagram/Inter-SemiBold.ttf?url'

// Prévia do acabamento no canvas. Espelha secret-shop-backend/src/instagram/finish.ts:
// mesma fonte (Inter), mesmas proporções, mesmo selo de vidro fosco, e texto posicionado
// pela caixa da tinta (o Pango corta o vazio em volta da letra; aqui actualBoundingBox*
// dá a mesma caixa). Mudou um, muda o outro.

export type Kind = 'FEED' | 'STORY'
export type ElementKey = 'logo' | 'note' | 'price'
export type FinishLayout = {
  logo: { x: number; y: number; w: number }
  note: { x: number; y: number; size: number }
  price: { x: number; y: number; size: number }
}
export type Rect = { left: number; top: number; width: number; height: number }
export type FinishContent = { price: number | null; note: string | null; logo: HTMLImageElement }

// Mesmos números do finish.ts do backend.
const PRICE = { fontScale: 0.62, currencyScale: 0.46, tracking: -0.02, padX: 0.42, padY: 0.3, gap: 0.14 }
const NOTE = { padX: 0.8, padY: 0.55, gap: 0.5, iconHeight: 1, iconWidth: 1.45, maxRadius: 1.1 }
const GLASS = {
  blur: 0.22,
  saturation: 1.6,
  brightness: 0.9,
  tint: 'rgba(18,18,22,0.45)',
  hairline: 'rgba(255,255,255,0.22)',
  highlight: 'rgba(255,255,255,0.16)',
  shadow: 'rgba(0,0,0,0.3)',
  shadowBlur: 0.12,
  shadowOffset: 0.06,
}
const COLORS = { text: '#ffffff', secondary: 'rgba(255,255,255,0.72)', accent: '#FFD60A', perforation: 'rgba(0,0,0,0.55)' }
const MULTILINE_INK = 1.8
type Weight = 700 | 600

// Preço na faixa que o prompt mestre deixa limpa: x 8%, y 78–86% no story
// (acima da barra de resposta do Instagram), 80–92% no feed.
export const DEFAULT_LAYOUT: Record<Kind, FinishLayout> = {
  FEED: {
    logo: { x: 0.045, y: 0.045, w: 0.12 },
    note: { x: 0.6, y: 0.06, size: 0.034 },
    price: { x: 0.08, y: 0.82, size: 0.1 },
  },
  STORY: {
    logo: { x: 0.045, y: 0.075, w: 0.12 },
    note: { x: 0.6, y: 0.088, size: 0.034 },
    price: { x: 0.08, y: 0.785, size: 0.1 },
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

const formatAmount = (value: number) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Código do cupom na frase (= isCouponToken do backend): maiúscula/dígito, 3+ caracteres, com letra.
const isCouponToken = (word: string) =>
  /^[A-Z0-9][A-Z0-9_-]{2,}$/.test(word.replace(/[.,!?:;]+$/, '')) && /[A-Z]/.test(word)

let fontReady: Promise<void> | null = null
export const loadFont = () => {
  fontReady ??= Promise.all([
    new FontFace('Inter', `url(${interBoldUrl})`, { weight: '700' }).load(),
    new FontFace('Inter', `url(${interSemiBoldUrl})`, { weight: '600' }).load(),
  ]).then((faces) => faces.forEach((face) => document.fonts.add(face)))
  return fontReady
}

type Ink = { left: number; ascent: number; width: number; height: number }

const inkOf = (ctx: CanvasRenderingContext2D, text: string): Ink => {
  const m = ctx.measureText(text)
  return {
    left: m.actualBoundingBoxLeft,
    ascent: m.actualBoundingBoxAscent,
    width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
    height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
  }
}

const withFont = (ctx: CanvasRenderingContext2D, size: number, weight: Weight, spacing = 0) => {
  ctx.font = `${weight} ${size}px Inter`
  ctx.letterSpacing = `${spacing}px`
}

// Selo que passaria da borda para a 3% dela em vez de sair cortado (= insideArt do backend).
const edgeMargin = (width: number) => Math.round(width * 0.03)
const insideArt = (box: { x: number; y: number }, capsuleWidth: number, capsuleHeight: number, width: number, height: number): Rect => ({
  left: Math.max(0, Math.min(Math.round(box.x * width), width - edgeMargin(width) - capsuleWidth)),
  top: Math.max(0, Math.min(Math.round(box.y * height), height - edgeMargin(width) - capsuleHeight)),
  width: capsuleWidth,
  height: capsuleHeight,
})

// ── Preço ───────────────────────────────────────────────────────────────────

// "R$" pequeno alinhado pelo topo do número; tudo dentro do selo (x/y = canto do selo).
const priceRect = (ctx: CanvasRenderingContext2D, layout: FinishLayout, price: number, width: number, height: number) => {
  const size = Math.round(layout.price.size * width * PRICE.fontScale)
  const currencySize = Math.round(size * PRICE.currencyScale)
  withFont(ctx, currencySize, 600)
  const currency = inkOf(ctx, 'R$')
  withFont(ctx, size, 700, size * PRICE.tracking)
  const amount = inkOf(ctx, formatAmount(price))
  const padX = Math.round(size * PRICE.padX)
  const padY = Math.round(size * PRICE.padY)
  const gap = Math.round(size * PRICE.gap)
  return {
    ...insideArt(layout.price, padX * 2 + currency.width + gap + amount.width, padY * 2 + amount.height, width, height),
    size,
    currencySize,
    currency,
    amount,
    padX,
    padY,
    gap,
  }
}

// ── Frase do cupom ──────────────────────────────────────────────────────────

// Tirado do hhea da Inter (1984 e 494 em 2048 por em). Trocou a fonte: mede de novo.
const INTER_ASCENT = 1984 / 2048
const INTER_DESCENT = 494 / 2048

// Várias linhas como o Pango: alinhadas à esquerda, baseline a baseline = ascendente + descendente
// da fonte, cada uma arredondada pra cima. Medido no sharp/Pango do backend: 20px→25, 37px→45,
// 61px→75, 100px→122. Subiu o sharp: mede de novo.
const pangoLineHeight = (size: number) => Math.ceil(size * INTER_ASCENT) + Math.ceil(size * INTER_DESCENT)

const blockInk = (ctx: CanvasRenderingContext2D, lines: string[], size: number) => {
  const metrics = lines.map((line) => ctx.measureText(line))
  const first = metrics[0] ?? ctx.measureText('')
  const last = metrics[metrics.length - 1] ?? first
  const lineHeight = pangoLineHeight(size)
  const left = Math.max(...metrics.map((m) => m.actualBoundingBoxLeft))
  const right = Math.max(...metrics.map((m) => m.actualBoundingBoxRight))
  return {
    left,
    ascent: first.actualBoundingBoxAscent,
    width: left + right,
    height: first.actualBoundingBoxAscent + (lines.length - 1) * lineHeight + last.actualBoundingBoxDescent,
    lineHeight,
  }
}

// Quebra antes da borda direita da arte (= noteWrapWidth do backend, com o ícone e o padding reservados).
const noteWrapWidth = (layout: FinishLayout, width: number, size: number, reserved: number) =>
  Math.max(size * 3, Math.floor(width * (1 - layout.note.x)) - reserved)

// Quebra por palavra como o Pango (wrap 'word'): palavra que não cabe sozinha fica inteira na linha.
const wrapParagraph = (ctx: CanvasRenderingContext2D, paragraph: string, maxWidth: number) =>
  paragraph.split(' ').reduce<string[]>((lines, word) => {
    const current = lines[lines.length - 1]
    if (current === undefined) return [word]
    const candidate = `${current} ${word}`
    if (ctx.measureText(candidate).width <= maxWidth) return [...lines.slice(0, -1), candidate]
    return [...lines, word]
  }, [])

const noteLines = (ctx: CanvasRenderingContext2D, note: string, maxWidth: number) =>
  note.split(/\r?\n/).flatMap((paragraph) => wrapParagraph(ctx, paragraph, maxWidth))

const noteRect = (ctx: CanvasRenderingContext2D, layout: FinishLayout, note: string, width: number, height: number) => {
  const size = Math.round(layout.note.size * width)
  withFont(ctx, size, 600)
  const padX = Math.round(size * NOTE.padX)
  const padY = Math.round(size * NOTE.padY)
  const gap = Math.round(size * NOTE.gap)
  const iconHeight = Math.round(size * NOTE.iconHeight)
  const iconWidth = Math.round(size * NOTE.iconWidth)
  const lines = noteLines(ctx, note, noteWrapWidth(layout, width, size, padX * 3 + iconWidth + gap))
  const ink = blockInk(ctx, lines, size)
  const contentHeight = Math.max(ink.height, iconHeight)
  return {
    ...insideArt(layout.note, padX * 2 + iconWidth + gap + ink.width, padY * 2 + contentHeight, width, height),
    ink,
    lines,
    size,
    padX,
    padY,
    gap,
    iconWidth,
    iconHeight,
    contentHeight,
  }
}

// Uma linha = pílula; várias = canto arredondado do tamanho da fonte (pílula alta cortaria o texto).
const noteRadius = (inkHeight: number, tagHeight: number, size: number) => {
  const pill = tagHeight / 2
  if (inkHeight <= size * MULTILINE_INK) return pill
  return Math.min(pill, size * NOTE.maxRadius)
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

// ── Selo de vidro ───────────────────────────────────────────────────────────

const capsulePath = (rect: Rect, radius: number) => {
  const path = new Path2D()
  path.roundRect(rect.left, rect.top, rect.width, rect.height, radius)
  return path
}

// Sombra macia por baixo (blur do canvas ≈ 2 × sigma do sharp).
const drawShadow = (ctx: CanvasRenderingContext2D, rect: Rect, path: Path2D) => {
  ctx.save()
  ctx.shadowColor = GLASS.shadow
  ctx.shadowBlur = Math.max(1, rect.height * GLASS.shadowBlur) * 2
  ctx.shadowOffsetY = Math.round(rect.height * GLASS.shadowOffset)
  ctx.fillStyle = GLASS.tint
  ctx.fill(path)
  ctx.restore()
}

// A própria arte desfocada e saturada atrás do selo. Só redesenha a região (com margem de 3σ):
// blur na arte inteira a cada arrasto pesaria. Fora da arte fica transparente, como no backend.
const drawFrosted = (ctx: CanvasRenderingContext2D, base: HTMLImageElement, rect: Rect, path: Path2D) => {
  const { width, height } = ctx.canvas
  const sigma = rect.height * GLASS.blur
  const pad = Math.ceil(sigma * 3)
  const scaleX = base.naturalWidth / width
  const scaleY = base.naturalHeight / height
  const left = Math.max(0, rect.left - pad)
  const top = Math.max(0, rect.top - pad)
  const right = Math.min(width, rect.left + rect.width + pad)
  const bottom = Math.min(height, rect.top + rect.height + pad)
  if (right <= left || bottom <= top) return

  ctx.save()
  ctx.clip(path)
  ctx.filter = `blur(${sigma}px) saturate(${GLASS.saturation}) brightness(${GLASS.brightness})`
  ctx.drawImage(
    base,
    left * scaleX,
    top * scaleY,
    (right - left) * scaleX,
    (bottom - top) * scaleY,
    left,
    top,
    right - left,
    bottom - top,
  )
  ctx.restore()
}

const drawSkin = (ctx: CanvasRenderingContext2D, rect: Rect, path: Path2D, radius: number) => {
  ctx.save()
  ctx.fillStyle = GLASS.tint
  ctx.fill(path)
  const highlight = ctx.createLinearGradient(0, rect.top, 0, rect.top + rect.height)
  highlight.addColorStop(0, GLASS.highlight)
  highlight.addColorStop(0.55, 'rgba(255,255,255,0)')
  ctx.fillStyle = highlight
  ctx.fill(path)
  const line = Math.max(1, rect.height * 0.012)
  ctx.lineWidth = line
  ctx.strokeStyle = GLASS.hairline
  ctx.beginPath()
  ctx.roundRect(
    rect.left + line / 2,
    rect.top + line / 2,
    rect.width - line,
    rect.height - line,
    Math.max(0, radius - line / 2),
  )
  ctx.stroke()
  ctx.restore()
}

const drawCapsule = (ctx: CanvasRenderingContext2D, base: HTMLImageElement, rect: Rect, radius: number) => {
  const path = capsulePath(rect, radius)
  drawShadow(ctx, rect, path)
  drawFrosted(ctx, base, rect, path)
  drawSkin(ctx, rect, path, radius)
}

// Texto com o canto da tinta em (x, y), como a camada cortada do Pango.
const fillInk = (ctx: CanvasRenderingContext2D, text: string, ink: Ink, x: number, y: number) =>
  ctx.fillText(text, x + ink.left, y + ink.ascent)

const drawPrice = (ctx: CanvasRenderingContext2D, base: HTMLImageElement, layout: FinishLayout, price: number) => {
  const { width, height } = ctx.canvas
  const rect = priceRect(ctx, layout, price, width, height)
  drawCapsule(ctx, base, rect, rect.height / 2)
  const top = rect.top + rect.padY
  withFont(ctx, rect.currencySize, 600)
  ctx.fillStyle = COLORS.secondary
  fillInk(ctx, 'R$', rect.currency, rect.left + rect.padX, top)
  withFont(ctx, rect.size, 700, rect.size * PRICE.tracking)
  ctx.fillStyle = COLORS.text
  fillInk(ctx, formatAmount(price), rect.amount, rect.left + rect.padX + rect.currency.width + rect.gap, top)
}

// Ticket amarelo com recorte nas laterais e picote (= ticketIcon do backend).
const drawTicket = (ctx: CanvasRenderingContext2D, left: number, top: number, iconWidth: number, iconHeight: number) => {
  const icon = document.createElement('canvas')
  icon.width = iconWidth
  icon.height = iconHeight
  const ic = icon.getContext('2d')!
  ic.fillStyle = COLORS.accent
  ic.beginPath()
  ic.roundRect(0, 0, iconWidth, iconHeight, iconHeight * 0.18)
  ic.fill()
  ic.globalCompositeOperation = 'destination-out'
  ic.beginPath()
  ic.arc(0, iconHeight / 2, iconHeight * 0.2, 0, Math.PI * 2)
  ic.arc(iconWidth, iconHeight / 2, iconHeight * 0.2, 0, Math.PI * 2)
  ic.fill()
  ic.globalCompositeOperation = 'source-over'
  ic.strokeStyle = COLORS.perforation
  ic.lineWidth = iconHeight * 0.07
  ic.setLineDash([iconHeight * 0.09, iconHeight * 0.07])
  ic.beginPath()
  ic.moveTo(iconWidth * 0.64, iconHeight * 0.22)
  ic.lineTo(iconWidth * 0.64, iconHeight * 0.78)
  ic.stroke()
  ctx.drawImage(icon, left, top)
}

// Linha palavra a palavra: o código do cupom sai em amarelo, o resto em branco.
const drawNoteLine = (ctx: CanvasRenderingContext2D, line: string, x: number, baseline: number) =>
  line.split(/(\s+)/).reduce((cursor, part) => {
    ctx.fillStyle = isCouponToken(part) ? COLORS.accent : COLORS.text
    ctx.fillText(part, cursor, baseline)
    return cursor + ctx.measureText(part).width
  }, x)

const drawNote = (ctx: CanvasRenderingContext2D, base: HTMLImageElement, layout: FinishLayout, note: string) => {
  const { width, height } = ctx.canvas
  const rect = noteRect(ctx, layout, note, width, height)
  drawCapsule(ctx, base, rect, noteRadius(rect.ink.height, rect.height, rect.size))
  drawTicket(
    ctx,
    rect.left + rect.padX,
    rect.top + rect.padY + Math.round((rect.contentHeight - rect.iconHeight) / 2),
    rect.iconWidth,
    rect.iconHeight,
  )
  withFont(ctx, rect.size, 600)
  const x = rect.left + rect.padX + rect.iconWidth + rect.gap + rect.ink.left
  const firstBaseline = rect.top + rect.padY + Math.round((rect.contentHeight - rect.ink.height) / 2) + rect.ink.ascent
  rect.lines.forEach((line, index) => drawNoteLine(ctx, line, x, firstBaseline + index * rect.ink.lineHeight))
}

export const drawFinish = (ctx: CanvasRenderingContext2D, base: HTMLImageElement, layout: FinishLayout, content: FinishContent) => {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(base, 0, 0, width, height)
  if (content.price != null) drawPrice(ctx, base, layout, content.price)
  if (content.note) drawNote(ctx, base, layout, content.note)
  const logo = logoRect(layout, content.logo, width, height)
  ctx.drawImage(content.logo, logo.left, logo.top, logo.width, logo.height)
}
