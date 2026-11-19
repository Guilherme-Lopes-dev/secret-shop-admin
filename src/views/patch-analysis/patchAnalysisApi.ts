import { api } from '@/lib/api/api'

export type ChangeImpact = 'buff' | 'nerf' | 'neutral' | 'review'

export interface PatchChange {
  scope: 'hero' | 'talent' | 'ability'
  ability: string | null
  text: string
  info: string | null
  kind: 'numeric' | 'delta' | 'qualitative'
  stat: string | null
  impact: ChangeImpact
}

export interface HeroStoreData {
  in_stock: number
  stock_value_cents: number
  catalog_skins: number
  sales_before: number
  sales_after: number
  revenue_before_cents: number
  revenue_after_cents: number
}

export interface HeroPatchReport {
  heroId: number
  hero: string
  buffs: number
  nerfs: number
  neutral: number
  review: number
  changes: PatchChange[]
  store: HeroStoreData
}

export type RecommendationAction = 'raise' | 'lower' | 'hold' | 'buy_stock'

export interface PatchRecommendation {
  hero: string
  action: RecommendationAction
  change_pct: number
  confidence: 'low' | 'medium' | 'high'
  rationale: string
}

export interface PatchAnalysis {
  status: 'RUNNING' | 'DONE' | 'FAILED'
  started_at: string
  finished_at: string | null
  model: string | null
  result: { summary: string; recommendations: PatchRecommendation[] } | null
  error: string | null
}

export interface PatchReport {
  patch: { version: string; released_at: string; days_since_patch: number; window_days: number }
  heroes: HeroPatchReport[]
  analysis: PatchAnalysis | null
}

export interface PatchListItem {
  version: string
  released_at: string
}

export const patchAnalysisApi = {
  patches: () => api.get<PatchListItem[]>('/patch-analysis/patches'),
  report: (version: string) => api.get<PatchReport>(`/patch-analysis/patches/${version}`),
  analysis: (version: string) => api.get<PatchAnalysis | null>(`/patch-analysis/patches/${version}/analysis`),
  startAnalysis: (version: string) => api.post<PatchAnalysis>(`/patch-analysis/patches/${version}/analysis`),
}
