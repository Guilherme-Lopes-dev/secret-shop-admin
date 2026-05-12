import { api } from '@/lib/api/api'

const collectorNotificationTypes = 'COLLECTOR_PURCHASE,COLLECTOR_SHIPPING_REMINDER'

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

  async getAllSales(page: number = 1, limit: number = 20) {
    return api.get(`/admin/sales?page=${page}&limit=${limit}`)
  },

  async getSaleById(id: string | number) {
    return api.get(`/admin/sales/${id}`)
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
  ) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search) params.append('search', search)
    if (sort) params.append('sort', sort)
    if (minOrders !== undefined) params.append('minOrders', String(minOrders))
    if (maxOrders !== undefined) params.append('maxOrders', String(maxOrders))
    if (minSpent !== undefined) params.append('minSpent', String(minSpent))
    if (maxSpent !== undefined) params.append('maxSpent', String(maxSpent))
    return api.get(`/admin/users?${params}`)
  },

  async getUserById(uuid: string) {
    return api.get(`/admin/users/${uuid}`)
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
  ) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (botId) params.append('botId', botId)
    if (status) params.append('status', status)
    if (search) params.append('search', search)
    if (sort) params.append('sort', sort)
    if (minPrice !== undefined) params.append('minPrice', String(minPrice))
    if (maxPrice !== undefined) params.append('maxPrice', String(maxPrice))
    return api.get(`/skins/admin/inventory?${params}`)
  },

  async syncInventory() {
    return api.post('/skins/admin/sync')
  },

  // Bots
  async getBots() {
    return api.get('/steam-bots')
  },

  async getSteamInventoryBySteamId(steamId: string) {
    return api.get(`/steam/admin/skins/${steamId}`)
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

  // Collectors catalog
  async getCollectors(params: {
    page?: number
    limit?: number
    steamId?: string
    search?: string
    minPrice?: number
    maxPrice?: number
  } = {}) {
    const p = new URLSearchParams({ page: String(params.page ?? 1), limit: String(params.limit ?? 20) })
    if (params.steamId) p.append('steamId', params.steamId)
    if (params.search) p.append('search', params.search)
    if (params.minPrice !== undefined) p.append('minPrice', String(params.minPrice))
    if (params.maxPrice !== undefined) p.append('maxPrice', String(params.maxPrice))
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
}
