<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <h1 class="page-title">Instagram</h1>
        <p class="page-subtitle">Gera a arte com IA, aplica logo e preço e publica na conta da loja</p>
      </div>
      <div class="account">
        <button class="btn-ghost" @click="openPrompt">
          <Icon icon="mdi:script-text-outline" width="15" /> Prompt mestre
        </button>
        <template v-if="account">
          <div class="account__info">
            <span class="account__name"><Icon icon="mdi:instagram" width="16" /> @{{ account.username }}</span>
            <span class="account__token" :class="{ 'text-warn': tokenDaysLeft < 10 }">token vence em {{ tokenDaysLeft }} dias</span>
          </div>
          <button class="btn-ghost" @click="tokenModal = true">Trocar token</button>
        </template>
        <button v-else class="btn-primary" @click="tokenModal = true">
          <Icon icon="mdi:link-variant" width="16" /> Conectar conta
        </button>
      </div>
    </header>

    <div class="layout">
      <div class="side">
      <section class="section composer">
        <h2 class="section-title">Novo post</h2>

        <div class="kind-tabs">
          <button type="button" class="tab" :class="{ 'tab--on': kind === 'FEED' }" @click="setKind('FEED')">Feed</button>
          <button type="button" class="tab" :class="{ 'tab--on': kind === 'STORY' }" @click="setKind('STORY')">Story</button>
        </div>

        <div class="field">
          <label>Produto <span class="text-muted">(opcional; vira PRODUCT_LOCKED na arte)</span></label>
          <div v-if="subject" class="subject-chip">
            <Icon icon="mdi:sword" width="14" /> {{ subject }}
            <button type="button" class="subject-chip__clear" @click="clearSubject"><Icon icon="mdi:close" width="14" /></button>
          </div>
          <input v-else v-model="skinQuery" class="form-input" placeholder="Busca no estoque pelo nome..." @input="onSkinQuery" />
          <p v-if="searchingSkins" class="field-hint">Buscando...</p>
          <ul v-else-if="skinResults.length" class="skin-results">
            <li v-for="unit in skinResults" :key="unit.id">
              <button type="button" class="skin-option" @click="pickSkin(unit)">
                <img v-if="skinThumb(unit.skins?.icon_url_large)" :src="skinThumb(unit.skins?.icon_url_large)!" class="skin-thumb" alt="" />
                <span class="skin-option__text">
                  <strong>{{ unit.skins?.name }}</strong>
                  <small>{{ unit.skins?.hero ?? 'sem herói' }}</small>
                </span>
                <span class="skin-option__price">{{ formatPrice(unit.price) }}</span>
              </button>
            </li>
          </ul>
        </div>

        <div class="field">
          <label>Cupom</label>
          <input v-model="couponCode" class="form-input" placeholder="ex: RUNA10" />
        </div>

        <div v-if="couponCode.trim()" class="field">
          <label>Regra do cupom</label>
          <input v-model="couponRule" class="form-input" placeholder="ex: 10% em qualquer skin até domingo" />
        </div>

        <div class="field">
          <label>Mensagem <span class="text-muted">(o que a arte precisa dizer)</span></label>
          <textarea v-model="message" class="form-input" rows="3" placeholder="ex: chegou no estoque, poucas unidades confirmadas" />
        </div>

        <div class="field-row">
          <div class="field">
            <label>CTA</label>
            <input v-model="cta" class="form-input" placeholder="VER NO SITE" />
          </div>
          <div class="field">
            <label>Link</label>
            <input v-model="ctaUrl" class="form-input" placeholder="https://secretshopgg.com" />
          </div>
        </div>

        <div v-if="kind === 'FEED'" class="field">
          <label>Legenda</label>
          <textarea v-model="caption" class="form-input" rows="5" placeholder="Legenda do post" />
        </div>
        <p v-else class="field-hint">Story não tem legenda. O texto vai na própria arte.</p>

        <p v-if="composerError" class="error-msg">{{ composerError }}</p>

        <button class="btn-primary" :disabled="!canCreate || creating" @click="createPost">
          <Icon icon="mdi:creation" width="16" /> {{ creating ? 'Enviando...' : 'Gerar imagem' }}
        </button>
        <p class="field-hint">Prompt mestre v3 decide template e composição. Leva 1–2 min; depois marca a arte ao lado pra aplicar logo, preço e frase.</p>
      </section>

      <section v-if="selectedPosts.length" class="section composer finish">
        <h2 class="section-title">Finalizar arte ({{ selectedPosts.length }})</h2>
        <p class="field-hint">Logo no topo; preço e frase numa faixa escura embaixo. Sempre refaz em cima da arte original da IA, então dá pra aplicar de novo com outro preço.</p>

        <div class="field">
          <label>Frase <span class="text-muted">(opcional, vale pra todas)</span></label>
          <input v-model="finishNote" class="form-input" maxlength="120" placeholder="sem frase" />
        </div>

        <ul class="finish-list">
          <li v-for="p in selectedPosts" :key="p.id" class="finish-item">
            <img referrerpolicy="no-referrer" :src="mediaUrl(p.base_image_url ?? p.image_url)" class="finish-item__thumb" alt="" />
            <span class="finish-item__name">{{ p.subject ?? 'Sem produto' }}</span>
            <input v-model="selected[p.id]" type="number" min="0" step="0.01" class="form-input finish-item__price" placeholder="sem preço" />
            <button type="button" class="icon-btn" title="Posicionar" @click="editing = p"><Icon icon="mdi:cursor-move" width="16" /></button>
            <button type="button" class="icon-btn" title="Tirar da seleção" @click="toggleSelect(p)"><Icon icon="mdi:close" width="16" /></button>
          </li>
        </ul>
        <p class="field-hint">Preço vem do item mais barato disponível no estoque; troca à mão se quiser. <Icon icon="mdi:cursor-move" width="12" /> abre o editor: ajusta uma arte só ou salva a posição como padrão. "Aplicar em N" usa sempre o padrão de cada formato.</p>

        <button class="btn-primary" :disabled="finishing" @click="finishSelected">
          <Icon icon="mdi:layers-outline" width="16" /> {{ finishing ? 'Aplicando...' : `Aplicar em ${selectedPosts.length}` }}
        </button>
      </section>
      </div>

      <section class="posts">
        <div v-if="loading" class="section empty-state">Carregando...</div>
        <div v-else-if="posts.length === 0" class="section empty-state">Nenhum post ainda. Gera o primeiro ao lado.</div>

        <article v-for="p in posts" :key="p.id" class="post-card">
          <div class="post-card__image" :class="p.kind === 'STORY' ? 'ratio-story' : 'ratio-feed'">
            <label v-if="canPublish(p)" class="post-card__select" :class="{ 'post-card__select--on': p.id in selected }">
              <input type="checkbox" :checked="p.id in selected" @change="toggleSelect(p)" />
              {{ p.base_image_url ? 'Refazer acabamento' : 'Finalizar' }}
            </label>
            <img v-if="p.image_url" referrerpolicy="no-referrer" :src="mediaUrl(p.image_url)" alt="" />
            <div v-else class="post-card__placeholder">
              <Icon v-if="p.status === 'GENERATING'" icon="mdi:loading" width="28" class="spin" />
              <Icon v-else icon="mdi:image-off-outline" width="28" />
              <span>{{ p.status === 'GENERATING' ? 'Gerando imagem...' : 'Sem imagem' }}</span>
            </div>
          </div>

          <div class="post-card__body">
            <div class="post-card__meta">
              <span class="kind-badge">{{ p.kind === 'STORY' ? 'Story' : 'Feed' }}</span>
              <span class="status-badge" :class="statusClass(p.status)">{{ statusLabel(p.status) }}</span>
              <span v-if="p.cost_usd != null" class="text-muted" :title="tokensOf(p)">≈ US$ {{ p.cost_usd.toFixed(2) }}</span>
              <span class="text-muted post-card__date">{{ when(p.published_at ?? p.created_at) }}</span>
            </div>

            <p v-if="p.subject" class="post-card__subject">{{ p.subject }}</p>

            <textarea
              v-if="p.kind === 'FEED' && isEditable(p)"
              v-model="p.caption"
              class="form-input"
              rows="4"
              placeholder="Legenda"
              @blur="saveCaption(p)"
            />
            <p v-else-if="p.caption" class="post-card__caption">{{ p.caption }}</p>

            <p v-if="p.error" class="error-msg">{{ p.error }}</p>
            <details v-if="p.revised_prompt" class="prompt-details">
              <summary>Prompt usado</summary>
              <p>{{ p.revised_prompt }}</p>
            </details>

            <div class="action-row">
              <button v-if="canPublish(p)" class="btn-primary btn-sm" :disabled="busy === p.id" @click="publish(p)">
                <Icon icon="mdi:send" width="14" /> {{ p.status === 'FAILED' ? 'Tentar de novo' : 'Publicar' }}
              </button>
              <a v-if="p.permalink" :href="p.permalink" target="_blank" rel="noopener" class="btn-view">Ver no Instagram</a>
              <button v-if="!isBusyStatus(p.status)" class="btn-danger" @click="deleteTarget = p">Excluir</button>
            </div>
          </div>
        </article>
      </section>
    </div>

    <div v-if="promptModal" class="modal-overlay" @click.self="promptModal = false">
      <div class="modal modal--wide">
        <div class="modal__head">
          <h3>Prompt mestre</h3>
          <span class="modal-hint">{{ promptMeta }}</span>
        </div>
        <p class="modal-hint">Vai inteiro como <code>instructions</code> do gpt-5 a cada geração. Preço, cupom e campanha ficam fora daqui — vêm do formulário.</p>
        <textarea v-model="promptDraft" class="form-input prompt-editor" spellcheck="false" />
        <p v-if="promptError" class="error-msg">{{ promptError }}</p>
        <div class="modal-actions">
          <button v-if="!promptIsDefault" class="btn-ghost" :disabled="promptBusy" @click="resetPrompt">Restaurar padrão</button>
          <span class="modal-actions__spacer" />
          <button class="btn-ghost" @click="promptModal = false">Cancelar</button>
          <button class="btn-primary" :disabled="promptBusy || !promptDraft.trim()" @click="savePrompt">
            {{ promptBusy ? 'Salvando...' : 'Salvar' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="tokenModal" class="modal-overlay" @click.self="tokenModal = false">
      <div class="modal">
        <h3>{{ account ? 'Trocar token' : 'Conectar conta do Instagram' }}</h3>
        <p class="modal-hint">
          Painel da Meta → app → Instagram → <em>API setup with Instagram business login</em> → Gerar token.
          Vale 60 dias; o sistema renova sozinho antes de vencer.
        </p>
        <textarea v-model="tokenInput" class="form-input" rows="4" placeholder="IGAAR..." />
        <p v-if="tokenError" class="error-msg">{{ tokenError }}</p>
        <div class="modal-actions">
          <button class="btn-ghost" @click="tokenModal = false">Cancelar</button>
          <button class="btn-primary" :disabled="!tokenInput.trim() || connecting" @click="connect">
            {{ connecting ? 'Validando...' : 'Salvar' }}
          </button>
        </div>
      </div>
    </div>

    <FinishEditor
      v-if="editing"
      :kind="editing.kind"
      :base-url="mediaUrl(editing.base_image_url ?? editing.image_url)"
      :subject="editing.subject"
      :price="priceOf(editing)"
      :note="finishNote.trim() || null"
      :initial-layout="layoutOf(editing)"
      :default-layout="defaultLayouts[editing.kind as Kind]"
      :applying="applyingEditor"
      @close="editing = null"
      @apply="applyFromEditor"
      @save-default="saveDefaultFromEditor"
    />

    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal">
        <h3>Excluir post</h3>
        <p>Apaga o rascunho e a imagem gerada.</p>
        <p v-if="deleteTarget.status === 'PUBLISHED'" class="modal-hint">O post continua no Instagram; só some daqui.</p>
        <div class="modal-actions">
          <button class="btn-ghost" @click="deleteTarget = null">Cancelar</button>
          <button class="btn-danger" :disabled="deleting" @click="doDelete">{{ deleting ? 'Excluindo...' : 'Excluir' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { mediaUrl } from '@/utils/mediaUrl'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import dayjs from 'dayjs'
import { adminService } from '@/services/admin/admin.service'
import FinishEditor from './FinishEditor.vue'
import { KIND_LABEL, readSavedLayout, saveLayout, type FinishLayout } from './finishCanvas'

type Kind = 'FEED' | 'STORY'

const BUSY_STATUSES = ['GENERATING', 'PUBLISHING']
const POLL_MS = 4000
const NOTE_KEY = 'instagram.finishNote'
// Opcional: apagar o campo tira a frase da arte (e fica lembrado vazio).
const DEFAULT_NOTE = 'Preço sujeito a mudança'

// ── Conta ─────────────────────────────────────────────────────────────────────
const account = ref<any>(null)
const tokenModal = ref(false)
const tokenInput = ref('')
const tokenError = ref('')
const connecting = ref(false)

const tokenDaysLeft = computed(() => (account.value ? dayjs(account.value.expires_at).diff(dayjs(), 'day') : 0))

const loadAccount = async () => {
  const res = await adminService.getInstagramAccount()
  account.value = res.data
}

const connect = async () => {
  connecting.value = true
  tokenError.value = ''
  try {
    const res = await adminService.connectInstagramAccount(tokenInput.value.trim())
    account.value = res.data
    tokenInput.value = ''
    tokenModal.value = false
    toast.success(`Conectado como @${res.data.username}`)
  } catch (err: any) {
    tokenError.value = err.response?.data?.message ?? 'Token inválido.'
  } finally {
    connecting.value = false
  }
}

// ── Prompt mestre ─────────────────────────────────────────────────────────────
const promptModal = ref(false)
const promptDraft = ref('')
const promptIsDefault = ref(true)
const promptUpdatedAt = ref<string | null>(null)
const promptBusy = ref(false)
const promptError = ref('')

const promptMeta = computed(() =>
  promptIsDefault.value ? 'padrão do repo (story-runtime-v3.md)' : `editado em ${when(promptUpdatedAt.value!)}`)

const applyPrompt = (data: any) => {
  promptDraft.value = data.content
  promptIsDefault.value = data.is_default
  promptUpdatedAt.value = data.updated_at
}

const openPrompt = async () => {
  promptError.value = ''
  promptModal.value = true
  try {
    const res = await adminService.getInstagramPrompt()
    applyPrompt(res.data)
  } catch {
    promptError.value = 'Não carregou o prompt.'
  }
}

const savePrompt = async () => {
  promptBusy.value = true
  promptError.value = ''
  try {
    const res = await adminService.saveInstagramPrompt(promptDraft.value)
    applyPrompt(res.data)
    promptModal.value = false
    toast.success('Prompt salvo. Vale a partir da próxima geração.')
  } catch (err: any) {
    promptError.value = err.response?.data?.message ?? 'Não salvou.'
  } finally {
    promptBusy.value = false
  }
}

const resetPrompt = async () => {
  promptBusy.value = true
  try {
    const res = await adminService.resetInstagramPrompt()
    applyPrompt(res.data)
    toast.info('Voltou pro prompt padrão do repo.')
  } finally {
    promptBusy.value = false
  }
}

// ── Composer ──────────────────────────────────────────────────────────────────
const kind = ref<Kind>('FEED')
const subject = ref('')
const couponCode = ref('')
const couponRule = ref('')
const message = ref('')
const cta = ref('VER NO SITE')
const ctaUrl = ref('https://secretshopgg.com')
const caption = ref('')
const creating = ref(false)
const composerError = ref('')

const skinQuery = ref('')
const skinResults = ref<any[]>([])
const searchingSkins = ref(false)
let skinTimer: ReturnType<typeof setTimeout> | null = null
const pickedUnit = shallowRef<any>(null)

const skinThumb = (icon?: string | null): string | null =>
  icon ? `https://steamcommunity-a.akamaihd.net/economy/image/${icon}/62fx62f` : null

const formatPrice = (cents?: number | null) =>
  cents == null ? '—' : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// A arte vem do prompt mestre no backend; aqui só a legenda tem template.
// Sem preço: a arte é reutilizada com preços diferentes, preço só no acabamento.
const captionFor = (unit: any) => {
  const name = unit.skins?.name ?? 'Item'
  const hero = unit.skins?.hero ? ` — ${unit.skins.hero}` : ''
  return `${name}${hero}\nDisponível na Secret Shop 🔥\nLink na bio.\n\n#dota2 #dota2skins #dota2brasil #secretshop`
}

const setKind = (k: Kind) => { kind.value = k }

// Precisa de algo pra peça dizer: produto, cupom ou mensagem.
const canCreate = computed(() => !!subject.value || !!couponCode.value.trim() || !!message.value.trim())

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

const pickSkin = (unit: any) => {
  pickedUnit.value = unit
  subject.value = unit.skins?.name ?? ''
  caption.value = captionFor(unit)
  skinQuery.value = ''
  skinResults.value = []
}

const clearSubject = () => {
  pickedUnit.value = null
  subject.value = ''
}

const createPost = async () => {
  if (creating.value) return
  creating.value = true
  composerError.value = ''
  try {
    const res = await adminService.createInstagramPost({
      kind: kind.value,
      skin_uuid: pickedUnit.value?.skins?.id || undefined,
      coupon_code: couponCode.value.trim() || undefined,
      coupon_rule: couponRule.value.trim() || undefined,
      message: message.value.trim() || undefined,
      cta: cta.value.trim() || undefined,
      cta_url: ctaUrl.value.trim() || undefined,
      caption: kind.value === 'FEED' ? caption.value.trim() || undefined : undefined,
    })
    posts.value = [res.data, ...posts.value]
    schedulePoll()
    toast.info('Gerando imagem...')
  } catch (err: any) {
    composerError.value = err.response?.data?.message ?? 'Não deu pra criar o post.'
  } finally {
    creating.value = false
  }
}

// ── Posts ─────────────────────────────────────────────────────────────────────
const posts = ref<any[]>([])
const loading = ref(true)
const busy = ref<string | null>(null)
const deleteTarget = ref<any>(null)
const deleting = ref(false)
let pollTimer: ReturnType<typeof setTimeout> | null = null

const when = (d: string) => dayjs(d).format('DD/MM/YY HH:mm')

// Custo é estimativa (texto pelo usage, imagem por tabela fixa); tooltip mostra os tokens.
const tokensOf = (p: any) =>
  p.usage ? `${p.usage.input_tokens} in / ${p.usage.output_tokens} out (texto)` : 'estimativa'

const isBusyStatus = (status: string) => BUSY_STATUSES.includes(status)
const isEditable = (p: any) => p.status === 'DRAFT' || p.status === 'FAILED'
const canPublish = (p: any) => isEditable(p) && !!p.image_url

const STATUS_LABEL: Record<string, string> = {
  GENERATING: 'Gerando imagem',
  DRAFT: 'Rascunho',
  PUBLISHING: 'Publicando',
  PUBLISHED: 'Publicado',
  FAILED: 'Falhou',
}
const STATUS_CLASS: Record<string, string> = {
  GENERATING: 'status-pending',
  DRAFT: 'status-inactive',
  PUBLISHING: 'status-pending',
  PUBLISHED: 'status-active',
  FAILED: 'status-expired',
}
const statusLabel = (status: string) => STATUS_LABEL[status] ?? status
const statusClass = (status: string) => STATUS_CLASS[status] ?? 'status-inactive'

// Geração e publicação rodam em background no backend: enquanto tiver post
// GENERATING/PUBLISHING, recarrega a lista a cada 4s.
const schedulePoll = () => {
  if (pollTimer) clearTimeout(pollTimer)
  pollTimer = setTimeout(() => fetchPosts().catch(schedulePoll), POLL_MS)
}

const fetchPosts = async () => {
  try {
    const res = await adminService.getInstagramPosts()
    posts.value = res.data
  } finally {
    loading.value = false
  }
  if (posts.value.some((p) => isBusyStatus(p.status))) schedulePoll()
}

const saveCaption = async (p: any) => {
  try {
    await adminService.updateInstagramPost(p.id, { caption: p.caption?.trim() || undefined })
  } catch {
    toast.error('Não salvou a legenda.')
  }
}

const publish = async (p: any) => {
  busy.value = p.id
  try {
    const res = await adminService.publishInstagramPost(p.id)
    Object.assign(p, res.data)
    schedulePoll()
    toast.info('Publicando...')
  } catch (err: any) {
    toast.error(err.response?.data?.message ?? 'Não deu pra publicar.')
  } finally {
    busy.value = null
  }
}

// ── Acabamento (logo + preço + frase) ─────────────────────────────────────────
// id do post -> preço digitado (input number: number, ou vazio = sem preço).
const selected = ref<Record<string, number | ''>>({})
const finishing = ref(false)

const readNote = () => {
  try {
    return localStorage.getItem(NOTE_KEY) ?? DEFAULT_NOTE
  } catch {
    return DEFAULT_NOTE
  }
}
const finishNote = ref(readNote())

// Sem storage (aba anônima etc.) só não lembra a frase.
watch(finishNote, (note) => {
  try {
    localStorage.setItem(NOTE_KEY, note)
  } catch {}
})

const selectedPosts = computed(() => posts.value.filter((p) => p.id in selected.value))

const unselect = (id: string) => {
  const { [id]: _, ...rest } = selected.value
  selected.value = rest
}

const stockPrice = (p: any): number | '' => (p.stock_price_brl != null ? Number(p.stock_price_brl.toFixed(2)) : '')

// Input number devolve number (ou '' vazio); 0 é preço válido.
const priceOf = (p: any): number | null => {
  const price = selected.value[p.id]
  return price === '' || price == null ? null : Number(price)
}

const toggleSelect = (p: any) => {
  if (p.id in selected.value) return unselect(p.id)
  selected.value = { ...selected.value, [p.id]: stockPrice(p) }
}

// Reativo: "Voltar ao padrão" no editor enxerga um padrão salvo na mesma sessão.
const defaultLayouts = ref<Record<Kind, FinishLayout>>({
  FEED: readSavedLayout('FEED'),
  STORY: readSavedLayout('STORY'),
})

// Layout do post > padrão salvo do formato > padrão de fábrica.
const layoutOf = (p: any): FinishLayout => p.finish_layout ?? defaultLayouts.value[p.kind as Kind]

// Troca pelo id: o poll pode ter substituído o objeto enquanto a request rodava.
const replacePost = (updated: any) => {
  posts.value = posts.value.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
}

const finishOne = async (p: any, layout: FinishLayout) => {
  const res = await adminService.finishInstagramPost(p.id, {
    layout,
    price_brl: priceOf(p) ?? undefined,
    note: finishNote.value.trim() || undefined,
  })
  replacePost(res.data)
  unselect(p.id)
}

// ── Editor de posição ─────────────────────────────────────────────────────────
const editing = ref<any>(null)
const applyingEditor = ref(false)

const saveDefaultFromEditor = (layout: FinishLayout) => {
  const kind: Kind = editing.value.kind
  saveLayout(kind, layout)
  defaultLayouts.value = { ...defaultLayouts.value, [kind]: layout }
  toast.success(`Padrão do ${KIND_LABEL[kind]} salvo. "Aplicar em N" usa ele.`)
}

// Ajuste só desta arte; o padrão só muda pelo botão "Salvar como padrão".
const applyFromEditor = async (layout: FinishLayout) => {
  const p = editing.value
  applyingEditor.value = true
  try {
    await finishOne(p, layout)
    editing.value = null
    toast.success('Arte finalizada.')
  } catch (err: any) {
    toast.error(err.response?.data?.message ?? 'Não deu pra finalizar.')
  } finally {
    applyingEditor.value = false
  }
}

// Lote sempre no padrão do formato (sobrescreve ajuste individual). Falhas continuam marcadas.
const finishSelected = async () => {
  if (finishing.value) return
  finishing.value = true
  const results = await Promise.allSettled(
    selectedPosts.value.map((p) => finishOne(p, defaultLayouts.value[p.kind as Kind])),
  )
  finishing.value = false
  const failed = results.filter((r) => r.status === 'rejected').length
  if (failed) return toast.error(`${failed} arte(s) não finalizaram.`)
  toast.success('Arte finalizada.')
}

const doDelete = async () => {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await adminService.deleteInstagramPost(deleteTarget.value.id)
    unselect(deleteTarget.value.id)
    posts.value = posts.value.filter((p) => p.id !== deleteTarget.value.id)
    deleteTarget.value = null
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  loadAccount().catch(() => undefined)
  fetchPosts()
})

onBeforeUnmount(() => {
  if (pollTimer) clearTimeout(pollTimer)
  if (skinTimer) clearTimeout(skinTimer)
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
  margin-bottom 2rem

.page-title
  font-size 1.8rem
  font-weight 700
  margin 0 0 4px

.page-subtitle
  font-size 0.85rem
  color rgba(255,255,255,0.45)
  margin 0

.account
  display flex
  align-items center
  gap 12px

.account__info
  display flex
  flex-direction column
  align-items flex-end
  gap 2px

.account__name
  display inline-flex
  align-items center
  gap 6px
  font-weight 600
  font-size 0.9rem

.account__token
  font-size 0.75rem
  color rgba(255,255,255,0.45)

.text-warn
  color #fbbf24 !important

.text-muted
  color rgba(255,255,255,0.45)

.layout
  display grid
  grid-template-columns 420px 1fr
  gap 1.5rem
  align-items start
  @media (max-width: 1100px)
    grid-template-columns 1fr

.section
  background #16161a
  border 1px solid rgba(255,255,255,0.06)
  border-radius 12px

.side
  display flex
  flex-direction column
  gap 1rem
  position sticky
  top 1rem

.composer
  padding 1.25rem
  display flex
  flex-direction column
  gap 1rem

.finish
  border-color rgba(251,191,36,0.3)

.finish-list
  list-style none
  margin 0
  padding 0
  display flex
  flex-direction column
  gap 6px
  max-height 320px
  overflow-y auto

.finish-item
  display flex
  align-items center
  gap 8px

.finish-item__thumb
  width 36px
  height 36px
  border-radius 6px
  object-fit cover

.finish-item__name
  flex 1
  min-width 0
  font-size 0.8rem
  white-space nowrap
  overflow hidden
  text-overflow ellipsis

.finish-item__price
  width 110px

.icon-btn
  display inline-flex
  padding 4px
  background transparent
  border none
  border-radius 6px
  color rgba(255,255,255,0.6)
  cursor pointer
  &:hover
    color #fff
    background rgba(255,255,255,0.08)

.section-title
  font-size 1rem
  font-weight 600
  margin 0

.kind-tabs
  display flex
  gap 4px
  padding 4px
  background rgba(0,0,0,0.25)
  border-radius 8px

.tab
  flex 1
  display inline-flex
  align-items center
  justify-content center
  gap 6px
  padding 6px
  background transparent
  border none
  border-radius 6px
  color rgba(255,255,255,0.55)
  font-size 0.85rem
  font-weight 600
  cursor pointer
  &:hover
    color #fff

.tab--on
  background #6366f1
  color #fff

.field
  display flex
  flex-direction column
  gap 6px
  label
    font-size 0.8rem
    font-weight 600
    color rgba(255,255,255,0.7)

.field-row
  display grid
  grid-template-columns 1fr 1fr
  gap 10px

.prompt-details
  font-size 0.75rem
  color rgba(255,255,255,0.45)
  summary
    cursor pointer
    user-select none
  p
    margin 6px 0 0
    white-space pre-line
    color rgba(255,255,255,0.55)

.field-hint
  font-size 0.75rem
  color rgba(255,255,255,0.4)
  margin 0

.form-input
  background rgba(0,0,0,0.25)
  border 1px solid rgba(255,255,255,0.1)
  border-radius 8px
  color #fff
  padding 0.5rem 0.75rem
  font-size 0.875rem
  font-family inherit
  outline none
  width 100%
  box-sizing border-box
  resize vertical
  &:focus
    border-color rgba(99,102,241,0.5)

.subject-chip
  display inline-flex
  align-items center
  gap 6px
  align-self flex-start
  padding 4px 8px 4px 10px
  background rgba(251,191,36,0.1)
  border 1px solid rgba(251,191,36,0.3)
  border-radius 999px
  font-size 0.8rem
  color #fbbf24

.subject-chip__clear
  display inline-flex
  background transparent
  border none
  color inherit
  cursor pointer
  padding 0
  opacity 0.7
  &:hover
    opacity 1

.skin-results
  list-style none
  margin 0
  padding 0
  display flex
  flex-direction column
  gap 4px
  max-height 320px
  overflow-y auto

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

.skin-option__text
  display flex
  flex-direction column
  flex 1
  min-width 0
  strong
    font-size 0.85rem
    white-space nowrap
    overflow hidden
    text-overflow ellipsis
  small
    font-size 0.72rem
    color rgba(255,255,255,0.45)

.skin-option__price
  font-size 0.8rem
  color #4ade80
  white-space nowrap

.skin-thumb
  width 36px
  height 36px
  border-radius 6px
  object-fit cover
  background rgba(0,0,0,0.3)

.error-msg
  color #fc8181
  font-size 0.8rem
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

.btn-sm
  padding 4px 12px
  font-size 0.8rem

.btn-ghost
  padding 6px 12px
  background transparent
  border 1px solid rgba(255,255,255,0.12)
  border-radius 6px
  color rgba(255,255,255,0.65)
  font-size 0.85rem
  cursor pointer
  &:hover
    background rgba(255,255,255,0.06)

.btn-view
  display inline-flex
  align-items center
  padding 4px 12px
  background rgba(99,102,241,0.12)
  border 1px solid rgba(99,102,241,0.25)
  border-radius 6px
  color #a5b4fc
  font-size 0.8rem
  text-decoration none
  cursor pointer
  &:hover
    background rgba(99,102,241,0.22)

.btn-danger
  padding 4px 12px
  background rgba(252,129,129,0.10)
  border 1px solid rgba(252,129,129,0.25)
  border-radius 6px
  color #fc8181
  font-size 0.8rem
  cursor pointer
  &:hover
    background rgba(252,129,129,0.18)
  &:disabled
    opacity 0.5
    cursor not-allowed

.posts
  display grid
  grid-template-columns repeat(auto-fill, minmax(300px, 1fr))
  gap 1rem

.empty-state
  grid-column 1 / -1
  padding 2.5rem
  text-align center
  color rgba(255,255,255,0.4)
  font-size 0.9rem

.post-card
  background #16161a
  border 1px solid rgba(255,255,255,0.06)
  border-radius 12px
  overflow hidden
  display flex
  flex-direction column

.post-card__select
  position absolute
  top 8px
  left 8px
  display inline-flex
  align-items center
  gap 6px
  padding 4px 10px
  border-radius 999px
  background rgba(0,0,0,0.7)
  font-size 0.75rem
  font-weight 600
  cursor pointer
  input
    accent-color #fbbf24

.post-card__select--on
  background #fbbf24
  color #000

.post-card__image
  position relative
  width 100%
  background #0f0f12
  display grid
  place-items center
  img
    width 100%
    height 100%
    object-fit contain
    display block

.ratio-feed
  aspect-ratio 1 / 1

.ratio-story
  aspect-ratio 2 / 3

.post-card__placeholder
  display flex
  flex-direction column
  align-items center
  gap 8px
  color rgba(255,255,255,0.35)
  font-size 0.8rem

.spin
  animation spin 1s linear infinite

@keyframes spin
  to
    transform rotate(360deg)

.post-card__body
  padding 0.9rem 1rem 1rem
  display flex
  flex-direction column
  gap 8px

.post-card__meta
  display flex
  align-items center
  gap 8px
  flex-wrap wrap

.post-card__date
  font-size 0.75rem
  margin-left auto

.kind-badge
  padding 2px 8px
  border-radius 6px
  background rgba(255,255,255,0.08)
  font-size 0.72rem
  font-weight 600
  text-transform uppercase
  letter-spacing 0.04em

.post-card__subject
  margin 0
  font-size 0.85rem
  font-weight 600
  color #fbbf24

.post-card__caption
  margin 0
  font-size 0.82rem
  color rgba(255,255,255,0.7)
  white-space pre-line

.status-badge
  display inline-block
  padding 2px 10px
  border-radius 999px
  font-size 0.72rem
  font-weight 600

.status-active
  background rgba(46,220,138,0.12)
  color #4ade80

.status-inactive
  background rgba(255,255,255,0.06)
  color rgba(255,255,255,0.45)

.status-expired
  background rgba(252,129,129,0.12)
  color #fc8181

.status-pending
  background rgba(99,102,241,0.15)
  color #a5b4fc

.action-row
  display flex
  gap 6px
  flex-wrap wrap
  margin-top 4px

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
  width 460px
  max-width 95vw
  display flex
  flex-direction column
  gap 10px
  h3
    margin 0
  p
    margin 0
    font-size 0.9rem

.modal--wide
  width 900px
  max-height 92vh

.modal__head
  display flex
  align-items baseline
  justify-content space-between
  gap 12px

.prompt-editor
  font-family ui-monospace, Consolas, monospace
  font-size 0.78rem
  line-height 1.45
  height 62vh
  resize none
  white-space pre-wrap

.modal-actions__spacer
  flex 1

.modal-hint
  color rgba(255,255,255,0.4) !important
  font-size 0.8rem !important

.modal-actions
  display flex
  justify-content flex-end
  gap 8px
  margin-top 0.75rem
</style>
