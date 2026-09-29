<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { adminService } from '@/services/admin/admin.service'
import type { CollectorTask, CollectorTaskAction, DropshipStage, DropshipTask, TodayTasks } from '@/services/admin/types'
import { formatCurrency } from '@/utils/formatCurrency'
import { persistedRef } from '@/utils/persistedRef'
import RefreshFriendshipButton from '@/components/common/RefreshFriendshipButton.vue'

/** Dropship parado mais que isso fica vermelho. */
const DROPSHIP_LATE_DAYS = 3

const tasks = ref<TodayTasks | null>(null)
const loading = ref(true)
const failed = ref(false)
const collapsed = persistedRef('dashboard:today-tasks-collapsed', false)

const fetchTasks = async () => {
    loading.value = true
    failed.value = false
    try {
        const { data } = await adminService.getDashboardTodayTasks()
        tasks.value = data
    } catch (error) {
        console.error('Erro ao carregar pendências do dia:', error)
        failed.value = true
    } finally {
        loading.value = false
    }
}

// Ordem = prioridade de leitura: o que dá pra fazer agora primeiro, o que só espera por último.
const collectorSections: Array<{ action: CollectorTaskAction; title: string; icon: string; tone: string }> = [
    { action: 'ready', title: 'Collector: pode presentear hoje', icon: 'mdi:gift-outline', tone: 'ok' },
    { action: 'add_friend', title: 'Collector: ainda não são amigos', icon: 'mdi:account-plus-outline', tone: 'critical' },
    { action: 'check_friendship', title: 'Collector: sem dados da Steam (nunca checado ou lista privada) — rode "Atualizar amizades"', icon: 'mdi:account-question-outline', tone: 'warn' },
    { action: 'waiting', title: 'Collector: contando os 30 dias de amizade', icon: 'mdi:timer-sand', tone: 'muted' },
]

const collectorByAction = computed(() => {
    const groups: Record<CollectorTaskAction, CollectorTask[]> = { ready: [], add_friend: [], check_friendship: [], waiting: [] }
    // `?.` segura deploy fora de ordem: ação nova no backend não derruba o dashboard.
    for (const task of tasks.value?.collector ?? []) groups[task.action]?.push(task)
    return groups
})

const visibleSections = computed(() =>
    collectorSections.filter(section => collectorByAction.value[section.action].length > 0),
)

const dropship = computed(() => tasks.value?.dropship ?? [])

// "Comprado" primeiro: é o que dá pra fechar hoje; "falta comprar" ainda depende do Market.
const dropshipSections = [
    { key: 'purchased', title: 'Dropship: comprado, falta enviar', icon: 'mdi:cart-check', tone: 'ok' },
    { key: 'to_buy', title: 'Dropship: falta comprar no Market', icon: 'mdi:package-variant-closed', tone: 'warn' },
] as const

const dropshipByStage = computed(() => ({
    purchased: dropship.value.filter(task => task.purchased_at),
    to_buy: dropship.value.filter(task => !task.purchased_at),
}))

const visibleDropshipSections = computed(() =>
    dropshipSections.filter(section => dropshipByStage.value[section.key].length > 0),
)

// Já comprado: a espera é só o envio, não vira vermelho.
const waitingTone = (task: DropshipTask, stage: DropshipStage) => {
    if (stage === 'purchased') return 'badge--muted'
    return task.waiting_days >= DROPSHIP_LATE_DAYS ? 'badge--critical' : 'badge--warn'
}

const totalCount = computed(() => (tasks.value?.collector.length ?? 0) + dropship.value.length)

const days = (count: number | null) => {
    if (count === null) return '? dias'
    return `${count} ${count === 1 ? 'dia' : 'dias'}`
}

const statusText: Record<CollectorTaskAction, (task: CollectorTask) => string> = {
    ready: task => `amigos há ${days(task.friendship_age_days)}`,
    waiting: task => `libera em ${days(task.unlocks_in_days)}`,
    add_friend: () => 'não amigos',
    check_friendship: () => 'sem dados da Steam',
}

// Nome da conta explica por que difere da lista de usuários (lá vale qualquer conta collector).
const friendshipText = (task: CollectorTask) => {
    const status = statusText[task.action](task)
    if (!task.blocking_account) return status
    return `${status} · ${task.blocking_account}`
}

const generatedAt = computed(() => {
    if (!tasks.value) return ''
    return new Date(tasks.value.generated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
})

onMounted(fetchTasks)
</script>

<template>
    <div class="section today-tasks" :class="{ 'today-tasks--collapsed': collapsed }">
        <div class="section-header">
            <button type="button" class="collapse-toggle" :aria-expanded="!collapsed" @click="collapsed = !collapsed">
                <Icon :icon="collapsed ? 'mdi:chevron-right' : 'mdi:chevron-down'" width="20" />
                <h2 class="section-title">Pendências a tratar hoje</h2>
                <span v-if="tasks" class="group-count" :class="{ 'group-count--hot': totalCount > 0 }">{{ totalCount }}</span>
                <span v-if="generatedAt" class="generated-at">calculado às {{ generatedAt }}</span>
            </button>
            <div v-if="!collapsed" class="header-actions">
                <RefreshFriendshipButton @done="fetchTasks" />
                <button type="button" class="refresh-btn" :disabled="loading" @click="fetchTasks">
                    <Icon icon="mdi:refresh" width="15" :class="{ spin: loading }" />
                    Recalcular
                </button>
            </div>
        </div>

        <template v-if="!collapsed">
        <p v-if="failed" class="empty empty--error">Falha ao carregar as pendências. Tente recalcular.</p>
        <p v-else-if="!loading && totalCount === 0" class="empty">Nada a tratar hoje.</p>

        <div v-for="section in visibleSections" :key="section.action" class="task-group" :class="`task-group--${section.tone}`">
            <h3 class="group-title">
                <Icon :icon="section.icon" width="16" />
                {{ section.title }}
                <span class="group-count">{{ collectorByAction[section.action].length }}</span>
            </h3>
            <router-link
                v-for="task in collectorByAction[section.action]"
                :key="task.id"
                :to="`/collector-orders/${task.id}`"
                class="task-row"
            >
                <span class="task-order">{{ task.order_number }}</span>
                <span class="task-user">{{ task.user_name }}</span>
                <span class="task-items" :title="task.items.join(', ')">{{ task.items.join(', ') }}</span>
                <span class="task-meta">
                    <span class="badge" :class="`badge--${section.tone}`">{{ friendshipText(task) }}</span>
                    <span class="badge" :class="task.overdue ? 'badge--critical' : 'badge--muted'">
                        pago há {{ days(task.paid_days_ago) }}{{ task.overdue ? ' — atrasado' : '' }}
                    </span>
                    <span class="task-amount">{{ formatCurrency(task.total_amount) }}</span>
                </span>
            </router-link>
        </div>

        <div v-for="section in visibleDropshipSections" :key="section.key" class="task-group" :class="`task-group--${section.tone}`">
            <h3 class="group-title">
                <Icon :icon="section.icon" width="16" />
                {{ section.title }}
                <span class="group-count">{{ dropshipByStage[section.key].length }}</span>
            </h3>
            <router-link
                v-for="task in dropshipByStage[section.key]"
                :key="task.id"
                :to="task.sale_uuid ? `/dropship-orders/${task.sale_uuid}` : '/dropship-orders'"
                class="task-row"
            >
                <span class="task-order">{{ task.order_number }}</span>
                <span class="task-user">{{ task.user_name }}</span>
                <span class="task-items" :title="task.items.join(', ')">{{ task.items.join(', ') }}</span>
                <span class="task-meta">
                    <span class="badge" :class="waitingTone(task, section.key)">
                        aguardando há {{ days(task.waiting_days) }}
                    </span>
                    <span class="task-amount">{{ formatCurrency(task.total_amount) }}</span>
                </span>
            </router-link>
        </div>
        </template>
    </div>
</template>

<style lang="stylus" scoped>
.today-tasks
    margin-bottom 2rem

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.section-header
    display flex
    justify-content space-between
    align-items center
    margin-bottom 1rem
    gap 1rem
    flex-wrap wrap

.today-tasks--collapsed .section-header
    margin-bottom 0

.collapse-toggle
    display flex
    align-items center
    gap 0.5rem
    background none
    border none
    padding 0
    color inherit
    cursor pointer
    text-align left
    &:hover .section-title
        color #a5b4fc

.section-title
    font-size 1rem
    font-weight 600

.generated-at
    font-size 0.72rem
    color #64748b

.group-count--hot
    background rgba(255,152,0,0.2)
    color #ffb74d

.empty--error
    color #ef9a9a

.header-actions
    display flex
    gap 0.5rem
    align-items center

.refresh-btn
    display flex
    align-items center
    gap 0.35rem
    background rgba(255,255,255,0.05)
    border 1px solid rgba(255,255,255,0.1)
    color #94a3b8
    font-size 0.8rem
    padding 0.4rem 0.7rem
    border-radius 7px
    cursor pointer
    &:hover
        background rgba(99,102,241,0.2)
        color #e2e8f0
    &:disabled
        opacity 0.6
        cursor default

.spin
    animation spin 1s linear infinite

@keyframes spin
    to
        transform rotate(360deg)

.empty
    color #64748b
    font-size 0.85rem
    text-align center
    padding 1rem

.task-group
    margin-bottom 1rem
    &:last-child
        margin-bottom 0

.group-title
    display flex
    align-items center
    gap 0.4rem
    font-size 0.82rem
    font-weight 600
    margin-bottom 0.4rem
    color #cbd5e1

.group-count
    font-size 0.72rem
    padding 0 0.45rem
    border-radius 999px
    background rgba(255,255,255,0.08)

.task-group--ok .group-title
    color #4caf50
.task-group--warn .group-title
    color #ffb74d
.task-group--critical .group-title
    color #ef9a9a
.task-group--muted .group-title
    color #94a3b8

.task-row
    display grid
    grid-template-columns 120px 150px 1fr auto
    align-items center
    gap 0.75rem
    padding 0.5rem 0.75rem
    border-radius 8px
    text-decoration none
    color #e2e8f0
    font-size 0.82rem
    border 1px solid transparent
    &:hover
        background rgba(255,255,255,0.03)
        border-color rgba(99,102,241,0.4)
    @media (max-width: 900px)
        grid-template-columns 1fr
        gap 0.25rem

.task-order
    font-weight 600

.task-user
    color #94a3b8
    overflow hidden
    text-overflow ellipsis
    white-space nowrap

.task-items
    color #94a3b8
    overflow hidden
    text-overflow ellipsis
    white-space nowrap
    min-width 0

.task-meta
    display flex
    gap 0.4rem
    align-items center
    flex-wrap wrap
    justify-content flex-end

.task-amount
    font-weight 600
    font-size 0.8rem

.badge
    font-size 0.7rem
    padding 2px 7px
    border-radius 5px
    white-space nowrap

.badge--ok
    background rgba(76,175,80,0.12)
    color #4caf50
.badge--warn
    background rgba(255,152,0,0.12)
    color #ff9800
.badge--critical
    background rgba(244,67,54,0.12)
    color #f44336
.badge--muted
    background rgba(255,255,255,0.06)
    color #94a3b8
</style>
