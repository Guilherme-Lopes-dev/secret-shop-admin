import { computed, onMounted, ref } from 'vue'

/** Carrega uma leitura ao vivo (Meta/Google) ao abrir a seção; erro vira mensagem na própria seção. */
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

/** Escrita na conta ligada no backend (META_ADS_APPLY_ENABLED / GOOGLE_ADS_APPLY_ENABLED). */
export const useApplyEnabled = (fetchStatus: () => Promise<{ data: { apply_enabled: boolean } }>) => {
  const { data } = useLive(fetchStatus, '')
  return computed(() => !!data.value?.apply_enabled)
}
