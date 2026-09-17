<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <button class="btn-back" @click="router.push('/runes')">
          <Icon icon="mdi:arrow-left" width="16" /> Runas
        </button>
        <h1 class="page-title">{{ isEdit ? `Runa de ${selectedInfo.label}` : 'Nova runa' }}</h1>
      </div>
    </header>

    <div v-if="loadingRune" class="loading-state">
      <Icon icon="mdi:loading" class="spin" width="32" />
    </div>

    <div v-else class="form-grid">
      <!-- ── Esquerda: a runa ─────────────────────────────────────────────── -->
      <form class="form-col" @submit.prevent="submit">
        <section class="form-section">
          <h2 class="section-title">Tipo</h2>
          <p class="section-hint">Só muda o visual e a copy no site. O prêmio é o cupom vinculado.</p>

          <div class="rune-picker">
            <button
              v-for="r in RUNE_TYPES"
              :key="r.value"
              type="button"
              class="rune-pick"
              :class="{ 'rune-pick--on': form.type === r.value }"
              @click="form.type = r.value"
            >
              <img :src="r.image" alt="" />
              <span>{{ r.label }}</span>
            </button>
          </div>

          <div class="rune-about">
            <p><strong>No jogo:</strong> {{ selectedInfo.inGame }}</p>
            <p><strong>Prêmio sugerido:</strong> {{ selectedInfo.suggested }}</p>
          </div>

          <div class="field">
            <label>Nome interno</label>
            <input v-model="form.name" type="text" maxlength="100" placeholder="Ex: Runa de sexta" class="form-input" />
            <p class="field-hint">Só aparece no painel.</p>
          </div>
        </section>

        <section class="form-section">
          <h2 class="section-title">Quando</h2>
          <div class="field-row">
            <div class="field">
              <label>Horário do spawn <span class="required">*</span></label>
              <input v-model="form.spawn_time" type="time" class="form-input" required />
              <p class="field-hint">Todo dia, fuso de Brasília.</p>
            </div>
            <div class="field">
              <label>Fica visível por <span class="field-unit">minutos</span></label>
              <input v-model.number="form.visible_minutes" type="number" min="1" class="form-input" required />
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Primeiro dia <span class="required">*</span></label>
              <input v-model="form.starts_on" type="date" class="form-input" required />
            </div>
            <div class="field">
              <label>Último dia</label>
              <input v-model="form.ends_on" type="date" class="form-input" />
              <p class="field-hint">Vazio = pra sempre.</p>
            </div>
          </div>
        </section>

        <section class="form-section">
          <h2 class="section-title">Onde e vagas</h2>
          <div class="field-row">
            <div class="field">
              <label>Página</label>
              <select v-model="form.page" class="form-input">
                <option v-for="p in RUNE_PAGES" :key="p.value" :value="p.value">{{ p.label }}</option>
              </select>
            </div>
            <div class="field">
              <label>Vagas por spawn</label>
              <input v-if="prizeType === 'SKIN'" value="1" disabled class="form-input" />
              <input v-else v-model.number="form.max_finders" type="number" min="1" placeholder="Sem limite" class="form-input" />
              <p class="field-hint">{{ prizeType === 'SKIN' ? 'Skin é unidade única: 1 vaga.' : 'Vazio = todo mundo que clicar pega.' }}</p>
            </div>
          </div>

          <div class="field toggle-row">
            <label class="toggle-label">
              <div>
                <span>Ponto no header quando a runa está ativa</span>
                <p class="field-hint">"Tem runa no mapa". Mais gente acha, menos caça.</p>
              </div>
              <button type="button" class="toggle" :class="{ 'toggle--on': form.minimap_hint }" @click="form.minimap_hint = !form.minimap_hint">
                <span class="toggle-knob" />
              </button>
            </label>
          </div>

          <div class="field toggle-row">
            <label class="toggle-label">
              <span>Ativa</span>
              <button type="button" class="toggle" :class="{ 'toggle--on': form.is_active }" @click="form.is_active = !form.is_active">
                <span class="toggle-knob" />
              </button>
            </label>
          </div>
        </section>

        <section class="form-section">
          <h2 class="section-title">Pra quem</h2>
          <p class="section-hint">Tudo vazio = qualquer usuário logado. Faixa de nível e lista de usuários somam: precisa passar nas duas.</p>

          <div class="field-row">
            <div class="field">
              <label>Nível mínimo</label>
              <select v-model="form.min_tier" class="form-input">
                <option :value="null">Qualquer</option>
                <option v-for="t in TIERS" :key="t" :value="t">Nível {{ t }}</option>
              </select>
            </div>
            <div class="field">
              <label>Nível máximo</label>
              <select v-model="form.max_tier" class="form-input">
                <option :value="null">Sem teto</option>
                <option v-for="t in TIERS" :key="t" :value="t">Nível {{ t }}</option>
              </select>
            </div>
          </div>

          <div class="field">
            <label>Usuários específicos</label>
            <input v-model="userQuery" type="search" placeholder="Nome, e-mail ou steam id..." class="form-input" @input="onUserQuery" />
            <p class="field-hint">Com lista, só quem está nela vê a runa.</p>
          </div>
          <div v-if="searchingUsers" class="loading-state small"><Icon icon="mdi:loading" class="spin" width="20" /></div>
          <ul v-else-if="userResults.length" class="skin-results">
            <li v-for="user in userResults" :key="user.id">
              <button type="button" class="skin-option" @click="addUser(user)">
                <img v-if="user.avatar" :src="user.avatar" class="avatar" alt="" />
                <span v-else class="avatar avatar--empty" />
                <span class="skin-option__text">
                  <strong>{{ user.username || user.email || user.id }}</strong>
                  <small>{{ user.steam_id ?? user.email ?? '' }}</small>
                </span>
              </button>
            </li>
          </ul>
          <div v-if="audience.length" class="chip-row">
            <button v-for="user in audience" :key="user.id" type="button" class="chip" @click="removeUser(user.id)">
              <img v-if="user.avatar" :src="user.avatar" class="avatar avatar--xs" alt="" />
              {{ user.username || user.email || user.id }}
              <Icon icon="mdi:close" width="12" />
            </button>
          </div>
        </section>

        <div class="form-footer">
          <span v-if="errorMsg" class="error-msg">{{ errorMsg }}</span>
          <div class="form-footer__actions">
            <button type="button" class="btn-ghost" @click="router.push('/runes')">Cancelar</button>
            <button type="submit" class="btn-primary" :disabled="submitting">
              {{ submitting ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar e definir prêmio' }}
            </button>
          </div>
        </div>
      </form>

      <!-- ── Direita: prêmio + quem pegou ─────────────────────────────────── -->
      <div class="form-col">
        <section class="form-section">
          <h2 class="section-title">Prêmio</h2>

          <p v-if="!isEdit" class="section-hint">Salva a runa primeiro. O prêmio é definido aqui depois — dá pra ver quem pegou antes de decidir.</p>

          <div v-if="isEdit" class="prize-kind">
            <button type="button" class="prize-tab" :class="{ 'prize-tab--on': prizeType === 'COUPON' }" :disabled="prizeBusy" @click="setPrizeType('COUPON')">
              <Icon icon="mdi:ticket-percent-outline" width="15" /> Cupom
            </button>
            <button type="button" class="prize-tab" :class="{ 'prize-tab--on': prizeType === 'SKIN' }" :disabled="prizeBusy" @click="setPrizeType('SKIN')">
              <Icon icon="mdi:sword" width="15" /> Skin
            </button>
          </div>

          <!-- Skin: uma unidade fixa do estoque. Busca começa vazia de propósito. -->
          <template v-if="isEdit && prizeType === 'SKIN'">
            <div v-if="inventory" class="prize-card prize-card--skin">
              <img v-if="skinThumb(inventory.skins?.icon_url_large)" :src="skinThumb(inventory.skins?.icon_url_large)!" class="skin-thumb" alt="" />
              <div class="prize-card__body">
                <strong>{{ inventory.skins?.name ?? 'Skin' }}</strong>
                <p class="field-hint">{{ inventory.skins?.hero ?? 'sem herói' }} · {{ formatPrice(inventory.price) }}</p>
                <p v-if="inventory.is_sold" class="field-hint field-hint--warn">Já entregue por esta runa.</p>
                <p v-else class="field-hint">Reservada: some da vitrine até a runa entregar ou você desvincular.</p>
              </div>
              <div class="prize-actions">
                <button type="button" class="btn-ghost" :disabled="prizeBusy || inventory.is_sold" @click="unlinkSkin">Desvincular</button>
              </div>
            </div>

            <div v-else class="prize-form">
              <div class="field">
                <label>Buscar no estoque</label>
                <input v-model="skinQuery" type="search" placeholder="Nome da skin..." class="form-input" @input="onSkinQuery" />
                <p class="field-hint">Só unidades disponíveis. Escolher = reservar na hora.</p>
              </div>
              <div v-if="searchingSkins" class="loading-state small"><Icon icon="mdi:loading" class="spin" width="20" /></div>
              <p v-else-if="skinQuery.trim().length >= 2 && skinResults.length === 0" class="empty-state">Nada disponível com esse nome.</p>
              <ul v-else-if="skinResults.length" class="skin-results">
                <li v-for="unit in skinResults" :key="unit.id">
                  <button type="button" class="skin-option" :disabled="prizeBusy" @click="linkSkin(unit)">
                    <img v-if="skinThumb(unit.skins?.icon_url_large)" :src="skinThumb(unit.skins?.icon_url_large)!" class="skin-thumb skin-thumb--sm" alt="" />
                    <span class="skin-option__text">
                      <strong>{{ unit.skins?.name }}</strong>
                      <small>{{ unit.skins?.hero ?? 'sem herói' }}</small>
                    </span>
                    <span class="skin-option__price">{{ formatPrice(unit.price) }}</span>
                  </button>
                </li>
              </ul>
            </div>
            <p v-if="prizeError" class="error-msg">{{ prizeError }}</p>
          </template>

          <template v-else-if="isEdit && coupon">
            <div class="prize-card">
              <div>
                <span class="code-badge">{{ coupon.code }}</span>
                <p class="prize-desc">{{ discountLabel(coupon) }}<span v-if="coupon.description"> · {{ coupon.description }}</span></p>
                <p class="field-hint">
                  {{ coupon.max_uses_per_user ?? '∞' }}x por pessoa ·
                  {{ coupon.expires_at ? `vale até ${dayjs(coupon.expires_at).format('DD/MM/YY HH:mm')}` : 'sem validade' }}
                  <span v-if="!coupon.is_active" class="text-danger"> · cupom inativo</span>
                </p>
              </div>
              <div class="prize-actions">
                <button type="button" class="btn-view" @click="router.push(`/coupons/${coupon.id}/edit`)">Editar cupom</button>
                <button type="button" class="btn-ghost" :disabled="prizeBusy" @click="unlinkPrize">Desvincular</button>
              </div>
            </div>
            <p class="field-hint">Só quem pegou a runa consegue usar esse código. Chutar ou passar o código não funciona.</p>
          </template>

          <template v-else-if="isEdit">
            <div class="prize-tabs">
              <button type="button" class="prize-tab" :class="{ 'prize-tab--on': prizeMode === 'create' }" @click="prizeMode = 'create'">Criar cupom</button>
              <button type="button" class="prize-tab" :class="{ 'prize-tab--on': prizeMode === 'link' }" @click="prizeMode = 'link'">Vincular existente</button>
            </div>

            <div v-if="prizeMode === 'create'" class="prize-form">
              <div class="field">
                <label>Código <span class="required">*</span></label>
                <input v-model="newCoupon.code" type="text" maxlength="50" class="form-input" style="text-transform:uppercase" required />
              </div>
              <div class="field-row">
                <div class="field">
                  <label>Tipo</label>
                  <select v-model="newCoupon.discount_type" class="form-input">
                    <option value="PERCENTAGE">Percentual (%)</option>
                    <option value="FIXED">Fixo (R$)</option>
                  </select>
                </div>
                <div class="field">
                  <label>Valor <span class="field-unit">{{ newCoupon.discount_type === 'PERCENTAGE' ? '%' : 'centavos' }}</span></label>
                  <input v-model.number="newCoupon.discount_value" type="number" min="1" class="form-input" required />
                  <p class="field-hint">{{ discountLabel(newCoupon) }}</p>
                </div>
              </div>
              <div class="field-row">
                <div class="field">
                  <label>Usos por pessoa</label>
                  <input v-model.number="newCoupon.max_uses_per_user" type="number" min="1" class="form-input" />
                </div>
                <div class="field">
                  <label>Expira em</label>
                  <input v-model="newCoupon.expires_at" type="datetime-local" class="form-input" />
                </div>
              </div>
              <div class="field">
                <label>Descrição</label>
                <input v-model="newCoupon.description" type="text" maxlength="255" placeholder="Aparece pro cliente" class="form-input" />
              </div>
              <button type="button" class="btn-primary" :disabled="prizeBusy || !newCoupon.code" @click="createPrize">
                {{ prizeBusy ? 'Criando...' : 'Criar e vincular' }}
              </button>
            </div>

            <div v-else class="prize-form">
              <div class="field">
                <label>Cupom</label>
                <select v-model="linkUuid" class="form-input">
                  <option value="">Escolhe um cupom ativo...</option>
                  <option v-for="c in linkableCoupons" :key="c.id" :value="c.id">{{ c.code }} — {{ discountLabel(c) }}</option>
                </select>
              </div>
              <button type="button" class="btn-primary" :disabled="prizeBusy || !linkUuid" @click="linkPrize">
                {{ prizeBusy ? 'Vinculando...' : 'Vincular' }}
              </button>
            </div>
            <p v-if="prizeError" class="error-msg">{{ prizeError }}</p>
          </template>
        </section>

        <section v-if="isEdit" class="form-section">
          <h2 class="section-title">Quem pegou</h2>

          <div class="stats">
            <div class="stat"><span class="stat-l">Viram</span><span class="stat-v">{{ discoveries.length }}</span></div>
            <div class="stat"><span class="stat-l">Pegaram</span><span class="stat-v stat-v--gold">{{ discoveries.length - count('seen') }}</span></div>
            <div class="stat"><span class="stat-l">{{ prizeType === 'SKIN' ? 'Entregues' : 'Usaram' }}</span><span class="stat-v stat-v--ok">{{ prizeType === 'SKIN' ? count('delivered') : count('redeemed') }}</span></div>
            <div class="stat"><span class="stat-l">{{ prizeType === 'SKIN' ? 'Em análise' : 'Expiraram' }}</span><span class="stat-v" :class="prizeType === 'SKIN' ? 'stat-v--gold' : 'stat-v--danger'">{{ prizeType === 'SKIN' ? count('awaiting_review') : count('expired') }}</span></div>
          </div>

          <div class="tabs">
            <button v-for="t in tabs" :key="t.value" type="button" class="tab" :class="{ 'tab--on': filter === t.value }" @click="filter = t.value">{{ t.label }}</button>
          </div>

          <div v-if="loadingDiscoveries" class="loading-state small"><Icon icon="mdi:loading" class="spin" width="22" /></div>
          <p v-else-if="filteredDiscoveries.length === 0" class="empty-state">Ninguém ainda.</p>
          <div v-else class="table-wrapper">
            <table>
              <thead>
                <tr><th>Usuário</th><th>Dia</th><th>Viu</th><th>Pegou</th><th>Usou</th><th>Status</th></tr>
              </thead>
              <tbody>
                <tr v-for="d in filteredDiscoveries" :key="d.id">
                  <td>
                    <div class="user-cell">
                      <img v-if="d.user?.avatar" :src="d.user.avatar" class="avatar" alt="" />
                      <span v-else class="avatar avatar--empty" />
                      <span>{{ d.user?.username || 'Sem nome' }}</span>
                      <span v-if="firstBlood.has(d.id)" class="fb">first blood</span>
                    </div>
                  </td>
                  <td class="text-muted">{{ dayjs(String(d.spawn_date).slice(0, 10)).format('DD/MM') }}</td>
                  <td class="text-muted">{{ time(d.seen_at) }}</td>
                  <td class="text-muted">{{ time(d.found_at) }}</td>
                  <td class="text-muted">{{ time(d.redeemed_at) }}</td>
                  <td>
                    <span class="status-badge" :class="`status-${d.status}`">{{ statusLabels[d.status as DiscoveryStatus] ?? d.status }}</span>
                    <RouterLink v-if="d.gift && d.user?.id" :to="`/users/${d.user.id}`" class="gift-link" title="Liberar na interna do usuário">{{ d.gift.order_number }}</RouterLink>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import { adminService } from '@/services/admin/admin.service'
import { RUNE_PAGES, RUNE_TYPES, runeInfo, type RunePage, type RuneType } from '@/utils/runes'

type DiscoveryStatus = 'seen' | 'found' | 'redeemed' | 'expired' | 'awaiting_review' | 'released' | 'delivered' | 'action_required' | 'rejected'
type PrizeType = 'COUPON' | 'SKIN'

const router = useRouter()
const route = useRoute()

const uuid = computed(() => route.params.uuid as string | undefined)
const isEdit = computed(() => !!uuid.value)
const loadingRune = ref(false)
const submitting = ref(false)
const errorMsg = ref('')

// ── Runa ─────────────────────────────────────────────────────────────────────

const form = reactive({
  type: 'BOUNTY' as RuneType,
  name: '',
  page: 'CATALOG' as RunePage,
  spawn_time: '20:00',
  visible_minutes: 5,
  starts_on: dayjs().format('YYYY-MM-DD'),
  ends_on: '',
  max_finders: 10 as number | null,
  minimap_hint: false,
  min_tier: null as number | null,
  max_tier: null as number | null,
  is_active: true,
})

// ponytail: espelha TIER_THRESHOLDS.length do backend; vira campo da API se a escada mudar de tamanho
const TIERS = [1, 2, 3, 4, 5, 6, 7]

const selectedInfo = computed(() => runeInfo(form.type))

const payload = () => ({
  type: form.type,
  name: form.name || null,
  page: form.page,
  spawn_time: form.spawn_time,
  visible_minutes: form.visible_minutes,
  starts_on: form.starts_on,
  ends_on: form.ends_on || null,
  max_finders: form.max_finders || null,
  minimap_hint: form.minimap_hint,
  min_tier: form.min_tier,
  max_tier: form.max_tier,
  audience_uuids: audience.value.map((user) => user.id),
  is_active: form.is_active,
})

const submit = async () => {
  errorMsg.value = ''
  submitting.value = true
  try {
    if (isEdit.value) {
      await adminService.updateRune(uuid.value!, payload())
      router.push('/runes')
      return
    }
    const res = await adminService.createRune(payload())
    router.push(`/runes/${res.data.id}/edit`)
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.message ?? 'Erro ao salvar runa.'
  } finally {
    submitting.value = false
  }
}

const fillForm = (data: any) => {
  form.type = data.type ?? 'BOUNTY'
  form.name = data.name ?? ''
  form.page = data.page ?? 'CATALOG'
  form.spawn_time = data.spawn_time ?? '20:00'
  form.visible_minutes = data.visible_minutes ?? 5
  form.starts_on = data.starts_on ? String(data.starts_on).slice(0, 10) : ''
  form.ends_on = data.ends_on ? String(data.ends_on).slice(0, 10) : ''
  form.max_finders = data.max_finders ?? null
  form.minimap_hint = data.minimap_hint ?? false
  form.min_tier = data.min_tier ?? null
  form.max_tier = data.max_tier ?? null
  audience.value = data.audience ?? []
  form.is_active = data.is_active ?? true
  coupon.value = data.coupon ?? null
  prizeType.value = data.prize_type ?? 'COUPON'
  inventory.value = data.inventory ?? null
}

// ── Prêmio ───────────────────────────────────────────────────────────────────

const coupon = ref<any>(null)
const prizeType = ref<PrizeType>('COUPON')
const inventory = ref<any>(null)
const prizeMode = ref<'create' | 'link'>('create')
const prizeBusy = ref(false)
const prizeError = ref('')
const linkUuid = ref('')
const allCoupons = ref<any[]>([])

const newCoupon = reactive({
  code: '',
  description: '',
  discount_type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
  discount_value: 10,
  max_uses_per_user: 1,
  expires_at: '',
})

watch(() => form.type, (t) => { if (!newCoupon.code || newCoupon.code.startsWith('RUNA-')) newCoupon.code = `RUNA-${t.replace('_', '')}` }, { immediate: true })

const linkableCoupons = computed(() => allCoupons.value.filter((c) => c.is_active))

const discountLabel = (c: { discount_type: string; discount_value: number }) =>
  c.discount_type === 'FIXED' ? `R$ ${(c.discount_value / 100).toFixed(2)} off` : `${c.discount_value}% off`

const withPrize = async (fn: () => Promise<{ data: any }>) => {
  prizeError.value = ''
  prizeBusy.value = true
  try {
    const res = await fn()
    coupon.value = res.data.coupon ?? null
    inventory.value = res.data.inventory ?? null
    prizeType.value = res.data.prize_type ?? prizeType.value
    await loadDiscoveries()
  } catch (err: any) {
    prizeError.value = err?.response?.data?.message ?? 'Erro ao salvar prêmio.'
  } finally {
    prizeBusy.value = false
  }
}

const createPrize = () => withPrize(() => adminService.createRuneCoupon(uuid.value!, {
  code: newCoupon.code.toUpperCase().trim(),
  description: newCoupon.description || null,
  discount_type: newCoupon.discount_type,
  discount_value: newCoupon.discount_value,
  max_uses_per_user: newCoupon.max_uses_per_user || 1,
  expires_at: newCoupon.expires_at ? new Date(newCoupon.expires_at).toISOString() : null,
}))

const linkPrize = () => withPrize(() => adminService.updateRune(uuid.value!, { coupon_uuid: linkUuid.value }))

const unlinkPrize = () => withPrize(() => adminService.updateRune(uuid.value!, { coupon_uuid: null }))

const setPrizeType = (type: PrizeType) => {
  if (type === prizeType.value) return
  return withPrize(() => adminService.updateRune(uuid.value!, { prize_type: type }))
}

// ── Skin fixa ────────────────────────────────────────────────────────────────

const skinQuery = ref('')
const skinResults = ref<any[]>([])
const searchingSkins = ref(false)
let skinTimer: ReturnType<typeof setTimeout> | null = null

// ── Público-alvo: usuários específicos ──────────────────────────────────────
// Lista vazia = todo mundo. Payload manda só os uuids; a API devolve o resumo.

const audience = ref<any[]>([])
const userQuery = ref('')
const userResults = ref<any[]>([])
const searchingUsers = ref(false)
let userTimer: ReturnType<typeof setTimeout> | null = null

const searchUsers = async () => {
  const search = userQuery.value.trim()
  if (search.length < 2) { userResults.value = []; return }
  searchingUsers.value = true
  try {
    const res = await adminService.getAllUsers(1, 8, search)
    const chosen = new Set(audience.value.map((user) => user.id))
    userResults.value = (res.data.data ?? []).filter((user: any) => !chosen.has(user.id))
  } catch {
    userResults.value = []
  } finally {
    searchingUsers.value = false
  }
}

const onUserQuery = () => {
  if (userTimer) clearTimeout(userTimer)
  userTimer = setTimeout(searchUsers, 300)
}

const addUser = (user: any) => {
  audience.value = [...audience.value, user]
  userQuery.value = ''
  userResults.value = []
}

const removeUser = (id: string) => {
  audience.value = audience.value.filter((user) => user.id !== id)
}

const skinThumb = (icon?: string | null): string | null =>
  icon ? `https://steamcommunity-a.akamaihd.net/economy/image/${icon}/62fx62f` : null

const formatPrice = (cents?: number | null) =>
  cents == null ? '—' : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const searchSkins = async () => {
  const search = skinQuery.value.trim()
  if (search.length < 2) { skinResults.value = []; return }
  searchingSkins.value = true
  try {
    const res = await adminService.getInventory({ search, status: 'available', limit: 8 })
    skinResults.value = res.data.data ?? res.data ?? []
  } catch {
    skinResults.value = []
  } finally {
    searchingSkins.value = false
  }
}

const onSkinQuery = () => {
  if (skinTimer) clearTimeout(skinTimer)
  skinTimer = setTimeout(searchSkins, 300)
}

const linkSkin = (unit: any) => withPrize(async () => {
  const res = await adminService.updateRune(uuid.value!, { prize_type: 'SKIN', inventory_uuid: unit.id })
  skinQuery.value = ''
  skinResults.value = []
  return res
})

const unlinkSkin = () => withPrize(() => adminService.updateRune(uuid.value!, { inventory_uuid: null }))

const loadCoupons = async () => {
  const res = await adminService.getCoupons()
  allCoupons.value = res.data
}

// ── Quem pegou ───────────────────────────────────────────────────────────────

const discoveries = ref<any[]>([])
const loadingDiscoveries = ref(false)
const filter = ref<'all' | DiscoveryStatus>('all')

const tabs = computed<Array<{ value: 'all' | DiscoveryStatus; label: string }>>(() => [
  { value: 'all', label: 'Todos' },
  ...[...new Set(discoveries.value.map((d) => d.status as DiscoveryStatus))].map((value) => ({ value, label: statusLabels[value] ?? value })),
])

const statusLabels: Record<DiscoveryStatus, string> = {
  seen: 'só viu',
  found: 'engarrafada',
  redeemed: 'usou',
  expired: 'expirou',
  awaiting_review: 'em análise',
  released: 'liberada',
  delivered: 'entregue',
  action_required: 'sem trade link',
  rejected: 'recusada',
}

const count = (s: DiscoveryStatus) => discoveries.value.filter((d) => d.status === s).length

const filteredDiscoveries = computed(() =>
  filter.value === 'all' ? discoveries.value : discoveries.value.filter((d) => d.status === filter.value),
)

// primeiro found_at de cada spawn_date (lista já vem ordenada por found_at asc)
const firstBlood = computed(() => {
  const seenDates = new Set<string>()
  const ids = new Set<string>()
  discoveries.value.filter((d) => d.found_at).forEach((d) => {
    if (seenDates.has(d.spawn_date)) return
    seenDates.add(d.spawn_date)
    ids.add(d.id)
  })
  return ids
})

const time = (d: string | null) => (d ? dayjs(d).format('HH:mm') : '—')

const loadDiscoveries = async () => {
  loadingDiscoveries.value = true
  try {
    const res = await adminService.getRuneDiscoveries(uuid.value!)
    discoveries.value = res.data
  } finally {
    loadingDiscoveries.value = false
  }
}

onMounted(async () => {
  if (!isEdit.value) return
  loadingRune.value = true
  try {
    const res = await adminService.getRune(uuid.value!)
    fillForm(res.data)
  } finally {
    loadingRune.value = false
  }
  await Promise.all([loadDiscoveries(), loadCoupons()])
})
</script>

<style lang="stylus" scoped>
.view-wrap
  padding 2rem
  color #fff
  min-height 100vh

.page-header
  margin-bottom 2rem

.btn-back
  display inline-flex
  align-items center
  gap 6px
  background transparent
  border none
  color rgba(255,255,255,0.45)
  font-size 0.82rem
  cursor pointer
  padding 0 0 8px
  &:hover
    color rgba(255,255,255,0.8)

.page-title
  font-size 1.6rem
  font-weight 700
  margin 0

.loading-state
  display flex
  justify-content center
  padding 4rem
  color rgba(255,255,255,0.4)
  &.small
    padding 1.5rem

.form-grid
  display grid
  grid-template-columns 1fr 1fr
  gap 1.5rem
  align-items start
  @media (max-width: 900px)
    grid-template-columns 1fr

.form-col
  display flex
  flex-direction column
  gap 1.5rem

.form-footer
  display flex
  align-items center
  justify-content flex-end
  gap 1rem

.form-footer__actions
  display flex
  gap 8px

.error-msg
  color #fc8181
  font-size 0.875rem

.form-section
  background #16161a
  border 1px solid rgba(255,255,255,0.06)
  border-radius 12px
  padding 1.25rem 1.5rem

.section-title
  font-size 0.95rem
  font-weight 700
  color rgba(255,255,255,0.85)
  margin 0 0 1rem
  padding-bottom 0.5rem
  border-bottom 1px solid rgba(255,255,255,0.06)

.section-hint
  font-size 0.8rem
  color rgba(255,255,255,0.4)
  margin -0.5rem 0 1rem

.field
  display flex
  flex-direction column
  gap 6px
  margin-bottom 1rem
  label
    font-size 0.82rem
    font-weight 600
    color rgba(255,255,255,0.65)
  &:last-child
    margin-bottom 0

.field-row
  display grid
  grid-template-columns 1fr 1fr
  gap 0.75rem

.required
  color #fc8181

.field-unit
  font-weight 400
  color rgba(255,255,255,0.35)
  margin-left 4px

.field-hint
  font-size 0.75rem
  color rgba(255,255,255,0.35)
  margin 0

.field-hint--warn
  color #fbbf24

.form-input
  background rgba(0,0,0,0.25)
  border 1px solid rgba(255,255,255,0.1)
  border-radius 8px
  color #fff
  padding 0.5rem 0.75rem
  font-size 0.875rem
  outline none
  width 100%
  box-sizing border-box
  color-scheme dark
  &:focus
    border-color rgba(99,102,241,0.5)
  option
    background #1a1a1e
    color #fff

.toggle-row
  margin-bottom 1rem

.toggle-label
  display flex
  align-items center
  justify-content space-between
  gap 1rem
  cursor default
  font-size 0.875rem
  color rgba(255,255,255,0.7)

.toggle
  flex-shrink 0
  width 40px
  height 22px
  background rgba(255,255,255,0.12)
  border none
  border-radius 999px
  position relative
  cursor pointer
  transition background 0.2s
  padding 0

.toggle--on
  background #6366f1

.toggle-knob
  display block
  width 16px
  height 16px
  background #fff
  border-radius 50%
  position absolute
  top 3px
  left 3px
  transition transform 0.2s

.toggle--on .toggle-knob
  transform translateX(18px)

// Picker
.rune-picker
  display grid
  grid-template-columns repeat(4, 1fr)
  gap 8px
  margin-bottom 1rem

.rune-pick
  display flex
  flex-direction column
  align-items center
  gap 4px
  padding 10px 6px 8px
  background rgba(0,0,0,0.25)
  border 1px solid rgba(255,255,255,0.08)
  border-radius 10px
  color rgba(255,255,255,0.55)
  font-size 0.72rem
  cursor pointer
  transition border-color 0.15s, color 0.15s
  img
    width 44px
    height 44px
    filter drop-shadow(0 0 6px rgba(255,255,255,0.12))
  &:hover
    border-color rgba(255,255,255,0.25)
    color #fff

.rune-pick--on
  border-color #fbbf24
  background rgba(251,191,36,0.10)
  color #fbbf24

.rune-about
  background rgba(255,255,255,0.03)
  border-radius 8px
  padding 10px 12px
  margin-bottom 1rem
  font-size 0.8rem
  color rgba(255,255,255,0.6)
  p
    margin 0 0 4px
    &:last-child
      margin 0
  strong
    color rgba(255,255,255,0.85)

// Prêmio
.prize-card
  display flex
  align-items flex-start
  justify-content space-between
  gap 1rem
  background rgba(99,102,241,0.06)
  border 1px solid rgba(99,102,241,0.2)
  border-radius 10px
  padding 12px 14px
  margin-bottom 0.75rem

.prize-desc
  margin 6px 0 4px
  font-size 0.875rem
  color rgba(255,255,255,0.8)

.prize-actions
  display flex
  flex-direction column
  gap 6px
  flex-shrink 0

.prize-kind
  display flex
  gap 4px
  margin-bottom 1rem
  padding-bottom 1rem
  border-bottom 1px solid rgba(255,255,255,0.06)

  .prize-tab
    display inline-flex
    align-items center
    justify-content center
    gap 6px

.prize-card--skin
  align-items center

.prize-card__body
  flex 1
  min-width 0
  strong
    display block
    font-size 0.9rem

.skin-thumb
  width 62px
  height 62px
  border-radius 8px
  object-fit contain
  background rgba(0,0,0,0.3)
  flex-shrink 0

  &--sm
    width 40px
    height 40px

.skin-results
  list-style none
  margin 0
  padding 0
  display flex
  flex-direction column
  gap 4px

.skin-option
  display flex
  align-items center
  gap 10px
  width 100%
  padding 6px 8px
  background rgba(0,0,0,0.2)
  border 1px solid rgba(255,255,255,0.06)
  border-radius 8px
  color #fff
  text-align left
  cursor pointer
  &:hover
    border-color rgba(251,191,36,0.5)
    background rgba(251,191,36,0.06)
  &:disabled
    opacity 0.5
    cursor not-allowed

  &__text
    flex 1
    min-width 0
    display flex
    flex-direction column
    strong
      font-size 0.82rem
      white-space nowrap
      overflow hidden
      text-overflow ellipsis
    small
      font-size 0.72rem
      color rgba(255,255,255,0.45)

  &__price
    font-family 'Courier New', monospace
    font-size 0.8rem
    color #4ade80

.gift-link
  display block
  margin-top 3px
  font-family 'Courier New', monospace
  font-size 0.7rem
  color #a5b4fc
  text-decoration none
  &:hover
    text-decoration underline

.status-awaiting_review
  background rgba(251,191,36,0.12)
  color #fbbf24

.status-released
  background rgba(99,102,241,0.15)
  color #a5b4fc

.status-delivered
  background rgba(46,220,138,0.12)
  color #4ade80

.status-action_required, .status-rejected
  background rgba(252,129,129,0.12)
  color #fc8181

.prize-tabs
  display flex
  gap 4px
  margin-bottom 1rem

.prize-tab
  flex 1
  padding 8px
  background transparent
  border 1px solid rgba(255,255,255,0.1)
  border-radius 8px
  color rgba(255,255,255,0.55)
  font-size 0.82rem
  font-weight 600
  cursor pointer

.prize-tab--on
  background rgba(99,102,241,0.15)
  border-color rgba(99,102,241,0.4)
  color #a5b4fc

.prize-form
  display flex
  flex-direction column
  gap 0.25rem

.code-badge
  background rgba(99,102,241,0.12)
  color #a5b4fc
  padding 2px 8px
  border-radius 6px
  font-size 0.85rem
  font-weight 700
  letter-spacing 0.05em

.text-danger
  color #fc8181

// Quem pegou
.stats
  display grid
  grid-template-columns repeat(4, 1fr)
  gap 8px
  margin-bottom 1rem

.stat
  background rgba(0,0,0,0.25)
  border-radius 8px
  padding 10px 12px
  display flex
  flex-direction column
  gap 2px

.stat-l
  font-size 0.7rem
  text-transform uppercase
  letter-spacing 0.06em
  color rgba(255,255,255,0.4)

.stat-v
  font-size 1.4rem
  font-weight 700
  &--gold
    color #fbbf24
  &--ok
    color #4ade80
  &--danger
    color #fc8181

.tabs
  display flex
  gap 4px
  flex-wrap wrap
  margin-bottom 0.75rem

.tab
  padding 4px 10px
  background transparent
  border 1px solid transparent
  border-radius 6px
  color rgba(255,255,255,0.5)
  font-size 0.78rem
  cursor pointer

.tab--on
  background rgba(99,102,241,0.15)
  border-color rgba(99,102,241,0.35)
  color #a5b4fc

.table-wrapper
  overflow-x auto
  margin 0 -1.5rem -1.25rem
  padding 0 1.5rem 1.25rem

table
  width 100%
  border-collapse collapse

th
  padding 0.5rem 0.6rem
  text-align left
  font-size 0.7rem
  font-weight 600
  text-transform uppercase
  letter-spacing 0.04em
  color rgba(255,255,255,0.4)
  border-bottom 1px solid rgba(255,255,255,0.06)

td
  padding 0.55rem 0.6rem
  font-size 0.82rem
  border-bottom 1px solid rgba(255,255,255,0.04)
  vertical-align middle
  white-space nowrap

tbody tr:last-child td
  border-bottom none

.user-cell
  display flex
  align-items center
  gap 8px

.avatar
  width 24px
  height 24px
  border-radius 50%
  object-fit cover
  flex-shrink 0
  &--empty
    background rgba(255,255,255,0.1)
  &--xs
    width 16px
    height 16px

// público-alvo: usuários escolhidos, clique tira
.chip-row
  display flex
  flex-wrap wrap
  gap 6px
  margin-top 8px

.chip
  display inline-flex
  align-items center
  gap 5px
  padding 4px 10px
  border-radius 999px
  background rgba(251,191,36,0.1)
  border 1px solid rgba(251,191,36,0.3)
  color #fbbf24
  font-size 0.78rem
  cursor pointer
  &:hover
    background rgba(252,129,129,0.12)
    border-color rgba(252,129,129,0.35)
    color #fca5a5

.fb
  font-size 0.65rem
  text-transform uppercase
  letter-spacing 0.05em
  padding 1px 6px
  border-radius 999px
  background rgba(252,129,129,0.12)
  color #fc8181

.text-muted
  color rgba(255,255,255,0.4)

.status-badge
  display inline-block
  padding 2px 8px
  border-radius 999px
  font-size 0.7rem
  font-weight 600

.status-seen
  background rgba(255,255,255,0.06)
  color rgba(255,255,255,0.45)

.status-found
  background rgba(251,191,36,0.12)
  color #fbbf24

.status-redeemed
  background rgba(46,220,138,0.12)
  color #4ade80

.status-expired
  background rgba(252,129,129,0.12)
  color #fc8181

.empty-state
  text-align center
  padding 1.5rem
  color rgba(255,255,255,0.35)
  font-size 0.85rem
  margin 0

.btn-primary
  display inline-flex
  align-items center
  justify-content center
  gap 6px
  padding 0.5rem 1rem
  background #6366f1
  border none
  border-radius 8px
  color #fff
  font-weight 600
  font-size 0.875rem
  cursor pointer
  &:hover
    background #4f46e5
  &:disabled
    opacity 0.5
    cursor not-allowed

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

.btn-ghost
  padding 4px 12px
  background transparent
  border 1px solid rgba(255,255,255,0.12)
  border-radius 6px
  color rgba(255,255,255,0.65)
  font-size 0.85rem
  cursor pointer
  &:hover
    background rgba(255,255,255,0.06)
  &:disabled
    opacity 0.5
    cursor not-allowed

.spin
  animation spin 1s linear infinite

@keyframes spin
  to
    transform rotate(360deg)
</style>
