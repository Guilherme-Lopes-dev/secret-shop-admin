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
  async getAllUsers(page: number = 1, limit: number = 20, search?: string) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search) params.append('search', search)
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
