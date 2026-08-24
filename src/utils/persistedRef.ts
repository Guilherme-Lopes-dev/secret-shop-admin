import { ref, watch, type Ref } from 'vue'

// Filtro de tela morre a cada F5. Mesma ideia do cache dos collectors:
// o valor vive no localStorage e o ref só espelha.
const namespace = (key: string) => `secretshop-admin:filters:${key}:v1`

function readStored<T>(key: string, fallback: T): T {
    try {
        const raw = window.localStorage.getItem(namespace(key))

        return raw === null ? fallback : (JSON.parse(raw) as T)
    } catch {
        return fallback
    }
}

function writeStored<T>(key: string, value: T) {
    try {
        window.localStorage.setItem(namespace(key), JSON.stringify(value))
    } catch {
        // ponytail: quota estourada ou storage bloqueado — filtro não é dado crítico, segue sem persistir.
    }
}

export function persistedRef<T>(key: string, fallback: T): Ref<T> {
    const state = ref(readStored(key, fallback)) as Ref<T>

    watch(state, (value) => writeStored(key, value), { deep: true })

    return state
}
