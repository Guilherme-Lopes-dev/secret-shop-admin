import type { CrmCampaign, CrmCustomer } from '@/services/admin/admin.service'

// Espelha a ordem de prioridade do CASE no backend (src/crm/campaigns.ts).
export const CAMPAIGNS: Record<CrmCampaign, { label: string; icon: string; color: string; hint: string }> = {
    abandoned_cart: {
        label: 'Carrinho abandonado',
        icon: 'mdi:cart-off',
        color: '#f59e0b',
        hint: 'Tem item parado no carrinho há menos de 30 dias. Lembrete direto com o item, cupom pequeno se não voltar.',
    },
    first_purchase: {
        label: 'Primeira compra',
        icon: 'mdi:sprout-outline',
        color: '#38bdf8',
        hint: 'Nunca comprou. Cupom de boas-vindas nos heróis que ele joga.',
    },
    winback: {
        label: 'Winback',
        icon: 'mdi:account-arrow-left-outline',
        color: '#f87171',
        hint: 'Mais de 90 dias sem comprar. Oferta agressiva ou ele não volta.',
    },
    reactivation: {
        label: 'Reativação',
        icon: 'mdi:refresh',
        color: '#fb923c',
        hint: 'Entre 30 e 90 dias sem comprar. Novidade do herói favorito + cupom moderado.',
    },
    vip: {
        label: 'VIP',
        icon: 'mdi:crown-outline',
        color: '#e4ae33',
        hint: 'Ativo e acima de R$ 1.000 gastos. Acesso antecipado e atendimento pessoal — sem cupom.',
    },
    second_purchase: {
        label: 'Segunda compra',
        icon: 'mdi:numeric-2-circle-outline',
        color: '#a78bfa',
        hint: 'Comprou uma vez nos últimos 30 dias. Recomendação do mesmo herói pra virar recorrente.',
    },
    loyalty: {
        label: 'Fidelização',
        icon: 'mdi:heart-outline',
        color: '#4ade80',
        hint: 'Ativo e recorrente. Manter aquecido: novidades, cashback, sorteios.',
    },
}

export const CAMPAIGN_OPTIONS = (Object.keys(CAMPAIGNS) as CrmCampaign[]).map((value) => ({
    value,
    label: CAMPAIGNS[value].label,
}))

export const campaignMeta = (campaign: CrmCampaign | null) => (campaign && CAMPAIGNS[campaign]) || CAMPAIGNS.loyalty

export const daysSince = (date: string | null | undefined): number | null => {
    if (!date) return null

    return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000)
}

export const daysLabel = (days: number | null): string => {
    if (days == null) return 'nunca comprou'
    if (days < 1) return 'hoje'
    if (days === 1) return 'ontem'

    return `há ${days} dias`
}

// O que fez o usuário cair naquela campanha, em uma frase.
const lastPurchase = (customer: CrmCustomer) => `última compra ${daysLabel(customer.days_since_last_purchase)}`
const activeBuyer = (customer: CrmCustomer) => `${customer.orders_count} compras, ativo`

const REASONS: Record<CrmCampaign, (customer: CrmCustomer) => string> = {
    abandoned_cart: (customer) => `${customer.cart_items} item(ns) no carrinho`,
    first_purchase: () => 'nenhuma compra paga',
    winback: lastPurchase,
    reactivation: lastPurchase,
    vip: activeBuyer,
    second_purchase: (customer) => `1 compra ${daysLabel(customer.days_since_last_purchase)}`,
    loyalty: activeBuyer,
}

export const campaignReason = (customer: CrmCustomer): string =>
    customer.campaign ? REASONS[customer.campaign](customer) : ''
