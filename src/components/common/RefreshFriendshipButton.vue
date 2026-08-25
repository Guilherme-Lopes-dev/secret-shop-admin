<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { adminService } from '@/services/admin/admin.service'

// A varredura consulta a Steam usuário a usuário: não cabe num request HTTP.
// O botão dispara e acompanha pelo status até a fila esvaziar.
const emit = defineEmits<{ done: [] }>()

const POLL_MS = 3000

const running = ref(false)
const pending = ref(0)
const checked = ref(0)
const busy = ref(false)
let poll: ReturnType<typeof setInterval> | null = null

const stopPolling = () => {
    if (!poll) return
    clearInterval(poll)
    poll = null
}

const fetchStatus = async () => {
    try {
        const { data } = await adminService.getCollectorFriendshipStatus()
        const wasRunning = running.value
        running.value = data.running
        pending.value = data.pending
        checked.value = data.checked

        if (!wasRunning || data.running) return

        // Terminou: para o polling e deixa a lista se recarregar com o dado novo.
        stopPolling()
        toast.success('Amizades atualizadas.')
        emit('done')
    } catch {
        stopPolling()
    }
}

const startPolling = () => {
    stopPolling()
    poll = setInterval(fetchStatus, POLL_MS)
}

const refresh = async () => {
    if (busy.value || running.value) return
    busy.value = true
    try {
        const { data } = await adminService.refreshCollectorFriendship()
        running.value = true
        pending.value = data.pending
        startPolling()
        toast.info(`Consultando a Steam para ${data.pending} usuário(s).`)
    } catch {
        toast.error('Falha ao disparar a consulta de amizades.')
    } finally {
        busy.value = false
    }
}

const label = () => {
    if (running.value) return `Consultando Steam... ${pending.value} restante(s)`
    if (pending.value > 0) return `Atualizar amizades (${pending.value} pendente(s))`
    return 'Amizades atualizadas'
}

onMounted(async () => {
    await fetchStatus()
    if (running.value) startPolling()
})

onUnmounted(stopPolling)
</script>

<template>
    <button
        class="refresh-friendship"
        :class="{ 'refresh-friendship--idle': !running && pending === 0 }"
        :disabled="busy || running || pending === 0"
        :title="`${checked} usuário(s) já consultados`"
        @click="refresh"
    >
        <Icon :icon="running ? 'mdi:loading' : 'mdi:account-heart-outline'" :class="{ spin: running }" />
        {{ label() }}
    </button>
</template>

<style lang="stylus" scoped>
.refresh-friendship
    display inline-flex
    align-items center
    gap 0.4rem
    background rgba(99,102,241,0.12)
    color #818cf8
    border 1px solid rgba(99,102,241,0.25)
    padding 0.5rem 0.9rem
    border-radius 8px
    font-size 0.82rem
    font-weight 600
    cursor pointer
    white-space nowrap
    transition all 0.2s

    &:hover:not(:disabled)
        background rgba(99,102,241,0.22)

    &:disabled
        cursor default

.refresh-friendship--idle
    background rgba(148,163,184,0.08)
    color #94a3b8
    border-color rgba(255,255,255,0.06)

.spin
    animation spin 1s linear infinite

@keyframes spin
    from
        transform rotate(0deg)
    to
        transform rotate(360deg)
</style>
