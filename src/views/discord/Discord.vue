<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { adminService } from '@/services/admin/admin.service'
import type {
    DiscordAuditLogDto,
    DiscordBotChannelDto,
    DiscordBotGuildDto,
    DiscordChannelDto,
    DiscordGuildDto,
    DiscordHealthDto,
    DiscordMeDto,
    DiscordMemberDto,
    DiscordModerationPayload,
    DiscordRoleDto,
} from '@/services/admin/types'

type TabKey =
    | 'overview'
    | 'messages'
    | 'guilds'
    | 'channels'
    | 'roles'
    | 'members'
    | 'moderation'
    | 'commands'
    | 'webhooks'
    | 'audit'

const API_URL = import.meta.env.VITE_API_URL?.trim() || ''
const DISCORD_SNOWFLAKE_PATTERN = /^\d{16,32}$/

const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
    { key: 'overview', label: 'Overview', icon: 'mdi:view-dashboard-outline' },
    { key: 'messages', label: 'Mensagens', icon: 'mdi:message-text-outline' },
    { key: 'guilds', label: 'Guilds', icon: 'mdi:server-network' },
    { key: 'channels', label: 'Canais', icon: 'mdi:pound' },
    { key: 'roles', label: 'Roles', icon: 'mdi:shield-account-outline' },
    { key: 'members', label: 'Membros', icon: 'mdi:account-group-outline' },
    { key: 'moderation', label: 'Moderacao', icon: 'mdi:gavel' },
    { key: 'commands', label: 'Slash Commands', icon: 'mdi:slash-forward' },
    { key: 'webhooks', label: 'Webhooks', icon: 'mdi:webhook' },
    { key: 'audit', label: 'Auditoria', icon: 'mdi:clipboard-text-clock-outline' },
]

const activeTab = ref<TabKey>('overview')
const loading = ref(false)
const selectedGuildId = ref('')
const memberSearch = ref('')

const health = ref<DiscordHealthDto | null>(null)
const me = ref<DiscordMeDto | null>(null)
const guilds = ref<DiscordGuildDto[]>([])
const botGuilds = ref<DiscordBotGuildDto[]>([])
const botChannels = ref<DiscordBotChannelDto[]>([])
const savedChannels = ref<DiscordChannelDto[]>([])
const channels = ref<DiscordChannelDto[]>([])
const roles = ref<DiscordRoleDto[]>([])
const members = ref<DiscordMemberDto[]>([])
const auditLogs = ref<DiscordAuditLogDto[]>([])
const metrics = ref('')
const lastResponse = ref('')

const messageForm = reactive({
    channelId: '',
    content: '',
    queue: true,
})

const channelForm = reactive({
    guildId: '',
    channelId: '',
    name: '',
    type: 0,
    parentId: '',
    topic: '',
    nsfw: false,
})

const roleForm = reactive({
    guildId: '',
    roleId: '',
    name: '',
    color: 5867519,
    permissions: '',
    hoist: false,
    mentionable: false,
})

const roleMemberForm = reactive({
    guildId: '',
    userId: '',
    roleId: '',
})

const moderationForm = reactive<DiscordModerationPayload>({
    action: 'timeout',
    guildId: '',
    userId: '',
    reason: '',
    timeoutMinutes: 60,
    deleteMessageDays: 0,
    queue: true,
})

const commandForm = reactive({
    name: 'status',
    description: 'Mostra o status da Secret Shop.',
    guildId: '',
    defaultMemberPermissions: '',
    dmPermission: false,
    optionsJson: '',
})

const webhookForm = reactive({
    channelId: '',
    name: 'Secret Shop Alerts',
    avatar: '',
})

const oauthLoginUrl = computed(() => buildApiUrl('/auth/discord/login'))
const oauthLinkUrl = computed(() => buildApiUrl('/auth/discord/link'))
const interactionsUrl = computed(() => buildApiUrl('/webhooks/discord/interactions'))

const selectedGuild = computed(() =>
    guilds.value.find((guild) => guild.discord_id === selectedGuildId.value) ?? null,
)

const guildOptions = computed(() => {
    const seen = new Set<string>()
    const syncedGuilds = guilds.value
        .map((guild) => ({
            id: guildDiscordId(guild),
            name: guild.name,
            synced: true,
        }))
        .filter((guild) => Boolean(guild.id))
    const liveGuilds = botGuilds.value.map((guild) => ({
        id: guild.id,
        name: guild.name,
        synced: guild.synced,
    })).filter((guild) => Boolean(toDiscordSnowflake(guild.id)))

    return [...syncedGuilds, ...liveGuilds].filter((guild) => {
        if (seen.has(guild.id)) return false
        seen.add(guild.id)
        return true
    })
})

const savedChannelOptions = computed(() =>
    savedChannels.value
        .map((channel) => ({
            id: channelDiscordId(channel),
            name: channel.name,
            guildName: channel.guild?.name ?? guildNameForId(channel.guild?.discord_id),
        }))
        .filter((channel) => Boolean(channel.id)),
)

const summaryCards = computed(() => [
    {
        label: 'Guilds',
        value: guilds.value.length,
        icon: 'mdi:server-network',
        status: 'neutral',
    },
    {
        label: 'Canais',
        value: savedChannels.value.length,
        icon: 'mdi:pound',
        status: 'neutral',
    },
    {
        label: 'Roles',
        value: roles.value.length,
        icon: 'mdi:shield-account-outline',
        status: 'neutral',
    },
    {
        label: 'Membros',
        value: members.value.length,
        icon: 'mdi:account-group-outline',
        status: 'neutral',
    },
])

const errorMessage = (err: unknown, fallback: string): string => {
    const candidate = err as { response?: { data?: { message?: string } } }
    return candidate.response?.data?.message ?? fallback
}

function buildApiUrl(path: string) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    if (!API_URL) return normalizedPath
    return `${API_URL.replace(/\/$/, '')}${normalizedPath}`
}

function formatDate(value?: string | null) {
    if (!value) return '-'
    return new Date(value).toLocaleString('pt-BR')
}

function formatJson(value: unknown) {
    if (value === null || value === undefined || value === '') return '-'
    try {
        return JSON.stringify(value, null, 2)
    } catch {
        return String(value)
    }
}

function recordResponse(label: string, payload: unknown) {
    lastResponse.value = `${label}\n${formatJson(payload)}`
}

function toDiscordSnowflake(value: unknown) {
    if (typeof value !== 'string') return ''

    const normalized = value.trim()
    return DISCORD_SNOWFLAKE_PATTERN.test(normalized) ? normalized : ''
}

function channelDiscordId(channel: DiscordChannelDto) {
    const fallback = (channel as unknown as { discordId?: unknown }).discordId
    return toDiscordSnowflake(channel.discord_id) || toDiscordSnowflake(fallback)
}

function guildDiscordId(guild: DiscordGuildDto) {
    const fallback = (guild as unknown as { discordId?: unknown }).discordId
    return toDiscordSnowflake(guild.discord_id) || toDiscordSnowflake(fallback)
}

function guildNameForId(guildId?: string | null) {
    if (!guildId) return 'Guild nao identificada'

    const syncedGuild = guilds.value.find((guild) => guild.discord_id === guildId)
    if (syncedGuild) return syncedGuild.name

    const liveGuild = botGuilds.value.find((guild) => guild.id === guildId)
    return liveGuild?.name ?? guildId
}

function mergeSavedChannels(nextChannels: DiscordChannelDto[]) {
    const byDiscordId = new Map<string, DiscordChannelDto>()

    savedChannels.value.forEach((channel) => {
        const discordId = channelDiscordId(channel)
        if (discordId) byDiscordId.set(discordId, channel)
    })
    nextChannels.forEach((channel) => {
        const discordId = channelDiscordId(channel)
        if (discordId) byDiscordId.set(discordId, channel)
    })

    savedChannels.value = Array.from(byDiscordId.values()).sort((left, right) => {
        const leftGuild = left.guild?.name ?? ''
        const rightGuild = right.guild?.name ?? ''
        const guildCompare = leftGuild.localeCompare(rightGuild)
        if (guildCompare !== 0) return guildCompare

        return (left.name ?? left.discord_id).localeCompare(right.name ?? right.discord_id)
    })
}

function applyGuildId(guildId: string) {
    const discordGuildId = toDiscordSnowflake(guildId)
    if (!discordGuildId) {
        selectedGuildId.value = ''
        return
    }

    const previousGuildId = selectedGuildId.value
    selectedGuildId.value = discordGuildId
    channelForm.guildId = discordGuildId
    roleForm.guildId = discordGuildId
    roleMemberForm.guildId = discordGuildId
    moderationForm.guildId = discordGuildId
    commandForm.guildId = discordGuildId

    if (previousGuildId !== discordGuildId) {
        botChannels.value = []
    }
}

async function selectGuild(guildId: string) {
    const discordGuildId = toDiscordSnowflake(guildId)
    if (!discordGuildId) {
        toast.warning('Selecione uma guild valida.')
        return
    }

    applyGuildId(discordGuildId)
    await loadGuildDetails(false)
    await loadBotChannels()
}

function onGuildSelect(event: Event) {
    if (!(event.target instanceof HTMLSelectElement)) return
    const guildId = event.target.value
    void runSafely(() => selectGuild(guildId))
}

function onMessageChannelSelect(event: Event) {
    if (!(event.target instanceof HTMLSelectElement)) return

    const channelId = toDiscordSnowflake(event.target.value)
    if (!channelId) {
        applyChannelId('')
        return
    }

    applyChannelId(channelId)
}

function applyChannelId(channelId: string) {
    const discordChannelId = toDiscordSnowflake(channelId)
    messageForm.channelId = discordChannelId
    channelForm.channelId = discordChannelId
    webhookForm.channelId = discordChannelId
}

function applyRoleId(roleId: string) {
    roleForm.roleId = roleId
    roleMemberForm.roleId = roleId
}

function applyMemberId(userId: string) {
    roleMemberForm.userId = userId
    moderationForm.userId = userId
}

async function withLoading<T>(action: () => Promise<T>) {
    loading.value = true
    try {
        return await action()
    } finally {
        loading.value = false
    }
}

async function loadOverview() {
    await withLoading(async () => {
        const [healthRes, meRes, guildsRes, botGuildsRes, savedChannelsRes] = await Promise.allSettled([
            adminService.getDiscordHealth(),
            adminService.getDiscordMe(),
            adminService.getDiscordGuilds(),
            adminService.getDiscordBotGuilds(),
            adminService.getDiscordAllChannels(),
        ])

        if (healthRes.status === 'fulfilled') health.value = healthRes.value.data
        if (meRes.status === 'fulfilled') me.value = meRes.value.data
        if (guildsRes.status === 'fulfilled') guilds.value = guildsRes.value.data ?? []
        if (botGuildsRes.status === 'fulfilled') botGuilds.value = botGuildsRes.value.data ?? []
        if (savedChannelsRes.status === 'fulfilled') savedChannels.value = savedChannelsRes.value.data ?? []

        if (!selectedGuildId.value && guilds.value[0]) {
            applyGuildId(guilds.value[0].discord_id)
            await loadGuildDetails(false)
            return
        }

        if (!selectedGuildId.value && botGuilds.value[0]) {
            applyGuildId(botGuilds.value[0].id)
        }
    })
}

async function loadDiscordMe() {
    await withLoading(async () => {
        const { data } = await adminService.getDiscordMe()
        me.value = data
        recordResponse('GET /discord/me', data)
    })
}

async function unlinkDiscordMe() {
    if (!confirm('Desvincular a conta Discord do usuario logado?')) return
    await withLoading(async () => {
        const { data } = await adminService.unlinkDiscordMe()
        me.value = { linked: false, account: null }
        toast.success('Conta Discord desvinculada.')
        recordResponse('DELETE /discord/me', data)
    })
}

async function loadGuilds() {
    await withLoading(async () => {
        const [guildsRes, channelsRes] = await Promise.all([
            adminService.getDiscordGuilds(),
            adminService.getDiscordAllChannels(),
        ])
        guilds.value = guildsRes.data ?? []
        savedChannels.value = channelsRes.data ?? []
        if (!selectedGuildId.value && guilds.value[0]) applyGuildId(guilds.value[0].discord_id)
        recordResponse('GET /admin/discord/guilds', guildsRes.data)
    })
}

async function loadBotGuilds() {
    await withLoading(async () => {
        const { data } = await adminService.getDiscordBotGuilds()
        botGuilds.value = data ?? []
        if (!selectedGuildId.value && botGuilds.value[0]) applyGuildId(botGuilds.value[0].id)
        recordResponse('GET /admin/discord/bot/guilds', data)
    })
}

async function loadGuildDetails(showToast = true) {
    if (!selectedGuildId.value) {
        if (showToast) toast.warning('Selecione uma guild.')
        return
    }

    await withLoading(async () => {
        const [channelsRes, rolesRes, membersRes] = await Promise.all([
            adminService.getDiscordChannels(selectedGuildId.value),
            adminService.getDiscordRoles(selectedGuildId.value),
            adminService.getDiscordMembers(selectedGuildId.value, memberSearch.value.trim() || undefined),
        ])

        channels.value = channelsRes.data ?? []
        mergeSavedChannels(channels.value)
        roles.value = rolesRes.data ?? []
        members.value = membersRes.data ?? []
        recordResponse('GET guild details', {
            channels: channels.value.length,
            roles: roles.value.length,
            members: members.value.length,
        })
    })
}

watch(memberSearch, (value, previous) => {
    if (value !== '' || previous === '') return
    if (!selectedGuildId.value) return
    runSafely(() => loadGuildDetails(false))
})

async function loadSavedChannels() {
    await withLoading(async () => {
        const { data } = await adminService.getDiscordAllChannels()
        savedChannels.value = data ?? []
        recordResponse('GET /admin/discord/channels', data)
    })
}

async function loadBotChannels() {
    if (!selectedGuildId.value) {
        toast.warning('Selecione uma guild.')
        return
    }

    await withLoading(async () => {
        const { data } = await adminService.getDiscordBotChannels(selectedGuildId.value)
        botChannels.value = data ?? []
        recordResponse(`GET /admin/discord/bot/guilds/${selectedGuildId.value}/channels`, data)
    })
}

async function syncSelectedGuild(queue = true) {
    if (!selectedGuildId.value) {
        toast.warning('Selecione uma guild.')
        return
    }

    await withLoading(async () => {
        const { data } = await adminService.syncDiscordGuild(selectedGuildId.value, queue)
        toast.success(queue ? 'Sync enfileirado.' : 'Sync executado.')
        recordResponse(`POST /admin/discord/guilds/${selectedGuildId.value}/sync`, data)
    })

    if (!queue) {
        await loadGuildDetails(false)
        await loadSavedChannels()
    }
}

async function sendMessage() {
    const channelId = toDiscordSnowflake(messageForm.channelId)
    if (!channelId || !messageForm.content) {
        toast.warning('Informe canal e conteudo.')
        return
    }

    await withLoading(async () => {
        const { data } = await adminService.sendDiscordMessage({
            channelId,
            content: messageForm.content,
            queue: messageForm.queue,
        })
        toast.success(messageForm.queue ? 'Mensagem enfileirada.' : 'Mensagem enviada.')
        recordResponse('POST /admin/discord/messages', data)
    })
}

async function createChannel() {
    if (!channelForm.guildId || !channelForm.name) {
        toast.warning('Informe guild e nome do canal.')
        return
    }

    await withLoading(async () => {
        const { data } = await adminService.createDiscordChannel({
            guildId: channelForm.guildId,
            name: channelForm.name,
            type: channelForm.type,
            parentId: channelForm.parentId || undefined,
            topic: channelForm.topic || undefined,
            nsfw: channelForm.nsfw,
        })
        toast.success('Canal criado.')
        recordResponse('POST /admin/discord/channels', data)
    })
}

async function updateChannel() {
    if (!channelForm.channelId) {
        toast.warning('Informe channelId.')
        return
    }

    await withLoading(async () => {
        const { data } = await adminService.updateDiscordChannel(channelForm.channelId, {
            name: channelForm.name || undefined,
            parentId: channelForm.parentId || undefined,
            topic: channelForm.topic || undefined,
            nsfw: channelForm.nsfw,
        })
        toast.success('Canal atualizado.')
        recordResponse(`PATCH /admin/discord/channels/${channelForm.channelId}`, data)
    })
}

async function deleteChannel() {
    if (!channelForm.channelId) {
        toast.warning('Informe channelId.')
        return
    }
    if (!confirm(`Remover canal ${channelForm.channelId}?`)) return

    await withLoading(async () => {
        const { data } = await adminService.deleteDiscordChannel(channelForm.channelId)
        toast.success('Canal removido.')
        recordResponse(`DELETE /admin/discord/channels/${channelForm.channelId}`, data)
    })
}

async function createRole() {
    if (!roleForm.guildId || !roleForm.name) {
        toast.warning('Informe guild e nome da role.')
        return
    }

    await withLoading(async () => {
        const { data } = await adminService.createDiscordRole({
            guildId: roleForm.guildId,
            name: roleForm.name,
            color: roleForm.color,
            permissions: roleForm.permissions || undefined,
            hoist: roleForm.hoist,
            mentionable: roleForm.mentionable,
        })
        toast.success('Role criada.')
        recordResponse('POST /admin/discord/roles', data)
    })
}

async function updateRole() {
    if (!roleForm.guildId || !roleForm.roleId) {
        toast.warning('Informe guildId e roleId.')
        return
    }

    await withLoading(async () => {
        const { data } = await adminService.updateDiscordRole(roleForm.guildId, roleForm.roleId, {
            name: roleForm.name || undefined,
            color: roleForm.color,
            permissions: roleForm.permissions || undefined,
            hoist: roleForm.hoist,
            mentionable: roleForm.mentionable,
        })
        toast.success('Role atualizada.')
        recordResponse(`PATCH /admin/discord/guilds/${roleForm.guildId}/roles/${roleForm.roleId}`, data)
    })
}

async function deleteRole() {
    if (!roleForm.guildId || !roleForm.roleId) {
        toast.warning('Informe guildId e roleId.')
        return
    }
    if (!confirm(`Remover role ${roleForm.roleId}?`)) return

    await withLoading(async () => {
        const { data } = await adminService.deleteDiscordRole(roleForm.guildId, roleForm.roleId)
        toast.success('Role removida.')
        recordResponse(`DELETE /admin/discord/guilds/${roleForm.guildId}/roles/${roleForm.roleId}`, data)
    })
}

async function assignRole() {
    if (!roleMemberForm.guildId || !roleMemberForm.userId || !roleMemberForm.roleId) {
        toast.warning('Informe guild, usuario e role.')
        return
    }

    await withLoading(async () => {
        const { data } = await adminService.assignDiscordRole({ ...roleMemberForm })
        toast.success('Role atribuida.')
        recordResponse('POST /admin/discord/roles/assign', data)
    })
}

async function removeRole() {
    if (!roleMemberForm.guildId || !roleMemberForm.userId || !roleMemberForm.roleId) {
        toast.warning('Informe guild, usuario e role.')
        return
    }

    await withLoading(async () => {
        const { data } = await adminService.removeDiscordRole({ ...roleMemberForm })
        toast.success('Role removida do membro.')
        recordResponse('POST /admin/discord/roles/remove', data)
    })
}

async function moderateMember() {
    if (!moderationForm.guildId || !moderationForm.userId) {
        toast.warning('Informe guild e usuario.')
        return
    }

    await withLoading(async () => {
        const { data } = await adminService.moderateDiscordMember({
            ...moderationForm,
            reason: moderationForm.reason || undefined,
            timeoutMinutes:
                moderationForm.action === 'timeout'
                    ? moderationForm.timeoutMinutes
                    : undefined,
            deleteMessageDays:
                moderationForm.action === 'ban'
                    ? moderationForm.deleteMessageDays
                    : undefined,
        })
        toast.success(moderationForm.queue ? 'Moderacao enfileirada.' : 'Moderacao aplicada.')
        recordResponse('POST /admin/discord/moderation', data)
    })
}

async function registerSlashCommand() {
    if (!commandForm.name || !commandForm.description) {
        toast.warning('Informe nome e descricao.')
        return
    }

    const options = parseJsonArray(commandForm.optionsJson)
    if (options === null) return

    await withLoading(async () => {
        const { data } = await adminService.registerDiscordSlashCommand({
            name: commandForm.name,
            description: commandForm.description,
            guildId: commandForm.guildId || undefined,
            defaultMemberPermissions: commandForm.defaultMemberPermissions || undefined,
            dmPermission: commandForm.dmPermission,
            options,
        })
        toast.success('Slash command salvo e registrado.')
        recordResponse('POST /admin/discord/slash-commands', data)
    })
}

async function registerCommandScope() {
    await withLoading(async () => {
        const { data } = await adminService.registerDiscordCommandScope(commandForm.guildId || undefined)
        toast.success('Registro de comandos enfileirado.')
        recordResponse('POST /admin/discord/slash-commands/register-scope', data)
    })
}

function parseJsonArray(raw: string): Record<string, unknown>[] | undefined | null {
    if (!raw.trim()) return undefined

    try {
        const parsed = JSON.parse(raw) as unknown
        if (!Array.isArray(parsed)) {
            toast.error('Options precisa ser um array JSON.')
            return null
        }

        return parsed as Record<string, unknown>[]
    } catch {
        toast.error('JSON de options invalido.')
        return null
    }
}

async function createWebhook() {
    if (!webhookForm.channelId || !webhookForm.name) {
        toast.warning('Informe canal e nome do webhook.')
        return
    }

    await withLoading(async () => {
        const { data } = await adminService.createDiscordWebhook({
            channelId: webhookForm.channelId,
            name: webhookForm.name,
            avatar: webhookForm.avatar || undefined,
        })
        toast.success('Webhook criado.')
        recordResponse('POST /admin/discord/webhooks', data)
    })
}

async function loadAudit() {
    await withLoading(async () => {
        const { data } = await adminService.getDiscordAudit(100)
        auditLogs.value = data ?? []
        recordResponse('GET /admin/discord/audit', data)
    })
}

async function loadMetrics() {
    await withLoading(async () => {
        const { data } = await adminService.getDiscordMetrics()
        metrics.value = data
        recordResponse('GET /admin/discord/metrics', data)
    })
}

async function copy(value: string) {
    if (!value) return
    await navigator.clipboard.writeText(value)
    toast.success('Copiado.')
}

async function runSafely(action: () => Promise<void>) {
    try {
        await action()
    } catch (err) {
        toast.error(errorMessage(err, 'Falha ao executar chamada Discord.'))
    }
}

onMounted(() => {
    void runSafely(loadOverview)
})
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <p class="eyebrow">Integracao operacional</p>
                <h1 class="page-title">Discord</h1>
                <p class="page-subtitle">Console para testar e operar tudo que o modulo Discord expõe no backend.</p>
            </div>
            <div class="header-actions">
                <a class="btn-secondary" :href="oauthLoginUrl">
                    <Icon icon="mdi:login" />
                    Login OAuth
                </a>
                <a class="btn-primary" :href="oauthLinkUrl">
                    <Icon icon="mdi:link-variant" />
                    Vincular Discord
                </a>
            </div>
        </header>

        <section class="hero-grid">
            <div class="hero-card hero-card--wide">
                <div class="hero-card__top">
                    <Icon icon="mdi:discord" class="hero-icon" />
                    <div>
                        <span class="muted">Healthcheck</span>
                        <h2>{{ health?.enabled ? 'Modulo habilitado' : 'Modulo desabilitado' }}</h2>
                    </div>
                </div>
                <div class="status-grid">
                    <span :class="['pill', health?.oauthConfigured ? 'pill--ok' : 'pill--warn']">OAuth</span>
                    <span :class="['pill', health?.botConfigured ? 'pill--ok' : 'pill--warn']">Bot</span>
                    <span :class="['pill', health?.interactionsConfigured ? 'pill--ok' : 'pill--warn']">Interactions</span>
                    <span :class="['pill', health?.botReady ? 'pill--ok' : 'pill--idle']">Bot ready</span>
                </div>
                <button class="btn-ghost" :disabled="loading" @click="runSafely(loadOverview)">
                    <Icon :icon="loading ? 'mdi:loading' : 'mdi:refresh'" :class="{ spin: loading }" />
                    Recarregar overview
                </button>
            </div>

            <div v-for="card in summaryCards" :key="card.label" class="summary-card">
                <Icon :icon="card.icon" />
                <span>{{ card.label }}</span>
                <strong>{{ card.value }}</strong>
            </div>
        </section>

        <nav class="tabs">
            <button
                v-for="tab in tabs"
                :key="tab.key"
                class="tab"
                :class="{ active: activeTab === tab.key }"
                @click="activeTab = tab.key"
            >
                <Icon :icon="tab.icon" />
                {{ tab.label }}
            </button>
        </nav>

        <section v-if="activeTab === 'overview'" class="section-grid">
            <div class="section">
                <h2 class="section-title">
                    <Icon icon="mdi:account-link-outline" />
                    Conta Discord do admin logado
                </h2>
                <div v-if="me?.linked && me.account" class="account-card">
                    <img v-if="me.account.avatar" :src="me.account.avatar" alt="" class="avatar" />
                    <div class="avatar placeholder" v-else><Icon icon="mdi:discord" /></div>
                    <div>
                        <strong>{{ me.account.global_name || me.account.username }}</strong>
                        <span>{{ me.account.discord_user_id }}</span>
                        <small>{{ me.account.email || 'Sem email retornado' }}</small>
                    </div>
                </div>
                <p v-else class="empty-text">Nenhuma conta Discord vinculada ao usuario atual.</p>
                <div class="actions">
                    <button class="btn-secondary" @click="runSafely(loadDiscordMe)">Consultar /discord/me</button>
                    <button class="btn-danger" @click="runSafely(unlinkDiscordMe)">Desvincular</button>
                </div>
            </div>

            <div class="section">
                <h2 class="section-title">
                    <Icon icon="mdi:webhook" />
                    Interactions endpoint
                </h2>
                <p class="section-desc">Configure essa URL no Discord Developer Portal. O backend exige assinatura Ed25519.</p>
                <div class="copy-box">
                    <code>{{ interactionsUrl }}</code>
                    <button @click="copy(interactionsUrl)"><Icon icon="mdi:content-copy" /></button>
                </div>
                <div class="actions">
                    <button class="btn-secondary" @click="runSafely(loadMetrics)">Carregar metricas</button>
                    <button class="btn-secondary" @click="runSafely(loadAudit)">Carregar auditoria</button>
                </div>
            </div>

            <div class="section response-section">
                <h2 class="section-title">
                    <Icon icon="mdi:code-json" />
                    Ultima resposta
                </h2>
                <pre>{{ lastResponse || 'Nenhuma chamada executada ainda.' }}</pre>
            </div>
        </section>

        <section v-if="activeTab === 'messages'" class="section-grid">
            <div class="section form-section">
                <h2 class="section-title"><Icon icon="mdi:message-text-outline" />Enviar mensagem</h2>
                <label>Canal salvo</label>
                <select :value="messageForm.channelId" @change="onMessageChannelSelect">
                    <option value="">Selecione um canal sincronizado</option>
                    <option v-for="channel in savedChannelOptions" :key="channel.id" :value="channel.id">
                        #{{ channel.name || channel.id }} - {{ channel.guildName }}
                    </option>
                </select>
                <button class="btn-secondary" type="button" @click="runSafely(loadSavedChannels)">Recarregar canais salvos</button>
                <label>Conteudo</label>
                <textarea v-model="messageForm.content" rows="5" maxlength="2000" placeholder="Mensagem para enviar ao Discord" />
                <label class="check-row"><input v-model="messageForm.queue" type="checkbox" /> Enfileirar via BullMQ</label>
                <button class="btn-primary" :disabled="loading" @click="runSafely(sendMessage)">Enviar</button>
            </div>
        </section>

        <section v-if="activeTab === 'guilds'" class="section">
            <div class="section-header">
                <h2 class="section-title"><Icon icon="mdi:robot-outline" />Guilds do bot</h2>
                <button class="btn-secondary" @click="runSafely(loadBotGuilds)">Buscar no Discord</button>
            </div>
            <p class="section-desc">
                Lista ao vivo dos servidores onde o bot esta instalado. Use "Sync agora" para trazer canais, roles e membros para o painel.
            </p>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Guild</th>
                            <th>Discord ID</th>
                            <th>Status</th>
                            <th>Ultimo sync</th>
                            <th>Acoes</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="guild in botGuilds" :key="guild.id">
                            <td><strong>{{ guild.name }}</strong></td>
                            <td><code>{{ guild.id }}</code></td>
                            <td>
                                <span :class="['pill', guild.synced ? 'pill--ok' : 'pill--idle']">
                                    {{ guild.synced ? 'sincronizada' : 'nao sincronizada' }}
                                </span>
                                <span v-if="!guild.allowed" class="pill pill--warn">fora da allowlist</span>
                            </td>
                            <td>{{ formatDate(guild.lastSyncedAt) }}</td>
                            <td class="row-actions">
                                <button class="mini-btn" @click="applyGuildId(guild.id)">Usar ID</button>
                                <button class="mini-btn" @click="applyGuildId(guild.id); runSafely(() => syncSelectedGuild(true))">Sync fila</button>
                                <button class="mini-btn" @click="applyGuildId(guild.id); runSafely(() => syncSelectedGuild(false))">Sync agora</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <p v-if="!botGuilds.length" class="empty-text">Clique em "Buscar no Discord" para listar os servidores do bot.</p>
            </div>

            <div class="section-divider" />

            <div class="section-header">
                <h2 class="section-title"><Icon icon="mdi:server-network" />Guilds sincronizadas</h2>
                <button class="btn-secondary" @click="runSafely(loadGuilds)">Recarregar</button>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Guild</th>
                            <th>Discord ID</th>
                            <th>Membros</th>
                            <th>Sync</th>
                            <th>Acoes</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="guild in guilds" :key="guild.uuid">
                            <td><strong>{{ guild.name }}</strong></td>
                            <td><code>{{ guild.discord_id }}</code></td>
                            <td>{{ guild.member_count ?? guild._count?.members ?? '-' }}</td>
                            <td>{{ formatDate(guild.last_synced_at) }}</td>
                            <td class="row-actions">
                                <button class="mini-btn" @click="applyGuildId(guild.discord_id); runSafely(() => loadGuildDetails())">Abrir</button>
                                <button class="mini-btn" @click="applyGuildId(guild.discord_id); runSafely(() => syncSelectedGuild(true))">Sync fila</button>
                                <button class="mini-btn" @click="applyGuildId(guild.discord_id); runSafely(() => syncSelectedGuild(false))">Sync agora</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <section v-if="activeTab === 'channels'" class="section-grid">
            <div class="section form-section">
                <h2 class="section-title"><Icon icon="mdi:pound" />Criar/editar canal</h2>
                <label>Servidor/Guild</label>
                <select :value="selectedGuildId" @change="onGuildSelect">
                    <option value="">Selecione uma guild</option>
                    <option v-for="guild in guildOptions" :key="guild.id" :value="guild.id">
                        {{ guild.name }} - {{ guild.id }}
                    </option>
                </select>
                <p class="section-desc">Guild selecionada: {{ selectedGuildId ? guildNameForId(selectedGuildId) : 'nenhuma' }}</p>
                <label>Channel ID para editar/remover</label>
                <input v-model="channelForm.channelId" placeholder="channelId" />
                <label>Nome</label>
                <input v-model="channelForm.name" placeholder="suporte" />
                <label>Tipo</label>
                <input v-model.number="channelForm.type" type="number" min="0" max="15" />
                <label>Parent ID</label>
                <input v-model="channelForm.parentId" placeholder="opcional" />
                <label>Topico</label>
                <textarea v-model="channelForm.topic" rows="3" />
                <label class="check-row"><input v-model="channelForm.nsfw" type="checkbox" /> NSFW</label>
                <div class="actions">
                    <button class="btn-primary" @click="runSafely(createChannel)">Criar</button>
                    <button class="btn-secondary" @click="runSafely(updateChannel)">Atualizar</button>
                    <button class="btn-danger" @click="runSafely(deleteChannel)">Remover</button>
                </div>
            </div>

            <div class="section">
                <div class="section-header">
                    <h2 class="section-title"><Icon icon="mdi:cloud-search-outline" />Canais do Discord</h2>
                    <div class="actions">
                        <select :value="selectedGuildId" @change="onGuildSelect">
                            <option value="">Selecionar guild</option>
                            <option v-for="guild in guildOptions" :key="guild.id" :value="guild.id">
                                {{ guild.name }}
                            </option>
                        </select>
                        <button class="btn-secondary" @click="runSafely(loadBotChannels)">Buscar no Discord</button>
                    </div>
                </div>
                <p class="section-desc">Busca ao vivo os canais da guild selecionada, mesmo antes de sincronizar.</p>
                <div class="compact-list">
                    <button v-for="channel in botChannels" :key="channel.id" class="list-row" @click="applyChannelId(channel.id)">
                        <span>
                            #{{ channel.name || channel.id }}
                            <small>{{ channel.synced ? 'sincronizado' : 'ao vivo' }}</small>
                        </span>
                        <code>{{ channel.id }}</code>
                    </button>
                </div>
                <p v-if="!botChannels.length" class="empty-text">Selecione uma guild e clique em "Buscar no Discord".</p>
            </div>

            <div class="section section--wide">
                <div class="section-header">
                    <h2 class="section-title"><Icon icon="mdi:format-list-bulleted" />Canais sincronizados</h2>
                    <button class="btn-secondary" @click="runSafely(() => loadGuildDetails())">Recarregar</button>
                </div>
                <div class="compact-list">
                    <button v-for="channel in channels" :key="channelDiscordId(channel) || channel.id" class="list-row" @click="applyChannelId(channelDiscordId(channel))">
                        <span>#{{ channel.name || channelDiscordId(channel) }}</span>
                        <code>{{ channelDiscordId(channel) }}</code>
                    </button>
                </div>
                <p v-if="!channels.length" class="empty-text">Nenhum canal sincronizado para a guild selecionada.</p>
            </div>
        </section>

        <section v-if="activeTab === 'roles'" class="section-grid">
            <div class="section form-section">
                <h2 class="section-title"><Icon icon="mdi:shield-account-outline" />Criar/editar role</h2>
                <label>Guild ID</label>
                <input v-model="roleForm.guildId" />
                <label>Role ID para editar/remover</label>
                <input v-model="roleForm.roleId" />
                <label>Nome</label>
                <input v-model="roleForm.name" />
                <label>Cor decimal</label>
                <input v-model.number="roleForm.color" type="number" min="0" max="16777215" />
                <label>Permissoes bitset</label>
                <input v-model="roleForm.permissions" placeholder="opcional" />
                <label class="check-row"><input v-model="roleForm.hoist" type="checkbox" /> Hoist</label>
                <label class="check-row"><input v-model="roleForm.mentionable" type="checkbox" /> Mentionable</label>
                <div class="actions">
                    <button class="btn-primary" @click="runSafely(createRole)">Criar</button>
                    <button class="btn-secondary" @click="runSafely(updateRole)">Atualizar</button>
                    <button class="btn-danger" @click="runSafely(deleteRole)">Remover</button>
                </div>
            </div>

            <div class="section form-section">
                <h2 class="section-title"><Icon icon="mdi:account-key-outline" />Atribuir/remover role</h2>
                <label>Guild ID</label>
                <input v-model="roleMemberForm.guildId" />
                <label>User ID</label>
                <input v-model="roleMemberForm.userId" />
                <label>Role ID</label>
                <input v-model="roleMemberForm.roleId" />
                <div class="actions">
                    <button class="btn-primary" @click="runSafely(assignRole)">Atribuir</button>
                    <button class="btn-secondary" @click="runSafely(removeRole)">Remover do membro</button>
                </div>
            </div>

            <div class="section section--wide">
                <h2 class="section-title"><Icon icon="mdi:shield-search" />Roles sincronizadas</h2>
                <div class="chip-list">
                    <button v-for="role in roles" :key="role.discord_id" class="chip" @click="applyRoleId(role.discord_id)">
                        {{ role.name }} <small>{{ role.discord_id }}</small>
                    </button>
                </div>
            </div>
        </section>

        <section v-if="activeTab === 'members'" class="section">
            <div class="section-header">
                <h2 class="section-title"><Icon icon="mdi:account-group-outline" />Membros</h2>
                <div class="inline-controls">
                    <input v-model="memberSearch" type="search" placeholder="Buscar membro" @keyup.enter="runSafely(() => loadGuildDetails())" />
                    <button class="btn-secondary" @click="runSafely(() => loadGuildDetails())">Buscar</button>
                </div>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Usuario</th>
                            <th>Discord ID</th>
                            <th>Nick</th>
                            <th>Roles</th>
                            <th>Acoes</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="member in members" :key="member.uuid">
                            <td>{{ member.global_name || member.username || '-' }}</td>
                            <td><code>{{ member.discord_user_id }}</code></td>
                            <td>{{ member.nickname || '-' }}</td>
                            <td>{{ member.roles?.length ?? 0 }}</td>
                            <td class="row-actions">
                                <button class="mini-btn" @click="applyMemberId(member.discord_user_id)">Usar ID</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <section v-if="activeTab === 'moderation'" class="section form-section">
            <h2 class="section-title"><Icon icon="mdi:gavel" />Moderacao</h2>
            <div class="form-grid">
                <label>Acao<select v-model="moderationForm.action">
                    <option value="kick">Kick</option>
                    <option value="ban">Ban</option>
                    <option value="unban">Unban</option>
                    <option value="timeout">Timeout</option>
                    <option value="remove-timeout">Remove timeout</option>
                </select></label>
                <label>Guild ID<input v-model="moderationForm.guildId" /></label>
                <label>User ID<input v-model="moderationForm.userId" /></label>
                <label>Timeout min<input v-model.number="moderationForm.timeoutMinutes" type="number" min="1" /></label>
                <label>Delete msg days<input v-model.number="moderationForm.deleteMessageDays" type="number" min="0" max="7" /></label>
            </div>
            <label>Motivo</label>
            <textarea v-model="moderationForm.reason" rows="3" />
            <label class="check-row"><input v-model="moderationForm.queue" type="checkbox" /> Enfileirar</label>
            <button class="btn-primary" @click="runSafely(moderateMember)">Executar moderacao</button>
        </section>

        <section v-if="activeTab === 'commands'" class="section form-section">
            <h2 class="section-title"><Icon icon="mdi:slash-forward" />Slash Commands</h2>
            <div class="form-grid">
                <label>Nome<input v-model="commandForm.name" /></label>
                <label>Descricao<input v-model="commandForm.description" /></label>
                <label>Guild ID<input v-model="commandForm.guildId" placeholder="vazio = global" /></label>
                <label>Permissoes<input v-model="commandForm.defaultMemberPermissions" placeholder="bitset opcional" /></label>
            </div>
            <label>Options JSON</label>
            <textarea v-model="commandForm.optionsJson" rows="6" placeholder='[{"name":"texto","description":"Texto","type":3,"required":false}]' />
            <label class="check-row"><input v-model="commandForm.dmPermission" type="checkbox" /> Permitir DM</label>
            <div class="actions">
                <button class="btn-primary" @click="runSafely(registerSlashCommand)">Salvar e registrar</button>
                <button class="btn-secondary" @click="runSafely(registerCommandScope)">Re-registrar escopo via fila</button>
            </div>
        </section>

        <section v-if="activeTab === 'webhooks'" class="section form-section">
            <h2 class="section-title"><Icon icon="mdi:webhook" />Criar webhook Discord</h2>
            <label>Channel ID</label>
            <input v-model="webhookForm.channelId" />
            <label>Nome</label>
            <input v-model="webhookForm.name" />
            <label>Avatar data URI/base64</label>
            <textarea v-model="webhookForm.avatar" rows="4" placeholder="opcional" />
            <button class="btn-primary" @click="runSafely(createWebhook)">Criar webhook</button>
        </section>

        <section v-if="activeTab === 'audit'" class="section-grid">
            <div class="section section--wide">
                <div class="section-header">
                    <h2 class="section-title"><Icon icon="mdi:clipboard-text-clock-outline" />Auditoria</h2>
                    <div class="actions">
                        <button class="btn-secondary" @click="runSafely(loadAudit)">Carregar auditoria</button>
                        <button class="btn-secondary" @click="runSafely(loadMetrics)">Carregar metricas</button>
                    </div>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Acao</th>
                                <th>Target</th>
                                <th>Metadata</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="log in auditLogs" :key="log.uuid">
                                <td>{{ formatDate(log.created_at) }}</td>
                                <td><code>{{ log.action }}</code></td>
                                <td>{{ log.target_type || '-' }} / {{ log.target_id || '-' }}</td>
                                <td><pre class="inline-pre">{{ formatJson(log.metadata) }}</pre></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="section response-section">
                <h2 class="section-title"><Icon icon="mdi:chart-line" />Metricas</h2>
                <pre>{{ metrics || 'Clique em carregar metricas.' }}</pre>
            </div>
        </section>

        <section v-if="activeTab !== 'overview'" class="section response-section">
            <h2 class="section-title"><Icon icon="mdi:code-json" />Ultima resposta</h2>
            <pre>{{ lastResponse || 'Nenhuma chamada executada nessa sessao.' }}</pre>
        </section>
    </div>
</template>

<style lang="stylus" scoped>
.view-wrap
    padding 2rem
    color #fff
    background radial-gradient(circle at top right, rgba(88,101,242,0.14), transparent 34%), #121214
    min-height 100vh

.page-header
    display flex
    align-items flex-start
    justify-content space-between
    gap 1rem
    margin-bottom 1.5rem

.eyebrow
    margin 0 0 0.25rem
    color #818cf8
    text-transform uppercase
    letter-spacing 0.12em
    font-size 0.72rem
    font-weight 800

.page-title
    font-size 2rem
    font-weight 800
    margin 0

.page-subtitle
    color #94a3b8
    font-size 0.92rem
    margin 0.35rem 0 0

.header-actions,
.actions,
.row-actions,
.inline-controls
    display flex
    align-items center
    gap 0.55rem
    flex-wrap wrap

.hero-grid
    display grid
    grid-template-columns minmax(280px, 2fr) repeat(4, minmax(130px, 1fr))
    gap 1rem
    margin-bottom 1rem

.hero-card,
.summary-card,
.section
    background rgba(26,26,30,0.92)
    border 1px solid rgba(255,255,255,0.07)
    border-radius 16px
    box-shadow 0 18px 50px rgba(0,0,0,0.18)

.hero-card
    padding 1.25rem

.hero-card__top
    display flex
    align-items center
    gap 0.85rem
    margin-bottom 1rem

    h2
        margin 0.15rem 0 0
        font-size 1.25rem

.hero-icon
    font-size 2.5rem
    color #5865f2

.muted
    color #94a3b8
    font-size 0.78rem

.summary-card
    padding 1rem
    display flex
    flex-direction column
    gap 0.35rem

    svg
        font-size 1.4rem
        color #818cf8

    span
        color #94a3b8
        font-size 0.78rem

    strong
        font-size 1.65rem

.status-grid
    display flex
    flex-wrap wrap
    gap 0.4rem
    margin-bottom 1rem

.pill
    border-radius 999px
    padding 0.3rem 0.7rem
    font-size 0.75rem
    font-weight 700
    border 1px solid rgba(255,255,255,0.1)
    color #94a3b8

    &--ok
        color #86efac
        background rgba(34,197,94,0.1)
        border-color rgba(34,197,94,0.24)

    &--warn
        color #fbbf24
        background rgba(245,158,11,0.1)
        border-color rgba(245,158,11,0.24)

    &--idle
        color #cbd5e1
        background rgba(148,163,184,0.08)

.tabs
    display flex
    gap 0.5rem
    overflow-x auto
    margin 1.25rem 0
    padding-bottom 0.25rem

.tab
    display inline-flex
    align-items center
    gap 0.45rem
    color #94a3b8
    background rgba(255,255,255,0.04)
    border 1px solid rgba(255,255,255,0.07)
    border-radius 999px
    padding 0.55rem 0.9rem
    cursor pointer
    white-space nowrap
    font-weight 650

    &.active
        color #fff
        background #5865f2
        border-color #5865f2

.section-grid
    display grid
    grid-template-columns repeat(2, minmax(0, 1fr))
    gap 1rem

.section
    padding 1.25rem
    margin-bottom 1rem

    &--wide
        grid-column 1 / -1

.section-header
    display flex
    align-items center
    justify-content space-between
    gap 1rem
    margin-bottom 1rem

.section-title
    display flex
    align-items center
    gap 0.5rem
    font-size 1rem
    font-weight 750
    margin 0 0 1rem
    color #e2e8f0

.section-header .section-title
    margin-bottom 0

.section-divider
    height 1px
    background rgba(255,255,255,0.08)
    margin 1.25rem 0

.section-desc,
.empty-text
    color #94a3b8
    font-size 0.86rem
    line-height 1.5

.account-card
    display flex
    align-items center
    gap 0.8rem
    margin-bottom 1rem

    strong,
    span,
    small
        display block

    span,
    small
        color #94a3b8
        font-size 0.8rem

.avatar
    width 46px
    height 46px
    border-radius 50%
    object-fit cover

.placeholder
    display flex
    align-items center
    justify-content center
    background rgba(88,101,242,0.18)
    color #a5b4fc

.copy-box
    display flex
    align-items center
    gap 0.5rem
    background #101014
    border 1px solid rgba(255,255,255,0.08)
    border-radius 10px
    padding 0.75rem
    margin 1rem 0

    code
        color #c4b5fd
        overflow auto
        flex 1

    button
        background transparent
        border none
        color #94a3b8
        cursor pointer

.btn-primary,
.btn-secondary,
.btn-danger,
.btn-ghost,
.mini-btn
    display inline-flex
    align-items center
    justify-content center
    gap 0.4rem
    border-radius 9px
    font-weight 700
    cursor pointer
    text-decoration none
    transition all 0.15s

    &:disabled
        opacity 0.55
        cursor not-allowed

.btn-primary
    background #5865f2
    border 1px solid #5865f2
    color #fff
    padding 0.62rem 1rem

    &:hover:not(:disabled)
        background #4752c4

.btn-secondary,
.btn-ghost
    background rgba(255,255,255,0.06)
    border 1px solid rgba(255,255,255,0.1)
    color #e2e8f0
    padding 0.62rem 1rem

    &:hover:not(:disabled)
        background rgba(255,255,255,0.1)

.btn-danger
    background rgba(244,63,94,0.12)
    border 1px solid rgba(244,63,94,0.25)
    color #fb7185
    padding 0.62rem 1rem

.mini-btn
    padding 0.35rem 0.55rem
    background rgba(255,255,255,0.05)
    border 1px solid rgba(255,255,255,0.08)
    color #cbd5e1
    font-size 0.75rem

.form-section
    label
        display flex
        flex-direction column
        gap 0.35rem
        color #94a3b8
        font-size 0.78rem
        margin-bottom 0.85rem

input,
textarea,
select
    background #101014
    border 1px solid rgba(255,255,255,0.1)
    border-radius 9px
    color #fff
    padding 0.62rem 0.75rem
    font-size 0.88rem
    outline none

    &:focus
        border-color rgba(88,101,242,0.62)

textarea
    resize vertical

.check-row
    flex-direction row !important
    align-items center
    color #cbd5e1 !important

    input
        width auto

.form-grid
    display grid
    grid-template-columns repeat(auto-fit, minmax(180px, 1fr))
    gap 0.75rem

.table-wrapper
    overflow-x auto

table
    width 100%
    border-collapse collapse

th
    text-align left
    color #94a3b8
    font-size 0.72rem
    font-weight 700
    text-transform uppercase
    letter-spacing 0.04em
    border-bottom 1px solid rgba(255,255,255,0.06)
    padding 0.75rem 0.55rem

td
    border-bottom 1px solid rgba(255,255,255,0.04)
    padding 0.75rem 0.55rem
    font-size 0.85rem
    color #e2e8f0

code
    color #a5b4fc
    font-size 0.78rem

.chip-list
    display flex
    flex-wrap wrap
    gap 0.5rem

.chip
    display inline-flex
    align-items center
    gap 0.4rem
    border 1px solid rgba(88,101,242,0.28)
    background rgba(88,101,242,0.1)
    color #c4b5fd
    border-radius 999px
    padding 0.45rem 0.75rem
    cursor pointer

    small
        color #94a3b8

.compact-list
    display flex
    flex-direction column
    gap 0.4rem

.list-row
    display flex
    justify-content space-between
    gap 1rem
    background #101014
    border 1px solid rgba(255,255,255,0.06)
    border-radius 10px
    color #e2e8f0
    padding 0.7rem 0.85rem
    cursor pointer

    span
        display flex
        flex-direction column
        gap 0.15rem

    small
        color #94a3b8
        font-size 0.72rem

.response-section
    grid-column 1 / -1

pre
    margin 0
    white-space pre-wrap
    word-break break-word
    background #101014
    border 1px solid rgba(255,255,255,0.06)
    border-radius 10px
    padding 1rem
    color #cbd5e1
    font-size 0.8rem
    max-height 380px
    overflow auto

.inline-pre
    max-height 120px
    padding 0.5rem

.spin
    animation spin 0.8s linear infinite

@keyframes spin
    from
        transform rotate(0deg)
    to
        transform rotate(360deg)

@media (max-width: 1100px)
    .hero-grid,
    .section-grid
        grid-template-columns 1fr

@media (max-width: 720px)
    .view-wrap
        padding 1rem

    .page-header
        flex-direction column

    .header-actions
        width 100%

    .btn-primary,
    .btn-secondary,
    .btn-danger
        width 100%
</style>
