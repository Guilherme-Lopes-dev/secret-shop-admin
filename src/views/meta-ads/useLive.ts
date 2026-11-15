import { onMounted, ref } from 'vue'

/** Carrega uma leitura ao vivo da Meta ao abrir a seção; erro vira mensagem na própria seção. */
export const useLive = <T>(fetch: () => Promise<{ data: T }>, failMessage: string) => {
  const data = ref<T>()
  const error = ref('')

  const load = async () => {
    try {
      data.value = (await fetch()).data
      error.value = ''
    } catch (err: any) {
      error.value = err.response?.data?.message ?? failMessage
    }
  }

  onMounted(load)

  return { data, error, reload: load }
}
