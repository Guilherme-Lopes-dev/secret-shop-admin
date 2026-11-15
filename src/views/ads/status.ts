/**
 * Classe de cor do status nas duas redes. CAMPAIGN_PAUSED/ADSET_PAUSED (Meta) = parado pelo pai: cor de pausado.
 * As cores ficam em section.styl.
 */
export const statusClass = (status: string) => (status.endsWith('_PAUSED') ? 'paused' : status.toLowerCase())
