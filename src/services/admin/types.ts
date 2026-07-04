export interface PassTierEntry {
  rank:          number
  name:          string
  color:         string
  min_spent_brl: number
  min_points:    number
  unlocked:      boolean
  is_current:    boolean
}

export interface DropshipNotificationItem {
  name: string
  quantity: number
  unitPrice: number
  steamMarketUrl?: string | null
}

export interface DropshipNotificationMetadata {
  saleId: string
  saleUuid: string
  orderNumber: string
  userName: string
  email?: string | null
  contact?: string | null
  steamId?: string | null
  tradeLink?: string | null
  totalAmount: number
  items: DropshipNotificationItem[]
}

export interface DropshipNotificationDto {
  id: string
  type: 'DROPSHIP_PURCHASE'
  title: string
  body: string
  metadata: DropshipNotificationMetadata
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface DropshipNotificationsResponse {
  data: DropshipNotificationDto[]
  total: number
  page: number
  limit: number
}

export interface PassProgressDto {
  pass_active:         boolean
  season_start:        string | null
  season_end:          string | null
  current_tier:        { rank: number; name: string }
  next_tier:           { rank: number; name: string; min_points: number } | null
  points_balance:      number
  total_spent_brl:     number
  progress_percent:    number
  points_to_next_tier: number | null
  cashback_benefit:    { percentage: number } | null
  decay_info:          { inactivity_days_trigger: number; weekly_decay_points: number }
  all_tiers:           PassTierEntry[]
}

export interface DiscordHealthDto {
  ok: boolean
  enabled: boolean
  oauthConfigured: boolean
  botConfigured: boolean
  interactionsConfigured: boolean
  botReady: boolean
}

export interface DiscordAccountDto {
  uuid: string
  discord_user_id: string
  username: string | null
  global_name: string | null
  avatar: string | null
  email: string | null
  email_verified: boolean | null
  locale: string | null
  linked_at: string | null
  last_login_at: string | null
}

export interface DiscordMeDto {
  linked: boolean
  account: DiscordAccountDto | null
}

export interface DiscordGuildDto {
  id: string | number
  uuid: string
  discord_id: string
  name: string
  icon: string | null
  owner_id: string | null
  member_count: number | null
  preferred_locale: string | null
  permissions: string | null
  bot_joined_at: string | null
  last_synced_at: string | null
  created_at: string
  updated_at: string
  _count?: {
    channels: number
    roles: number
    members: number
    webhooks: number
  }
}

export interface DiscordBotGuildDto {
  id: string
  name: string
  icon: string | null
  owner: boolean
  permissions: string | null
  features: string[]
  synced: boolean
  allowed: boolean
  lastSyncedAt: string | null
}

export interface DiscordChannelDto {
  id: string | number
  uuid: string
  guild_id: string | number
  discord_id: string
  parent_discord_id: string | null
  name: string | null
  type: number
  position: number | null
  topic: string | null
  nsfw: boolean
  guild?: {
    discord_id: string
    name: string
  }
}

export interface DiscordBotChannelDto {
  id: string
  guildId: string
  parentId: string | null
  name: string | null
  type: number
  position: number | null
  topic: string | null
  nsfw: boolean
  synced: boolean
  allowed: boolean
}

export interface DiscordRoleDto {
  id: string | number
  uuid: string
  guild_id: string | number
  discord_id: string
  name: string
  color: number
  hoist: boolean
  managed: boolean
  mentionable: boolean
  position: number | null
  permissions: string | null
}

export interface DiscordMemberDto {
  id: string | number
  uuid: string
  guild_id: string | number
  account_id: string | number | null
  discord_user_id: string
  username: string | null
  global_name: string | null
  nickname: string | null
  avatar: string | null
  roles: string[] | null
  permissions: string | null
  joined_at: string | null
  communication_disabled_until: string | null
}

export interface DiscordAuditLogDto {
  id: string | number
  uuid: string
  actor_user_id: string | number | null
  actor_discord_id: string | null
  guild_id: string | number | null
  action: string
  target_type: string | null
  target_id: string | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface DiscordQueuedResponse {
  queued?: boolean
  jobId?: string | number
  idempotencyKey?: string
  ok?: boolean
}

export interface DiscordSendMessagePayload {
  channelId: string
  content?: string
  embeds?: Record<string, unknown>[]
  allowedMentions?: Record<string, unknown>
  idempotencyKey?: string
  queue?: boolean
}

export interface DiscordCreateChannelPayload {
  guildId: string
  name: string
  type?: number
  parentId?: string
  topic?: string
  nsfw?: boolean
}

export interface DiscordUpdateChannelPayload {
  name?: string
  parentId?: string
  topic?: string
  nsfw?: boolean
}

export interface DiscordCreateRolePayload {
  guildId: string
  name: string
  color?: number
  hoist?: boolean
  mentionable?: boolean
  permissions?: string
}

export interface DiscordUpdateRolePayload {
  name?: string
  color?: number
  hoist?: boolean
  mentionable?: boolean
  permissions?: string
}

export interface DiscordAssignRolePayload {
  guildId: string
  userId: string
  roleId: string
}

export interface DiscordModerationPayload {
  action: 'kick' | 'ban' | 'unban' | 'timeout' | 'remove-timeout'
  guildId: string
  userId: string
  reason?: string
  timeoutMinutes?: number
  deleteMessageDays?: number
  queue?: boolean
}

export interface DiscordSlashCommandPayload {
  name: string
  description: string
  guildId?: string
  options?: Record<string, unknown>[]
  defaultMemberPermissions?: string
  dmPermission?: boolean
}

export interface DiscordCreateWebhookPayload {
  channelId: string
  name: string
  avatar?: string
}

export interface DiscordWebhookCreatedDto {
  id: string
  name: string | null
  channel_id: string | null
  guild_id: string | null
}
