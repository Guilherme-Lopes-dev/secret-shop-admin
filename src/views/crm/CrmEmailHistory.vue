<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import {
    adminService,
    type EmailBlast,
    type EmailBlastDetail,
    type EmailSendStatus,
} from '@/services/admin/admin.service'
import { campaignMeta } from '@/utils/campaigns'

const STATUS_META: Record<EmailSendStatus, { label: string; icon: string; color: string }> = {
    SENT: { label: 'Enviados', icon: 'mdi:check-circle-outline', color: '#4ade80' },
    QUEUED: { label: 'Na fila', icon: 'mdi:clock-outline', color: '#38bdf8' },
    FAILED: { label: 'Falharam', icon: 'mdi:alert-circle-outline', color: '#f87171' },
    SKIPPED: { label: 'Pulados', icon: 'mdi:skip-next-circle-outline', color: '#94a3b8' },
}
const STATUSES = Object.keys(STATUS_META) as EmailSendStatus[]

const blasts = ref<EmailBlast[]>([])
const loading = ref(true)
const currentPage = ref(1)
const totalPages = ref(1)

const openId = ref<string | null>(null)
const detail = ref<EmailBlastDetail | null>(null)
const loadingDetail = ref(false)
const statusFilter = ref<EmailSendStatus | ''>('')
const sendSearch = ref('')
const showBody = ref(false)

const totalOf = (blast: EmailBlast) => STATUSES.reduce((sum, status) => sum + blast.counts[status], 0)

const visibleSends = computed(() => {
    const term = sendSearch.value.trim().toLowerCase()
    const sends = detail.value?.sends ?? []

    return sends
        .filter((send) => !statusFilter.value || send.status === statusFilter.value)
        .filter((send) => !term || `${send.display_name ?? ''} ${send.email}`.toLowerCase().includes(term))
})

const fetchBlasts = async (page: number) => {
    loading.value = true
    try {
        const { data } = await adminService.getEmailBlasts(page)
        blasts.value = data.data
        currentPage.value = data.page
        totalPages.value = data.pages
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao carregar histórico.')
    } finally {
        loading.value = false
    }
}

const fetchDetail = async (id: string) => {
    loadingDetail.value = true
    try {
        const { data } = await adminService.getEmailBlast(id)
        if (openId.value === id) detail.value = data
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao carregar disparo.')
    } finally {
        // Resposta de um disparo que já foi fechado não apaga o "Carregando" do atual.
        if (openId.value === id) loadingDetail.value = false
    }
}

const toggleBlast = (id: string) => {
    detail.value = null
    statusFilter.value = ''
    sendSearch.value = ''
    showBody.value = false
    openId.value = openId.value === id ? null : id
    if (openId.value) fetchDetail(id)
}

// Disparo em andamento: recarrega contagens e, se aberto, a lista de e-mails.
const refresh = () => {
    fetchBlasts(currentPage.value)
    if (openId.value) fetchDetail(openId.value)
}

onMounted(() => fetchBlasts(1))
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <router-link to="/crm/email" class="back-link"><Icon icon="mdi:arrow-left" /> Campanha por e-mail</router-link>
                <h1 class="page-title">Histórico de e-mails</h1>
                <p class="page-subtitle">Cada disparo com quem recebeu, quem falhou e por quê.</p>
            </div>
            <button class="btn-secondary" :disabled="loading" @click="refresh">
                <Icon icon="mdi:refresh" :class="{ spin: loading }" /> Atualizar
            </button>
        </header>

        <div class="section">
            <p v-if="loading && !blasts.length" class="muted pad">Carregando...</p>
            <p v-else-if="!blasts.length" class="muted pad">Nenhum disparo ainda.</p>

            <div v-for="blast in blasts" :key="blast.id" class="blast" :class="{ open: openId === blast.id }">
                <button class="blast-row" @click="toggleBlast(blast.id)">
                    <Icon :icon="openId === blast.id ? 'mdi:chevron-down' : 'mdi:chevron-right'" class="chevron" />
                    <span class="blast-main">
                        <span class="blast-subject">{{ blast.subject }}</span>
                        <small class="muted">
                            {{ $dayjs(blast.created_at).format('DD/MM/YYYY HH:mm') }} · {{ totalOf(blast) }} clientes
                            <template v-if="blast.coupon_code"> · cupom <strong class="coupon">{{ blast.coupon_code }}</strong></template>
                        </small>
                    </span>
                    <span v-if="blast.campaign" class="campaign-tag" :style="{ '--accent': campaignMeta(blast.campaign).color }">
                        {{ campaignMeta(blast.campaign).label }}
                    </span>
                    <span v-else class="campaign-tag">Sem campanha</span>
                    <span class="counts">
                        <template v-for="status in STATUSES" :key="status">
                            <span
                                v-if="blast.counts[status]"
                                class="count-chip"
                                :style="{ '--accent': STATUS_META[status].color }"
                                :title="STATUS_META[status].label"
                            >
                                <Icon :icon="STATUS_META[status].icon" /> {{ blast.counts[status] }}
                            </span>
                        </template>
                    </span>
                </button>

                <div v-if="openId === blast.id" class="blast-detail">
                    <p v-if="blast.skipped_count" class="hint">
                        {{ blast.skipped_count }} marcados não entraram (descadastrados ou sem e-mail no momento do envio).
                    </p>

                    <button class="btn-link" @click="showBody = !showBody">
                        {{ showBody ? 'Esconder texto' : 'Ver texto enviado' }}
                    </button>
                    <pre v-if="showBody" class="body-text">{{ blast.body }}</pre>

                    <div class="detail-toolbar">
                        <div class="status-filters">
                            <button class="filter-chip" :class="{ active: !statusFilter }" @click="statusFilter = ''">
                                Todos ({{ totalOf(blast) }})
                            </button>
                            <button
                                v-for="status in STATUSES"
                                :key="status"
                                class="filter-chip"
                                :class="{ active: statusFilter === status }"
                                :style="{ '--accent': STATUS_META[status].color }"
                                @click="statusFilter = status"
                            >
                                {{ STATUS_META[status].label }} ({{ blast.counts[status] }})
                            </button>
                        </div>
                        <input v-model="sendSearch" type="search" class="search-input" placeholder="Buscar cliente ou e-mail..." />
                    </div>

                    <p v-if="loadingDetail && !detail" class="muted pad">Carregando e-mails...</p>
                    <div v-else class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Cliente</th>
                                    <th>Status</th>
                                    <th>Enviado em</th>
                                    <th>Motivo</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="send in visibleSends" :key="send.id">
                                    <td>
                                        <router-link :to="`/crm/${send.user_uuid}`" class="client-link">{{ send.display_name || '—' }}</router-link>
                                        <small class="muted block">{{ send.email }}</small>
                                    </td>
                                    <td>
                                        <span class="status-badge" :style="{ '--accent': STATUS_META[send.status].color }">
                                            <Icon :icon="STATUS_META[send.status].icon" /> {{ STATUS_META[send.status].label }}
                                        </span>
                                    </td>
                                    <td>{{ send.sent_at ? $dayjs(send.sent_at).format('DD/MM HH:mm:ss') : '—' }}</td>
                                    <td class="error-cell">{{ send.error || '—' }}</td>
                                </tr>
                                <tr v-if="!visibleSends.length">
                                    <td colspan="4" class="muted pad center">Nenhum e-mail nesse filtro.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div v-if="totalPages > 1" class="pagination">
                <button class="page-btn" :disabled="currentPage === 1" @click="fetchBlasts(currentPage - 1)">Anterior</button>
                <span class="muted">Página {{ currentPage }} de {{ totalPages }}</span>
                <button class="page-btn" :disabled="currentPage === totalPages" @click="fetchBlasts(currentPage + 1)">Próxima</button>
            </div>
        </div>
    </div>
</template>

<style lang="stylus" scoped>
.view-wrap
    padding 2rem
    color #fff
    background #121214
    min-height 100vh

.page-header
    display flex
    align-items flex-end
    justify-content space-between
    gap 1rem
    flex-wrap wrap
    margin-bottom 1.5rem

.back-link
    display inline-flex
    align-items center
    gap 0.25rem
    color #94a3b8
    font-size 0.85rem
    text-decoration none
    margin-bottom 0.5rem

    &:hover
        color #fff

.page-title
    font-size 1.8rem
    font-weight 700
    margin-bottom 0.25rem

.page-subtitle
    color #94a3b8
    font-size 0.9rem

.btn-secondary, .page-btn
    display inline-flex
    align-items center
    gap 0.4rem
    background #2a2a30
    color #fff
    border 1px solid rgba(255,255,255,0.1)
    padding 0.5rem 1rem
    border-radius 8px
    font-size 0.85rem
    cursor pointer

    &:hover:not(:disabled)
        background #3a3a42

    &:disabled
        opacity 0.4
        cursor not-allowed

.spin
    animation spin 1s linear infinite

@keyframes spin
    to
        transform rotate(360deg)

.section
    background #1a1a1e
    padding 1rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.blast
    border 1px solid rgba(255,255,255,0.05)
    border-radius 10px
    margin-bottom 0.75rem

    &.open
        border-color rgba(99,102,241,0.35)

.blast-row
    display flex
    align-items center
    gap 0.75rem
    width 100%
    background none
    border none
    color #fff
    padding 0.85rem 1rem
    text-align left
    cursor pointer
    flex-wrap wrap

    &:hover
        background rgba(255,255,255,0.03)

.chevron
    color #64748b
    flex-shrink 0

.blast-main
    display flex
    flex-direction column
    flex 1
    min-width 200px
    gap 0.15rem

.blast-subject
    font-weight 600
    overflow-wrap anywhere

.coupon
    color #818cf8

.campaign-tag
    --accent #94a3b8
    color var(--accent)
    background rgba(255,255,255,0.06)
    padding 2px 8px
    border-radius 6px
    font-size 0.72rem
    font-weight 600
    white-space nowrap

.counts
    display flex
    gap 0.4rem
    flex-wrap wrap

.count-chip, .status-badge
    --accent #94a3b8
    display inline-flex
    align-items center
    gap 0.25rem
    color var(--accent)
    background rgba(255,255,255,0.06)
    padding 2px 8px
    border-radius 999px
    font-size 0.78rem
    font-weight 600
    white-space nowrap

.blast-detail
    padding 0 1rem 1rem
    border-top 1px solid rgba(255,255,255,0.05)

.hint
    color #f59e0b
    font-size 0.8rem
    margin 0.75rem 0 0

.btn-link
    background none
    border none
    color #818cf8
    font-size 0.82rem
    padding 0
    margin-top 0.75rem
    cursor pointer

    &:hover
        text-decoration underline

.body-text
    white-space pre-wrap
    overflow-wrap anywhere
    background #121214
    border 1px solid rgba(255,255,255,0.06)
    border-radius 8px
    padding 0.75rem
    font-family inherit
    font-size 0.85rem
    color #cbd5e1
    margin 0.5rem 0 0

.detail-toolbar
    display flex
    align-items center
    justify-content space-between
    gap 0.75rem
    flex-wrap wrap
    margin 1rem 0 0.75rem

.status-filters
    display flex
    gap 0.4rem
    flex-wrap wrap

.filter-chip
    --accent #818cf8
    background #121214
    border 1px solid rgba(255,255,255,0.08)
    color #cbd5e1
    padding 0.3rem 0.7rem
    border-radius 999px
    font-size 0.78rem
    cursor pointer

    &.active
        color var(--accent)
        border-color var(--accent)

.search-input
    background #121214
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.45rem 0.75rem
    font-size 0.85rem
    outline none
    min-width 200px

    &:focus
        border-color rgba(99,102,241,0.4)

.table-wrapper
    overflow-x auto
    max-height 480px
    overflow-y auto

table
    width 100%
    border-collapse collapse

    th
        position sticky
        top 0
        background #1a1a1e
        text-align left
        color #94a3b8
        font-size 0.75rem
        font-weight 500
        padding 0.6rem
        text-transform uppercase
        white-space nowrap

    td
        padding 0.6rem
        font-size 0.85rem
        border-top 1px solid rgba(255,255,255,0.04)
        vertical-align middle

.client-link
    color #fff
    text-decoration none

    &:hover
        text-decoration underline

.block
    display block

.error-cell
    color #94a3b8
    font-size 0.78rem
    max-width 360px
    overflow-wrap anywhere

.muted
    color #64748b

.pad
    padding 1rem
    margin 0

.center
    text-align center

.pagination
    display flex
    justify-content flex-end
    align-items center
    gap 1rem
    padding-top 0.75rem
</style>
