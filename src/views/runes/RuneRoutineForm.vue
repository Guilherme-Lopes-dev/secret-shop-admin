<template>
  <div class="view-wrap">
    <header class="page-header">
      <button class="btn-back" @click="router.push('/runes')">
        <Icon icon="mdi:arrow-left" width="16" /> Runas
      </button>
      <h1 class="page-title">{{ isEdit ? form.name || 'Rotina' : 'Nova rotina' }}</h1>
      <p class="page-subtitle">Nos dias marcados, a runa nasce num minuto sorteado da janela — o mesmo pra todos. O tipo é sorteado por usuário.</p>
    </header>

    <div v-if="loading" class="loading-state">
      <Icon icon="mdi:loading" class="spin" width="32" />
    </div>

    <form v-else class="form-grid" @submit.prevent="submit">
      <!-- ── Esquerda: quando, qual, onde, pra quem ─────────────────────────── -->
      <div class="form-col">
        <section class="form-section">
          <h2 class="section-title">Quando</h2>
          <div class="field">
            <label>Nome <span class="required">*</span></label>
            <input v-model="form.name" type="text" maxlength="100" placeholder="Ex: Sexta e sábado à noite" class="form-input" required />
            <p class="field-hint">Só aparece no painel. As runas geradas levam esse nome.</p>
          </div>

          <div class="field">
            <label>Dias <span class="required">*</span></label>
            <div class="day-row">
              <button
                v-for="(label, day) in WEEKDAYS"
                :key="day"
                type="button"
                class="day"
                :class="{ 'day--on': form.weekdays.includes(day) }"
                @click="toggleDay(day)"
              >
                {{ label }}
              </button>
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label>Janela abre <span class="required">*</span></label>
              <input v-model="form.window_start" type="time" class="form-input" required />
            </div>
            <div class="field">
              <label>Janela fecha <span class="required">*</span></label>
              <input v-model="form.window_end" type="time" class="form-input" required />
            </div>
          </div>

          <div class="field">
            <label>Fica visível por <span class="field-unit">minutos</span></label>
            <input v-model.number="form.visible_minutes" type="number" min="1" class="form-input" required />
          </div>

          <p class="window-hint" :class="{ 'window-hint--bad': !windowOk }">
            <Icon :icon="windowOk ? 'mdi:dice-5-outline' : 'mdi:alert-outline'" width="15" />
            {{ windowHint }}
          </p>
          <p v-if="lastSpawn" class="window-hint spawn-hint">
            <Icon icon="mdi:clock-outline" width="15" />
            {{ spawnHint }}
          </p>
        </section>

        <section class="form-section">
          <h2 class="section-title">Tipo sorteado</h2>
          <p class="section-hint">Cada usuário vê uma das marcadas, a mesma o dia todo. Nenhuma marcada = qualquer uma das 8.</p>
          <div class="rune-picker">
            <button
              v-for="r in RUNE_TYPES"
              :key="r.value"
              type="button"
              class="rune-pick"
              :class="{ 'rune-pick--on': form.types.includes(r.value) }"
              @click="toggleType(r.value)"
            >
              <img :src="r.image" alt="" />
              <span>{{ r.label }}</span>
            </button>
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
              <input v-if="form.prize_type === 'SKIN'" value="1" disabled class="form-input" />
              <input v-else v-model.number="form.max_finders" type="number" min="1" placeholder="Sem limite" class="form-input" />
              <p class="field-hint">{{ form.prize_type === 'SKIN' ? 'Skin é unidade única: 1 vaga.' : 'Vazio = todo mundo que clicar pega.' }}</p>
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
              <div>
                <span>Ativa</span>
                <p class="field-hint">Desligar para de gerar. A runa de hoje, se já gerada, continua.</p>
              </div>
              <button type="button" class="toggle" :class="{ 'toggle--on': form.is_active }" @click="form.is_active = !form.is_active">
                <span class="toggle-knob" />
              </button>
            </label>
          </div>
        </section>

        <section class="form-section">
          <h2 class="section-title">Pra quem</h2>
          <p class="section-hint">Tudo vazio = qualquer usuário logado. Faixa de nível e lista de usuários somam.</p>
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
            <button type="button" class="btn-ghost" @click="pickerOpen = true">
              <Icon icon="mdi:account-multiple-plus" width="16" />
              {{ audience.length ? `Selecionar usuários (${audience.length})` : 'Selecionar usuários' }}
            </button>
          </div>
          <div v-if="audience.length" class="chip-row">
            <button v-for="user in audience" :key="user.id" type="button" class="chip" @click="removeUser(user.id)">
              <img v-if="user.avatar" :src="user.avatar" class="avatar" alt="" />
              {{ user.username || user.email || user.id }}
              <Icon icon="mdi:close" width="12" />
            </button>
          </div>
        </section>
      </div>

      <!-- ── Direita: prêmio de cada spawn ──────────────────────────────────── -->
      <div class="form-col">
        <section class="form-section">
          <h2 class="section-title">Prêmio de cada spawn</h2>
          <div class="prize-kind">
            <button type="button" class="prize-tab" :class="{ 'prize-tab--on': form.prize_type === 'COUPON' }" @click="form.prize_type = 'COUPON'">
              <Icon icon="mdi:ticket-percent-outline" width="15" /> Cupom
            </button>
            <button type="button" class="prize-tab" :class="{ 'prize-tab--on': form.prize_type === 'SKIN' }" @click="form.prize_type = 'SKIN'">
              <Icon icon="mdi:sword" width="15" /> Skin
            </button>
          </div>

          <div v-if="form.prize_type === 'COUPON'" class="prize-form">
            <p class="section-hint">Cada runa gerada ganha um cupom novo (RUNA-XXXXXX) com isso. Só quem pegou consegue usar.</p>
            <div class="field-row">
              <div class="field">
                <label>Tipo</label>
                <select v-model="template.discount_type" class="form-input">
                  <option value="PERCENTAGE">Percentual (%)</option>
                  <option value="FIXED">Fixo (R$)</option>
                </select>
              </div>
              <div class="field">
                <label>Valor <span class="field-unit">{{ template.discount_type === 'PERCENTAGE' ? '%' : 'centavos' }}</span></label>
                <input v-model.number="template.discount_value" type="number" min="1" class="form-input" required />
                <p class="field-hint">{{ discountLabel }}</p>
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label>Usos por pessoa</label>
                <input v-model.number="template.max_uses_per_user" type="number" min="1" class="form-input" />
              </div>
              <div class="field">
                <label>Vale por <span class="field-unit">dias</span></label>
                <input v-model.number="template.valid_days" type="number" min="1" placeholder="Não expira" class="form-input" />
                <p class="field-hint">Conta do spawn.</p>
              </div>
            </div>
            <div class="field">
              <label>Descrição</label>
              <input v-model="template.description" type="text" maxlength="255" placeholder="Aparece pro cliente" class="form-input" />
            </div>
          </div>

          <template v-else>
            <div v-if="unit" class="prize-card">
              <img v-if="skinThumb(unit.skins?.icon_url_large)" :src="skinThumb(unit.skins?.icon_url_large)!" class="skin-thumb" alt="" />
              <div class="prize-card__body">
                <strong>{{ unit.skins?.name ?? 'Skin' }}</strong>
                <p class="field-hint">{{ unit.skins?.hero ?? 'sem herói' }} · {{ formatPrice(unit.price) }}</p>
                <p v-if="unit.is_sold" class="field-hint field-hint--warn">Já saiu numa runa. Troca a skin pra rotina voltar a gerar.</p>
                <p v-else class="field-hint">A rotina reserva até alguém pegar. Depois disso ela para de gerar.</p>
              </div>
              <button type="button" class="btn-ghost" @click="unit = null">Trocar</button>
            </div>

            <div v-else class="prize-form">
              <div class="field">
                <label>Buscar no estoque</label>
                <input v-model="skinQuery" type="search" placeholder="Nome da skin..." class="form-input" @input="onSkinQuery" />
                <p class="field-hint">Só unidades disponíveis. Reserva quando salvar.</p>
              </div>
              <div v-if="searchingSkins" class="loading-state small"><Icon icon="mdi:loading" class="spin" width="20" /></div>
              <p v-else-if="skinQuery.trim().length >= 2 && skinResults.length === 0" class="empty-state">Nada disponível com esse nome.</p>
              <ul v-else-if="skinResults.length" class="skin-results">
                <li v-for="option in skinResults" :key="option.id">
                  <button type="button" class="skin-option" @click="pickSkin(option)">
                    <img v-if="skinThumb(option.skins?.icon_url_large)" :src="skinThumb(option.skins?.icon_url_large)!" class="skin-thumb skin-thumb--sm" alt="" />
                    <span class="skin-option__text">
                      <strong>{{ option.skins?.name }}</strong>
                      <small>{{ option.skins?.hero ?? 'sem herói' }}</small>
                    </span>
                    <span class="skin-option__price">{{ formatPrice(option.price) }}</span>
                  </button>
                </li>
              </ul>
            </div>
          </template>
        </section>

        <div class="form-footer">
          <span v-if="errorMsg" class="error-msg">{{ errorMsg }}</span>
          <div class="form-footer__actions">
            <button type="button" class="btn-ghost" @click="router.push('/runes')">Cancelar</button>
            <button type="submit" class="btn-primary" :disabled="submitting || !canSubmit">
              {{ submitting ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar rotina' }}
            </button>
          </div>
        </div>
      </div>
    </form>
    <UserPickerModal :open="pickerOpen" :selected="audience" @close="pickerOpen = false" @apply="applyAudience" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { adminService } from '@/services/admin/admin.service'
import dayjs from 'dayjs'
import { RUNE_PAGES, RUNE_TYPES, WEEKDAYS, runeTypeLabel, type RunePage, type RuneType } from '@/utils/runes'
import UserPickerModal from '@/components/users/UserPickerModal.vue'

type PrizeType = 'COUPON' | 'SKIN'

const router = useRouter()
const route = useRoute()

const uuid = computed(() => route.params.uuid as string | undefined)
const isEdit = computed(() => !!uuid.value)
const loading = ref(false)
const submitting = ref(false)
const errorMsg = ref('')

// ponytail: espelha TIER_THRESHOLDS.length do backend, igual RuneForm
const TIERS = [1, 2, 3, 4, 5, 6, 7]

const form = reactive({
  name: '',
  weekdays: [5, 6] as number[],
  window_start: '18:00',
  window_end: '20:00',
  visible_minutes: 5,
  types: RUNE_TYPES.map((r) => r.value) as RuneType[],
  page: 'CATALOG' as RunePage,
  max_finders: 10 as number | null,
  minimap_hint: false,
  min_tier: null as number | null,
  max_tier: null as number | null,
  is_active: true,
  prize_type: 'COUPON' as PrizeType,
})

const template = reactive({
  discount_type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
  discount_value: 10,
  max_uses_per_user: 1 as number | null,
  valid_days: 7 as number | null,
  description: '' as string | null,
})

const unit = ref<any>(null)

// ── Janela ───────────────────────────────────────────────────────────────────

const toMinutes = (time: string) => {
  const [h = 0, m = 0] = time.split(':').map(Number)
  return h * 60 + m
}

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

const lastStart = computed(() => toMinutes(form.window_end) - form.visible_minutes)
const windowOk = computed(() => lastStart.value >= toMinutes(form.window_start))

const windowHint = computed(() => {
  if (!windowOk.value) return 'A janela não cabe a runa inteira: fecha mais tarde ou diminui o tempo visível.'
  return `Nasce entre ${form.window_start} e ${hhmm(lastStart.value)} (Brasília) e some ${form.visible_minutes} min depois.`
})

// Horário já sorteado pelo job; editar a janela não muda o spawn de hoje.
const lastSpawn = ref<any>(null)

// `starts_on` é dia de Brasília; o navegador pode estar em outro fuso. en-CA = YYYY-MM-DD.
const todayInBrasilia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

const spawnHint = computed(() => {
  const spawn = lastSpawn.value
  if (!spawn) return ''
  const date = String(spawn.starts_on).slice(0, 10)
  const when = date === todayInBrasilia() ? 'hoje' : dayjs(date).format('DD/MM')
  const removed = spawn.deleted_at ? ' (removida)' : ''
  return `Último sorteio: ${when} às ${spawn.spawn_time} · ${runeTypeLabel(spawn)}${removed}`
})

const canSubmit = computed(() => form.weekdays.length > 0 && windowOk.value)

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value])

const toggleDay = (day: number) => { form.weekdays = toggle(form.weekdays, day) }
const toggleType = (type: RuneType) => { form.types = toggle(form.types, type) }

// ── Prêmio ───────────────────────────────────────────────────────────────────

const discountLabel = computed(() =>
  template.discount_type === 'FIXED' ? `R$ ${(template.discount_value / 100).toFixed(2)} off` : `${template.discount_value}% off`,
)

const couponTemplate = () => ({
  ...template,
  max_uses_per_user: template.max_uses_per_user || 1,
  valid_days: template.valid_days || null,
  description: template.description || null,
})

const skinQuery = ref('')
const skinResults = ref<any[]>([])
const searchingSkins = ref(false)
let skinTimer: ReturnType<typeof setTimeout> | null = null

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

const pickSkin = (option: any) => {
  unit.value = option
  skinQuery.value = ''
  skinResults.value = []
}

// ── Público-alvo ─────────────────────────────────────────────────────────────

const audience = ref<any[]>([])
const pickerOpen = ref(false)

const applyAudience = (users: any[]) => {
  audience.value = users
  pickerOpen.value = false
}

const removeUser = (id: string) => {
  audience.value = audience.value.filter((user) => user.id !== id)
}

// ── Salvar / carregar ────────────────────────────────────────────────────────

const payload = () => ({
  ...form,
  max_finders: form.max_finders || null,
  audience_uuids: audience.value.map((user) => user.id),
  coupon_template: form.prize_type === 'COUPON' ? couponTemplate() : undefined,
  inventory_uuid: form.prize_type === 'SKIN' ? unit.value?.id ?? null : undefined,
})

const save = () => {
  if (isEdit.value) return adminService.updateRuneRoutine(uuid.value!, payload())
  return adminService.createRuneRoutine(payload())
}

const apiError = (err: any) =>
  [err?.response?.data?.message].flat().filter(Boolean).join(' · ') || 'Erro ao salvar rotina.'

const submit = async () => {
  errorMsg.value = ''
  submitting.value = true
  try {
    await save()
    router.push('/runes')
  } catch (err: any) {
    errorMsg.value = apiError(err)
  } finally {
    submitting.value = false
  }
}

// `key in data`: null da API (ex: sem limite de vagas) tem que sobrescrever o default
const fillForm = (data: any) => {
  Object.keys(form).filter((key) => key in data).forEach((key) => { (form as any)[key] = data[key] })
  Object.assign(template, data.coupon_template ?? {})
  unit.value = data.inventory ?? null
  audience.value = data.audience ?? []
  lastSpawn.value = data.runes?.[0] ?? null
}

onMounted(async () => {
  if (!isEdit.value) return
  loading.value = true
  try {
    const res = await adminService.getRuneRoutine(uuid.value!)
    fillForm(res.data)
  } finally {
    loading.value = false
  }
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
  margin 0 0 4px

.page-subtitle
  font-size 0.85rem
  color rgba(255,255,255,0.45)
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

// Dias da semana
.day-row
  display grid
  grid-template-columns repeat(7, 1fr)
  gap 6px

.day
  padding 8px 0
  background rgba(0,0,0,0.25)
  border 1px solid rgba(255,255,255,0.08)
  border-radius 8px
  color rgba(255,255,255,0.5)
  font-size 0.8rem
  font-weight 600
  cursor pointer
  &:hover
    border-color rgba(255,255,255,0.25)
    color #fff

.day--on
  border-color #fbbf24
  background rgba(251,191,36,0.10)
  color #fbbf24

.window-hint
  display flex
  align-items center
  gap 6px
  margin 0
  padding 8px 12px
  border-radius 8px
  background rgba(99,102,241,0.08)
  color #a5b4fc
  font-size 0.8rem

.window-hint--bad
  background rgba(252,129,129,0.10)
  color #fc8181

.spawn-hint
  margin-top 8px
  background rgba(251,191,36,0.08)
  color #fbbf24

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

// Prêmio
.prize-kind
  display flex
  gap 4px
  margin-bottom 1rem
  padding-bottom 1rem
  border-bottom 1px solid rgba(255,255,255,0.06)

.prize-tab
  flex 1
  display inline-flex
  align-items center
  justify-content center
  gap 6px
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

.prize-card
  display flex
  align-items center
  gap 1rem
  background rgba(99,102,241,0.06)
  border 1px solid rgba(99,102,241,0.2)
  border-radius 10px
  padding 12px 14px

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

// Público-alvo
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

.avatar
  width 16px
  height 16px
  border-radius 50%
  object-fit cover

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

.btn-ghost
  display inline-flex
  align-items center
  gap 6px
  padding 4px 12px
  background transparent
  border 1px solid rgba(255,255,255,0.12)
  border-radius 6px
  color rgba(255,255,255,0.65)
  font-size 0.85rem
  cursor pointer
  &:hover
    background rgba(255,255,255,0.06)

.spin
  animation spin 1s linear infinite

@keyframes spin
  to
    transform rotate(360deg)
</style>
