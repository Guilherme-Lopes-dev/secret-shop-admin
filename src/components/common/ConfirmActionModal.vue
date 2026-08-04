<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'

// Ações de envio são difíceis de reverter na Steam: o confirmar só destrava depois da
// contagem, pra o admin ler o que vai acontecer antes de clicar.
const props = withDefaults(defineProps<{
    open: boolean
    title: string
    description: string
    confirmLabel: string
    loadingLabel?: string
    icon?: string
    variant?: 'primary' | 'danger'
    delaySeconds?: number
    loading?: boolean
}>(), {
    loadingLabel: 'Salvando...',
    icon: 'mdi:alert-outline',
    variant: 'primary',
    delaySeconds: 10,
    loading: false,
})

const emit = defineEmits<{
    (e: 'update:open', value: boolean): void
    (e: 'confirm'): void
}>()

const remaining = ref(props.delaySeconds)
let timer: ReturnType<typeof setInterval> | null = null

const stopTimer = () => {
    if (!timer) return
    clearInterval(timer)
    timer = null
}

const startTimer = () => {
    stopTimer()
    remaining.value = props.delaySeconds
    if (remaining.value <= 0) return

    timer = setInterval(() => {
        remaining.value -= 1
        if (remaining.value <= 0) stopTimer()
    }, 1_000)
}

watch(() => props.open, (isOpen) => (isOpen ? startTimer() : stopTimer()), { immediate: true })
onBeforeUnmount(stopTimer)

const locked = computed(() => remaining.value > 0)

const confirmText = computed(() => {
    if (props.loading) return props.loadingLabel
    if (locked.value) return `${props.confirmLabel} (${remaining.value}s)`
    return props.confirmLabel
})

const close = () => emit('update:open', false)
</script>

<template>
    <div v-if="open" class="modal-backdrop" @click.self="close">
        <div class="modal">
            <h2 class="modal-title" :class="{ 'title-danger': variant === 'danger' }">
                <Icon :icon="icon" />
                {{ title }}
            </h2>

            <p class="modal-description">{{ description }}</p>

            <slot />

            <p class="modal-hint">
                <Icon :icon="locked ? 'mdi:timer-sand' : 'mdi:check-circle-outline'" />
                {{ locked
                    ? `Leia com atenção — o botão libera em ${remaining}s.`
                    : 'Botão liberado. Confirme se está tudo certo.' }}
            </p>

            <div class="modal-actions">
                <button class="btn-secondary" :disabled="loading" @click="close">Cancelar</button>
                <button
                    class="btn-confirm"
                    :class="variant === 'danger' ? 'btn-danger' : 'btn-primary'"
                    :disabled="locked || loading"
                    @click="emit('confirm')"
                >
                    <Icon v-if="loading" icon="mdi:loading" class="spin" />
                    {{ confirmText }}
                </button>
            </div>
        </div>
    </div>
</template>

<style lang="stylus" scoped>
.modal-backdrop
    position fixed
    inset 0
    background rgba(0,0,0,0.7)
    display flex
    align-items center
    justify-content center
    z-index 100
    backdrop-filter blur(4px)

.modal
    background #1e1e24
    border 1px solid rgba(255,255,255,0.1)
    border-radius 12px
    padding 1.75rem
    width 100%
    max-width 440px

.modal-title
    font-size 1.1rem
    font-weight 700
    margin 0 0 0.5rem
    display flex
    align-items center
    gap 0.5rem
    color #e2e8f0

.title-danger
    color #ef4444

.modal-description
    color #94a3b8
    font-size 0.875rem
    line-height 1.55
    margin 0 0 1.25rem
    white-space pre-line

.modal-hint
    display flex
    align-items center
    gap 0.45rem
    margin 1.25rem 0 0
    padding 0.6rem 0.75rem
    border-radius 7px
    background rgba(255,255,255,0.04)
    border 1px solid rgba(255,255,255,0.07)
    color #94a3b8
    font-size 0.8rem

.modal-actions
    display flex
    justify-content flex-end
    gap 0.75rem
    margin-top 1.25rem

.btn-secondary
    background #2a2a30
    color #94a3b8
    border 1px solid rgba(255,255,255,0.1)
    padding 0.5rem 1.1rem
    border-radius 7px
    font-size 0.875rem
    font-weight 500
    cursor pointer
    transition all 0.2s

    &:hover:not(:disabled)
        background #3a3a42

    &:disabled
        opacity 0.5
        cursor not-allowed

.btn-confirm
    display inline-flex
    align-items center
    gap 0.4rem
    color #fff
    border none
    padding 0.5rem 1.1rem
    border-radius 7px
    font-size 0.875rem
    font-weight 600
    cursor pointer
    transition all 0.2s
    font-variant-numeric tabular-nums

    &:disabled
        opacity 0.5
        cursor not-allowed

.btn-primary
    background rgba(99,102,241,0.9)

    &:hover:not(:disabled)
        background rgba(99,102,241,1)

.btn-danger
    background rgba(239,68,68,0.85)

    &:hover:not(:disabled)
        background rgba(239,68,68,1)

.spin
    animation spin 1s linear infinite

@keyframes spin
    to
        transform rotate(360deg)
</style>
