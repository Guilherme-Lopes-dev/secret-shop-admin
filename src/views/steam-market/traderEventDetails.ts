import dayjs from 'dayjs'
import { formatMoney } from './marketMath'

export type EventData = Record<string, unknown>
export type TopCandidate = { name: string; estimatedMarginPct: number; signal: string; sold7d: number }
export type DetailRow = { key: string; label: string; value: string }

// Ordem = ordem na tela. Chave nova do backend sem rótulo aparece no fim com o nome cru.
const LABELS: Record<string, string> = {
    mode: 'Modo',
    reason: 'Motivo',
    signal: 'Sinal de tendência',
    relativePct: 'Desvio vs. própria mediana (sem o mercado)',
    sold7d: 'Vendas na semana',
    interest: 'Procura no site',
    score: 'Score no ranking',
    consensusCents: 'Preço de consenso',
    median21Cents: 'Mediana de 21 dias',
    referenceCents: 'Referência de saída',
    syncBidCents: 'Maior lance (último sync)',
    syncAskCents: 'Menor venda (último sync)',
    estimatedMarginPct: 'Margem estimada (último sync)',
    bookMaxBuyCents: 'Maior lance ao vivo',
    bookMinSellCents: 'Menor venda ao vivo',
    bookBuyCount: 'Lances no livro',
    bookSellCount: 'Vendas no livro',
    bidCents: 'Lance / custo',
    expectedReceiveCents: 'Recebe na saída (esperado)',
    receiveCents: 'Recebe',
    newReceiveCents: 'Novo preço (recebe)',
    marginPct: 'Margem',
    forced: 'Venda forçada (paciência acabou)',
    profitCents: 'Resultado',
    profitPct: 'Resultado %',
    heldDays: 'Dias com o item',
    unlocksAt: 'Destrava em',
    candidates: 'Candidatos',
    placed: 'Compras novas',
    budgetLeftCents: 'Livre no orçamento',
    marketMovePct: 'Mercado em 3 dias',
    marketDeviationPct: 'Mercado vs. mediana de 21 dias',
    buyOrderId: 'buy_orderid',
    assetId: 'assetid',
    quantity: 'Quantidade',
}

const SIGNALS: Record<string, string> = {
    pico: 'Pico',
    alta: 'Alta',
    estavel: 'Estável',
    baixa: 'Baixa',
    fundo: 'Fundo',
    iliquido: 'Ilíquido',
    sem_dados: 'Sem dados',
}

const MODES: Record<string, string> = { paper: 'Simulado', live: 'Real' }

const HIDDEN = new Set(['topCandidates'])

export const money = (cents: number | null | undefined) => formatMoney(cents, 'BRL')
export const signedPct = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
export const signalLabel = (signal: string) => SIGNALS[signal] ?? signal

const formatValue = (key: string, value: unknown) => {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
    if (key.endsWith('Cents')) return money(Number(value))
    if (key.endsWith('Pct')) return signedPct(Number(value))
    if (key.endsWith('At')) return dayjs(String(value)).format('DD/MM HH:mm')
    if (key === 'signal') return signalLabel(String(value))
    if (key === 'mode') return MODES[String(value)] ?? String(value)

    return String(value)
}

const order = (key: string) => {
    const index = Object.keys(LABELS).indexOf(key)
    return index < 0 ? Infinity : index
}

export const detailRows = (data: EventData): DetailRow[] =>
    Object.entries(data)
        .filter(([key]) => !HIDDEN.has(key))
        .sort(([a], [b]) => order(a) - order(b))
        .map(([key, value]) => ({ key, label: LABELS[key] ?? key, value: formatValue(key, value) }))

export const topCandidatesOf = (data: EventData | null) =>
    (data?.topCandidates as TopCandidate[] | undefined) ?? []

/** Valor que resume o evento na tabela: o preço da ação. */
export const amountOf = (data: EventData | null) => {
    const cents = data?.bidCents ?? data?.receiveCents ?? data?.budgetLeftCents
    return typeof cents === 'number' ? money(cents) : '—'
}

/** Margem que resume o evento: a decidida, o resultado ou a estimada. */
export const marginOf = (data: EventData | null) => {
    const pct = data?.profitPct ?? data?.marginPct ?? data?.estimatedMarginPct
    return typeof pct === 'number' ? pct : null
}
