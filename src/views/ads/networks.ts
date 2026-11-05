import { adminService, type AdsSuggestion } from '@/services/admin/admin.service'

// O que muda entre as redes na tela de anúncios. O resto (gráfico, tabela, análises) é igual.

type ChangeDescription = (suggestion: AdsSuggestion) => string

export type AdsNetwork = {
  /** Prefixo das preferências salvas no navegador. */
  slug: string
  title: string
  levels: { value: string; label: string }[]
  defaultLevel: string
  levelLabels: Record<string, string>
  attributionNote: string
  customerClickLabel: string
  customerClickNote: string
  analysisSchedule: string
  changeDescriptions: Record<string, ChangeDescription>
  api: {
    status: typeof adminService.getGoogleAdsStatus
    sync: typeof adminService.syncGoogleAds
    overview: typeof adminService.getGoogleAdsOverview
    entities: typeof adminService.getGoogleAdsEntities
    analyses: typeof adminService.getGoogleAdsAnalyses
    startAnalysis: typeof adminService.startGoogleAdsAnalysis
    analysis: typeof adminService.getGoogleAdsAnalysis
    approve: typeof adminService.approveGoogleAdsSuggestion
    reject: typeof adminService.rejectGoogleAdsSuggestion
  }
}

const brl = (value: unknown) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const budgetChange: ChangeDescription = ({ current_value, proposed_value }) =>
  `Orçamento diário ${brl(current_value?.daily_budget_brl)} → ${brl(proposed_value?.daily_budget_brl)}`

export const googleAds: AdsNetwork = {
  slug: 'google-ads',
  title: 'Google Ads',
  levels: [
    { value: 'campaign', label: 'Campanhas' },
    { value: 'ad_group', label: 'Grupos' },
    { value: 'ad', label: 'Anúncios' },
    { value: 'keyword', label: 'Palavras-chave' },
    { value: 'search_term', label: 'Termos de busca' },
  ],
  // Termo de busca é onde se corta desperdício; campanha, com uma só ativa, repete o topo.
  defaultLevel: 'search_term',
  levelLabels: { campaign: 'Campanha', ad_group: 'Grupo', ad: 'Anúncio', keyword: 'Palavra-chave', search_term: 'Termo' },
  attributionNote: 'O Ads põe a compra no dia do clique e só conta quem clicou no anúncio.',
  customerClickLabel: 'Clientes novos que clicaram no anúncio',
  customerClickNote: '"Anúncio" = clicou num anúncio do Google antes da 1ª compra.',
  analysisSchedule: 'Toda segunda às 6h30',
  changeDescriptions: {
    set_campaign_budget: budgetChange,
    pause_campaign: () => 'Pausar campanha',
    pause_ad_group: () => 'Pausar grupo',
    pause_ad: () => 'Pausar anúncio',
    pause_keyword: () => 'Pausar palavra-chave',
    add_negative_keyword: ({ proposed_value }) => `Negativar "${proposed_value?.text}" (${proposed_value?.match_type})`,
  },
  api: {
    status: adminService.getGoogleAdsStatus,
    sync: adminService.syncGoogleAds,
    overview: adminService.getGoogleAdsOverview,
    entities: adminService.getGoogleAdsEntities,
    analyses: adminService.getGoogleAdsAnalyses,
    startAnalysis: adminService.startGoogleAdsAnalysis,
    analysis: adminService.getGoogleAdsAnalysis,
    approve: adminService.approveGoogleAdsSuggestion,
    reject: adminService.rejectGoogleAdsSuggestion,
  },
}

export const metaAds: AdsNetwork = {
  slug: 'meta-ads',
  title: 'Meta Ads',
  levels: [
    { value: 'campaign', label: 'Campanhas' },
    { value: 'ad_set', label: 'Conjuntos' },
    { value: 'ad', label: 'Anúncios' },
  ],
  // Na Meta o criativo é o que mais varia e não tem termo de busca pra olhar.
  defaultLevel: 'ad',
  levelLabels: { campaign: 'Campanha', ad_set: 'Conjunto', ad: 'Anúncio' },
  attributionNote: 'A Meta usa a janela de atribuição de cada conjunto, que pode contar quem só viu o anúncio. Cliques são só no link.',
  customerClickLabel: 'Clientes novos com link da Meta (inclui orgânico)',
  customerClickNote: '"Anúncio" = chegou por link com fbclid antes da 1ª compra. A Meta põe fbclid em link orgânico também, então é teto.',
  analysisSchedule: 'Toda segunda às 6h45',
  changeDescriptions: {
    set_campaign_budget: budgetChange,
    set_ad_set_budget: budgetChange,
    pause_campaign: () => 'Pausar campanha',
    pause_ad_set: () => 'Pausar conjunto',
    pause_ad: () => 'Pausar anúncio',
  },
  api: {
    status: adminService.getMetaAdsStatus,
    sync: adminService.syncMetaAds,
    overview: adminService.getMetaAdsOverview,
    entities: adminService.getMetaAdsEntities,
    analyses: adminService.getMetaAdsAnalyses,
    startAnalysis: adminService.startMetaAdsAnalysis,
    analysis: adminService.getMetaAdsAnalysis,
    approve: adminService.approveMetaAdsSuggestion,
    reject: adminService.rejectMetaAdsSuggestion,
  },
}
