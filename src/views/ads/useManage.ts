import { ref } from 'vue'
import { toast } from 'vue3-toastify'
import type { ManageRow } from './ManageTable.vue'

const brl = (value: number | null) => (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Confirmar, mandar pra rede, recarregar e avisar: igual nas duas redes.
 * `send` faz a chamada da rede; `reload` relê a conta depois de mudar.
 */
export const useManage = (reload: () => Promise<void>) => {
  const busy = ref<string | null>(null)

  /** true = a rede aceitou. */
  const run = async (key: string, send: () => Promise<unknown>) => {
    busy.value = key
    try {
      await send()
      toast.success('Alterado na conta.')
      await reload()
      return true
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'A rede recusou a alteração.')
      return false
    } finally {
      busy.value = null
    }
  }

  const confirmToggle = (row: ManageRow) =>
    window.confirm(row.active ? `Pausar "${row.name}"?` : `Ativar "${row.name}"? Começa a gastar se o resto da estrutura estiver ativo.`)

  // Cancelou ou a rede recusou: o campo volta pro valor que está na conta.
  const runBudget = async (row: ManageRow, value: number, input: HTMLInputElement, send: () => Promise<unknown>) => {
    if (!value || value === row.budget) return
    const confirmed = window.confirm(`Orçamento de "${row.name}": ${brl(row.budget)} → ${brl(value)} por dia?`)
    if (confirmed && (await run(row.key, send))) return
    input.value = String(row.budget)
  }

  return { busy, run, confirmToggle, runBudget }
}
