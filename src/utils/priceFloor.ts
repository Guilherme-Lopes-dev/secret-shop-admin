/**
 * Espelha `isHiddenByProtectionFloor` do backend
 * (secret-shop-backend/src/common/utils/price-protection.util.ts).
 *
 * O piso é uma fração do valor Steam TRAVADO NA ENTRADA da unidade
 * (`entry_steam_price`), não do preço de mercado de agora. Unidade sem entry
 * gravado não tem o que proteger — nunca some da vitrine.
 */

export type FloorStatusKey = 'forced-visible' | 'forced-hidden' | 'no-base' | 'below' | 'ok'

export type FloorStatus = {
  key: FloorStatusKey
  label: string
  hint: string
}

const STATUS: Record<FloorStatusKey, Omit<FloorStatus, 'key'>> = {
  'forced-visible': {
    label: 'Forçada visível',
    hint: 'Override manual: aparece na vitrine mesmo abaixo do piso.',
  },
  'forced-hidden': {
    label: 'Forçada oculta',
    hint: 'Override manual: escondida da vitrine, ignora o preço.',
  },
  'no-base': {
    label: 'Sem piso',
    hint: 'Sem valor Steam de entrada gravado — essa unidade não tem proteção.',
  },
  below: {
    label: 'Travada pelo piso',
    hint: 'Unidade abaixo do piso protegido — sai da vitrine e do carrinho. A skin só some do site se TODAS as unidades dela estiverem assim.',
  },
  ok: {
    label: 'Acima do piso',
    hint: 'Preço respeita o piso protegido — vende normalmente.',
  },
}

export const floorPrice = (entrySteamPrice: number | null, floorPct: number): number | null =>
  entrySteamPrice ? Math.round(entrySteamPrice * floorPct) : null

/** Variação do preço de venda contra o valor travado na entrada, em %. */
export const entryVariationPct = (
  price: number | null,
  entrySteamPrice: number | null,
): number | null => {
  // price 0 é preço de verdade (item zerado), só entry 0 impede a divisão.
  if (price == null || !entrySteamPrice) return null

  return (price / entrySteamPrice - 1) * 100
}

export const floorStatus = (
  price: number | null,
  entrySteamPrice: number | null,
  visibilityOverride: boolean | null | undefined,
  floorPct: number,
): FloorStatus => {
  const key = resolveKey(price, entrySteamPrice, visibilityOverride, floorPct)

  return { key, ...STATUS[key] }
}

const resolveKey = (
  price: number | null,
  entrySteamPrice: number | null,
  visibilityOverride: boolean | null | undefined,
  floorPct: number,
): FloorStatusKey => {
  if (visibilityOverride === true) return 'forced-visible'
  if (visibilityOverride === false) return 'forced-hidden'
  if (!entrySteamPrice) return 'no-base'

  const floor = floorPrice(entrySteamPrice, floorPct)
  if (price != null && floor != null && price < floor) return 'below'

  return 'ok'
}
