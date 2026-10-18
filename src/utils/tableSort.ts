export type SortState = { column: string; desc: boolean }

export type SortGetters<T> = Record<string, (row: T) => number | null | undefined>

/** Ciclo do clique no cabeçalho: maior primeiro → menor primeiro → volta pra ordem original. */
export const nextSort = (current: SortState | undefined, column: string): SortState | undefined => {
    if (current?.column !== column) return { column, desc: true }
    if (current.desc) return { column, desc: false }

    return undefined
}

// Sem valor ("—", "fora da loja") fica no fim nas duas direções.
const compareNullsLast = (a: number | null | undefined, b: number | null | undefined, direction: number) => {
    if (a == null && b == null) return 0
    if (a == null) return 1
    if (b == null) return -1

    return (a - b) * direction
}

export const sortRows = <T>(rows: T[], getters: SortGetters<T>, sort: SortState | undefined): T[] => {
    const getter = sort && getters[sort.column]
    if (!getter) return rows

    const direction = sort.desc ? -1 : 1

    return [...rows].sort((a, b) => compareNullsLast(getter(a), getter(b), direction))
}
