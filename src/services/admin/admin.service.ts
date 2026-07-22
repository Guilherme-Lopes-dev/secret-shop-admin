import { api } from '@/lib/api/api'
import type {
  DiscordAssignRolePayload,
  DiscordBotChannelDto,
  DiscordAuditLogDto,
  DiscordBotGuildDto,
  DiscordChannelDto,
  DiscordCreateChannelPayload,
  DiscordCreateRolePayload,
  DiscordCreateWebhookPayload,
  DiscordGuildDto,
  DiscordHealthDto,
  DiscordMeDto,
  DiscordMemberDto,
  DiscordModerationPayload,
  DiscordQueuedResponse,
  DiscordRoleDto,
  DiscordSendMessagePayload,
  DiscordSlashCommandPayload,
  DiscordUpdateChannelPayload,
  DiscordUpdateRolePayload,
  DiscordWebhookCreatedDto,
  DropshipNotificationsResponse,
  PassProgressDto,
} from './types'

const collectorNotificationTypes = 'COLLECTOR_PURCHASE,COLLECTOR_SHIPPING_REMINDER'
const dropshipNotificationTypes = 'DROPSHIP_PURCHASE'

export const adminService = {
  async getSalesStats() {
    return api.get('/dashboard/stats')
  },

  async getPerformance() {
    return api.get('/dashboard/performance')
  },

  async getRecentOrders() {
    return api.get('/dashboard/recent-orders')
  },

  async getDashboardToday() {
    return api.get<{
      revenueToday: number
      ordersToday: number
      revenueYesterday: number
      ordersYesterday: number
      pendingPaymentsToday: number
    }>('/dashboard/today')
  },

  async getDashboardPendings() {
    return api.get<Record<string, number>>('/dashboard/pendings')
  },

  async getAllSales(
    page: number = 1,
    limit: number = 20,
    filters: { from?: string; to?: string; paymentStatus?: string; couponCode?: string; fulfillmentStatus?: string } = {},
  ) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (filters.from) params.append('from', filters.from)
    if (filters.to) params.append('to', filters.to)
    if (filters.paymentStatus) params.append('payment_status', filters.paymentStatus)
    if (filters.couponCode) params.append('coupon_code', filters.couponCode)
    if (filters.fulfillmentStatus) params.append('fulfillment_status', filters.fulfillmentStatus)
    return api.get(`/admin/sales?${params}`)
  },

  async exportSalesReport(filters: { from?: string; to?: string; paymentStatus?: string }) {
    const params = new URLSearchParams()
    if (filters.from) params.append('from', filters.from)
    if (filters.to) params.append('to', filters.to)
    if (filters.paymentStatus) params.append('payment_status', filters.paymentStatus)
    return api.get<{ data: any[]; total: number; returned: number; capped: boolean }>(
      `/admin/sales/reports/export?${params}`,
    )
  },

  async getBulkAsaasReceipts(filters: { from?: string; to?: string }) {
    const params = new URLSearchParams()
    if (filters.from) params.append('from', filters.from)
    if (filters.to) params.append('to', filters.to)
    return api.get<{
      data: Array<{
        sale_uuid: string
        order_number: string
        username: string | null
        total_amount: number
        created_at: string
        asaas_payment_id: string
        receipt_url: string | null
        invoice_url: string | null
        bank_slip_url: string | null
        customer_cpf_cnpj: string | null
        customer_name: string | null
        error: string | null
      }>
      total: number
    }>(`/admin/sales/reports/receipts?${params}`)
  },

  async getSaleById(id: string | number) {
    return api.get(`/admin/sales/${id}`)
  },

  async getSaleAsaasPayment(uuid: string) {
    return api.get<{
      id: string
      status: string
      billingType: string
      value: number
      netValue?: number | null
      dueDate: string
      description?: string | null
      invoiceUrl?: string | null
      bankSlipUrl?: string | null
      transactionReceiptUrl?: string | null
    }>(`/admin/sales/${uuid}/asaas-payment`)
  },

  async updateSaleStatus(uuid: string, status: string) {
    return api.patch(`/admin/sales/${uuid}/status`, { status })
  },

  async retrySaleTrade(uuid: string) {
    return api.post(`/admin/sales/${uuid}/retry-trade`)
  },

  async syncTradeOffer(tradeOfferId: string) {
    return api.post(`/admin/sales/trade-offers/${tradeOfferId}/sync`)
  },

  // Users
  async getAllUsers(
    page: number = 1,
    limit: number = 20,
    search?: string,
    sort?: string,
    minOrders?: number,
    maxOrders?: number,
    minSpent?: number,
    maxSpent?: number,
    tierRank?: number,
  ) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search) params.append('search', search)
    if (sort) params.append('sort', sort)
    if (minOrders !== undefined) params.append('minOrders', String(minOrders))
    if (maxOrders !== undefined) params.append('maxOrders', String(maxOrders))
    if (minSpent !== undefined) params.append('minSpent', String(minSpent))
    if (maxSpent !== undefined) params.append('maxSpent', String(maxSpent))
    if (tierRank !== undefined) params.append('tierRank', String(tierRank))
    return api.get(`/admin/users?${params}`)
  },

  async getUserById(uuid: string) {
    return api.get(`/admin/users/${uuid}`)
  },

  async toggleUserActive(uuid: string) {
    return api.patch(`/admin/users/${uuid}/toggle-active`)
  },

  async toggleUserSwap(uuid: string) {
    return api.patch<{ id: string; swap_enabled: boolean }>(`/admin/users/${uuid}/toggle-swap`)
  },

  async resetInventoryCooldown(uuid: string) {
    return api.patch<{ id: string; last_inventory_fetch_at: string | null }>(
      `/admin/users/${uuid}/reset-inventory-cooldown`,
    )
  },

  async setAllUsersSwap(enabled: boolean) {
    return api.post<{ updated: number; enabled: boolean }>('/admin/users/swap-access', { enabled })
  },

  // Trade offers
  async getTradeOffers(page: number = 1, limit: number = 20, status?: string) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (status) params.append('status', status)
    return api.get(`/admin/sales/trade-offers?${params}`)
  },

  async getTradeOfferById(uuid: string) {
    return api.get(`/admin/sales/trade-offers/${uuid}`)
  },

  // Inventory item detail & update
  async getInventoryItem(uuid: string) {
    return api.get(`/skins/admin/inventory/${uuid}`)
  },

  async updateInventoryItem(uuid: string, dto: {
    name?: string
    hero?: string
    rarity?: string
    icon_url_large?: string
    manual_price?: number
    median_price?: number
    lowest_price?: number
    price?: number
    asset_id?: string
    class_id?: string
    instance_id?: string
    tradable?: boolean
    is_collector?: boolean
    is_gifted?: boolean
    trade_cooldown_until?: string | null
  }) {
    return api.patch(`/skins/admin/inventory/${uuid}`, dto)
  },

  // Inventory
  async getInventory(
    page: number = 1,
    limit: number = 20,
    botId?: string,
    status?: string,
    search?: string,
    sort?: string,
    minPrice?: number,
    maxPrice?: number,
    marketplace?: string,
  ) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (botId) params.append('botId', botId)
    if (status) params.append('status', status)
    if (search) params.append('search', search)
    if (sort) params.append('sort', sort)
    if (minPrice !== undefined) params.append('minPrice', String(minPrice))
    if (maxPrice !== undefined) params.append('maxPrice', String(maxPrice))
    if (marketplace) params.append('marketplace', marketplace)
    return api.get(`/skins/admin/inventory?${params}`)
  },

  async syncInventory() {
    return api.post('/skins/admin/sync')
  },

  // Market Explorer — catálogo cru do steamwebapi /items (paginado no back)
  async getMarketExplorer(params: MarketExplorerFilters & { page?: number; pageSize?: number; refresh?: boolean } = {}) {
    const p = new URLSearchParams({
      page: String(params.page ?? 1),
      pageSize: String(params.pageSize ?? 50),
    })
    if (params.search) p.append('search', params.search)
    if (params.hero) p.append('hero', params.hero)
    if (params.type) p.append('type', params.type)
    if (params.slot) p.append('slot', params.slot)
    if (params.rarity) p.append('rarity', params.rarity)
    if (params.qualities?.length) p.append('qualities', params.qualities.join(','))
    if (params.priceFilter) p.append('priceFilter', params.priceFilter)
    if (params.priceMin != null) p.append('priceMin', String(params.priceMin))
    if (params.priceMax != null) p.append('priceMax', String(params.priceMax))
    if (params.sortBy) p.append('sortBy', params.sortBy)
    if (params.sortDir) p.append('sortDir', params.sortDir)
    if (params.refresh) p.append('refresh', 'true')
    // refresh dispara busca de até 50k itens no steamwebapi (server: 120s) → timeout maior.
    return api.get<MarketExplorerResponse>(`/skins/admin/market-explorer?${p}`, {
      timeout: params.refresh ? 130_000 : 20_000,
    })
  },

  // Lista produtos salvos no banco (dropship_products) — mesmos filtros do explorer
  async getDropshipProducts(params: MarketExplorerFilters & { page?: number; pageSize?: number } = {}) {
    const p = new URLSearchParams({
      page: String(params.page ?? 1),
      pageSize: String(params.pageSize ?? 50),
    })
    if (params.search) p.append('search', params.search)
    if (params.hero) p.append('hero', params.hero)
    if (params.type) p.append('type', params.type)
    if (params.slot) p.append('slot', params.slot)
    if (params.rarity) p.append('rarity', params.rarity)
    if (params.qualities?.length) p.append('qualities', params.qualities.join(','))
    if (params.priceFilter) p.append('priceFilter', params.priceFilter)
    if (params.priceMin != null) p.append('priceMin', String(params.priceMin))
    if (params.priceMax != null) p.append('priceMax', String(params.priceMax))
    if (params.sortBy) p.append('sortBy', params.sortBy)
    if (params.sortDir) p.append('sortDir', params.sortDir)
    return api.get<MarketExplorerResponse>(`/skins/admin/dropship-products?${p}`, { timeout: 30_000 })
  },

  // Apaga produtos do banco (dropship_products) por market_hash_name
  async deleteDropshipProducts(marketHashNames: string[]) {
    return api.post<{ deleted: number }>('/skins/admin/dropship-products/delete', { marketHashNames })
  },

  // Salva um bloco de itens (curados no cliente) em dropship_products
  async saveDropshipProducts(items: MarketExplorerItem[]) {
    return api.post<{ saved: number }>(
      '/skins/admin/market-explorer/save',
      { items },
      { timeout: 60_000 },
    )
  },

  // Payload cru completo de um item do market (endpoint /item singular)
  async getMarketItemDetail(marketHashName: string) {
    return api.get<Record<string, any>>(
      `/skins/admin/market-explorer/item?marketHashName=${encodeURIComponent(marketHashName)}`,
      { timeout: 35_000 },
    )
  },

  // Bots
  async getBots() {
    return api.get('/steam-bots')
  },

  async getSteamInventoryBySteamId(steamId: string) {
    return api.get(`/steam/admin/skins/${steamId}`)
  },

  async getSteamTradeHistory(apiKey: string, cursor?: string) {
    return api.post('/steam/admin/trade-history', { apiKey, cursor }, { timeout: 120_000 })
  },

  // Collector notifications
  async getCollectorNotifications(page: number = 1, limit: number = 20, onlyUnread: boolean = false) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      types: collectorNotificationTypes,
    })
    if (onlyUnread) params.append('onlyUnread', 'true')
    return api.get(`/admin/notifications?${params}`)
  },

  async getCollectorUnreadCount() {
    return api.get(`/admin/notifications/unread-count?types=${collectorNotificationTypes}`)
  },

  async markCollectorNotificationRead(uuid: string) {
    return api.patch(`/admin/notifications/${uuid}/read`)
  },

  async markAllCollectorNotificationsRead() {
    return api.patch(`/admin/notifications/read-all?types=${collectorNotificationTypes}`)
  },

  // Dropship shipping queue
  async getDropshipNotifications(page: number = 1, limit: number = 20, onlyUnread: boolean = true) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      types: dropshipNotificationTypes,
    })
    if (onlyUnread) params.append('onlyUnread', 'true')
    return api.get<DropshipNotificationsResponse>(`/admin/notifications?${params}`)
  },

  async getDropshipUnreadCount() {
    return api.get<{ count: number }>(
      `/admin/notifications/unread-count?types=${dropshipNotificationTypes}`,
    )
  },

  async markDropshipNotificationRead(id: string) {
    return api.patch(`/admin/notifications/${id}/read`)
  },

  // Collectors catalog
  async getCollectors(params: {
    page?: number
    limit?: number
    steamId?: string
    search?: string
    minPrice?: number
    maxPrice?: number
    noPrice?: boolean
    noHero?: boolean
  } = {}) {
    const p = new URLSearchParams({ page: String(params.page ?? 1), limit: String(params.limit ?? 20) })
    if (params.steamId) p.append('steamId', params.steamId)
    if (params.search) p.append('search', params.search)
    if (params.minPrice !== undefined) p.append('minPrice', String(params.minPrice))
    if (params.maxPrice !== undefined) p.append('maxPrice', String(params.maxPrice))
    if (params.noPrice) p.append('noPrice', 'true')
    if (params.noHero) p.append('noHero', 'true')
    return api.get(`/collectors/admin?${p}`)
  },

  async updateCollectorPrice(uuid: string, price: number | null) {
    return api.patch(`/collectors/admin/${uuid}/price`, { price })
  },

  async updateCollectorHero(uuid: string, heroSlug: string | null) {
    return api.patch(`/collectors/admin/${uuid}/hero`, { heroSlug })
  },

  async deleteCollector(uuid: string) {
    return api.delete(`/collectors/admin/${uuid}`)
  },

  // Collectors
  async bulkUpsertCollectors(payload: {
    steamId: string
    botId?: number | null
    items: Array<{
      assetId: string
      classId?: string | null
      instanceId?: string | null
      name: string
      marketHashName: string
      type?: string | null
      iconUrl?: string | null
      iconUrlLarge?: string | null
      amount?: number
      tradable?: boolean
      marketable?: boolean
      commodity?: boolean
      price?: number | null
      heroSlug?: string
    }>
  }) {
    return api.post('/collectors/admin/bulk', payload)
  },

  // Dota Heroes
  async getDotaHeroes() {
    return api.get<Array<{ uuid: string; slug: string; name: string; image: string | null }>>('/dota-heroes')
  },

  async toggleSkinPriceLock(skinUuid: string, locked: boolean) {
    return api.patch(`/skins/admin/skin/${skinUuid}/price-lock`, { locked })
  },

  // Preços — catálogo + evolução por skin
  async getSkinsPriceCatalog(page: number = 1, limit: number = 20, filters: MarketExplorerFilters = {}) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (filters.search) params.append('search', filters.search)
    if (filters.hero) params.append('hero', filters.hero)
    if (filters.type) params.append('type', filters.type)
    if (filters.slot) params.append('slot', filters.slot)
    if (filters.rarity) params.append('rarity', filters.rarity)
    if (filters.qualities?.length) params.append('qualities', filters.qualities.join(','))
    if (filters.priceFilter) params.append('priceFilter', filters.priceFilter)
    if (filters.priceMin != null) params.append('priceMin', String(filters.priceMin))
    if (filters.priceMax != null) params.append('priceMax', String(filters.priceMax))
    if (filters.sortBy) params.append('sortBy', filters.sortBy)
    if (filters.sortDir) params.append('sortDir', filters.sortDir)
    return api.get<SkinPriceCatalogResponse>(`/skins/admin/price-catalog?${params}`)
  },

  async getSkinPriceHistory(uuid: string) {
    return api.get<SkinPriceHistoryResponse>(`/skins/admin/${uuid}/price-history`)
  },

  // Pass config
  async getPassConfig() {
    return api.get<{
      pass_active: boolean
      points_per_brl: number
      decay_inactivity_days: number
      decay_points_per_week: number
      inactive_from: string | null
      inactive_until: string | null
      season_start: string | null
      season_end: string | null
    }>('/admin/passes/config')
  },

  async setPassConfig(dto: {
    pass_active?: boolean
    points_per_brl?: number
    decay_inactivity_days?: number
    decay_points_per_week?: number
    inactive_from?: string | null
    inactive_until?: string | null
    season_start?: string | null
    season_end?: string | null
  }) {
    return api.put('/admin/passes/config', dto)
  },

  async getPassTiers() {
    return api.get<Array<{
      rank: number
      name: string
      min_points: number
      benefits: Array<{ id: string; benefit_type: string; config: Record<string, unknown>; active: boolean; created_at: string }>
    }>>('/admin/passes/tiers')
  },

  async createPassBenefit(tierRank: number, benefitType: string, config: Record<string, unknown>) {
    return api.post(`/admin/passes/tiers/${tierRank}/benefits`, { benefit_type: benefitType, config })
  },

  async updatePassBenefit(id: string, patch: { active?: boolean; config?: Record<string, unknown> }) {
    return api.patch(`/admin/passes/benefits/${id}`, patch)
  },

  async deletePassBenefit(id: string) {
    return api.delete(`/admin/passes/benefits/${id}`)
  },

  async setTierThreshold(rank: number, minPoints: number) {
    return api.put(`/admin/passes/tiers/${rank}/threshold`, { min_points: minPoints })
  },

  async getUserPassProgress(uuid: string) {
    return api.get<PassProgressDto>(`/admin/passes/users/${uuid}/progress`)
  },

  // Antifraud — política de país (allowlist / blocklist)
  async getAntifraudCountryPolicy() {
    return api.get<{ allowed: string[]; blocked: string[] }>('/admin/antifraud/country-policy')
  },

  async setAntifraudCountryPolicy(dto: { allowed?: string[]; blocked?: string[] }) {
    return api.put<{ allowed: string[]; blocked: string[] }>('/admin/antifraud/country-policy', dto)
  },

  // Collector Sales (admin)
  async getCollectorSales(params: {
    page?: number
    limit?: number
    payment_status?: string
    delivery_status?: string
    search?: string
  } = {}) {
    const p = new URLSearchParams({ page: String(params.page ?? 1), limit: String(params.limit ?? 20) })
    if (params.payment_status) p.append('payment_status', params.payment_status)
    if (params.delivery_status) p.append('delivery_status', params.delivery_status)
    if (params.search) p.append('search', params.search)
    return api.get(`/collector-sales/admin/list?${p}`)
  },

  async updateCollectorDelivery(uuid: string, deliveryStatus: string, notes?: string) {
    return api.patch(`/collector-sales/admin/lines/${uuid}/delivery`, {
      delivery_status: deliveryStatus,
      ...(notes ? { notes } : {}),
    })
  },

  async cancelCollectorSale(uuid: string, refund = false) {
    return api.post(`/collector-sales/admin/${uuid}/cancel`, { refund })
  },

  async getCollectorSaleDetail(uuid: string) {
    return api.get(`/collector-sales/${uuid}`)
  },

  async getCollectorSaleFriendship(uuid: string) {
    return api.get(`/collector-sales/${uuid}/friendship/admin`)
  },

  async getCollectorSaleAsaasPayment(uuid: string) {
    return api.get<{
      id: string
      status: string
      billingType: string
      value: number
      netValue?: number | null
      dueDate: string
      description?: string | null
      invoiceUrl?: string | null
      bankSlipUrl?: string | null
      transactionReceiptUrl?: string | null
    }>(`/collector-sales/admin/${uuid}/asaas-payment`)
  },

  // Products
  async createProduct(dto: {
    name: string
    market_hash_name: string
    hero?: string
    rarity?: string
    icon_url_large?: string
    manual_price: number
    median_price?: number
    lowest_price?: number
    bot_uuid: string
    asset_id: string
    class_id?: string
    instance_id?: string
    is_collector?: boolean
    is_gifted?: boolean
    tradable?: boolean
    trade_cooldown_until?: string
  }) {
    return api.post('/skins/admin/products', dto)
  },

  // Discord
  async getDiscordHealth() {
    return api.get<DiscordHealthDto>('/discord/health')
  },

  async getDiscordMe() {
    return api.get<DiscordMeDto>('/discord/me')
  },

  async unlinkDiscordMe() {
    return api.delete<{ ok: boolean }>('/discord/me')
  },

  async getDiscordGuilds() {
    return api.get<DiscordGuildDto[]>('/admin/discord/guilds')
  },

  async getDiscordBotGuilds() {
    return api.get<DiscordBotGuildDto[]>('/admin/discord/bot/guilds')
  },

  async getDiscordBotChannels(guildId: string) {
    return api.get<DiscordBotChannelDto[]>(`/admin/discord/bot/guilds/${guildId}/channels`)
  },

  async getDiscordAllChannels(guildId?: string) {
    const params = new URLSearchParams()
    if (guildId) params.append('guildId', guildId)
    return api.get<DiscordChannelDto[]>(
      `/admin/discord/channels${params.toString() ? `?${params}` : ''}`,
    )
  },

  async getDiscordChannels(guildId: string) {
    return api.get<DiscordChannelDto[]>(`/admin/discord/guilds/${guildId}/channels`)
  },

  async getDiscordRoles(guildId: string) {
    return api.get<DiscordRoleDto[]>(`/admin/discord/guilds/${guildId}/roles`)
  },

  async getDiscordMembers(guildId: string, search?: string) {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    return api.get<DiscordMemberDto[]>(
      `/admin/discord/guilds/${guildId}/members${params.toString() ? `?${params}` : ''}`,
    )
  },

  async syncDiscordGuild(guildId: string, queue = true) {
    return api.post<DiscordQueuedResponse>(`/admin/discord/guilds/${guildId}/sync?queue=${queue}`)
  },

  async sendDiscordMessage(payload: DiscordSendMessagePayload) {
    return api.post<DiscordQueuedResponse>('/admin/discord/messages', payload)
  },

  async createDiscordChannel(payload: DiscordCreateChannelPayload) {
    return api.post<DiscordChannelDto>('/admin/discord/channels', payload)
  },

  async updateDiscordChannel(channelId: string, payload: DiscordUpdateChannelPayload) {
    return api.patch<DiscordChannelDto>(`/admin/discord/channels/${channelId}`, payload)
  },

  async deleteDiscordChannel(channelId: string) {
    return api.delete<{ ok: boolean }>(`/admin/discord/channels/${channelId}`)
  },

  async createDiscordRole(payload: DiscordCreateRolePayload) {
    return api.post<DiscordRoleDto>('/admin/discord/roles', payload)
  },

  async updateDiscordRole(guildId: string, roleId: string, payload: DiscordUpdateRolePayload) {
    return api.patch<DiscordRoleDto>(`/admin/discord/guilds/${guildId}/roles/${roleId}`, payload)
  },

  async deleteDiscordRole(guildId: string, roleId: string) {
    return api.delete<{ ok: boolean }>(`/admin/discord/guilds/${guildId}/roles/${roleId}`)
  },

  async assignDiscordRole(payload: DiscordAssignRolePayload) {
    return api.post<{ ok: boolean }>('/admin/discord/roles/assign', payload)
  },

  async removeDiscordRole(payload: DiscordAssignRolePayload) {
    return api.post<{ ok: boolean }>('/admin/discord/roles/remove', payload)
  },

  async moderateDiscordMember(payload: DiscordModerationPayload) {
    return api.post<DiscordQueuedResponse>('/admin/discord/moderation', payload)
  },

  async registerDiscordSlashCommand(payload: DiscordSlashCommandPayload) {
    return api.post<{ ok: boolean; registered: unknown[] }>('/admin/discord/slash-commands', payload)
  },

  async registerDiscordCommandScope(guildId?: string) {
    const params = new URLSearchParams()
    if (guildId) params.append('guildId', guildId)
    return api.post<DiscordQueuedResponse>(
      `/admin/discord/slash-commands/register-scope${params.toString() ? `?${params}` : ''}`,
    )
  },

  async createDiscordWebhook(payload: DiscordCreateWebhookPayload) {
    return api.post<DiscordWebhookCreatedDto>('/admin/discord/webhooks', payload)
  },

  async getDiscordAudit(limit = 50) {
    return api.get<DiscordAuditLogDto[]>(`/admin/discord/audit?limit=${limit}`)
  },

  async getDiscordMetrics() {
    return api.get<string>('/admin/discord/metrics')
  },

  // ── Coupons ─────────────────────────────────────────────────────────────────

  async getCoupons() {
    return api.get('/coupons')
  },

  async getCoupon(uuid: string) {
    return api.get(`/coupons/${uuid}`)
  },

  async getCouponRedemptions(uuid: string) {
    return api.get(`/coupons/${uuid}/redemptions`)
  },

  async createCoupon(data: Record<string, unknown>) {
    return api.post('/coupons', data)
  },

  async updateCoupon(uuid: string, data: Record<string, unknown>) {
    return api.patch(`/coupons/${uuid}`, data)
  },

  async deleteCoupon(uuid: string) {
    return api.delete(`/coupons/${uuid}`)
  },

  // ── Steam Bots ──────────────────────────────────────────────────────────────

  async getSteamBots() {
    return api.get('/steam-bots')
  },

  async createSteamBot(data: Record<string, unknown>) {
    return api.post('/steam-bots', data)
  },

  async updateSteamBot(uuid: string, data: Record<string, unknown>) {
    return api.patch(`/steam-bots/${uuid}`, data)
  },

  async deleteSteamBot(uuid: string) {
    return api.delete(`/steam-bots/${uuid}`)
  },

  // WhatsApp Blast
  async previewWhatsappBlast(segment: string, limit: number, tierRank?: number) {
    const params = new URLSearchParams({ segment, limit: String(limit) })
    if (tierRank !== undefined) params.append('tierRank', String(tierRank))
    return api.get<Array<{
      id: string
      username: string | null
      email: string | null
      contact: string
      sales_count: number
      total_spent: number
      tier_rank: number
      tier_name: string
    }>>(`/admin/whatsapp/blast/preview?${params}`)
  },

  async sendWhatsappBlast(userUuids: string[], message: string, spacingMs?: number) {
    return api.post<{ queued: number; spacingMs: number }>('/admin/whatsapp/blast', { userUuids, message, spacingMs })
  },

  async sendWhatsappBlastByPhones(phones: string[], message: string, spacingMs?: number) {
    return api.post<{ queued: number; skipped: number; invalid: string[]; spacingMs: number }>('/admin/whatsapp/blast/by-phones', { phones, message, spacingMs })
  },

  async getUserHeroPreferences(page = 1, limit = 20, search?: string) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search) params.append('search', search)
    return api.get(`/admin/user-hero-preferences?${params}`)
  },

  async getNewsList(page = 1, limit = 20) {
    return api.get(`/news?page=${page}&limit=${limit}`)
  },

  async getNews(uuid: string) {
    return api.get(`/news/${uuid}`)
  },

  async createNews(payload: Record<string, unknown>) {
    return api.post('/news', payload)
  },

  async updateNews(uuid: string, payload: Record<string, unknown>) {
    return api.put(`/news/${uuid}`, payload)
  },

  async deleteNews(uuid: string) {
    return api.delete(`/news/${uuid}`)
  },

  async getSwaps(status?: string) {
    const query = status ? `?status=${status}` : ''
    return api.get(`/swaps${query}`)
  },

  async getSwap(uuid: string) {
    return api.get(`/swaps/${uuid}`)
  },

  async approveSwap(uuid: string) {
    return api.post(`/swaps/${uuid}/approve`)
  },

  async deliverSwap(uuid: string) {
    return api.post(`/swaps/${uuid}/deliver`)
  },

  async rejectSwap(uuid: string, reason?: string) {
    return api.post(`/swaps/${uuid}/reject`, { reason })
  },

  async refreshSwapCompensation(uuid: string) {
    return api.post(`/swaps/${uuid}/compensation/refresh`)
  },

  async simulateSwapCompensationPaid(uuid: string) {
    return api.post(`/swaps/${uuid}/compensation/simulate-paid`)
  },

  async getSwapMultiplier() {
    return api.get<{ multiplier: number; storeMultiplier: number }>('/swaps/config/multiplier')
  },

  async setSwapMultiplier(payload: { multiplier?: number; storeMultiplier?: number }) {
    return api.post<{ multiplier: number; storeMultiplier: number }>(
      '/swaps/config/multiplier',
      payload,
    )
  },

  async getSwapCompensationConfig() {
    return api.get<SwapCompensationConfig>('/swaps/config/compensation')
  },

  async setSwapCompensationConfig(config: Partial<SwapCompensationConfig>) {
    return api.post<SwapCompensationConfig>('/swaps/config/compensation', config)
  },

  async getRarityMultipliers() {
    return api.get<RarityMultiplier[]>('/swaps/config/rarity-multipliers')
  },

  async upsertRarityMultiplier(payload: RarityMultiplierInput) {
    return api.post<RarityMultiplier[]>('/swaps/config/rarity-multipliers', payload)
  },

  async deleteRarityMultiplier(rarity: string) {
    return api.post<RarityMultiplier[]>('/swaps/config/rarity-multipliers/delete', { rarity })
  },

  async getPricingConfig() {
    return api.get<PricingConfig>('/skins/admin/pricing-config')
  },

  async setPricingConfig(payload: PricingConfigInput) {
    return api.post<PricingConfigBase>('/skins/admin/pricing-config', payload)
  },

  async upsertArcanaHeroMultiplier(payload: ArcanaHeroMultiplierInput) {
    return api.post<ArcanaHeroMultiplier[]>('/skins/admin/pricing-config/arcana-heroes', payload)
  },

  async deleteArcanaHeroMultiplier(hero: string) {
    return api.post<ArcanaHeroMultiplier[]>('/skins/admin/pricing-config/arcana-heroes/delete', { hero })
  },
}

export interface MarketExplorerFilters {
  search?: string
  hero?: string
  type?: string
  slot?: string
  rarity?: string
  qualities?: string[]
  priceFilter?: 'all' | 'with' | 'without'
  priceMin?: number
  priceMax?: number
  sortBy?: 'price' | 'name' | 'rarity' | 'variation'
  sortDir?: 'asc' | 'desc'
}

export interface MarketExplorerItem {
  marketHashName: string
  name: string | null
  image: string | null
  steamMarketUrl: string
  rarity: string | null
  quality: string | null
  type: string | null
  slot: string | null
  hero: string | null
  salePrice: number | null
  priceLatest: number | null
  priceMedian: number | null
  priceUpdatedAt: string | null
}

export interface MarketExplorerFacets {
  heroes: string[]
  types: string[]
  slots: string[]
  rarities: string[]
  qualities: string[]
}

export interface MarketExplorerResponse {
  data: MarketExplorerItem[]
  total: number
  page: number
  pages: number
  pageSize: number
  fetchedAt: string
  facets: MarketExplorerFacets
}

export interface SwapCompensationConfig {
  enabled: boolean
  max: number
  tolerance: number
  margin: number
  maxUserItems: number
}

export interface RarityMultiplier {
  rarity: string
  userMultiplier: number
  storeMultiplier: number
  active: boolean
}

export interface RarityMultiplierInput {
  rarity: string
  userMultiplier?: number
  storeMultiplier?: number
  active?: boolean
}

export interface ArcanaHeroMultiplier {
  hero: string
  level1: number
  level2: number
  level3: number
  active: boolean
}

export interface ArcanaHeroMultiplierInput {
  hero: string
  level1?: number
  level2?: number
  level3?: number
  active?: boolean
}

export interface PricingConfigBase {
  priceSyncDiscount: number
  dropshipPriceMultiplier: number
  arcanaLevelMultipliers: Record<1 | 2 | 3, number>
}

export interface PricingConfig extends PricingConfigBase {
  arcanaHeroes: ArcanaHeroMultiplier[]
  heroOptions: string[]
}

export interface PricingConfigInput {
  priceSyncDiscount?: number
  dropshipPriceMultiplier?: number
  arcanaLevel1Multiplier?: number
  arcanaLevel2Multiplier?: number
  arcanaLevel3Multiplier?: number
}

export interface SkinPriceCatalogItem {
  id: string
  name: string
  hero: string | null
  icon_url_large: string | null
  lowest_price: number | null
  median_price: number | null
  manual_price: number | null
  last_price_update_at: string | null
  first_median_price: number | null
  last_median_price: number | null
  median_price_change_pct: number | null
  price_avg: number | null
  price_avg_24h: number | null
  price_avg_7d: number | null
  price_avg_30d: number | null
  price_avg_90d: number | null
}

export interface SkinPriceCatalogResponse {
  data: SkinPriceCatalogItem[]
  total: number
  page: number
  pages: number
  facets: MarketExplorerFacets
}

export interface SkinPriceHistoryPoint {
  day: string
  lowest_price: number | null
  median_price: number | null
  manual_price: number | null
  price_avg: number | null
  price_avg_24h: number | null
  price_avg_7d: number | null
  price_avg_30d: number | null
  price_avg_90d: number | null
}

export interface SkinPriceHistoryResponse {
  skin: {
    id: string
    name: string
    hero: string | null
    icon_url_large: string | null
    // Shape interno não documentado pelo steamwebapi — renderizado de forma genérica.
    latest_10_sales: unknown[] | null
  }
  points: SkinPriceHistoryPoint[]
}
