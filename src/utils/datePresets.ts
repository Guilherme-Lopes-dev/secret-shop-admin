import dayjs from 'dayjs'

export type DatePreset = 'today' | '7d' | '30d' | 'month' | 'lastMonth' | 'year'

/** Intervalo `[de, até]` em YYYY-MM-DD, do jeito que os filtros de relatório mandam pra API. */
export const DATE_RANGE_BUILDERS: Record<DatePreset, () => [string, string]> = {
    today: () => [day(), day()],
    '7d': () => [day(dayjs().subtract(6, 'day')), day()],
    '30d': () => [day(dayjs().subtract(29, 'day')), day()],
    month: () => [day(dayjs().startOf('month')), day()],
    lastMonth: () => {
        const last = dayjs().subtract(1, 'month')
        return [day(last.startOf('month')), day(last.endOf('month'))]
    },
    year: () => [day(dayjs().startOf('year')), day()],
}

export const DATE_PRESETS: { key: DatePreset; label: string }[] = [
    { key: 'today', label: 'Hoje' },
    { key: '7d', label: '7 dias' },
    { key: '30d', label: '30 dias' },
    { key: 'month', label: 'Mês atual' },
    { key: 'lastMonth', label: 'Mês passado' },
    { key: 'year', label: 'Ano' },
]

function day(date = dayjs()) {
    return date.format('YYYY-MM-DD')
}
