/** Janela de "logado agora", em minutos. Espelha ONLINE_WINDOW_MS do dashboard.service no backend. */
export const ONLINE_NOW_MINUTES = '20'

/** Link do card "Logados agora" pra lista de usuários já filtrada. */
export const ONLINE_NOW_USERS_LINK = `/users?lastLogin=${ONLINE_NOW_MINUTES}`
