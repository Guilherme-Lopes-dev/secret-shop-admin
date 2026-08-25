export interface FriendshipAccount {
    steam_id: string
    name: string | null
    avatar: string | null
    are_friends: boolean
    friend_since: string | null
    friendship_age_days: number | null
    /** Nenhuma das duas listas de amigos é pública — não dá pra afirmar nada. */
    unknown: boolean
}

export interface FriendshipSummary {
    checked_at: string | null
    blocked: boolean
    friends_count: number
    accounts_count: number
    friend_since: string | null
    friendship_age_days: number | null
    accounts: FriendshipAccount[]
}

export type FriendshipStatus = 'friends' | 'not_friends' | 'unknown'

export const FRIENDSHIP_FILTER_OPTIONS: Array<{ label: string; value: '' | FriendshipStatus }> = [
    { label: 'Amizade: todas', value: '' },
    { label: 'Amigos das contas collector', value: 'friends' },
    { label: 'Não amigos', value: 'not_friends' },
    { label: 'Sem dados (lista privada)', value: 'unknown' },
]

/** Atalhos de duração — o admin quase sempre quer uma dessas faixas. */
export const FRIENDSHIP_DURATION_PRESETS: Array<{ label: string; min?: number; max?: number }> = [
    { label: 'Qualquer duração' },
    { label: 'Menos de 7 dias', max: 7 },
    { label: 'Menos de 30 dias', max: 30 },
    { label: '30 a 180 dias', min: 30, max: 180 },
    { label: 'Mais de 180 dias', min: 180 },
    { label: 'Mais de 1 ano', min: 365 },
]

export const friendshipDuration = (days: number | null | undefined): string | null => {
    if (days === null || days === undefined) return null
    if (days < 1) return 'Menos de 1 dia'
    if (days < 30) return `${days} ${days === 1 ? 'dia' : 'dias'}`

    const months = Math.floor(days / 30)
    if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`

    const years = Math.floor(days / 365)
    return `${years} ${years === 1 ? 'ano' : 'anos'}`
}

export const friendshipStatus = (summary?: FriendshipSummary | null): FriendshipStatus => {
    if (!summary || !summary.checked_at || summary.blocked) return 'unknown'
    return summary.friends_count > 0 ? 'friends' : 'not_friends'
}

const STATUS_LABEL: Record<FriendshipStatus, string> = {
    friends: 'Amigos',
    not_friends: 'Não amigos',
    unknown: 'Sem dados',
}

/** Texto da célula: duração da amizade mais antiga, ou o motivo de não ter. */
export const friendshipLabel = (summary?: FriendshipSummary | null): string => {
    const status = friendshipStatus(summary)
    if (status !== 'friends') return STATUS_LABEL[status]
    return friendshipDuration(summary?.friendship_age_days) ?? 'Amigos'
}

export const friendshipTone = (summary?: FriendshipSummary | null): FriendshipStatus =>
    friendshipStatus(summary)

export const friendshipIcon = (summary?: FriendshipSummary | null): string => ({
    friends: 'mdi:account-heart-outline',
    not_friends: 'mdi:account-off-outline',
    unknown: 'mdi:account-question-outline',
}[friendshipStatus(summary)])

export const friendshipDurationRange = (index: string | number): { min?: number; max?: number } =>
    FRIENDSHIP_DURATION_PRESETS[Number(index)] ?? {}
