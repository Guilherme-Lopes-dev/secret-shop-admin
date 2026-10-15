<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <h1 class="page-title">Config do Trocador</h1>
        <p class="page-subtitle">Preço, compensação e acesso do trocador, e a tendência do que os usuários trazem.</p>
      </div>
      <router-link to="/swaps" class="btn-ghost">Ver trocas</router-link>
    </header>

    <div class="config-grid">
      <section class="config-card">
        <header class="card-head">
          <h3>Multiplicadores de preço</h3>
          <p class="config-hint">usuário = preço SteamWebAPI × mult · loja = preço do catálogo × mult</p>
        </header>
        <div class="fields-grid">
          <div class="field">
            <small>Itens do usuário</small>
            <input v-model.number="multiplier" type="number" step="0.01" min="0" />
          </div>
          <div class="field">
            <small>Itens da loja</small>
            <input v-model.number="storeMultiplier" type="number" step="0.01" min="0" />
          </div>
        </div>
        <footer class="card-actions">
          <button class="btn-primary" :disabled="savingMultiplier" @click="saveMultiplier">
            {{ savingMultiplier ? 'Salvando...' : 'Salvar' }}
          </button>
        </footer>
      </section>

      <section class="config-card">
        <header class="card-head">
          <h3>Acesso ao trade (todos)</h3>
          <p class="config-hint">aplica a todos de uma vez; o ajuste 1 a 1 fica na tela de Usuários.</p>
        </header>
        <footer class="card-actions">
          <button class="btn-danger" :disabled="settingAllSwap" @click="setAllSwap(false)">
            Bloquear p/ todos
          </button>
          <button class="btn-primary" :disabled="settingAllSwap" @click="setAllSwap(true)">
            {{ settingAllSwap ? 'Aplicando...' : 'Liberar p/ todos' }}
          </button>
        </footer>
      </section>

      <section class="config-card">
        <header class="card-head">
          <h3>Compensação em dinheiro (swap)</h3>
          <p class="config-hint">
            comp = recebe − oferece (&gt;0 user paga PIX). Acima do teto bloqueia; off exige troca exata. Máx. itens 0 = sem limite.
          </p>
        </header>
        <div class="fields-grid">
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
        </div>
        <footer class="card-actions">
          <button class="btn-primary" :disabled="savingComp" @click="saveComp">
            {{ savingComp ? 'Salvando...' : 'Salvar config' }}
          </button>
        </footer>
      </section>

      <section class="config-card">
        <header class="card-head">
          <h3>Multiplicador por raridade</h3>
          <p class="config-hint">raridade na lista usa estes multiplicadores; o resto cai no multiplicador global.</p>
        </header>
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
            <label class="switch">
              <input v-model="row.active" type="checkbox" />
              <span class="slider"></span>
            </label>
            <div class="rarity-actions">
              <button class="btn-primary sm" :disabled="savingRarity === row.rarity" @click="saveRarity(row)">
                {{ savingRarity === row.rarity ? '...' : 'Salvar' }}
              </button>
              <button
                class="btn-danger sm icon-only"
                :disabled="savingRarity === row.rarity"
                :title="'Remover ' + row.rarity"
                :aria-label="'Remover ' + row.rarity"
                @click="removeRarity(row.rarity)"
              >
                <Icon icon="mdi:trash-can-outline" width="16" />
              </button>
            </div>
          </div>

          <div class="rarity-row rarity-add">
            <select v-model="newRarity.rarity">
              <option value="">Adicionar…</option>
              <option v-for="r in availableRarities" :key="r" :value="r">{{ r }}</option>
            </select>
            <input v-model.number="newRarity.userMultiplier" type="number" step="0.01" min="0" />
            <input v-model.number="newRarity.storeMultiplier" type="number" step="0.01" min="0" />
            <span></span>
            <div class="rarity-actions">
              <button
                class="btn-primary sm"
                :disabled="!newRarity.rarity || savingRarity === newRarity.rarity"
                @click="addRarity"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="config-card config-card--wide">
        <header class="card-head">
          <h3>Ajuste por tendência</h3>
          <p class="config-hint">
            Cada skin recebe um sinal comparando o preço de hoje com o normal das últimas 3 semanas, já descontado o
            movimento do mercado. O fator do sinal multiplica o que o usuário recebe pelo item:
            valor = preço salvo × multiplicador × fator.
          </p>
          <p class="config-hint">
            1 = sem ajuste · 0,98 = paga 2% a menos · 1,05 = paga 5% a mais (aceita de 0,5 a 1,5). Vale pro inventário
            exibido e pras trocas novas; troca já criada mantém o valor. Skin sem dados nunca é ajustada.
          </p>
        </header>
        <div v-if="trendFactors" class="fields-grid fields-grid--trend">
          <div v-for="signal in TREND_SIGNALS" :key="signal" class="field">
            <small class="signal-label">
              <span class="signal-dot" :style="{ background: SWAP_TREND_SIGNALS[signal].color }"></span>
              {{ SWAP_TREND_SIGNALS[signal].label }}
            </small>
            <input v-model.number="trendFactors[signal]" type="number" step="0.01" min="0.5" max="1.5" />
            <span class="factor-effect">{{ factorEffect(trendFactors[signal]) }}</span>
            <span class="factor-suggested">
              sugerido: {{ formatFactor(SWAP_TREND_SIGNALS[signal].suggestedFactor) }}
              <button v-if="canApplySuggestion(signal)" type="button" class="link-btn" @click="applySuggestion(signal)">
                usar
              </button>
            </span>
            <span class="factor-measured">medido: {{ SWAP_TREND_SIGNALS[signal].nextWeek }}</span>
            <p class="signal-advice">{{ SWAP_TREND_SIGNALS[signal].advice }}</p>
            <p class="signal-advice"><strong>Por que esse fator:</strong> {{ SWAP_TREND_SIGNALS[signal].suggestion }}</p>
          </div>
        </div>
        <p v-else-if="trendLoadError" class="config-hint">
          {{ trendLoadError }}
          <button class="btn-ghost sm" @click="fetchTrendFactors">Tentar de novo</button>
        </p>
        <p v-else class="config-hint">Carregando os fatores salvos…</p>
        <footer class="card-actions">
          <button class="btn-primary" :disabled="!trendFactors || savingTrend" @click="saveTrendFactors">
            {{ savingTrend ? 'Salvando...' : 'Salvar ajuste' }}
          </button>
        </footer>
      </section>
    </div>

    <SwapTrendsPanel />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue3-toastify'
import SwapTrendsPanel from '@/components/swaps/SwapTrendsPanel.vue'
import { SWAP_TREND_SIGNALS } from '@/components/swaps/swapTrendSignals'
import { adminService, type SwapCompensationConfig, type RarityMultiplier } from '@/services/admin/admin.service'
import type { SwapTrendFactors } from '@/services/admin/types'
import { formatCurrency } from '@/utils/formatCurrency'

const TREND_SIGNALS = ['pico', 'alta', 'estavel', 'baixa', 'fundo', 'iliquido'] as const
type TrendSignal = (typeof TREND_SIGNALS)[number]
// Sem valor inicial: com o GET falhando, salvar mandaria um padrão por cima do que está salvo.
const trendFactors = ref<SwapTrendFactors | null>(null)
const trendLoadError = ref('')
const savingTrend = ref(false)

const EXAMPLE_CENTS = 10000

// Campo apagado: v-model.number entrega '' em vez de número.
const factorEffect = (factor: number) => {
  if (typeof factor !== 'number') return '—'

  const pct = Math.round((factor - 1) * 1000) / 10
  if (pct === 0) return 'sem ajuste: paga o valor cheio'

  const example = `${formatCurrency(EXAMPLE_CENTS)} → ${formatCurrency(Math.round(EXAMPLE_CENTS * factor))}`
  if (pct < 0) return `paga ${Math.abs(pct).toLocaleString('pt-BR')}% a menos (${example})`

  return `paga ${pct.toLocaleString('pt-BR')}% a mais (${example})`
}

const formatFactor = (factor: number | null) => {
  if (factor === null) return 'sem medição'

  return factor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

const canApplySuggestion = (signal: TrendSignal) => {
  const suggested = SWAP_TREND_SIGNALS[signal].suggestedFactor
  if (suggested === null) return false

  return trendFactors.value?.[signal] !== suggested
}

const applySuggestion = (signal: TrendSignal) => {
  const suggested = SWAP_TREND_SIGNALS[signal].suggestedFactor
  if (suggested === null || !trendFactors.value) return

  trendFactors.value[signal] = suggested
}

const fetchTrendFactors = async () => {
  trendLoadError.value = ''
  try {
    const res = await adminService.getSwapTrendFactors()
    trendFactors.value = res.data
  } catch (err: any) {
    trendLoadError.value = err.response?.data?.message ?? 'Não foi possível carregar os fatores salvos.'
  }
}

const saveTrendFactors = async () => {
  if (!trendFactors.value) return

  savingTrend.value = true
  try {
    const res = await adminService.setSwapTrendFactors(trendFactors.value)
    trendFactors.value = res.data
    toast.success('Ajuste por tendência salvo.')
  } catch (err: any) {
    toast.error(err.response?.data?.message ?? 'Erro ao salvar o ajuste.')
  } finally {
    savingTrend.value = false
  }
}

const multiplier = ref(1)
const storeMultiplier = ref(1)
const savingMultiplier = ref(false)

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
  fetchMultiplier()
  fetchComp()
  fetchRarityMultipliers()
  fetchTrendFactors()
})
</script>

<style lang="stylus" scoped>
.view-wrap
  padding 2rem
  color #fff
  background #121214
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

// 2x2 com colunas minmax(0, 1fr): conteúdo largo encolhe dentro do card em vez de estourar.
// Abaixo de 1200px (menu de 230px + padding) o card da raridade não cabe em meia tela.
.config-grid
  display grid
  grid-template-columns repeat(2, minmax(0, 1fr))
  gap 1rem
  margin-bottom 1.5rem

  @media (max-width: 1200px)
    grid-template-columns minmax(0, 1fr)

.config-card
  display flex
  flex-direction column
  gap 1rem
  background #16161a
  border 1px solid rgba(255,255,255,0.06)
  border-radius 12px
  padding 1.1rem 1.25rem

.config-card--wide
  grid-column 1 / -1

.signal-label
  display inline-flex
  align-items center
  gap 6px

.signal-dot
  width 8px
  height 8px
  border-radius 50%
  flex-shrink 0

.factor-effect
  font-size 0.72rem
  color rgba(255,255,255,0.7)

.factor-measured
  font-size 0.68rem
  color rgba(255,255,255,0.35)

.factor-suggested
  display inline-flex
  align-items center
  gap 6px
  font-size 0.72rem
  color #a5b4fc

.link-btn
  padding 0
  background none
  border none
  color #818cf8
  font-size inherit
  text-decoration underline
  cursor pointer
  &:hover
    color #c7d2fe

// explicação embaixo do input: texto de tamanho variável não desalinha os inputs entre colunas
.signal-advice
  margin 2px 0 0
  padding-top 6px
  border-top 1px solid rgba(255,255,255,0.05)
  font-size 0.68rem
  line-height 1.45
  color rgba(255,255,255,0.45)

  strong
    color rgba(255,255,255,0.65)
    font-weight 600

// colunas mais largas que o padrão pra explicação não virar uma tira de 130px
.fields-grid.fields-grid--trend
  grid-template-columns repeat(auto-fill, minmax(200px, 1fr))

.card-head
  display flex
  flex-direction column
  gap 4px

  h3
    margin 0
    font-size 0.78rem
    font-weight 600
    text-transform uppercase
    letter-spacing 0.04em
    color rgba(255,255,255,0.6)

.config-hint
  margin 0
  font-size 0.72rem
  line-height 1.45
  color rgba(255,255,255,0.35)

// margin-top auto: os botões dos dois cards da mesma linha ficam na mesma altura.
.card-actions
  display flex
  justify-content flex-end
  gap 0.6rem
  margin-top auto
  padding-top 0.75rem
  border-top 1px solid rgba(255,255,255,0.05)

.fields-grid
  display grid
  grid-template-columns repeat(auto-fill, minmax(130px, 1fr))
  gap 0.75rem 1rem

.field
  display flex
  flex-direction column
  gap 5px
  min-width 0

  small
    font-size 0.7rem
    color rgba(255,255,255,0.5)

  input
    width 100%
    box-sizing border-box
    background #0e0e11
    border 1px solid rgba(255,255,255,0.12)
    border-radius 8px
    padding 0.45rem 0.6rem
    color #fff
    font-size 0.9rem

.toggle-field
  justify-content space-between

.rarity-grid
  display flex
  flex-direction column
  gap 6px

// Ações com largura fixa: quem encolhe são os inputs, nunca os botões.
.rarity-row
  display grid
  grid-template-columns minmax(80px, 1.3fr) minmax(56px, 1fr) minmax(56px, 1fr) 44px 112px
  align-items center
  gap 8px

  input, select
    width 100%
    min-width 0
    box-sizing border-box
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

.rarity-add
  margin-top 4px
  padding-top 10px
  border-top 1px dashed rgba(255,255,255,0.08)

.rarity-name
  font-weight 600
  font-size 0.9rem
  overflow hidden
  text-overflow ellipsis

.rarity-actions
  display flex
  justify-content flex-end
  gap 6px

.btn-primary.sm,
.btn-danger.sm,
.btn-ghost.sm
  height 32px
  padding 0 10px
  font-size 0.78rem

.btn-danger.icon-only
  display inline-flex
  align-items center
  justify-content center
  width 32px
  padding 0

.card-actions .btn-primary,
.card-actions .btn-danger
  height 36px

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
  text-decoration none
  &:hover
    background rgba(255,255,255,0.06)

</style>
