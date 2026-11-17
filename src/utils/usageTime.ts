/** Faixas de tempo logado (total nos últimos 30 dias, em minutos): `min` inclusivo, `max` exclusivo. */
export const USAGE_RANGE_PRESETS: Array<{ label: string; min?: number; max?: number }> = [
    { label: 'Qualquer' },
    { label: 'Sem uso (< 1 min)', max: 1 },
    { label: 'Até 1h', min: 1, max: 60 },
    { label: '1h a 5h', min: 60, max: 300 },
    { label: '5h a 15h', min: 300, max: 900 },
    { label: 'Mais de 15h', min: 900 },
]

export const usageRangeOf = (index: string | number): { min?: number; max?: number } =>
    USAGE_RANGE_PRESETS[Number(index)] ?? {}
