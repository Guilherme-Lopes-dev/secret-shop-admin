// Arquivos em /media/*. VITE_MEDIA_URL deixa ver as imagens de prod com a API local.
const MEDIA_ORIGIN = (import.meta.env.VITE_MEDIA_URL || import.meta.env.VITE_API_URL)?.trim() || ''

export const mediaUrl = (path: string) => `${MEDIA_ORIGIN}${path}`
