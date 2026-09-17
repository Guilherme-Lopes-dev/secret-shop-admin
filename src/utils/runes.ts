import bounty from '@/assets/runes/bounty.webp'
import doubleDamage from '@/assets/runes/double_damage.webp'
import haste from '@/assets/runes/haste.webp'
import arcane from '@/assets/runes/arcane.webp'
import regeneration from '@/assets/runes/regeneration.webp'
import invisibility from '@/assets/runes/invisibility.webp'
import illusion from '@/assets/runes/illusion.webp'
import water from '@/assets/runes/water.webp'

export type RuneType =
  | 'BOUNTY' | 'DOUBLE_DAMAGE' | 'HASTE' | 'ARCANE'
  | 'REGENERATION' | 'INVISIBILITY' | 'ILLUSION' | 'WATER'

export type RunePage = 'CATALOG' | 'HOME' | 'PRODUCT' | 'ANY'

export interface RuneTypeInfo {
  value: RuneType
  label: string
  image: string
  inGame: string
  suggested: string
}

// Ordem e nomes da wiki PT. `suggested` é só sugestão de prêmio, não regra.
export const RUNE_TYPES: RuneTypeInfo[] = [
  { value: 'BOUNTY',        label: 'Recompensa',     image: bounty,       inGame: 'Dá ouro pro time inteiro. A mais comum.',           suggested: 'Cashback fixo. Spawn diário, muitas vagas.' },
  { value: 'DOUBLE_DAMAGE', label: 'Dano Duplo',     image: doubleDamage, inGame: 'Dobra o dano por um tempo curto.',                   suggested: 'Desconto dobrado (20% em vez de 10%). Rara.' },
  { value: 'HASTE',         label: 'Haste',         image: haste,        inGame: 'Velocidade máxima por um tempo curto.',              suggested: 'Desconto alto, expira em 1h. Quem pega corre.' },
  { value: 'ARCANE',        label: 'Arcana',         image: arcane,       inGame: 'Reduz recarga e custo de mana.',                     suggested: 'Desconto só em Arcanas.' },
  { value: 'REGENERATION',  label: 'Regeneração',    image: regeneration, inGame: 'Recupera vida e mana até encher.',                   suggested: 'Cupom reutilizável: 3 usos por pessoa.' },
  { value: 'INVISIBILITY',  label: 'Invisibilidade', image: invisibility, inGame: 'Herói fica invisível até atacar.',                   suggested: 'Desconto surpresa, só aparece no checkout.' },
  { value: 'ILLUSION',      label: 'Ilusão',         image: illusion,     inGame: 'Cria duas cópias do herói.',                         suggested: 'Cupom com 3 usos pra mesma pessoa, uma ilusão por compra.' },
  { value: 'WATER',         label: 'Água',           image: water,        inGame: 'Regeneração pequena. Só no começo da partida.',      suggested: 'Brinde de entrada pra conta nova.' },
]

export const RUNE_PAGES: Array<{ value: RunePage; label: string }> = [
  { value: 'CATALOG', label: 'Catálogo de skins' },
  { value: 'HOME',    label: 'Home' },
  { value: 'PRODUCT', label: 'Página de produto' },
  { value: 'ANY',     label: 'Qualquer página (aleatória)' },
]

const byValue = Object.fromEntries(RUNE_TYPES.map((r) => [r.value, r])) as Record<RuneType, RuneTypeInfo>

export const runeInfo = (type: string): RuneTypeInfo => byValue[type as RuneType] ?? RUNE_TYPES[0]

export const runePageLabel = (page: string) => RUNE_PAGES.find((p) => p.value === page)?.label ?? page
