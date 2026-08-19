<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { adminService, type BackupFileDto } from '@/services/admin/admin.service'

const router = useRouter()

const files = ref<BackupFileDto[]>([])
const running = ref<string | null>(null)
const lastError = ref<string | null>(null)
const loading = ref(false)

let poll: ReturnType<typeof setInterval> | null = null

const busy = computed(() => loading.value || !!running.value)

const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

const formatDate = (iso: string) => new Date(iso).toLocaleString('pt-BR')

const notifyError = (error: any, fallback: string) =>
  toast.error(error?.response?.data?.message || fallback)

const stopPolling = () => {
  if (!poll) return
  clearInterval(poll)
  poll = null
}

// Dump e restore rodam soltos no servidor: a listagem é o único sinal de progresso.
const startPolling = () => {
  if (poll) return
  poll = setInterval(load, 3000)
}

const load = async () => {
  try {
    const { data } = await adminService.listBackups()
    files.value = data.files
    running.value = data.running
    // Só notifica na transição: lastError fica no servidor até o próximo start(),
    // senão todo mount da tela repetiria o erro antigo.
    if (data.lastError && data.lastError !== lastError.value) toast.error(data.lastError)
    lastError.value = data.lastError
    if (!data.running) stopPolling()
  } catch (error) {
    stopPolling()
    notifyError(error, 'Erro ao listar backups.')
  }
}

const handleCreate = async () => {
  loading.value = true
  try {
    await adminService.createBackup()
    toast.info('Backup iniciado. O arquivo aparece na lista quando terminar.')
    startPolling()
    await load()
  } catch (error) {
    notifyError(error, 'Erro ao iniciar o backup.')
  } finally {
    loading.value = false
  }
}

const handleDownload = async (name: string) => {
  try {
    await adminService.downloadBackup(name)
  } catch (error) {
    notifyError(error, 'Erro ao baixar o backup.')
  }
}

const handleDelete = async (name: string) => {
  if (!confirm(`Apagar ${name} do servidor?`)) return

  try {
    await adminService.deleteBackup(name)
    await load()
  } catch (error) {
    notifyError(error, 'Erro ao apagar o backup.')
  }
}

const handleRestore = async (name: string) => {
  const warning = `RESTAURAR a partir de ${name}?\n\nO estado atual do banco e salvo antes, num backup "safety", entao da pra voltar. Ainda assim: o site fica inconsistente durante a restauracao.`
  if (!confirm(warning)) return
  if (prompt('Digite RESTAURAR para confirmar:') !== 'RESTAURAR') return

  try {
    await adminService.restoreBackup(name)
    toast.info('Restauracao iniciada. Nao mexa no painel ate terminar.')
    startPolling()
    await load()
  } catch (error) {
    notifyError(error, 'Erro ao iniciar a restauracao.')
  }
}

onUnmounted(stopPolling)

load()
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <button class="btn-back" @click="router.push('/')">
                <Icon icon="mdi:arrow-left" /> Dashboard
            </button>
        </header>

        <h1 class="page-title">Backup do banco</h1>
        <p class="page-subtitle">
            Gera um dump completo do Postgres no servidor e baixa pro seu computador. Um backup
            automático roda todo dia às 4h e guarda os 7 últimos. Restaurar por aqui serve pra
            desfazer estrago nos dados com o banco de pé — em desastre total o login não funciona,
            e aí a restauração é por SSH com o <code>.dump</code> que você baixou.
        </p>

        <div class="actions">
            <button class="btn-primary" :disabled="busy" @click="handleCreate">
                <Icon v-if="loading" icon="mdi:loading" class="spinning" />
                <Icon v-else icon="mdi:database-export-outline" />
                Fazer backup agora
            </button>
        </div>

        <div v-if="running" class="banner running">
            <Icon icon="mdi:loading" class="spinning" />
            Em andamento: {{ running }}
        </div>

        <div v-if="lastError" class="banner error">
            <Icon icon="mdi:alert-circle-outline" />
            {{ lastError }}
        </div>

        <div class="card">
            <p v-if="!files.length" class="empty">Nenhum backup guardado ainda.</p>

            <table v-else class="table">
                <thead>
                    <tr>
                        <th>Arquivo</th>
                        <th>Tamanho</th>
                        <th>Criado em</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="file in files" :key="file.name">
                        <td class="file-name">{{ file.name }}</td>
                        <td>{{ formatSize(file.size) }}</td>
                        <td>{{ formatDate(file.createdAt) }}</td>
                        <td class="row-actions">
                            <button class="btn-icon" title="Baixar" @click="handleDownload(file.name)">
                                <Icon icon="mdi:download-outline" />
                            </button>
                            <button class="btn-icon danger" title="Restaurar" :disabled="busy" @click="handleRestore(file.name)">
                                <Icon icon="mdi:database-import-outline" />
                            </button>
                            <button class="btn-icon" title="Apagar" :disabled="busy" @click="handleDelete(file.name)">
                                <Icon icon="mdi:trash-can-outline" />
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<style lang="stylus" scoped>
.view-wrap
    padding 2rem
    color #fff
    background #121214
    min-height 100vh
    max-width 900px

.page-header
    margin-bottom 1.5rem

.btn-back
    display inline-flex
    align-items center
    gap 0.4rem
    background transparent
    border none
    color #94a3b8
    cursor pointer
    font-size 0.875rem
    padding 0.4rem 0.5rem
    border-radius 6px
    transition all 0.15s

    &:hover
        color #fff
        background rgba(255,255,255,0.05)

.page-title
    font-size 1.8rem
    font-weight 700
    margin-bottom 0.25rem

.page-subtitle
    color #94a3b8
    font-size 0.9rem
    margin-bottom 2rem
    max-width 640px

.actions
    display flex
    gap 0.75rem
    flex-wrap wrap
    margin-bottom 1.5rem

.btn-primary
    display inline-flex
    align-items center
    gap 0.5rem
    border none
    padding 0.6rem 1.25rem
    border-radius 8px
    font-size 0.9rem
    font-weight 600
    cursor pointer
    transition all 0.2s
    background #6366f1
    color #fff

    &:hover:not(:disabled)
        background #4f52d4

    &:disabled
        opacity 0.5
        cursor not-allowed

.banner
    display flex
    align-items center
    gap 0.5rem
    padding 0.75rem 1rem
    border-radius 8px
    font-size 0.875rem
    margin-bottom 1rem

    &.running
        background rgba(99,102,241,0.12)
        color #a5b4fc

    &.error
        background rgba(239,68,68,0.12)
        color #fca5a5

.card
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.05)
    border-radius 12px
    padding 1rem

.empty
    color #64748b
    font-size 0.875rem
    text-align center
    padding 2rem 0

.table
    width 100%
    border-collapse collapse
    font-size 0.85rem

    th
        text-align left
        color #94a3b8
        font-weight 500
        text-transform uppercase
        letter-spacing 0.04em
        font-size 0.72rem
        padding 0.5rem 0.75rem

    td
        padding 0.65rem 0.75rem
        border-top 1px solid rgba(255,255,255,0.05)

.file-name
    font-family monospace
    color #e2e8f0

.row-actions
    display flex
    gap 0.35rem
    justify-content flex-end

.btn-icon
    display inline-flex
    align-items center
    justify-content center
    width 32px
    height 32px
    border none
    border-radius 6px
    background rgba(255,255,255,0.05)
    color #94a3b8
    cursor pointer
    transition all 0.15s

    &:hover:not(:disabled)
        background rgba(255,255,255,0.12)
        color #fff

    &.danger:hover:not(:disabled)
        background rgba(239,68,68,0.18)
        color #fca5a5

    &:disabled
        opacity 0.4
        cursor not-allowed

.spinning
    animation spin 1s linear infinite

@keyframes spin
    from transform rotate(0deg)
    to transform rotate(360deg)
</style>
