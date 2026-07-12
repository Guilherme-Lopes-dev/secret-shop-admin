<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <h1 class="page-title">Trocas (Swaps)</h1>
        <p class="page-subtitle">{{ swaps.length }} trocas listadas</p>
      </div>
    </header>

    <section class="config-panel">
      <div class="config-block">
        <label>Multiplicadores de preço</label>
        <div class="config-fields">
          <div class="field">
            <small>Itens do usuário</small>
            <input v-model.number="multiplier" type="number" step="0.01" min="0" />
          </div>
          <div class="field">
            <small>Itens da loja</small>
            <input v-model.number="storeMultiplier" type="number" step="0.01" min="0" />
          </div>
          <button class="btn-primary" :disabled="savingMultiplier" @click="saveMultiplier">
            {{ savingMultiplier ? 'Salvando...' : 'Salvar' }}
          </button>
        </div>
        <span class="config-hint">usuário = preço SteamWebAPI × mult · loja = preço do catálogo × mult</span>
      </div>

      <div class="config-divider"></div>

      <div class="config-block grow">
        <label>Compensação em dinheiro (swap)</label>
        <div class="config-fields">
          <div class="field toggle-field">
            <small>Ativada</small>
            <label class="switch">
              <input v-model="comp.enabled" type="checkbox" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="field">
            <small>Teto (R$)</small>
            <input v-model.number="compMaxReais" type="number" step="0.01" min="0" />
          </div>
          <div class="field">
            <small>Margem-alvo (fator)</small>
            <input v-model.number="comp.margin" type="number" step="0.01" min="0" />
          </div>
          <div class="field">
            <small>Tolerância (%)</small>
            <input v-model.number="comp.tolerance" type="number" step="0.1" min="0" />
          </div>
          <div class="field">
            <small>Máx. itens do usuário</small>
            <input v-model.number="comp.maxUserItems" type="number" step="1" min="0" />
          </div>
          <button class="btn-primary" :disabled="savingComp" @click="saveComp">
            {{ savingComp ? 'Salvando...' : 'Salvar config' }}
          </button>
        </div>
        <span class="config-hint">
          comp = recebe − oferece (&gt;0 user paga PIX). Acima do teto bloqueia; off exige troca exata. Máx. itens 0 = sem limite.
        </span>
      </div>

      <div class="config-divider"></div>

      <div class="config-block">
        <label>Acesso ao trade (todos)</label>
        <div class="config-fields">
          <button class="btn-primary" :disabled="settingAllSwap" @click="setAllSwap(true)">
            {{ settingAllSwap ? 'Aplicando...' : 'Liberar p/ todos' }}
          </button>
          <button class="btn-danger" :disabled="settingAllSwap" @click="setAllSwap(false)">
            Bloquear p/ todos
          </button>
        </div>
        <span class="config-hint">aplica a todos de uma vez; o ajuste 1 a 1 fica na tela de Usuários.</span>
      </div>

      <div class="config-divider"></div>

      <div class="config-block grow">
        <label>Multiplicador por raridade</label>
        <div class="rarity-grid">
          <div class="rarity-row rarity-head">
            <span>Raridade</span>
            <span>Usuário</span>
            <span>Loja</span>
            <span>Ativo</span>
            <span></span>
          </div>
          <div v-for="row in rarityMultipliers" :key="row.rarity" class="rarity-row">
            <span class="rarity-name">{{ row.rarity }}</span>
            <input v-model.number="row.userMultiplier" type="number" step="0.01" min="0" />
            <input v-model.number="row.storeMultiplier" type="number" step="0.01" min="0" />
            <label class="switch sm">
              <input v-model="row.active" type="checkbox" />
              <span class="slider"></span>
            </label>
            <div class="rarity-actions">
              <button class="btn-primary sm" :disabled="savingRarity === row.rarity" @click="saveRarity(row)">
                {{ savingRarity === row.rarity ? '...' : 'Salvar' }}
              </button>
              <button class="btn-danger sm" :disabled="savingRarity === row.rarity" @click="removeRarity(row.rarity)">
                Remover
              </button>
            </div>
          </div>

          <div class="rarity-row rarity-add">
            <select v-model="newRarity.rarity">
              <option value="">Adicionar raridade…</option>
              <option v-for="r in availableRarities" :key="r" :value="r">{{ r }}</option>
            </select>
            <input v-model.number="newRarity.userMultiplier" type="number" step="0.01" min="0" />
            <input v-model.number="newRarity.storeMultiplier" type="number" step="0.01" min="0" />
            <span></span>
            <button
              class="btn-primary sm"
              :disabled="!newRarity.rarity || savingRarity === newRarity.rarity"
              @click="addRarity"
            >
              Adicionar
            </button>
          </div>
        </div>
        <span class="config-hint">raridade na lista usa estes multiplicadores; o resto cai no multiplicador global acima.</span>
      </div>
    </section>

    <div class="filters">
      <button
        v-for="opt in statusFilters"
        :key="opt.value"
        class="filter-chip"
        :class="{ active: activeStatus === opt.value }"
        @click="setStatus(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>

    <div class="section">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Oferece</th>
              <th>Recebe</th>
              <th>Valores</th>
              <th>Status</th>
              <th>Criado</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <template v-if="loading">
              <tr v-for="n in 5" :key="n">
                <td colspan="7"><div class="skeleton" style="height:18px" /></td>
              </tr>
            </template>
            <template v-else>
              <tr v-for="swap in swaps" :key="swap.id">
                <td>
                  <span class="title-cell">{{ swap.users?.username || 'Sem nome' }}</span>
                  <p class="row-sub">{{ swap.users?.steam_id }}</p>
                </td>
                <td>
                  <span class="count-pill">{{ swap.user_items?.length || 0 }} item(s)</span>
                </td>
                <td>
                  <span class="count-pill">{{ swap.store_items?.length || 0 }} item(s)</span>
                </td>
                <td>
                  <div class="value-cell">
                    <span class="value-give">{{ formatCurrency(swap.user_items_value) }}</span>
                    <span class="value-sep">→</span>
                    <span class="value-get">{{ formatCurrency(swap.store_items_value) }}</span>
                  </div>
                </td>
                <td>
                  <span class="status-badge" :class="statusClass(swap.status)">
                    {{ statusLabel(swap.status) }}
                  </span>
                </td>
                <td class="text-muted">{{ $dayjs(swap.created_at).format('DD/MM/YY HH:mm') }}</td>
                <td>
                  <button class="btn-view" @click="openDetail(swap)">Ver</button>
                </td>
              </tr>
              <tr v-if="swaps.length === 0">
                <td colspan="7" class="empty-state">Nenhuma troca encontrada.</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="detail" class="modal-overlay" @click.self="detail = null">
      <div class="modal modal-lg">
        <header class="modal-head">
          <h3>Troca de {{ detail.users?.username || 'usuário' }}</h3>
          <span class="status-badge" :class="statusClass(detail.status)">{{ statusLabel(detail.status) }}</span>
        </header>

        <p v-if="phaseHint(detail.status)" class="phase-hint">{{ phaseHint(detail.status) }}</p>

        <div class="trade-grid">
          <section class="trade-side">
            <h4>Usuário oferece <span>{{ formatCurrency(detail.user_items_value) }}</span></h4>
            <ul class="item-list">
              <li v-for="item in detail.user_items" :key="item.id">
                <img v-if="item.icon_url" :src="item.icon_url" alt="" />
                <div>
                  <span class="item-name">{{ item.market_hash_name }}</span>
                  <span class="item-price">{{ formatCurrency(item.price_at_time) }}</span>
                </div>
              </li>
            </ul>
          </section>

          <section class="trade-side">
            <h4>Loja envia <span>{{ formatCurrency(detail.store_items_value) }}</span></h4>
            <ul class="item-list">
              <li v-for="item in detail.store_items" :key="item.id">
                <img v-if="item.bot_inventory?.skins?.icon_url_large" :src="item.bot_inventory.skins.icon_url_large" alt="" />
                <div>
                  <span class="item-name">{{ item.bot_inventory?.skins?.name || item.bot_inventory?.asset_id }}</span>
                  <span class="item-price">{{ formatCurrency(item.price_at_time) }}</span>
                </div>
              </li>
            </ul>
          </section>
        </div>

        <div class="value-summary">
          <div class="vs-cell">
            <span>Usuário oferece</span>
            <strong class="value-give">{{ formatCurrency(detail.user_items_value) }}</strong>
          </div>
          <Icon icon="mdi:arrow-right" width="18" class="vs-arrow" />
          <div class="vs-cell">
            <span>Loja envia</span>
            <strong class="value-get">{{ formatCurrency(detail.store_items_value) }}</strong>
          </div>
          <div class="vs-cell vs-diff">
            <span>Diferença (loja − usuário)</span>
            <strong>{{ formatCurrency(detail.store_items_value - detail.user_items_value) }}</strong>
          </div>
        </div>

        <div v-if="detail.offers && detail.offers.length > 0" class="offers-block">
          <h4 class="offers-title">
            Ofertas por bot
            <span class="muted">{{ detail.offers.length }} oferta(s) — aceitação tudo-ou-nada</span>
          </h4>
          <div v-for="offer in detail.offers" :key="offer.id" class="offer-row">
            <div class="offer-bot">
              <Icon icon="mdi:robot-outline" width="16" />
              {{ offer.steam_bots?.name || 'Bot' }}
            </div>
            <span class="muted">{{ offer.store_items?.length || 0 }} item(s) · {{ formatCurrency(offer.store_value) }}</span>
            <span class="status-badge" :class="statusClass(mapOfferStatus(offer.status))">{{ offerStatusLabel(offer.status) }}</span>
            <span v-if="offer.trade_offer_id" class="muted offer-tid">#{{ offer.trade_offer_id }}</span>
          </div>
        </div>

        <div v-if="detail.compensation_amount > 0 || detail.value_flag" class="comp-block">
          <div class="comp-block-head">
            <h4>Compensação</h4>
            <span v-if="detail.value_flag" class="flag-badge" :class="'flag-' + detail.value_flag">
              {{ detail.value_flag === 'green' ? '🟢 Dentro da margem' : '🟡 Abaixo da margem' }}
            </span>
          </div>

          <div class="comp-grid">
            <div><span>Valor</span> {{ formatCurrency(detail.compensation_amount) }}</div>
            <div>
              <span>Status</span>
              <span class="status-badge" :class="compStatusClass(detail.compensation_status)">
                {{ compStatusLabel(detail.compensation_status) }}
              </span>
            </div>
            <div v-if="detail.payment_provider"><span>Gateway</span> {{ detail.payment_provider }}</div>
            <div v-if="detail.compensation_paid_at">
              <span>Pago em</span> {{ $dayjs(detail.compensation_paid_at).format('DD/MM/YY HH:mm') }}
            </div>
          </div>

          <div v-if="detail.compensation_qr_payload" class="qr-block">
            <img
              v-if="detail.compensation_qr_image"
              :src="'data:image/png;base64,' + detail.compensation_qr_image"
              alt="QR PIX"
              class="qr-img"
            />
            <div class="qr-copy">
              <span>Copia e cola</span>
              <code>{{ detail.compensation_qr_payload }}</code>
              <button class="btn-view" @click="copyPix(detail.compensation_qr_payload)">Copiar</button>
            </div>
          </div>
        </div>

        <div class="detail-meta">
          <div><span>Mult. usuário</span> {{ detail.price_multiplier }}×</div>
          <div><span>Mult. loja</span> {{ detail.store_price_multiplier ?? 1 }}×</div>
          <div><span>Steam ID</span> {{ detail.users?.steam_id || '—' }}</div>
          <div><span>Criada</span> {{ $dayjs(detail.created_at).format('DD/MM/YY HH:mm') }}</div>
          <div v-if="detail.approved_at"><span>Aprovada</span> {{ $dayjs(detail.approved_at).format('DD/MM/YY HH:mm') }}</div>
          <div v-if="detail.items_received_at"><span>Itens recebidos</span> {{ $dayjs(detail.items_received_at).format('DD/MM/YY HH:mm') }}</div>
          <div v-if="detail.expires_at"><span>Reserva até</span> {{ $dayjs(detail.expires_at).format('DD/MM/YY HH:mm') }}</div>
          <div v-if="detail.rejection_reason" class="reason"><span>Motivo</span> {{ detail.rejection_reason }}</div>
        </div>

        <p v-if="actionError" class="action-error">{{ actionError }}</p>

        <div class="modal-actions">
          <button class="btn-ghost" @click="detail = null">Fechar</button>
          <button
            v-if="detail.compensation_amount > 0 && detail.compensation_status !== 'paid'"
            class="btn-ghost"
            :disabled="acting"
            @click="refreshCompensation"
          >
            {{ acting ? '...' : 'Reconciliar pagamento' }}
          </button>
          <button
            v-if="detail.compensation_amount > 0 && detail.compensation_status !== 'paid'"
            class="btn-ghost btn-dev"
            :disabled="acting"
            @click="simulatePaid"
          >
            DEV: Simular PIX pago
          </button>
          <button v-if="canReject(detail.status)" class="btn-danger" :disabled="acting" @click="reject">
            Rejeitar
          </button>
          <button v-if="detail.status === 'pending_admin'" class="btn-primary" :disabled="acting" @click="approve">
            {{ acting ? 'Processando...' : 'Aprovar (pedir itens)' }}
          </button>
          <button v-if="detail.status === 'items_received'" class="btn-primary" :disabled="acting" @click="deliver">
            {{ acting ? 'Entregando...' : 'Entregar itens da loja' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue3-toastify'
import { adminService, type SwapCompensationConfig, type RarityMultiplier } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'

const swaps = ref<any[]>([])
const loading = ref(true)
const detail = ref<any>(null)
const acting = ref(false)
const actionError = ref('')
const multiplier = ref(1)
const storeMultiplier = ref(1)
const savingMultiplier = ref(false)
const route = useRoute()
const router = useRouter()
const activeStatus = ref((route.query.status as string) ?? '')

const KNOWN_RARITIES = ['Common', 'Uncommon', 'Rare', 'Mythical', 'Legendary', 'Ancient', 'Immortal', 'Arcana']
const rarityMultipliers = ref<RarityMultiplier[]>([])
const savingRarity = ref('')
const newRarity = ref({ rarity: '', userMultiplier: 1, storeMultiplier: 1 })
const availableRarities = computed(() =>
  KNOWN_RARITIES.filter(
    (r) => !rarityMultipliers.value.some((m) => m.rarity.toLowerCase() === r.toLowerCase()),
  ),
)

const comp = ref<SwapCompensationConfig>({ enabled: true, max: 100000, tolerance: 0, margin: 1, maxUserItems: 10 })
const savingComp = ref(false)
const compMaxReais = computed({
  get: () => Math.round((comp.value.max / 100) * 100) / 100,
  set: (v: number) => { comp.value.max = Math.round((Number(v) || 0) * 100) },
})

const compStatusMeta: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Aguardando PIX', cls: 'status-scheduled' },
  paid: { label: 'Pago', cls: 'status-active' },
  refunded: { label: 'Estornado', cls: 'status-inactive' },
  not_required: { label: 'Sem cobrança', cls: 'status-draft' },
}
const compStatusLabel = (s: string | null) => (s ? compStatusMeta[s]?.label ?? s : '—')
const compStatusClass = (s: string | null) => (s ? compStatusMeta[s]?.cls ?? 'status-draft' : 'status-draft')

const copyPix = (payload: string) => {
  navigator.clipboard?.writeText(payload)
}

const statusFilters = [
  { value: '', label: 'Todos' },
  { value: 'pending_admin', label: 'Pendentes' },
  { value: 'awaiting_user_items', label: 'Aguardando envio' },
  { value: 'items_received', label: 'Recebidos' },
  { value: 'review', label: 'Em revisão' },
  { value: 'store_sent', label: 'Loja enviada' },
  { value: 'completed', label: 'Concluídas' },
  { value: 'rejected', label: 'Rejeitadas' },
  { value: 'cancelled', label: 'Canceladas' },
]

const statusMeta: Record<string, { label: string; cls: string }> = {
  pending_admin: { label: 'Pendente', cls: 'status-scheduled' },
  requesting_items: { label: 'Solicitando...', cls: 'status-info' },
  awaiting_user_items: { label: 'Aguardando envio', cls: 'status-info' },
  items_received: { label: 'Itens recebidos', cls: 'status-active' },
  review: { label: 'Em revisão', cls: 'status-scheduled' },
  delivering: { label: 'Entregando...', cls: 'status-info' },
  store_sent: { label: 'Loja enviada', cls: 'status-info' },
  completed: { label: 'Concluída', cls: 'status-active' },
  rejected: { label: 'Rejeitada', cls: 'status-inactive' },
  cancelled: { label: 'Cancelada', cls: 'status-danger' },
  expired: { label: 'Expirada', cls: 'status-inactive' },
}

const statusLabel = (status: string) => statusMeta[status]?.label ?? status
const statusClass = (status: string) => statusMeta[status]?.cls ?? 'status-draft'

const offerStatusMeta: Record<string, string> = {
  pending: 'Pendente',
  trade_sent: 'Enviada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
}

const phaseHints: Record<string, string> = {
  pending_admin: 'Aprovar pede os itens do usuário (escrow). Nada é enviado da loja ainda.',
  awaiting_user_items: 'Oferta enviada — aguardando o usuário depositar os itens.',
  items_received: 'Itens recebidos e conferidos. A entrega é automática — o bot já está enviando. Use o botão abaixo só se a entrega automática falhar.',
  review: 'Itens recebidos com divergência (nome/valor). Decida manualmente entregar ou devolver.',
  store_sent: 'Itens da loja enviados ao usuário. Aguardando aceite na Steam.',
}
const phaseHint = (status: string) => phaseHints[status] ?? ''

const offerStatusLabel = (status: string) => offerStatusMeta[status] ?? status
const mapOfferStatus = (status: string) => {
  if (status === 'completed') return 'completed'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'trade_sent') return 'trade_sent'
  return 'pending_admin'
}

const fetchSwaps = async () => {
  loading.value = true
  try {
    const res = await adminService.getSwaps(activeStatus.value || undefined)
    swaps.value = res.data
  } finally {
    loading.value = false
  }
}

const fetchMultiplier = async () => {
  const res = await adminService.getSwapMultiplier()
  multiplier.value = res.data.multiplier
  storeMultiplier.value = res.data.storeMultiplier ?? 1
}

const fetchComp = async () => {
  const res = await adminService.getSwapCompensationConfig()
  comp.value = res.data
}

const saveComp = async () => {
  savingComp.value = true
  try {
    const res = await adminService.setSwapCompensationConfig(comp.value)
    comp.value = res.data
    toast.success('Configuração de compensação salva.')
  } catch (err: any) {
    toast.error(err.response?.data?.message ?? 'Erro ao salvar configuração.')
  } finally {
    savingComp.value = false
  }
}

const settingAllSwap = ref(false)
const setAllSwap = async (enabled: boolean) => {
  const verb = enabled ? 'liberar' : 'bloquear'
  if (!window.confirm(`Tem certeza que deseja ${verb} o trade para TODOS os usuários?`)) return
  settingAllSwap.value = true
  try {
    const { data } = await adminService.setAllUsersSwap(enabled)
    toast.success(`Trade ${enabled ? 'liberado' : 'bloqueado'} para ${data.updated} usuário(s).`)
  } catch (err: any) {
    toast.error(err.response?.data?.message ?? 'Falha ao atualizar acesso em massa.')
  } finally {
    settingAllSwap.value = false
  }
}

const setStatus = (status: string) => {
  activeStatus.value = status
  router.replace({ query: status ? { status } : {} })
  fetchSwaps()
}

const saveMultiplier = async () => {
  savingMultiplier.value = true
  try {
    const res = await adminService.setSwapMultiplier({
      multiplier: multiplier.value,
      storeMultiplier: storeMultiplier.value,
    })
    multiplier.value = res.data.multiplier
    storeMultiplier.value = res.data.storeMultiplier
    toast.success('Multiplicadores salvos.')
  } catch (err: any) {
    toast.error(err.response?.data?.message ?? 'Erro ao salvar multiplicadores.')
  } finally {
    savingMultiplier.value = false
  }
}

const openDetail = (swap: any) => {
  actionError.value = ''
  detail.value = swap
}

const canReject = (status: string) =>
  ['pending_admin', 'awaiting_user_items', 'items_received', 'review'].includes(status)

const runAction = async (
  fn: () => Promise<{ data: any }>,
  fallback: string,
) => {
  if (!detail.value) return
  acting.value = true
  actionError.value = ''
  try {
    const res = await fn()
    applyUpdate(res.data)
  } catch (err: any) {
    actionError.value = err.response?.data?.message ?? err.message ?? fallback
  } finally {
    acting.value = false
  }
}

const approve = () =>
  runAction(() => adminService.approveSwap(detail.value.id), 'Falha ao aprovar.')

const deliver = () =>
  runAction(() => adminService.deliverSwap(detail.value.id), 'Falha ao entregar.')

const refreshCompensation = () =>
  runAction(
    () => adminService.refreshSwapCompensation(detail.value.id),
    'Falha ao reconciliar pagamento.',
  )

const simulatePaid = () =>
  runAction(
    () => adminService.simulateSwapCompensationPaid(detail.value.id),
    'Falha ao simular pagamento (ative ALLOW_DEV_PAYMENT_SIMULATION).',
  )

const reject = () => {
  const reason = window.prompt('Motivo da rejeição (opcional):') ?? undefined
  return runAction(() => adminService.rejectSwap(detail.value.id, reason), 'Falha ao rejeitar.')
}

const applyUpdate = (updated: any) => {
  const index = swaps.value.findIndex((s) => s.id === updated.id)
  if (index !== -1) swaps.value[index] = updated
  detail.value = updated
}

const fetchRarityMultipliers = async () => {
  try {
    const res = await adminService.getRarityMultipliers()
    rarityMultipliers.value = res.data
  } catch {
    /* opcional */
  }
}

const saveRarity = async (row: RarityMultiplier) => {
  savingRarity.value = row.rarity
  try {
    const res = await adminService.upsertRarityMultiplier({
      rarity: row.rarity,
      userMultiplier: row.userMultiplier,
      storeMultiplier: row.storeMultiplier,
      active: row.active,
    })
    rarityMultipliers.value = res.data
    toast.success('Multiplicador salvo.')
  } catch (err: any) {
    toast.error(err.response?.data?.message ?? 'Erro ao salvar.')
  } finally {
    savingRarity.value = ''
  }
}

const addRarity = async () => {
  const next = newRarity.value
  if (!next.rarity) return
  savingRarity.value = next.rarity
  try {
    const res = await adminService.upsertRarityMultiplier({
      rarity: next.rarity,
      userMultiplier: next.userMultiplier,
      storeMultiplier: next.storeMultiplier,
    })
    rarityMultipliers.value = res.data
    newRarity.value = { rarity: '', userMultiplier: 1, storeMultiplier: 1 }
    toast.success('Raridade adicionada.')
  } catch (err: any) {
    toast.error(err.response?.data?.message ?? 'Erro ao adicionar.')
  } finally {
    savingRarity.value = ''
  }
}

const removeRarity = async (rarity: string) => {
  savingRarity.value = rarity
  try {
    const res = await adminService.deleteRarityMultiplier(rarity)
    rarityMultipliers.value = res.data
  } catch (err: any) {
    toast.error(err.response?.data?.message ?? 'Erro ao remover.')
  } finally {
    savingRarity.value = ''
  }
}

onMounted(() => {
  fetchSwaps()
  fetchMultiplier()
  fetchComp()
  fetchRarityMultipliers()
})
</script>

<style lang="stylus" scoped>
.view-wrap
  padding 2rem
  color #fff
  min-height 100vh

.page-header
  display flex
  align-items flex-start
  justify-content space-between
  gap 1rem
  margin-bottom 1.5rem

.page-title
  font-size 1.8rem
  font-weight 700
  margin 0 0 4px

.page-subtitle
  font-size 0.85rem
  color rgba(255,255,255,0.45)
  margin 0

.config-panel
  display flex
  align-items stretch
  gap 1.5rem
  width 100%
  background #16161a
  border 1px solid rgba(255,255,255,0.06)
  border-radius 12px
  padding 1.1rem 1.25rem
  margin-bottom 1.5rem
  flex-wrap wrap

.config-block
  display flex
  flex-direction column
  gap 0.75rem

  &.grow
    flex 1
    min-width 320px

  label
    font-size 0.72rem
    text-transform uppercase
    letter-spacing 0.04em
    color rgba(255,255,255,0.45)

.config-divider
  width 1px
  align-self stretch
  background rgba(255,255,255,0.07)

.config-fields
  display flex
  align-items flex-end
  gap 1rem
  flex-wrap wrap

.field
  display flex
  flex-direction column
  gap 5px

  small
    font-size 0.7rem
    color rgba(255,255,255,0.5)

  input
    width 120px
    background #0e0e11
    border 1px solid rgba(255,255,255,0.12)
    border-radius 8px
    padding 0.45rem 0.6rem
    color #fff
    font-size 0.9rem

.toggle-field
  justify-content space-between
  min-height 56px

.config-hint
  font-size 0.72rem
  color rgba(255,255,255,0.35)

.rarity-grid
  display flex
  flex-direction column
  gap 6px
  margin-top 4px

.rarity-row
  display grid
  grid-template-columns 110px 90px 90px 50px 1fr
  align-items center
  gap 10px

  input, select
    width 100%
    background #0e0e11
    border 1px solid rgba(255,255,255,0.12)
    border-radius 8px
    padding 0.4rem 0.55rem
    color #fff
    font-size 0.85rem

.rarity-head
  font-size 0.7rem
  color rgba(255,255,255,0.45)
  text-transform uppercase
  letter-spacing 0.04em

.rarity-name
  font-weight 600
  font-size 0.9rem

.rarity-actions
  display flex
  gap 6px

.btn-primary.sm,
.btn-danger.sm
  height 32px
  padding 0 10px
  font-size 0.78rem

.config-fields .btn-primary,
.config-fields .btn-danger
  height 38px

.switch
  position relative
  display inline-block
  width 40px
  height 22px

  input
    opacity 0
    width 0
    height 0

.slider
  position absolute
  cursor pointer
  inset 0
  background rgba(255,255,255,0.18)
  border-radius 999px
  transition 0.2s
  &::before
    content ''
    position absolute
    height 16px
    width 16px
    left 3px
    bottom 3px
    background #fff
    border-radius 50%
    transition 0.2s

.switch input:checked + .slider
  background #6366f1
.switch input:checked + .slider::before
  transform translateX(18px)

.comp-block
  margin-top 1.25rem
  padding-top 1rem
  border-top 1px solid rgba(255,255,255,0.06)

.comp-block-head
  display flex
  align-items center
  justify-content space-between
  margin-bottom 0.75rem

  h4
    margin 0
    font-size 0.85rem
    color rgba(255,255,255,0.75)

.flag-badge
  padding 2px 10px
  border-radius 999px
  font-size 0.75rem
  font-weight 600

.flag-green
  background rgba(46,220,138,0.12)
  color #4ade80

.flag-yellow
  background rgba(251,191,36,0.12)
  color #fbbf24

.comp-grid
  display flex
  flex-wrap wrap
  gap 1.25rem
  font-size 0.82rem

  div span
    display block
    font-size 0.7rem
    text-transform uppercase
    letter-spacing 0.03em
    color rgba(255,255,255,0.4)
    margin-bottom 4px

.qr-block
  display flex
  gap 1rem
  margin-top 1rem
  align-items flex-start

.qr-img
  width 120px
  height 120px
  border-radius 8px
  background #fff
  padding 4px

.qr-copy
  display flex
  flex-direction column
  gap 6px
  flex 1
  min-width 0

  span
    font-size 0.7rem
    text-transform uppercase
    letter-spacing 0.03em
    color rgba(255,255,255,0.4)

  code
    font-size 0.72rem
    word-break break-all
    color rgba(255,255,255,0.7)
    background #0e0e11
    border 1px solid rgba(255,255,255,0.08)
    border-radius 6px
    padding 0.5rem
    max-height 90px
    overflow-y auto

.filters
  display flex
  gap 8px
  margin-bottom 1rem
  flex-wrap wrap

.filter-chip
  padding 5px 14px
  border-radius 999px
  border 1px solid rgba(255,255,255,0.1)
  background transparent
  color rgba(255,255,255,0.6)
  font-size 0.8rem
  cursor pointer
  &.active
    background #6366f1
    border-color #6366f1
    color #fff

.section
  background #16161a
  border 1px solid rgba(255,255,255,0.06)
  border-radius 12px
  overflow hidden

.table-wrapper
  overflow-x auto

table
  width 100%
  border-collapse collapse

thead tr
  background rgba(255,255,255,0.03)

th
  padding 0.7rem 1rem
  text-align left
  font-size 0.75rem
  font-weight 600
  text-transform uppercase
  letter-spacing 0.04em
  color rgba(255,255,255,0.45)
  border-bottom 1px solid rgba(255,255,255,0.06)

td
  padding 0.75rem 1rem
  font-size 0.875rem
  border-bottom 1px solid rgba(255,255,255,0.04)
  vertical-align middle

tbody tr:last-child td
  border-bottom none

tbody tr:hover td
  background rgba(255,255,255,0.02)

.title-cell
  font-weight 600

.row-sub
  color rgba(255,255,255,0.38)
  font-size 0.75rem
  margin 2px 0 0

.text-muted
  color rgba(255,255,255,0.35)
  font-size 0.82rem

.count-pill
  display inline-block
  padding 2px 10px
  border-radius 999px
  background rgba(255,255,255,0.06)
  font-size 0.78rem

.value-cell
  display flex
  align-items center
  gap 6px
  font-size 0.82rem

.value-give
  color #fbbf24

.value-get
  color #4ade80

.value-sep
  color rgba(255,255,255,0.3)

.status-badge
  display inline-block
  padding 2px 10px
  border-radius 999px
  font-size 0.75rem
  font-weight 600

.status-active
  background rgba(46,220,138,0.12)
  color #4ade80

.status-inactive
  background rgba(255,255,255,0.06)
  color rgba(255,255,255,0.45)

.status-scheduled
  background rgba(251,191,36,0.12)
  color #fbbf24

.status-info
  background rgba(99,102,241,0.14)
  color #a5b4fc

.status-danger
  background rgba(252,129,129,0.12)
  color #fc8181

.status-draft
  background rgba(255,255,255,0.06)
  color rgba(255,255,255,0.4)

.btn-view
  padding 4px 12px
  background rgba(99,102,241,0.12)
  border 1px solid rgba(99,102,241,0.25)
  border-radius 6px
  color #a5b4fc
  font-size 0.8rem
  cursor pointer
  &:hover
    background rgba(99,102,241,0.22)

.btn-primary
  display inline-flex
  align-items center
  gap 6px
  padding 0.5rem 1rem
  background #6366f1
  border none
  border-radius 8px
  color #fff
  font-weight 600
  font-size 0.85rem
  cursor pointer
  &:hover
    background #4f46e5
  &:disabled
    opacity 0.5
    cursor not-allowed

.btn-danger
  padding 0.5rem 1rem
  background rgba(252,129,129,0.10)
  border 1px solid rgba(252,129,129,0.25)
  border-radius 8px
  color #fc8181
  font-size 0.85rem
  cursor pointer
  &:hover
    background rgba(252,129,129,0.18)
  &:disabled
    opacity 0.5
    cursor not-allowed

.btn-ghost
  padding 0.5rem 1rem
  background transparent
  border 1px solid rgba(255,255,255,0.12)
  border-radius 8px
  color rgba(255,255,255,0.65)
  font-size 0.85rem
  cursor pointer
  &:hover
    background rgba(255,255,255,0.06)

.btn-dev
  border-style dashed
  border-color rgba(251,191,36,0.4)
  color #fbbf24
  &:hover
    background rgba(251,191,36,0.08)

.empty-state
  text-align center
  padding 2.5rem
  color rgba(255,255,255,0.35)
  font-size 0.9rem

.skeleton
  background rgba(255,255,255,0.06)
  border-radius 4px
  animation pulse 1.4s ease-in-out infinite

@keyframes pulse
  0%, 100%
    opacity 1
  50%
    opacity 0.4

.modal-overlay
  position fixed
  inset 0
  background rgba(0,0,0,0.65)
  z-index 100
  display flex
  align-items center
  justify-content center

.modal
  background #1e1e24
  border 1px solid rgba(255,255,255,0.1)
  border-radius 14px
  padding 1.75rem
  width 420px
  max-width 95vw

.modal-lg
  width 720px

.modal-head
  display flex
  align-items center
  justify-content space-between
  margin-bottom 1.25rem

  h3
    margin 0
    font-size 1.15rem
    font-weight 700

.trade-grid
  display grid
  grid-template-columns 1fr 1fr
  gap 1rem

.trade-side
  background #16161a
  border 1px solid rgba(255,255,255,0.06)
  border-radius 10px
  padding 1rem

  h4
    margin 0 0 0.75rem
    font-size 0.85rem
    display flex
    justify-content space-between
    align-items center
    color rgba(255,255,255,0.7)

    span
      font-weight 700
      color #fff

.item-list
  list-style none
  margin 0
  padding 0
  display flex
  flex-direction column
  gap 8px
  max-height 280px
  overflow-y auto

  li
    display flex
    align-items center
    gap 10px

    img
      width 40px
      height 40px
      object-fit contain
      border-radius 6px
      background rgba(255,255,255,0.04)

    div
      display flex
      flex-direction column

.item-name
  font-size 0.82rem
  font-weight 500

.item-price
  font-size 0.75rem
  color rgba(255,255,255,0.45)

.offers-block
  margin-top 1.25rem
  padding-top 1rem
  border-top 1px solid rgba(255,255,255,0.06)

.offers-title
  margin 0 0 0.75rem
  font-size 0.85rem
  display flex
  justify-content space-between
  align-items baseline
  color rgba(255,255,255,0.75)

.offer-row
  display flex
  align-items center
  gap 12px
  padding 0.5rem 0.75rem
  background #16161a
  border 1px solid rgba(255,255,255,0.06)
  border-radius 8px
  margin-bottom 6px
  font-size 0.82rem

.offer-bot
  display flex
  align-items center
  gap 6px
  font-weight 600
  min-width 120px

.offer-tid
  margin-left auto

.detail-meta
  display flex
  flex-wrap wrap
  gap 1rem
  margin-top 1.25rem
  padding-top 1rem
  border-top 1px solid rgba(255,255,255,0.06)
  font-size 0.82rem

  div span
    display block
    font-size 0.7rem
    text-transform uppercase
    letter-spacing 0.03em
    color rgba(255,255,255,0.4)
    margin-bottom 2px

  .reason
    flex-basis 100%
    color #fc8181

.value-summary
  display flex
  align-items center
  gap 1rem
  flex-wrap wrap
  margin-top 1.25rem
  padding 0.9rem 1rem
  background #16161a
  border 1px solid rgba(255,255,255,0.06)
  border-radius 10px

.vs-cell
  display flex
  flex-direction column
  gap 3px

  span
    font-size 0.68rem
    text-transform uppercase
    letter-spacing 0.03em
    color rgba(255,255,255,0.4)

  strong
    font-size 1rem
    font-weight 700

.vs-arrow
  color rgba(255,255,255,0.3)

.vs-diff
  margin-left auto
  text-align right

  strong
    color #a5b4fc

.phase-hint
  margin 0 0 1rem
  padding 0.6rem 0.8rem
  background rgba(99,102,241,0.1)
  border 1px solid rgba(99,102,241,0.22)
  border-radius 8px
  color #a5b4fc
  font-size 0.82rem

.action-error
  margin 1rem 0 0
  padding 0.6rem 0.8rem
  background rgba(252,129,129,0.1)
  border 1px solid rgba(252,129,129,0.25)
  border-radius 8px
  color #fc8181
  font-size 0.82rem

.modal-actions
  display flex
  justify-content flex-end
  gap 8px
  margin-top 1.5rem
</style>
