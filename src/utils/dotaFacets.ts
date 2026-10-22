// Mesmas opções dos filtros da vitrine (secretshop-front/src/utils/dotaFacets.ts e
// views/products): o `value` é o valor gravado em skins.rarity/type/slot/quality — nunca traduzir.
// Mudou lá, muda aqui.

export interface FacetOption {
    value: string
    label: string
}

export const RARITY_OPTIONS: FacetOption[] = [
    { value: 'Common', label: 'Comum' },
    { value: 'Uncommon', label: 'Incomum' },
    { value: 'Rare', label: 'Rara' },
    { value: 'Mythical', label: 'Mítica' },
    { value: 'Legendary', label: 'Lendária' },
    { value: 'Ancient', label: 'Ancestral' },
    { value: 'Immortal', label: 'Imortal' },
    { value: 'Arcana', label: 'Arcana' },
]

export const SLOT_OPTIONS: FacetOption[] = [
    { value: 'Weapon', label: 'Arma' },
    { value: 'Head', label: 'Cabeça' },
    { value: 'Back', label: 'Costas' },
    { value: 'Shoulder', label: 'Ombros' },
    { value: 'Arms', label: 'Braços' },
    { value: 'Belt', label: 'Cinto' },
    { value: 'Off-Hand', label: 'Mão secundária' },
    { value: 'Armor', label: 'Armadura' },
    { value: 'Legs', label: 'Pernas' },
    { value: 'Misc', label: 'Diversos' },
    { value: 'Mount', label: 'Montaria' },
    { value: 'Tail', label: 'Cauda' },
    { value: 'Neck', label: 'Pescoço' },
    { value: 'Hero Base', label: 'Base do herói' },
    { value: 'Summoned Unit', label: 'Unidade invocada' },
    { value: 'Shapeshift', label: 'Transformação' },
    { value: 'Gloves', label: 'Luvas' },
]

export const TYPE_OPTIONS: FacetOption[] = [
    { value: 'Wearable', label: 'Skin de herói' },
    { value: 'Taunt', label: 'Provocação' },
    { value: 'Bundle', label: 'Conjunto' },
    { value: 'Sticker', label: 'Adesivo' },
    { value: 'Announcer', label: 'Narrador' },
    { value: 'Courier', label: 'Mensageiro' },
    { value: 'Ward', label: 'Sentinela' },
    { value: 'Loading Screen', label: 'Tela de carregamento' },
    { value: 'HUD Skin', label: 'HUD' },
    { value: 'Cursor Pack', label: 'Cursor' },
    { value: 'Music', label: 'Trilha sonora' },
    { value: 'Terrain', label: 'Terreno' },
    { value: 'Treasure', label: 'Tesouro' },
    { value: 'Gem / Rune', label: 'Gema / Runa' },
    { value: 'Tool', label: 'Ferramenta' },
    { value: 'Misc', label: 'Diversos' },
]

export const QUALITY_OPTIONS: FacetOption[] = [
    'Standard',
    'Inscribed',
    'Genuine',
    'Gold',
    'Autographed',
    'Infused',
    'Unusual',
    'Exalted',
    'Corrupted',
    'Auspicious',
    'Heroic',
    'Holo',
    'Glitter',
    'Cursed',
    'Ascendant',
    'Frozen',
    'Elder',
    'Base',
].map((value) => ({ value, label: value }))

export const SORT_OPTIONS: FacetOption[] = [
    { value: '', label: 'Mais recentes' },
    { value: 'name_asc', label: 'Nome (A-Z)' },
    { value: 'name_desc', label: 'Nome (Z-A)' },
    { value: 'price_asc', label: 'Menor preço' },
    { value: 'price_desc', label: 'Maior preço' },
]
