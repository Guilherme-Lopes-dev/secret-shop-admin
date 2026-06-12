<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { adminService } from '@/services/admin/admin.service'
import { COUNTRIES, countryName } from '@/utils/countries'

const errorMessage = (err: unknown, fallback: string): string => {
    const e = err as { response?: { data?: { message?: string } } }
    return e?.response?.data?.message ?? fallback
}

const loading = ref(true)
const saving = ref(false)
const allowed = ref<string[]>([])
const blocked = ref<string[]>([])
const allowedSelect = ref('')
const blockedSelect = ref('')

// Opções do select, escondendo o que já está na respectiva lista.
const allowedOptions = computed(() => COUNTRIES.filter((c) => !allowed.value.includes(c.code)))
const blockedOptions = computed(() => COUNTRIES.filter((c) => !blocked.value.includes(c.code)))

const addCountry = (list: 'allowed' | 'blocked', code: string) => {
    if (!code) return
    const target = list === 'allowed' ? allowed : blocked
    if (target.value.includes(code)) return
    target.value = [...target.value, code]
    if (list === 'allowed') allowedSelect.value = ''
    else blockedSelect.value = ''
}

const removeCountry = (list: 'allowed' | 'blocked', code: string) => {
    const target = list === 'allowed' ? allowed : blocked
    target.value = target.value.filter((c) => c !== code)
}

const labelFor = (code: string): string => `${code} — ${countryName(code)}`

const load = async () => {
    loading.value = true
    try {
        const res = await adminService.getAntifraudCountryPolicy()
        allowed.value = res.data.allowed ?? []
        blocked.value = res.data.blocked ?? []
    } catch (err) {
        toast.error(errorMessage(err, 'Falha ao carregar a política de país.'))
    } finally {
        loading.value = false
    }
}

const save = async () => {
    saving.value = true
    try {
        const res = await adminService.setAntifraudCountryPolicy({
            allowed: allowed.value,
            blocked: blocked.value,
        })
        allowed.value = res.data.allowed ?? []
        blocked.value = res.data.blocked ?? []
        toast.success('Política de país atualizada.')
    } catch (err) {
        toast.error(errorMessage(err, 'Falha ao salvar a política de país.'))
    } finally {
        saving.value = false
    }
}

onMounted(load)
</script>

<template>
    <section class="antifraud-policy">
        <header class="page-head">
            <div>
                <h1>Antifraude — Política de País</h1>
                <p class="subtitle">
                    Define como o motor de risco trata o país de origem do IP na compra.
                </p>
            </div>
            <button class="btn-save" :disabled="saving || loading" @click="save">
                <Icon icon="mdi:content-save" /> {{ saving ? 'Salvando…' : 'Salvar' }}
            </button>
        </header>

        <div v-if="loading" class="loading">
            <Icon icon="mdi:loading" class="spin" /> Carregando…
        </div>

        <div v-else class="cards">
            <!-- Allowlist -->
            <article class="card allow">
                <div class="card-head">
                    <Icon icon="mdi:check-decagram" />
                    <div>
                        <h2>Países permitidos</h2>
                        <p>Compra de fora desta lista é restrita a <strong>PIX</strong> (sem chargeback).</p>
                    </div>
                </div>

                <div class="chips">
                    <span v-for="code in allowed" :key="code" class="chip">
                        {{ labelFor(code) }}
                        <button @click="removeCountry('allowed', code)"><Icon icon="mdi:close" /></button>
                    </span>
                    <span v-if="!allowed.length" class="empty">Nenhum país — todas as compras seriam restritas a PIX.</span>
                </div>

                <div class="add-row">
                    <select v-model="allowedSelect" @change="addCountry('allowed', allowedSelect)">
                        <option value="" disabled>Selecione um país…</option>
                        <option v-for="c in allowedOptions" :key="c.code" :value="c.code">
                            {{ c.code }} — {{ c.name }}
                        </option>
                    </select>
                </div>
            </article>

            <!-- Blocklist -->
            <article class="card block">
                <div class="card-head">
                    <Icon icon="mdi:cancel" />
                    <div>
                        <h2>Países bloqueados</h2>
                        <p>Bloqueio imediato em <strong>qualquer</strong> método de pagamento.</p>
                    </div>
                </div>

                <div class="chips">
                    <span v-for="code in blocked" :key="code" class="chip danger">
                        {{ labelFor(code) }}
                        <button @click="removeCountry('blocked', code)"><Icon icon="mdi:close" /></button>
                    </span>
                    <span v-if="!blocked.length" class="empty">Nenhum país bloqueado.</span>
                </div>

                <div class="add-row">
                    <select v-model="blockedSelect" @change="addCountry('blocked', blockedSelect)">
                        <option value="" disabled>Selecione um país…</option>
                        <option v-for="c in blockedOptions" :key="c.code" :value="c.code">
                            {{ c.code }} — {{ c.name }}
                        </option>
                    </select>
                </div>
            </article>
        </div>
    </section>
</template>

<style lang="stylus" scoped>
.antifraud-policy
    padding 24px
    color #e6e9ef

.page-head
    display flex
    align-items flex-start
    justify-content space-between
    gap 16px
    margin-bottom 24px
    h1
        font-size 22px
        font-weight 700
    .subtitle
        color #9aa3b2
        font-size 14px
        margin-top 4px

.btn-save
    display inline-flex
    align-items center
    gap 6px
    background #4b69ff
    color #fff
    border none
    border-radius 8px
    padding 10px 16px
    font-weight 600
    cursor pointer
    &:disabled
        opacity .6
        cursor not-allowed

.loading
    display flex
    align-items center
    gap 8px
    color #9aa3b2
    .spin
        animation spin 1s linear infinite
@keyframes spin
    to
        transform rotate(360deg)

.cards
    display grid
    grid-template-columns repeat(auto-fit, minmax(320px, 1fr))
    gap 20px

.card
    background #161b26
    border 1px solid #232a38
    border-radius 12px
    padding 20px
    &.allow
        border-top 3px solid #3fb950
    &.block
        border-top 3px solid #eb4b4b

.card-head
    display flex
    gap 12px
    margin-bottom 16px
    svg
        font-size 28px
        flex-shrink 0
    h2
        font-size 16px
        font-weight 700
    p
        color #9aa3b2
        font-size 13px
        margin-top 2px

.chips
    display flex
    flex-wrap wrap
    gap 8px
    min-height 36px
    margin-bottom 14px

.chip
    display inline-flex
    align-items center
    gap 6px
    background #232a38
    border-radius 6px
    padding 5px 10px
    font-weight 600
    font-size 13px
    letter-spacing .5px
    &.danger
        background #3a1f24
        color #ff8a8a
    button
        display inline-flex
        background none
        border none
        color inherit
        opacity .6
        cursor pointer
        &:hover
            opacity 1

.empty
    color #6b7280
    font-size 13px
    font-style italic

.add-row
    display flex
    gap 8px
    select
        width 100%
        background #0e1118
        border 1px solid #2a3242
        border-radius 6px
        padding 9px 12px
        color #e6e9ef
        font-weight 500
        cursor pointer
        &:hover
            border-color #3a4254
        &:focus
            outline none
            border-color #4b69ff
</style>
