import type { FinishLayout } from '@/views/instagram/finishCanvas'

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
  purchasedAt?: string | null
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

export type DropshipStage = 'purchased' | 'to_buy'

export interface DropshipQueueFilter {
  onlyUnread?: boolean
  stage?: DropshipStage
}

export interface DropshipNotificationsResponse {
  data: DropshipNotificationDto[]
  total: number
  page: number
  limit: number
}

export type CollectorTaskAction = 'ready' | 'waiting' | 'add_friend' | 'check_friendship'

/** Pedido collector pago com linha ainda não enviada — o que falta pra presentear. */
export interface CollectorTask {
  id: string
  order_number: string
  total_amount: number
  user_name: string
  items: string[]
  paid_days_ago: number
  overdue: boolean
  action: CollectorTaskAction
  friendship_age_days: number | null
  unlocks_in_days: number | null
  /** Conta collector que decide o status (a mais travada do pedido). */
  blocking_account?: string | null
  /** Prazo de presente mais curto do pedido ("Giftable until"); null = sem prazo. */
  gift_deadline?: string | null
  gift_deadline_days?: number | null
  /** A amizade não libera antes do prazo: do jeito que está, não dá pra entregar. */
  misses_gift_deadline?: boolean
}

/** Estoque com prazo de presente numa conta, agrupado pelo dia em que vence. */
export interface GiftStockGroup {
  steam_id: string
  account_name: string
  giftable_until: string
  /** Negativo = já venceu e ficou preso no bot. */
  days_left: number
  available: number
  unpriced: number
  /** Já não dá tempo de vender e entregar: pior caso, reciclar. */
  recycle?: boolean
  sets: Array<{ name: string; units: number }>
}

/** Encomenda paga esperando o próximo lote. */
export interface BackorderQueueEntry {
  /** UUID do pedido. */
  id: string
  order_number: string
  user_name: string
  item: string
  paid_days_ago: number
  action: CollectorTaskAction
  /** Quando o presente libera pro cliente; null se ainda não é amigo da conta. */
  unlocks_at: string | null
}

/** Fila do próximo lote numa conta: o que abrir e quando. */
export interface BackorderQueueAccount {
  steam_id: string
  account_name: string
  units: number
  /** Sugestão de quando abrir o lote: quando o primeiro amigo da fila libera. */
  open_at: string | null
  /** O primeiro da fila já liberou: abrir o lote agora. */
  open_now: boolean
  sets: Array<{ name: string; units: number }>
  entries: BackorderQueueEntry[]
}

export interface DropshipTask {
  id: string
  sale_uuid: string | null
  order_number: string
  user_name: string
  total_amount: number
  items: string[]
  waiting_days: number
  purchased_at: string | null
}

export interface TodayTasks {
  generated_at: string
  collector: CollectorTask[]
  dropship: DropshipTask[]
  gift_stock?: GiftStockGroup[]
  backorder_queue?: BackorderQueueAccount[]
}

export type SwapNotificationType =
  | 'swap_approve_conflict'
  | 'swap_review'
  | 'swap_countered'
  | 'swap_compensation_refund'

export interface SwapNotificationDto {
  id: string
  type: SwapNotificationType
  title: string
  body: string
  metadata: { swap_uuid?: string; detail?: string } | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface SwapNotificationsResponse {
  data: SwapNotificationDto[]
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

export interface AchievementDto {
  code:       string
  label:      string
  hint:       string
  xp:         number
  done:       boolean
  awarded_at: string | null
}

export interface ProfileProgressDto {
  xp:             number
  tier:           number
  tier_max:       number
  tier_min_xp:    number
  next_tier_xp:   number | null
  progress_pct:   number
  purchase_xp:     number
  purchase_count:  number
  tier_thresholds: number[]
  achievements:    AchievementDto[]
}

/** Janela de XP multiplicado nas compras. Datas ISO; fim exclusivo. */
export interface XpBoost {
  multiplier: number
  starts_at:  string
  ends_at:    string
}

export interface XpBoostResponse {
  boost: (XpBoost & { active: boolean }) | null
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
  /** `uuid` chega como `id`: o interceptor do backend renomeia na resposta. */
  id: string
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

/** Linha do ranking de vendas por skin (`/admin/sales/reports/by-skin`). Valores em centavos. */
export interface SkinSalesRow {
  skin_name: string
  market_hash_name: string | null
  skin_image: string | null
  quantity: number
  items: number
  orders: number
  buyers: number
  revenue: number
  cost: number
  /** Itens vendidos com custo conhecido; menor que `items` = lucro parcial (dropship não tem custo). */
  cost_items: number
  discount: number
  first_sale_at: string | null
  last_sale_at: string | null
  stock_available: number
  stock_blocked: number
  stock_value: number
}

/** Linha do resumo de demanda (`/admin/demand`). Preço em centavos. */
export interface DemandRow {
  kind: 'skin' | 'collector' | 'physical'
  /** Identidade dentro do catálogo: uuid da skin/produto, ou `market_hash_name|hero_id` no collector. */
  key: string
  name: string
  image: string | null
  market_hash_name: string | null
  hero: string | null
  price: number | null
  is_dropship: boolean
  favorites: number
  last_favorited_at: string | null
  cart_lines: number
  cart_quantity: number
  cart_users: number
  last_carted_at: string | null
  stock_available: number
  /** Unidades em linha soft-deletada — fora da venda, mas o admin quer saber que existe. */
  stock_deleted: number
}

/** Item nas listas de Tendências: lado Steam (preço de consenso, volume) + lado site. Preços em centavos. */
export interface MarketTrendItem {
  marketHashName: string
  name: string
  image: string | null
  hero: string | null
  rarity: string | null
  quality: string | null
  /** Preço que a vitrine mostra agora; null = não está à venda na loja. */
  sitePrice: number | null
  /** Preço de referência por dia, do mais antigo pro mais novo. */
  history: number[]
  priceNow: number | null
  priceBefore: number | null
  changePct: number | null
  sold24h: number | null
  sold7d: number | null
  /** Vendas 24h ÷ média diária da semana. 2 = o dobro do normal. */
  volumeSpike: number | null
  offerVolume: number | null
  buyOrderPrice: number | null
  siteSold: number
  siteRevenue: number
  favorites: number
  inCarts: number
  stock: number
}

export interface MarketTrendSearch {
  term: string
  hits: number
  zeroHits: number
}

/** Faixa do desvio contra a mediana de 21 dias, já descontado o mercado. */
export type SwapTrendSignal = 'pico' | 'alta' | 'estavel' | 'baixa' | 'fundo' | 'iliquido' | 'sem_dados'

/** Fator por sinal no valor do item do usuário (1 = sem ajuste). "Sem dados" nunca mexe. */
export type SwapTrendFactors = Record<Exclude<SwapTrendSignal, 'sem_dados'>, number>

export interface SwapTrendItem {
  marketHashName: string
  name: string
  image: string | null
  hero: string | null
  rarity: string | null
  /** Preço de consenso por dia (centavos), 21 dias + o último sync. */
  history: number[]
  signal: SwapTrendSignal
  priceNow: number | null
  baseMedian: number | null
  deviationPct: number | null
  /** Desvio descontado o mercado — é o que decide o sinal. */
  relativePct: number | null
  change7Pct: number | null
  /** Mediana medida da semana seguinte nessa faixa, contra o mercado. */
  nextWeekPct: number | null
  sold7d: number | null
  buyOrderPrice: number | null
  offerVolume: number | null
  offered: number
  owners: number
  inOpenSwaps: number
  /** Preço médio congelado nos snapshots do trocador (SteamWebAPI no fetch). */
  frozenPrice: number | null
  frozenVsNowPct: number | null
}

export interface SwapTrendsResponse {
  day: string
  market: { liquidItems: number; deviationPct: number | null }
  exposure: { items: number; illiquid: number; frozenAbove: number }
  items: SwapTrendItem[]
}

export interface MarketTrendsResponse {
  day: string
  fromDay: string
  period: 1 | 7 | 30
  minSold7d: number
  onlyStock: boolean
  /** false = não houve sync nesse dia (data futura ou buraco no histórico). */
  hasSnapshot: boolean
  /**
   * Dia de onde vem o filtro de liquidez. null = nenhum volume gravado ainda (listas da
   * Steam vazias). Diferente de `day` = dia anterior ao registro de volume (pico e giro vazios).
   */
  liquidityDay: string | null
  market: { liquidItems: number; rising: number; falling: number; medianChangePct: number | null }
  steam: {
    gainers: MarketTrendItem[]
    losers: MarketTrendItem[]
    volumeSpikes: MarketTrendItem[]
    mostTraded: MarketTrendItem[]
  }
  site: {
    topSold: MarketTrendItem[]
    mostWanted: MarketTrendItem[]
    searches: MarketTrendSearch[]
    missedSearches: MarketTrendSearch[]
    /** Total real de termos sem resultado — a lista acima vem cortada em 25. */
    missedTotal: number
  }
}

/** Todo item do estoque com lucro, ranqueado por `score`. A tela filtra e recorta. */
export interface MarketStoriesResponse {
  day: string
  fromDay: string
  period: 1 | 7 | 30
  minSold7d: number
  picks: StoryPick[]
}

export interface StoryPick {
  /** uuid da skin — vai como skin_uuid no composer do Instagram. */
  skinId: string
  marketHashName: string
  name: string
  image: string | null
  hero: string | null
  rarity: string | null
  stock: number
  sitePrice: number
  avgCost: number
  profit: number
  marginPct: number
  steamPrice: number | null
  /** Positivo = loja mais barata que a Steam. */
  discountVsSteamPct: number | null
  steamChangePct: number | null
  favorites: number
  inCarts: number
  siteSold: number
  searchHits: number
  topSearch: string | null
  score: number
  /** Frase pronta pro story. */
  hook: string
  reasons: string[]
}

// Steam Market ao vivo. Centavos na moeda que a Steam devolveu (`currency`).

/** bot = lido logado pelo TradeBot (moeda da carteira); anonymous = moeda do IP do servidor. */
export type SteamMarketSource = 'bot' | 'anonymous'

export interface SteamOrderLevel {
  priceCents: number
  quantity: number
}

export interface SteamOrderbook {
  currency: string
  minSellCents: number
  maxBuyCents: number
  sellCount: number
  buyCount: number
  /** Do mais barato pro mais caro. */
  sell: SteamOrderLevel[]
  /** Do maior lance pro menor. */
  buy: SteamOrderLevel[]
  source: SteamMarketSource
  /** Quando o dado saiu da Steam (cache do backend: até 30s antes do pedido). */
  fetchedAt: string
}

export interface SteamBotWallet {
  /** ISO (BRL, USD...) ou STEAM_<id> se a Steam mandar moeda desconhecida. */
  currency: string
  balanceCents: number
}

export type MarketTraderMode = 'off' | 'paper' | 'live'

export interface MarketTraderLimits {
  budgetCents: number
  minUnitCents: number
  maxUnitCents: number
  minSold7d: number
  minMarginPct: number
  minExitMarginPct: number
  patienceDays: number
  bidTtlHours: number
  maxPerItem: number
  maxOpenBids: number
  maxNewOrdersPerCycle: number
  maxReadsPerCycle: number
  maxLoss7dCents: number
}

export type MarketTraderConfig = MarketTraderLimits & { mode: MarketTraderMode }

export interface MarketTraderSummary {
  openCount: number
  committedCents: number
  soldCount: number
  wins: number
  realizedCents: number
  returnPct: number | null
}

export interface MarketTraderDecision {
  marginPct: number
  expectedReceiveCents: number
  referenceCents: number
  signal: string
  relativePct: number | null
  sold7d: number
  interest: number
  score: number
}

export interface MarketTraderPosition {
  id: string
  mode: 'paper' | 'live'
  marketHashName: string
  status: 'bidding' | 'unclaimed' | 'holding' | 'listed' | 'sold' | 'cancelled'
  bidCents: number
  receiveCents: number | null
  buyOrderId: string | null
  createdAt: string
  filledAt: string | null
  unlocksAt: string | null
  listedAt: string | null
  closedAt: string | null
  closedReason: string | null
  decision: MarketTraderDecision | null
}

export interface MarketTraderEvent {
  id: string
  kind: string
  message: string
  marketHashName: string | null
  /** Hash da CDN da Steam ou URL. */
  image: string | null
  /** Números da decisão: chave *Cents = dinheiro, *Pct = %. null em evento antigo. */
  data: Record<string, unknown> | null
  createdAt: string
}

export interface MarketTraderBookHour {
  /** Hora de Brasília, 0–23. */
  hour: number
  samples: number
  items: number
  /** Maior lance contra o normal do próprio item: negativo = lance mais barato nessa hora. */
  bidVsItemPct: number
  /** Menor venda contra o normal do próprio item: positivo = vende mais caro nessa hora. */
  askVsItemPct: number
  /** Quanto sobra entre lance e venda, depois da taxa. */
  spreadPct: number
}

export interface MarketTraderHours {
  samples: number
  items: number
  since: string | null
  hours: MarketTraderBookHour[]
}

export interface MarketTraderOverview {
  config: MarketTraderConfig
  /** false = servidor sem MARKET_TRADER_ENABLED: cron parado e modo real bloqueado. */
  liveAllowed: boolean
  running: boolean
  bots: { id: string; name: string; isTrader: boolean }[]
  wallet: SteamBotWallet | null
  market: { day: string; deviationPct: number | null; movePct: number | null; falling: boolean } | null
  summary: { paper: MarketTraderSummary; live: MarketTraderSummary }
  positions: MarketTraderPosition[]
  events: MarketTraderEvent[]
}

export interface SteamBuyOrderInput {
  /** uuid do bot (chega como `id` na lista de bots). */
  botId: string
  marketHashName: string
  /** Por unidade, já com taxa — mesmo valor do livro de buy orders. */
  priceCents: number
  quantity: number
}

export interface SteamBuyOrderResult {
  buyOrderId: string
  /**
   * filled = executou tudo na hora; partial = comprou parte e o resto segue aberto;
   * open = esperando vendedor; unknown = criada, mas a Steam não deixou conferir (ex.: 429).
   */
  status: 'filled' | 'partial' | 'open' | 'unknown'
  purchases: { appid: number; contextid: string; assetid: string }[]
  wallet: SteamBotWallet | null
}

export interface SteamOpenBuyOrder {
  buyOrderId: string
  appid: number
  marketHashName: string | null
  name: string | null
  /** Hash da imagem na CDN da Steam. */
  icon: string | null
  currency: string
  /** Por unidade, já com taxa. */
  priceCents: number
  quantity: number
  quantityRemaining: number
}

export interface SteamSellListing {
  listingId: string
  /** awaiting_confirmation = falta a confirmação mobile; on_hold = segurada pela Steam. */
  status: 'active' | 'awaiting_confirmation' | 'on_hold'
  assetId: string | null
  marketHashName: string | null
  name: string | null
  /** Hash da imagem na CDN da Steam. */
  icon: string | null
  /** null = a Steam não mandou e a carteira do bot ainda não carregou. */
  currency: string | null
  /** O que o bot recebe se vender. */
  receiveCents: number
  /** O que o comprador paga (recebe + taxas). */
  buyerPaysCents: number
  createdAt: string | null
}

/** O mylistings da Steam traz buy orders e vendas juntas: uma consulta pras duas listas. */
export interface SteamOpenBuyOrders {
  orders: SteamOpenBuyOrder[]
  listings: SteamSellListing[]
  wallet: SteamBotWallet | null
}

/**
 * on_sale = está no estoque do site; committed = reservado ou vendido no site, esperando
 * entrega (o backend recusa a venda); null = o site não conhece o item.
 */
export type SteamSiteStatus = 'on_sale' | 'committed' | null

export interface SteamInventoryItem {
  assetId: string
  name: string
  icon: string | null
  /** false = comprado no Market há menos de 7 dias. */
  marketable: boolean
  siteStatus: SteamSiteStatus
}

export interface SteamSellInput {
  /** uuid do bot (chega como `id` na lista de bots). */
  botId: string
  assetId: string
  /** O que o bot recebe, sem taxa. */
  receiveCents: number
}

export interface SteamSellResult {
  /** awaiting_confirmation = o checker do bot aprova em ~10s (sem identity secret, no celular). */
  status: 'listed' | 'awaiting_confirmation'
  /** A venda foi feita, mas o item do estoque do site não saiu da vitrine: o admin precisa agir. */
  siteWarning: string | null
}

/** Skin da vitrine (GET /skins) — mesma busca e filtros que o cliente usa. `id` = uuid da skin. */
export interface StoreSkin {
  id: string
  name: string
  market_hash_name: string
  hero: string | null
  rarity: string | null
  icon_url_large: string | null
  effective_price: number
  quantity: number
}

export interface KitItem {
  /** uuid da skin */
  id: string
  name: string
  market_hash_name: string
  hero: string | null
  rarity: string | null
  icon_url_large: string | null
  /** Preço avulso ao vivo: unidade mais barata vendável. */
  price: number
  is_available: boolean
}

export interface Kit {
  id: string
  name: string
  is_active: boolean
  /** Preço configurado do combo. */
  price: number
  /** O que o cliente paga: min(price, items_total). */
  sale_price: number
  items_total: number
  is_available: boolean
  items: KitItem[]
}

export interface KitPayload {
  name: string
  price: number
  is_active: boolean
  skin_uuids: string[]
}

// ── Story automático de skins (/instagram/auto-stories) ─────────────────────

export type AutoStoryBand = { max_cents: number | null; count: number; skip_days: number }

export type AutoStoryConfig = {
  is_active: boolean
  auto_publish: boolean
  /** 0 = domingo … 6 = sábado. */
  weekdays: number[]
  prepare_time: string
  publish_time: string
  coupon_uuid: string | null
  note_template: string
  bands: AutoStoryBand[]
  max_per_hero: number
  max_new_arts_per_day: number
  period: 1 | 7 | 30
  min_sold_7d: number
  layout: FinishLayout | null
}

export type AutoStoryRunResult = {
  created: number
  reused: number
  generated: number
  failed: number
  skipped: { cap_reached: number; error: number }
  error: string | null
}

export type AutoStoryLastRun = {
  date: string
  trigger: 'job' | 'manual'
  started_at: string
  finished_at: string | null
  interrupted?: boolean
  result: AutoStoryRunResult | null
}

export type AutoStoryPublishResult = {
  published: number
  skipped_stock: number
  repriced: number
  failed: number
  error: string | null
}

export type AutoStoryLastPublish = {
  date: string
  started_at: string
  finished_at: string | null
  result: AutoStoryPublishResult | null
}

export type AutoStoryMeta = {
  band_index: number
  /** Rótulo da faixa na hora da rodada. */
  band_label: string
  rank: number
  price_cents: number
  coupon_uuid: string
  coupon_code: string
  note: string
  new_art: boolean
}

export type AutoStoryRow = {
  /** uuid do post (o interceptor renomeia). */
  id: string
  status: 'GENERATING' | 'DRAFT' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED'
  error: string | null
  image_url: string | null
  /** Arte crua (sem preço/cupom): fundo do editor de posição. */
  base_image_url: string | null
  finish_layout: FinishLayout | null
  permalink: string | null
  published_at: string | null
  auto_meta: AutoStoryMeta | null
  skin: { id: string; market_hash_name: string } | null
  current_price_cents: number | null
  stock: number
}

export type AutoStoryOverview = {
  config: AutoStoryConfig
  last_run: AutoStoryLastRun | null
  last_publish: AutoStoryLastPublish | null
  preparing: boolean
  publishing: boolean
  next_run: string
  coupon_problem: string | null
  /** false = backend local: o cron não roda e publicar daqui é bloqueado. */
  automation_enabled: boolean
  today: AutoStoryRow[]
  /** Arte crua mais recente: fundo do editor de posição. */
  sample_art_url: string | null
}

export type AutoStoryPlan = {
  /** Snapshot da Steam ainda calculando (boot/sync): o painel tenta de novo em seguida. */
  ranking_pending?: boolean
  coupon_problem: string | null
  bands: { label: string; count: number; available: number; selected: number }[]
  skins: {
    skin_uuid: string
    name: string
    /** Ícone da Steam (hash ou URL). Backend antigo não manda. */
    image?: string | null
    hero: string | null
    price_cents: number
    band: string
    has_art: boolean
  }[]
  new_arts: number
  new_arts_left_today: number
  estimated_cost_usd: number
}

export type AutoStoryCoupon = { id: string; code: string; description: string | null }
