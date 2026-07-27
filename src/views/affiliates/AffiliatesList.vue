<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import {
    affiliatesService,
    describeCents,
    describeRate,
    optionalInt,
    type AffiliateRow,
} from '@/services/affiliates/affiliates.service'
import { adminService } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'

// `id` aqui é o uuid do usuário — o backend serializa `uuid` como `id`.
interface FoundUser {
    id: string
    username: string | null
    avatar: string | null
    steam_id: string | null
}

const route = useRoute()
const router = useRouter()
const affiliates = ref<AffiliateRow[]>([])
const loading = ref(true)
const search = ref('')

const creating = ref(false)
const saving = ref(false)
const form = ref({
    displayName: '',
    document: '',
    pixKey: '',
    rateNewBps: '' as string | number,
    rateReturningBps: '' as string | number,
    monthlyCap: '' as string | number,
})

const fetchAffiliates = async () => {
    loading.value = true
    try {
        const response = await affiliatesService.list(search.value.trim() || undefined)
        affiliates.value = response.data ?? []
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao carregar afiliados.')
    } finally {
        loading.value = false
    }
}

const steamIdInput = ref('')
const foundUser = ref<FoundUser | null>(null)
const searchingUser = ref(false)

/** Aceita o ID cru ou a URL do perfil — o Steam64 é sempre a sequência de 17 dígitos. */
const normalizeSteamId = (raw: string) => raw.match(/\d{17}/)?.[0] || raw.trim()

const clearFoundUser = () => {
    foundUser.value = null
}

// O id vem do usuário selecionado — sem ele não existe cadastro, então nada de campo solto.
const selectUser = (user: FoundUser) => {
    if (!user?.id) return toast.error('Usuário sem id na resposta da API.')

    foundUser.value = user
    if (!form.value.displayName.trim()) form.value.displayName = user.username ?? ''
}

const findUserBySteamId = async () => {
    const steamId = normalizeSteamId(steamIdInput.value)
    if (!steamId) return toast.error('Informe o Steam ID.')

    searchingUser.value = true
    try {
        const response = await adminService.getAllUsers(1, 10, steamId)
        const users: FoundUser[] = response.data?.data ?? []
        const match = users.find((user) => user.steam_id === steamId)
        if (!match) return toast.error('Nenhum usuário com esse Steam ID.')

        selectUser(match)
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao buscar usuário.')
    } finally {
        searchingUser.value = false
    }
}

const submit = async () => {
    const userId = foundUser.value?.id
    if (!userId) return toast.error('Busque o usuário pelo Steam ID.')
    if (!form.value.displayName.trim()) return toast.error('Informe o nome de exibição.')
    if (!form.value.document.trim()) return toast.error('Informe o CPF/CNPJ.')

    saving.value = true
    try {
        await affiliatesService.create({
            userId,
            displayName: form.value.displayName.trim(),
            document: form.value.document.trim(),
            pixKey: form.value.pixKey.trim() || null,
            rateNewBps: optionalInt(form.value.rateNewBps),
            rateReturningBps: optionalInt(form.value.rateReturningBps),
            monthlyCap: optionalInt(form.value.monthlyCap),
        })
        toast.success('Afiliado cadastrado. Papel concedido ao usuário.')
        creating.value = false
        form.value = { displayName: '', document: '', pixKey: '', rateNewBps: '', rateReturningBps: '', monthlyCap: '' }
        steamIdInput.value = ''
        foundUser.value = null
        await fetchAffiliates()
    } catch (e: any) {
        toast.error(e?.response?.data?.message || 'Erro ao cadastrar afiliado.')
    } finally {
        saving.value = false
    }
}

const rateLabel = (bps: number | null) => (bps === null ? 'global' : `${(bps / 100).toFixed(2)}%`)

// Chegando da tela do usuário: já abre o formulário com ele selecionado.
const prefillFromQuery = async () => {
    const userId = route.query.userId
    if (typeof userId !== 'string') return

    creating.value = true
    try {
        const response = await adminService.getUserById(userId)
        if (response.data) selectUser(response.data as FoundUser)
        steamIdInput.value = response.data?.steam_id ?? ''
    } catch {
        toast.error('Não consegui carregar o usuário. Busque pelo Steam ID.')
    }
}

onMounted(() => {
    void prefillFromQuery()
    void fetchAffiliates()
})
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Afiliados</h1>
                <p class="page-subtitle">Criadores que divulgam links e recebem comissão em PIX.</p>
            </div>
            <div class="header-actions">
                <button class="btn-ghost" @click="router.push('/affiliates/commissions')">
                    <Icon icon="mdi:cash-multiple" /> Comissões
                </button>
                <button class="btn-ghost" @click="router.push('/affiliates/payouts')">
                    <Icon icon="mdi:bank-transfer-out" /> Payouts
                </button>
                <button class="btn-ghost" @click="router.push('/affiliates/config')">
                    <Icon icon="mdi:cog-outline" /> Config
                </button>
                <button class="btn-primary" @click="creating = !creating">
                    <Icon :icon="creating ? 'mdi:close' : 'mdi:plus'" />
                    {{ creating ? 'Cancelar' : 'Novo afiliado' }}
                </button>
            </div>
        </header>

        <section v-if="creating" class="panel">
            <h2 class="panel-title">Cadastrar afiliado</h2>
            <p class="panel-hint">
                Busque o usuário pelo Steam ID (ou cole a URL do perfil). Taxas em branco herdam o default global.
            </p>

            <div v-if="foundUser" class="picked-user">
                <div class="who">
                    <img v-if="foundUser.avatar" :src="foundUser.avatar" alt="" />
                    <div>
                        <strong>{{ foundUser.username || 'sem nome' }}</strong>
                        <span class="muted">{{ foundUser.steam_id || 'sem steam id' }}</span>
                    </div>
                </div>
                <button class="btn-ghost" @click="clearFoundUser">
                    <Icon icon="mdi:close" /> Trocar
                </button>
            </div>

            <div v-else class="search-row">
                <input
                    v-model="steamIdInput"
                    placeholder="Steam ID (76561198...)"
                    @keyup.enter="findUserBySteamId"
                />
                <button class="btn-ghost" :disabled="searchingUser" @click="findUserBySteamId">
                    <Icon icon="mdi:account-search" />
                    {{ searchingUser ? 'Buscando...' : 'Buscar usuário' }}
                </button>
            </div>

            <div class="form-grid">
                <label class="field">
                    <span>Nome de exibição</span>
                    <input v-model="form.displayName" placeholder="Fulano Gameplays" />
                </label>
                <label class="field">
                    <span>CPF / CNPJ</span>
                    <input v-model="form.document" placeholder="000.000.000-00" />
                </label>
                <label class="field">
                    <span>Chave PIX</span>
                    <input v-model="form.pixKey" placeholder="chave@email.com" />
                </label>
                <label class="field">
                    <span>% cliente novo (bps)</span>
                    <input v-model="form.rateNewBps" type="number" placeholder="800 = 8%" />
                    <small class="field-hint">{{ describeRate(form.rateNewBps) }}</small>
                </label>
                <label class="field">
                    <span>% cliente antigo (bps)</span>
                    <input v-model="form.rateReturningBps" type="number" placeholder="300 = 3%" />
                    <small class="field-hint">{{ describeRate(form.rateReturningBps) }}</small>
                </label>
                <label class="field">
                    <span>Teto mensal (centavos)</span>
                    <input v-model="form.monthlyCap" type="number" placeholder="vazio = sem teto" />
                    <small class="field-hint">{{ describeCents(form.monthlyCap, 'Sem teto por ciclo.') }}</small>
                </label>
            </div>
            <button class="btn-primary" :disabled="saving || !foundUser" @click="submit">
                {{ saving ? 'Salvando...' : 'Cadastrar' }}
            </button>
        </section>

        <div class="search-row">
            <input v-model="search" placeholder="Buscar por nome..." @keyup.enter="fetchAffiliates" />
            <button class="btn-ghost" @click="fetchAffiliates"><Icon icon="mdi:magnify" /> Buscar</button>
        </div>

        <div v-if="loading" class="state">Carregando...</div>
        <div v-else-if="!affiliates.length" class="state">Nenhum afiliado cadastrado.</div>

        <div v-else class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Afiliado</th>
                        <th>Status</th>
                        <th>% novo</th>
                        <th>% antigo</th>
                        <th>Pendente</th>
                        <th>Liberado</th>
                        <th>Pago</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="affiliate in affiliates"
                        :key="affiliate.id"
                        class="clickable-row"
                        @click="router.push(`/affiliates/${affiliate.id}`)"
                    >
                        <td>
                            <div class="who">
                                <img v-if="affiliate.avatar" :src="affiliate.avatar" alt="" />
                                <div>
                                    <strong>{{ affiliate.displayName }}</strong>
                                    <span class="muted">{{ affiliate.username || '—' }}</span>
                                </div>
                            </div>
                        </td>
                        <td>
                            <span class="badge" :class="affiliate.status === 'ACTIVE' ? 'badge--ok' : 'badge--off'">
                                {{ affiliate.status === 'ACTIVE' ? 'Ativo' : 'Suspenso' }}
                            </span>
                        </td>
                        <td>{{ rateLabel(affiliate.rateNewBps) }}</td>
                        <td>{{ rateLabel(affiliate.rateReturningBps) }}</td>
                        <td class="muted">{{ formatCurrency(affiliate.balances.pending) }}</td>
                        <td class="accent">{{ formatCurrency(affiliate.balances.approved) }}</td>
                        <td>{{ formatCurrency(affiliate.balances.paid) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<style lang="stylus" scoped>
@import './affiliates.styl'
</style>
