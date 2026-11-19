import type { ChangeImpact, PatchRecommendation, RecommendationAction } from './patchAnalysisApi'

export const ACTION_LABELS: Record<RecommendationAction, string> = {
  raise: 'Subir preço',
  lower: 'Baixar preço',
  hold: 'Manter e acompanhar',
  buy_stock: 'Comprar estoque',
}

export const CONFIDENCE_LABELS: Record<PatchRecommendation['confidence'], string> = {
  low: 'confiança baixa',
  medium: 'confiança média',
  high: 'confiança alta',
}

export const IMPACT_LABELS: Record<ChangeImpact, string> = {
  buff: 'buff',
  nerf: 'nerf',
  neutral: 'neutro',
  review: 'revisar',
}

const signed = (value: number) => (value > 0 ? `+${value}` : String(value))

export const describeRecommendation = (recommendation: PatchRecommendation) => {
  if (!recommendation.change_pct) return ACTION_LABELS[recommendation.action]

  return `${ACTION_LABELS[recommendation.action]} ${signed(recommendation.change_pct)}%`
}

export const heroKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')
