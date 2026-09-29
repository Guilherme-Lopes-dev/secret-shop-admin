<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import ConfirmActionModal from '@/components/common/ConfirmActionModal.vue'
import FilterField from '@/components/common/FilterField.vue'
import { adminService, type CrmCampaign, type CrmEmailRecipient } from '@/services/admin/admin.service'
import { CAMPAIGN_OPTIONS, campaignMeta } from '@/utils/campaigns'
import { formatCurrency } from '@/utils/formatCurrency'

interface Coupon {
    /** `uuid` chega como `id`: interceptor do backend renomeia. */
    id: string
    code: string
    is_active: boolean
    expires_at: string | null
    max_uses: number | null
    discount_type: 'PERCENTAGE' | 'FIXED'
    discount_value: number
    _count?: { redemptions: number }
}

/** Espelha MAX_EMAIL_RECIPIENTS do backend (crm.service.ts). */
const MAX_RECIPIENTS = 1000
/** Entram no lugar do nome em `{nome}` pra quem tiver uma escolhida. */
const NICKNAMES = ['Dom', 'Padrim', 'Patrão', 'Chefe', 'Mestre', 'Lenda', 'Craque']

const campaign = ref<CrmCampaign | ''>('')
const hero = ref('')
const heroes = ref<Array<{ name: string }>>([])
const recipients = ref<CrmEmailRecipient[]>([])
const selected = ref(new Set<string>())
const recipientSearch = ref('')
const loadingRecipients = ref(false)
/** id do cliente → alcunha. Sem entrada = vai o nome dele. */
const nicknames = ref<Record<string, string>>({})
const bulkNickname = ref('')

const subject = ref('')
const body = ref('Fala, {nome}!\n\n')
const couponId = ref('')
const coupons = ref<Coupon[]>([])

const confirmOpen = ref(false)
const sending = ref(false)

const isCouponAlive = (coupon: Coupon) => {
    if (!coupon.is_active) return false
    if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) return false
    if (coupon.max_uses && (coupon._count?.redemptions ?? 0) >= coupon.max_uses) return false

    return true
}
const activeCoupons = computed(() => coupons.value.filter(isCouponAlive))
const selectedCoupon = computed(() => coupons.value.find((coupon) => coupon.id === couponId.value) ?? null)
const couponDiscount = (coupon: Coupon) =>
    coupon.discount_type === 'PERCENTAGE' ? `${coupon.discount_value}%` : formatCurrency(coupon.discount_value)

const visibleRecipients = computed(() => {
    const term = recipientSearch.value.trim().toLowerCase()
    if (!term) return recipients.value

    return recipients.value.filter((recipient) =>
        `${recipient.username ?? ''} ${recipient.email}`.toLowerCase().includes(term),
    )
})
const allVisibleSelected = computed(() =>
    visibleRecipients.value.length > 0 && visibleRecipients.value.every((recipient) => selected.value.has(recipient.id)),
)
const canSend = computed(() => selected.value.size > 0 && subject.value.trim() !== '' && body.value.trim() !== '')

const displayName = (recipient: CrmEmailRecipient) => nicknames.value[recipient.id] || recipient.username || 'jogador'

const setNickname = (id: string, nickname: string) => {
    const { [id]: _previous, ...rest } = nicknames.value
    nicknames.value = nickname ? { ...rest, [id]: nickname } : rest
}

const applyNicknameToSelected = () => {
    selected.value.forEach((id) => setNickname(id, bulkNickname.value))
}

// Mesma conversão do backend (email-body.ts), só pra prévia.
const escapeHtml = (text: string) =>
    text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
const linkify = (html: string) =>
    html.replace(/https?:\/\/(?:[^\s<&]|&amp;)+/g, (match) => {
        const url = match.replace(/[.,;:!?)]+$/, '')
        return `<a href="${url}" target="_blank" rel="noopener">${url}</a>${match.slice(url.length)}`
    })
const previewRecipient = computed(() => recipients.value.find((recipient) => selected.value.has(recipient.id)) ?? null)
const previewName = computed(() => (previewRecipient.value ? displayName(previewRecipient.value) : 'jogador'))
const previewHtml = computed(() =>
    linkify(escapeHtml(body.value))
        .split('{nome}').join(escapeHtml(previewName.value))
        .replace(/\r?\n/g, '<br>'),
)

// Troca rápida de filtro: só a resposta do último pedido vale.
let latestRequest = 0

const fetchRecipients = async () => {
    const request = ++latestRequest
    loadingRecipients.value = true
    try {
        const { data } = await adminService.getEmailRecipients({
            campaign: campaign.value || undefined,
            hero: hero.value || undefined,
        })
        if (request !== latestRequest) return

        recipients.value = data
        selected.value = new Set(data.map((recipient) => recipient.id))
    } catch (e: any) {
        if (request !== latestRequest) return

        toast.error(e?.response?.data?.message || 'Erro ao carregar clientes.')
    } finally {
        if (request === latestRequest) loadingRecipients.value = false
    }
}

const toggleRecipient = (id: string) => {
    const next = new Set(selected.value)
    if (!next.delete(id)) next.add(id)
    selected.value = next
}

const toggleAllVisible = () => {
    const next = new Set(selected.value)
    const shouldSelect = !allVisibleSelected.value
    visibleRecipients.value.forEach((recipient) => (shouldSelect ? next.add(recipient.id) : next.delete(recipient.id)))
    selected.value = next
}

const send = async () => {
    sending.value = true
    try {
        const { data } = await adminService.sendEmailBlast({
            userUuids: [...selected.value],
            subject: subject.value,
            body: body.value,
            couponUuid: couponId.value || null,
            nicknames: Object.fromEntries(Object.entries(nicknames.value).filter(([id]) => selected.value.has(id))),
        })
        const notes = [
            data.alreadySentToday && `${data.alreadySentToday} já receberam campanha hoje`,
            data.skipped && `${data.skipped} descadastrados ou sem e-mail`,
        ].filter(Boolean)
        toast.success(`${data.queued} e-mails na fila.${notes.length ? ` Ignorados: ${notes.join(', ')}.` : ''}`)
        confirmOpen.value = false
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao enviar.')
    } finally {
        sending.value = false
    }
}

const fetchOptions = async () => {
    const [heroesResult, couponsResult] = await Promise.allSettled([adminService.getDotaHeroes(), adminService.getCoupons()])
    if (heroesResult.status === 'fulfilled') heroes.value = heroesResult.value.data
    if (couponsResult.status === 'fulfilled') coupons.value = couponsResult.value.data
}

onMounted(() => {
    fetchRecipients()
    fetchOptions()
})
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <router-link to="/crm" class="back-link"><Icon icon="mdi:arrow-left" /> CRM</router-link>
                <h1 class="page-title">Campanha por e-mail</h1>
                <p class="page-subtitle">Escolha o público, escreva o texto e, se quiser, anexe um cupom.</p>
            </div>
            <button class="btn-send" :disabled="!canSend" @click="confirmOpen = true">
                <Icon icon="mdi:send" /> Enviar para {{ selected.size }}
            </button>
        </header>

        <div class="grid">
            <section class="section">
                <h2 class="section-title">1. Público</h2>
                <div class="filters-row">
                    <FilterField label="Campanha">
                        <select v-model="campaign" class="filter-select" @change="fetchRecipients">
                            <option value="">Todos (sem campanha)</option>
                            <option v-for="opt in CAMPAIGN_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                        </select>
                    </FilterField>
                    <FilterField label="Herói">
                        <select v-model="hero" class="filter-select" @change="fetchRecipients">
                            <option value="">Todos</option>
                            <option v-for="option in heroes" :key="option.name" :value="option.name">{{ option.name }}</option>
                        </select>
                    </FilterField>
                </div>
                <p v-if="campaign" class="hint">{{ campaignMeta(campaign).hint }}</p>

                <div class="recipients-toolbar">
                    <label class="check-row">
                        <input type="checkbox" :checked="allVisibleSelected" @change="toggleAllVisible" />
                        Marcar todos ({{ selected.size }}/{{ recipients.length }})
                    </label>
                    <input v-model="recipientSearch" type="search" class="search-input" placeholder="Filtrar por nome ou e-mail..." />
                </div>
                <div class="nickname-bulk">
                    <span>Chamar os marcados de</span>
                    <select v-model="bulkNickname" class="filter-select">
                        <option value="">Nome do cliente</option>
                        <option v-for="nickname in NICKNAMES" :key="nickname" :value="nickname">{{ nickname }}</option>
                    </select>
                    <button class="btn-apply" :disabled="!selected.size" @click="applyNicknameToSelected">Aplicar</button>
                </div>

                <div class="recipients">
                    <p v-if="loadingRecipients" class="muted pad">Carregando...</p>
                    <p v-else-if="!recipients.length" class="muted pad">Ninguém com e-mail nesse público.</p>
                    <label v-for="recipient in visibleRecipients" v-else :key="recipient.id" class="recipient">
                        <input type="checkbox" :checked="selected.has(recipient.id)" @change="toggleRecipient(recipient.id)" />
                        <span class="recipient-info">
                            <span class="recipient-name">{{ recipient.username || '—' }}</span>
                            <small class="muted">{{ recipient.email }}</small>
                        </span>
                        <span v-if="recipient.campaign && !campaign" class="campaign-tag" :style="{ '--accent': campaignMeta(recipient.campaign).color }">
                            {{ campaignMeta(recipient.campaign).label }}
                        </span>
                        <select
                            class="nickname-select"
                            :class="{ active: nicknames[recipient.id] }"
                            :value="nicknames[recipient.id] ?? ''"
                            title="Como chamar esse cliente no {nome}"
                            @click.stop
                            @change="setNickname(recipient.id, ($event.target as HTMLSelectElement).value)"
                        >
                            <option value="">Nome</option>
                            <option v-for="nickname in NICKNAMES" :key="nickname" :value="nickname">{{ nickname }}</option>
                        </select>
                    </label>
                </div>
                <p v-if="recipients.length >= MAX_RECIPIENTS" class="hint warn">
                    Lista cortada em {{ MAX_RECIPIENTS }} (os que mais gastaram). Filtre por campanha ou herói pra ver o resto.
                </p>
                <p class="hint">Só aparece quem tem conta, e-mail e não se descadastrou. Clientes só do Wix ficam de fora.</p>
            </section>

            <section class="section">
                <h2 class="section-title">2. Mensagem</h2>
                <label class="field">
                    <span>Assunto</span>
                    <input v-model="subject" maxlength="150" class="text-input" placeholder="Ex.: Saudade de você, {nome}? Tem cupom aqui" />
                </label>
                <label class="field">
                    <span>Texto</span>
                    <textarea v-model="body" rows="9" maxlength="10000" class="text-input" />
                    <small class="hint"><code>{nome}</code> vira o nome do cliente, ou a alcunha escolhida na lista (vale no assunto também). Links (https://...) ficam clicáveis.</small>
                </label>
                <label class="field">
                    <span>Cupom (opcional)</span>
                    <select v-model="couponId" class="filter-select">
                        <option value="">Sem cupom</option>
                        <option v-for="coupon in activeCoupons" :key="coupon.id" :value="coupon.id">
                            {{ coupon.code }} — {{ couponDiscount(coupon) }}
                        </option>
                    </select>
                </label>

                <h2 class="section-title">Prévia</h2>
                <div class="preview">
                    <div class="preview-header">SecretShopGG</div>
                    <p class="preview-subject">{{ subject.split('{nome}').join(previewName) || 'Sem assunto' }}</p>
                    <div class="preview-body" v-html="previewHtml" />
                    <div v-if="selectedCoupon" class="preview-coupon">
                        <small>Seu cupom · {{ couponDiscount(selectedCoupon) }} off</small>
                        <strong>{{ selectedCoupon.code }}</strong>
                        <small v-if="selectedCoupon.expires_at">Válido até {{ $dayjs(selectedCoupon.expires_at).format('DD/MM/YYYY') }}</small>
                    </div>
                    <div class="preview-cta">Ir para a loja</div>
                    <small class="preview-footer">Rodapé com link de descadastro é adicionado automaticamente.</small>
                </div>
            </section>
        </div>

        <ConfirmActionModal
            v-model:open="confirmOpen"
            title="Enviar campanha?"
            :description="`${selected.size} clientes vão receber “${subject}”${selectedCoupon ? ` com o cupom ${selectedCoupon.code}` : ''}. Os envios saem aos poucos (um a cada 3s) e ninguém recebe mais de um e-mail de campanha por dia.`"
            confirm-label="Enviar"
            loading-label="Enfileirando..."
            icon="mdi:email-fast-outline"
            :delay-seconds="3"
            :loading="sending"
            @confirm="send"
        />
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

.btn-send
    display inline-flex
    align-items center
    gap 0.4rem
    background #6366f1
    color #fff
    border none
    padding 0.6rem 1.2rem
    border-radius 8px
    font-weight 600
    cursor pointer

    &:disabled
        opacity 0.4
        cursor not-allowed

.grid
    display grid
    grid-template-columns repeat(auto-fit, minmax(380px, 1fr))
    gap 1.25rem

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)
    min-width 0

.section-title
    font-size 1rem
    font-weight 600
    margin 0 0 1rem

.filters-row
    display flex
    align-items flex-end
    gap 0.75rem
    flex-wrap wrap

.filter-select, .search-input, .text-input
    background #121214
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.5rem 0.75rem
    font-size 0.875rem
    outline none
    box-sizing border-box

    &:focus
        border-color rgba(99,102,241,0.4)

    option
        background #1a1a1e

.text-input
    width 100%
    font-family inherit
    resize vertical

.hint
    color #64748b
    font-size 0.75rem
    margin 0.5rem 0 0

    &.warn
        color #f59e0b

.recipients-toolbar
    display flex
    align-items center
    justify-content space-between
    gap 0.75rem
    flex-wrap wrap
    margin 1rem 0 0.5rem

.search-input
    flex 1
    min-width 180px

.check-row
    display inline-flex
    align-items center
    gap 0.4rem
    font-size 0.85rem
    cursor pointer

.nickname-bulk
    display flex
    align-items center
    gap 0.5rem
    flex-wrap wrap
    margin-bottom 0.5rem
    font-size 0.85rem
    color #cbd5e1

.btn-apply
    background #2a2a30
    color #fff
    border 1px solid rgba(255,255,255,0.1)
    padding 0.45rem 0.9rem
    border-radius 8px
    font-size 0.85rem
    cursor pointer

    &:hover:not(:disabled)
        background #3a3a42

    &:disabled
        opacity 0.4
        cursor not-allowed

.nickname-select
    background transparent
    border 1px solid rgba(255,255,255,0.08)
    border-radius 6px
    color #94a3b8
    padding 2px 4px
    font-size 0.75rem
    cursor pointer

    &.active
        color #818cf8
        border-color rgba(99,102,241,0.4)

    option
        background #1a1a1e

.recipients
    max-height 420px
    overflow-y auto
    border 1px solid rgba(255,255,255,0.05)
    border-radius 8px

.recipient
    display flex
    align-items center
    gap 0.6rem
    padding 0.55rem 0.75rem
    border-bottom 1px solid rgba(255,255,255,0.04)
    cursor pointer

    &:hover
        background rgba(255,255,255,0.03)

.recipient-info
    display flex
    flex-direction column
    flex 1
    min-width 0

    small
        overflow hidden
        text-overflow ellipsis
        white-space nowrap

.recipient-name
    font-size 0.875rem

.campaign-tag
    --accent #6366f1
    color var(--accent)
    background rgba(255,255,255,0.06)
    padding 2px 8px
    border-radius 6px
    font-size 0.7rem
    font-weight 600
    white-space nowrap

.muted
    color #64748b

.pad
    padding 1rem
    margin 0

.field
    display flex
    flex-direction column
    gap 0.35rem
    margin-bottom 1rem
    font-size 0.85rem
    color #cbd5e1

.preview
    background #f4f4f5
    border-radius 8px
    overflow hidden
    color #27272a

.preview-header
    background #121214
    color #fff
    font-weight 700
    padding 0.85rem 1.25rem

.preview-subject
    font-weight 700
    padding 1rem 1.25rem 0
    margin 0

.preview-body
    padding 0.75rem 1.25rem 1rem
    font-size 0.9rem
    line-height 1.6
    overflow-wrap anywhere

    :deep(a)
        color #6366f1

.preview-coupon
    display flex
    flex-direction column
    align-items center
    gap 0.2rem
    margin 0 1.25rem 1rem
    padding 0.85rem
    border 2px dashed #6366f1
    border-radius 8px

    strong
        font-size 1.4rem
        letter-spacing 2px

    small
        color #71717a

.preview-cta
    width fit-content
    margin 0 auto 1rem
    background #6366f1
    color #fff
    padding 0.6rem 1.4rem
    border-radius 6px
    font-weight 700
    font-size 0.85rem

.preview-footer
    display block
    text-align center
    color #a1a1aa
    font-size 0.7rem
    padding 0 1rem 1rem
</style>
