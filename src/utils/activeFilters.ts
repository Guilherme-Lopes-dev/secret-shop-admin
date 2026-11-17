export type ActiveFilter = { key: string; label: string; clear: () => void }

type Label = string | false | null | undefined

/** Um filtro vira chip só quando tem valor: `label` vazio/false = filtro desligado. */
export const activeFilter = (key: string, label: Label, clear: () => void): ActiveFilter[] =>
    label ? [{ key, label, clear }] : []

export const optionLabel = <T>(options: Array<{ label: string; value: T }>, value: T) =>
    options.find(option => option.value === value)?.label

/** "≥ 10", "≤ 50", "10–50"; sem nenhum dos dois, sem chip. */
export const rangeLabel = (min: string, max: string): Label => {
    if (!min && !max) return null
    if (!max) return `≥ ${min}`
    if (!min) return `≤ ${max}`

    return `${min}–${max}`
}
