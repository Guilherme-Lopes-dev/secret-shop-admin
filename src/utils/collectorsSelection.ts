export type CollectorInventoryItem = {
  assetId: string
  classId: string
  instanceId: string
  amount: number
  name: string
  marketHashName: string
  type: string | null
  tradable: boolean
  marketable: boolean
  commodity: boolean
  iconUrl: string | null
  iconUrlLarge: string | null
}

export type CollectorInventoryPayload = {
  steamId: string
  total: number
  totalInventoryCount: number
  items: CollectorInventoryItem[]
  fetchedAt: string
}

export type CollectorReviewSelection = {
  steamId: string
  botId?: number
  items: CollectorInventoryItem[]
  priceInputs: Record<string, string>
  heroSelects: Record<string, string>
}

const REVIEW_STORAGE_KEY = 'secretshop-admin:collectors-review-selection:v1'

export const getCollectorItemKey = (item: CollectorInventoryItem) =>
  `${item.assetId}-${item.classId}-${item.instanceId}`

const normalizeCollectorInventoryItem = (item: any): CollectorInventoryItem => ({
  assetId: String(item?.assetId ?? ''),
  classId: String(item?.classId ?? ''),
  instanceId: String(item?.instanceId ?? ''),
  amount: Number(item?.amount ?? 1),
  name: String(item?.name ?? 'Item sem nome'),
  marketHashName: String(item?.marketHashName ?? ''),
  type: item?.type ? String(item.type) : null,
  tradable: Boolean(item?.tradable),
  marketable: Boolean(item?.marketable),
  commodity: Boolean(item?.commodity),
  iconUrl: item?.iconUrl ? String(item.iconUrl) : null,
  iconUrlLarge: item?.iconUrlLarge ? String(item.iconUrlLarge) : null,
})

export const createNormalizedCollectorItem = normalizeCollectorInventoryItem

export function readCollectorReviewSelection(): CollectorReviewSelection | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(REVIEW_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<CollectorReviewSelection>
    const items = Array.isArray(parsed.items)
      ? parsed.items.map((item) => normalizeCollectorInventoryItem(item))
      : []

    return {
      steamId: typeof parsed.steamId === 'string' ? parsed.steamId : '',
      botId: typeof parsed.botId === 'number' ? parsed.botId : undefined,
      items,
      priceInputs:
        parsed.priceInputs && typeof parsed.priceInputs === 'object'
          ? Object.fromEntries(
              Object.entries(parsed.priceInputs).map(([key, value]) => [
                key,
                typeof value === 'string' ? value : String(value ?? ''),
              ]),
            )
          : {},
      heroSelects:
        parsed.heroSelects && typeof parsed.heroSelects === 'object'
          ? Object.fromEntries(
              Object.entries(parsed.heroSelects).map(([key, value]) => [
                key,
                typeof value === 'string' ? value : String(value ?? ''),
              ]),
            )
          : {},
    }
  } catch {
    return null
  }
}

export function saveCollectorReviewSelection(selection: CollectorReviewSelection) {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(selection))
}

export function clearCollectorReviewSelection() {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.removeItem(REVIEW_STORAGE_KEY)
}
