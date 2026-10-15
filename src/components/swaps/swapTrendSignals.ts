import type { SwapTrendSignal } from '@/services/admin/types'

type SignalInfo = {
    label: string
    color: string
    advice: string
    nextWeek: string
    /** Fator recomendado sobre o pricesafe. null = sem medição, decisão de negócio. */
    suggestedFactor: number | null
    suggestion: string
}

// Conselho = o que a medição de 14/10/2026 mostrou pra cada faixa (ver swap-trends.ts no
// backend). Usado na Config do Trocador e no detalhe da troca.
// nextWeek = mediana medida da semana seguinte, contra o mercado.
// ponytail: sugestão fixa da tabela "Fator líquido" de docs/TENDENCIA_TROCADOR.md (um dia de
// pricesafe); vira cálculo diário quando o sync gravar o pricesafe no histórico.
export const SWAP_TREND_SIGNALS: Record<SwapTrendSignal, SignalInfo> = {
    pico: {
        label: 'Pico',
        color: '#f43f5e',
        advice: 'Mais de 15% acima do normal (já descontado o mercado). Costuma devolver ~8% em 7 dias, mas o preço do trocador (pricesafe) já fica no normal da skin.',
        nextWeek: '−8% em 7 dias',
        suggestedFactor: 1,
        suggestion: 'O pricesafe fica 18% abaixo do preço do dia (o normal é 6%) e já cobre a queda. A conta até permitiria × 1,05, mas em 1 de cada 4 picos a skin caiu 19% ou mais: pagar mais não compensa.',
    },
    alta: {
        label: 'Em alta',
        color: '#fb923c',
        advice: '5–15% acima do normal. Costuma devolver ~3% em 7 dias e o pricesafe acompanha a alta: pague um pouco menos.',
        nextWeek: '−3% em 7 dias',
        suggestedFactor: 0.98,
        suggestion: 'Único sinal em que o pricesafe ainda fica acima do valor esperado: a conta dá × 0,978. Ir abaixo de 0,97 desconta mais do que a queda medida.',
    },
    estavel: {
        label: 'Normal',
        color: '#94a3b8',
        advice: 'No preço normal das últimas 3 semanas. Pague o padrão.',
        nextWeek: '~0% em 7 dias',
        suggestedFactor: 1,
        suggestion: 'Nada a ajustar: a conta dá exatamente × 1,00.',
    },
    baixa: {
        label: 'Em baixa',
        color: '#38bdf8',
        advice: '5–15% abaixo do normal. Costuma recuperar ~2% em 7 dias: o padrão está ok.',
        nextWeek: '+2% em 7 dias',
        suggestedFactor: 1,
        suggestion: 'O pricesafe já embute a recuperação; a conta dá × 1,006. Pagar mais não muda nada na prática.',
    },
    fundo: {
        label: 'Fundo',
        color: '#22c55e',
        advice: 'Mais de 15% abaixo do normal. Costuma recuperar ~4% em 7 dias; o pricesafe já embute quase toda a recuperação.',
        nextWeek: '+4% em 7 dias',
        suggestedFactor: 1,
        suggestion: 'A conta dá × 1,011: no máximo 1% a mais. Em 1 de cada 4 casos o fundo caiu mais 3,5% ou mais, então o padrão é o mais seguro.',
    },
    iliquido: {
        label: 'Ilíquido',
        color: '#a78bfa',
        advice: 'Menos de 10 vendas por semana na Steam: preço frágil e difícil de revender. Pague menos ou recuse.',
        nextWeek: 'sem medição',
        suggestedFactor: null,
        suggestion: 'Sem medição: é decisão de negócio. A maior ordem de compra desses itens fica em ~28% do preço (84–88% nos líquidos). Ponto de partida possível: × 0,85, ou recusar o item.',
    },
    sem_dados: {
        label: 'Sem dados',
        color: '#64748b',
        advice: 'Sem histórico suficiente no banco (menos de 10 dias ou sem preço no último sync).',
        nextWeek: 'sem medição',
        suggestedFactor: null,
        suggestion: 'Nunca é ajustado.',
    },
}

export const signalStyle = (signal: SwapTrendSignal) => {
    const { color } = SWAP_TREND_SIGNALS[signal]

    return { color, background: `${color}1f`, borderColor: `${color}55` }
}

export const formatPct = (value: number | null) => {
    if (value === null) return '—'

    return `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}
