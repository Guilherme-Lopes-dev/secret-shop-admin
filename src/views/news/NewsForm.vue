<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <button class="btn-back" @click="router.push('/news')">
          <Icon icon="mdi:arrow-left" width="16" /> Novidades
        </button>
        <h1 class="page-title">{{ isEdit ? 'Editar novidade' : 'Nova novidade' }}</h1>
      </div>
      <button type="button" class="btn-preview" @click="showPreview = true" :disabled="!form.title && !form.cover_url && editorHtml === '<p></p>'">
        <Icon icon="mdi:eye-outline" width="16" /> Preview
      </button>
    </header>

    <div v-if="loadingItem" class="loading-state">
      <Icon icon="mdi:loading" class="spin" width="32" />
    </div>

    <form v-else class="form-grid" @submit.prevent="submit">
      <div class="form-col">
        <section class="form-section">
          <h2 class="section-title">Conteúdo</h2>

          <div class="field">
            <label>Título</label>
            <input
              v-model="form.title"
              type="text"
              placeholder="Ex: Atualização de preços de agosto"
              maxlength="255"
              class="form-input"
            />
          </div>

          <div class="field">
            <label>Conteúdo</label>
            <div class="editor-wrap">
              <div class="editor-toolbar">
                <button type="button" :class="{ active: editor?.isActive('bold') }" @click="editor?.chain().focus().toggleBold().run()" title="Negrito">
                  <Icon icon="mdi:format-bold" width="16" />
                </button>
                <button type="button" :class="{ active: editor?.isActive('italic') }" @click="editor?.chain().focus().toggleItalic().run()" title="Itálico">
                  <Icon icon="mdi:format-italic" width="16" />
                </button>
                <button type="button" :class="{ active: editor?.isActive('strike') }" @click="editor?.chain().focus().toggleStrike().run()" title="Tachado">
                  <Icon icon="mdi:format-strikethrough" width="16" />
                </button>
                <span class="toolbar-sep" />
                <button type="button" :class="{ active: editor?.isActive('heading', { level: 2 }) }" @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()" title="Título">
                  <Icon icon="mdi:format-header-2" width="16" />
                </button>
                <button type="button" :class="{ active: editor?.isActive('heading', { level: 3 }) }" @click="editor?.chain().focus().toggleHeading({ level: 3 }).run()" title="Subtítulo">
                  <Icon icon="mdi:format-header-3" width="16" />
                </button>
                <span class="toolbar-sep" />
                <button type="button" :class="{ active: editor?.isActive('bulletList') }" @click="editor?.chain().focus().toggleBulletList().run()" title="Lista">
                  <Icon icon="mdi:format-list-bulleted" width="16" />
                </button>
                <button type="button" :class="{ active: editor?.isActive('orderedList') }" @click="editor?.chain().focus().toggleOrderedList().run()" title="Lista numerada">
                  <Icon icon="mdi:format-list-numbered" width="16" />
                </button>
                <span class="toolbar-sep" />
                <button type="button" @click="editor?.chain().focus().undo().run()" title="Desfazer">
                  <Icon icon="mdi:undo" width="16" />
                </button>
                <button type="button" @click="editor?.chain().focus().redo().run()" title="Refazer">
                  <Icon icon="mdi:redo" width="16" />
                </button>
              </div>
              <editor-content :editor="editor" class="editor-content" />
            </div>
          </div>
        </section>
      </div>

      <div class="form-col">
        <section class="form-section">
          <h2 class="section-title">Imagem de capa</h2>

          <div class="field">
            <label>URL da imagem (Imgur)</label>
            <input
              v-model="form.cover_url"
              type="url"
              placeholder="https://i.imgur.com/..."
              class="form-input"
            />
            <p class="field-hint">Cole o link direto da imagem do Imgur (termina em .jpg, .png etc)</p>
          </div>

          <div v-if="form.cover_url" class="cover-preview">
            <img :src="form.cover_url" alt="Preview da capa" @error="coverError = true" @load="coverError = false" />
            <p v-if="coverError" class="field-hint field-hint--warn">URL inválida ou imagem não encontrada.</p>
          </div>
        </section>

        <section class="form-section">
          <h2 class="section-title">Publicação</h2>

          <div class="field">
            <label>Tamanho do popup</label>
            <div class="size-options">
              <button
                v-for="opt in sizeOptions"
                :key="opt.value"
                type="button"
                class="size-btn"
                :class="{ 'size-btn--active': form.size === opt.value }"
                @click="form.size = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
            <p class="field-hint">{{ sizeHint }}</p>
          </div>

          <div class="field">
            <label>
              Data de publicação
              <span class="field-hint-inline" title="Deixe vazio para publicar imediatamente ao ativar">(?)</span>
            </label>
            <input v-model="form.published_at" type="datetime-local" class="form-input" />
            <p class="field-hint">Vazio = aparece imediatamente quando ativo. Data futura = agendado.</p>
          </div>

          <div class="field toggle-row">
            <label class="toggle-label">
              <div>
                <span>Ativo</span>
                <p class="field-hint">
                  <template v-if="!form.is_active">Inativo — não aparece para ninguém.</template>
                  <template v-else-if="form.published_at && new Date(form.published_at) > new Date()">Agendado — aparece em {{ formatDate(form.published_at) }}.</template>
                  <template v-else>Ativo — aparece para usuários logados.</template>
                </p>
              </div>
              <button
                type="button"
                class="toggle"
                :class="{ 'toggle--on': form.is_active }"
                @click="form.is_active = !form.is_active"
              >
                <span class="toggle-knob" />
              </button>
            </label>
          </div>

          <div class="status-info">
            <span class="status-badge" :class="statusClass">{{ statusLabel }}</span>
            <span class="status-tip">{{ statusTip }}</span>
          </div>
        </section>
      </div>

      <div class="form-footer">
        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        <div class="form-footer__actions">
          <button type="button" class="btn-ghost" @click="router.push('/news')">Cancelar</button>
          <button type="submit" class="btn-primary" :disabled="submitting">
            {{ submitting ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar novidade' }}
          </button>
        </div>
      </div>
    </form>

    <!-- Preview modal -->
    <div v-if="showPreview" class="preview-overlay" @click.self="showPreview = false">
      <div class="preview-modal" :style="{ maxWidth: previewMaxWidth }">
        <button class="preview-close" @click="showPreview = false">
          <Icon icon="mdi:close" width="20" />
        </button>
        <div class="news-popup">
          <img v-if="form.cover_url && !coverError" :src="form.cover_url" class="news-popup__cover" alt="" />
          <div class="news-popup__body" v-if="form.title || editorHtml">
            <h2 v-if="form.title" class="news-popup__title">{{ form.title }}</h2>
            <div v-if="editorHtml" class="news-popup__content" v-html="editorHtml" />
          </div>
          <div class="news-popup__footer">
            <button class="news-popup__dismiss">Não mostrar novamente</button>
            <button class="news-popup__close">Fechar</button>
          </div>
        </div>
        <p class="preview-note">Preview do popup como o usuário vai ver</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { adminService } from '@/services/admin/admin.service'

const router = useRouter()
const route = useRoute()

const uuid = computed(() => route.params.uuid as string | undefined)
const isEdit = computed(() => !!uuid.value)
const loadingItem = ref(false)
const submitting = ref(false)
const errorMsg = ref('')
const showPreview = ref(false)
const coverError = ref(false)

const sizeOptions: { value: 'sm' | 'md' | 'lg' | 'full'; label: string }[] = [
  { value: 'sm', label: 'P — 400px' },
  { value: 'md', label: 'M — 620px' },
  { value: 'lg', label: 'G — 860px' },
  { value: 'full', label: 'Full' },
]

const form = reactive({
  title: '',
  cover_url: '',
  size: 'md' as 'sm' | 'md' | 'lg' | 'full',
  published_at: '',
  is_active: true,
})

const sizeHint = computed(() => {
  const map = { sm: 'Popup estreito (400px).', md: 'Tamanho padrão (620px).', lg: 'Popup largo (860px).', full: 'Ocupa quase toda a tela (95vw).' }
  return map[form.size]
})

const previewMaxWidth = computed(() => {
  const map = { sm: '400px', md: '620px', lg: '860px', full: '95vw' }
  return map[form.size] ?? '620px'
})

const editor = useEditor({
  extensions: [StarterKit],
  content: '',
  editorProps: {
    attributes: { class: 'tiptap-editor' },
  },
})

const editorHtml = computed(() => editor.value?.getHTML() ?? '')

const formatDate = (val: string) => val ? new Date(val).toLocaleString('pt-BR') : ''

const statusLabel = computed(() => {
  if (!form.is_active) return 'Inativo'
  if (form.published_at && new Date(form.published_at) > new Date()) return 'Agendado'
  return 'Ativo'
})

const statusClass = computed(() => {
  const s = statusLabel.value
  if (s === 'Ativo') return 'status-active'
  if (s === 'Agendado') return 'status-scheduled'
  return 'status-inactive'
})

const statusTip = computed(() => {
  if (!form.is_active) return 'Não aparece para usuários.'
  if (form.published_at && new Date(form.published_at) > new Date()) return `Aparece a partir de ${formatDate(form.published_at)}.`
  if (!form.published_at) return 'Aparece imediatamente para usuários logados.'
  return 'Aparece para usuários logados.'
})

const toISOorNull = (val: string) => val ? new Date(val).toISOString() : null

const submit = async () => {
  errorMsg.value = ''
  submitting.value = true
  try {
    const payload = {
      title: form.title.trim() || null,
      body: editorHtml.value || null,
      cover_url: form.cover_url.trim() || null,
      size: form.size,
      published_at: toISOorNull(form.published_at),
      is_active: form.is_active,
    }

    if (isEdit.value) {
      await adminService.updateNews(uuid.value!, payload)
    } else {
      await adminService.createNews(payload)
    }

    router.push('/news')
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.message ?? 'Erro ao salvar novidade.'
  } finally {
    submitting.value = false
  }
}

const fillForm = (data: any) => {
  form.title = data.title ?? ''
  form.cover_url = data.cover_url ?? ''
  form.size = data.size ?? 'md'
  form.published_at = data.published_at ? new Date(data.published_at).toISOString().slice(0, 16) : ''
  form.is_active = data.is_active ?? true
  editor.value?.commands.setContent(data.body ?? '')
}

onMounted(async () => {
  if (!isEdit.value) return
  loadingItem.value = true
  try {
    const res = await adminService.getNews(uuid.value!)
    fillForm(res.data)
  } finally {
    loadingItem.value = false
  }
})

onBeforeUnmount(() => editor.value?.destroy())
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

.btn-preview
  display inline-flex
  align-items center
  gap 6px
  padding 0.5rem 1.1rem
  background rgba(99,102,241,0.12)
  border 1px solid rgba(99,102,241,0.3)
  border-radius 8px
  color #a5b4fc
  font-size 0.875rem
  font-weight 600
  cursor pointer
  &:hover:not(:disabled)
    background rgba(99,102,241,0.22)
  &:disabled
    opacity 0.4
    cursor not-allowed

.loading-state
  display flex
  justify-content center
  padding 4rem
  color rgba(255,255,255,0.4)

.form-grid
  display grid
  grid-template-columns 1fr 1fr
  gap 1.5rem
  @media (max-width: 900px)
    grid-template-columns 1fr

.form-col
  display flex
  flex-direction column
  gap 1.5rem

.form-footer
  grid-column 1 / -1
  display flex
  align-items center
  justify-content flex-end
  gap 1rem
  padding-top 0.5rem

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

.field-hint
  font-size 0.75rem
  color rgba(255,255,255,0.35)
  margin 0

.field-hint--warn
  color #fbbf24

.field-hint-inline
  display inline-block
  width 14px
  height 14px
  border-radius 50%
  background rgba(255,255,255,0.1)
  color rgba(255,255,255,0.4)
  font-size 0.65rem
  text-align center
  line-height 14px
  cursor help
  margin-left 4px
  vertical-align middle

.required
  color #fc8181

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
  &:focus
    border-color rgba(99,102,241,0.5)

.editor-wrap
  border 1px solid rgba(255,255,255,0.1)
  border-radius 8px
  overflow hidden
  background rgba(0,0,0,0.25)
  &:focus-within
    border-color rgba(99,102,241,0.5)

.editor-toolbar
  display flex
  align-items center
  gap 2px
  padding 6px 8px
  border-bottom 1px solid rgba(255,255,255,0.07)
  background rgba(255,255,255,0.02)
  flex-wrap wrap

  button
    display flex
    align-items center
    justify-content center
    width 28px
    height 28px
    background transparent
    border none
    border-radius 5px
    color rgba(255,255,255,0.55)
    cursor pointer
    &:hover
      background rgba(255,255,255,0.08)
      color #fff
    &.active
      background rgba(99,102,241,0.2)
      color #a5b4fc

.toolbar-sep
  width 1px
  height 18px
  background rgba(255,255,255,0.1)
  margin 0 4px

.cover-preview
  margin-top 0.5rem
  border-radius 8px
  overflow hidden
  border 1px solid rgba(255,255,255,0.06)

  img
    width 100%
    max-height 160px
    object-fit cover
    display block

.toggle-row
  display flex
  flex-direction column
  justify-content center
  margin-bottom 0

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

.status-info
  display flex
  align-items center
  gap 8px
  margin-top 0.5rem

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

.status-tip
  font-size 0.75rem
  color rgba(255,255,255,0.35)

.btn-primary
  display inline-flex
  align-items center
  gap 6px
  padding 0.55rem 1.25rem
  background #6366f1
  border none
  border-radius 8px
  color #fff
  font-weight 600
  font-size 0.875rem
  cursor pointer
  &:hover:not(:disabled)
    background #4f46e5
  &:disabled
    opacity 0.5
    cursor not-allowed

.btn-ghost
  padding 0.55rem 1.25rem
  background transparent
  border 1px solid rgba(255,255,255,0.12)
  border-radius 8px
  color rgba(255,255,255,0.65)
  font-size 0.875rem
  cursor pointer
  &:hover
    background rgba(255,255,255,0.06)

.spin
  animation spin 0.8s linear infinite

@keyframes spin
  from
    transform rotate(0deg)
  to
    transform rotate(360deg)

// Preview overlay
.size-options
  display flex
  gap 6px

.size-btn
  padding 5px 14px
  border 1px solid rgba(255,255,255,0.12)
  border-radius 8px
  background transparent
  color rgba(255,255,255,0.5)
  font-size 0.8rem
  cursor pointer
  transition all 0.15s
  &:hover
    border-color rgba(255,255,255,0.3)
    color rgba(255,255,255,0.8)

.size-btn--active
  border-color #6366f1
  background rgba(99,102,241,0.15)
  color #a5b4fc

.preview-overlay
  position fixed
  inset 0
  background rgba(0,0,0,0.8)
  z-index 200
  display flex
  flex-direction column
  align-items center
  justify-content center
  padding 1rem

.preview-modal
  position relative
  width 100%
  max-width 480px

.preview-close
  position absolute
  top -36px
  right 0
  background transparent
  border none
  color rgba(255,255,255,0.6)
  cursor pointer
  display flex
  align-items center
  &:hover
    color #fff

.preview-note
  text-align center
  font-size 0.75rem
  color rgba(255,255,255,0.3)
  margin-top 0.75rem

// News popup (simulates frontend)
.news-popup
  background #1c1c22
  border 1px solid rgba(255,255,255,0.1)
  border-radius 16px
  overflow hidden
  box-shadow 0 24px 80px rgba(0,0,0,0.6)

.news-popup__cover
  width 100%
  display block

.news-popup__body
  padding 1.5rem

.news-popup__title
  font-size 1.2rem
  font-weight 700
  margin 0 0 0.75rem
  color #fff

.news-popup__content
  font-size 0.9rem
  color rgba(255,255,255,0.7)
  line-height 1.6

.news-popup__footer
  display flex
  align-items center
  justify-content flex-end
  gap 8px
  padding 1rem 1.5rem
  border-top 1px solid rgba(255,255,255,0.06)

.news-popup__dismiss
  padding 6px 14px
  background transparent
  border 1px solid rgba(255,255,255,0.12)
  border-radius 8px
  color rgba(255,255,255,0.5)
  font-size 0.8rem
  cursor pointer

.news-popup__close
  padding 6px 18px
  background #6366f1
  border none
  border-radius 8px
  color #fff
  font-size 0.85rem
  font-weight 600
  cursor pointer
</style>

<style>
.tiptap-editor {
  min-height: 200px;
  padding: 0.75rem;
  color: #fff;
  font-size: 0.9rem;
  line-height: 1.6;
  outline: none;
}
.tiptap-editor h2 { font-size: 1.2rem; font-weight: 700; margin: 0.75rem 0 0.4rem; }
.tiptap-editor h3 { font-size: 1rem; font-weight: 700; margin: 0.6rem 0 0.3rem; }
.tiptap-editor p { margin: 0 0 0.5rem; }
.tiptap-editor ul, .tiptap-editor ol { padding-left: 1.25rem; margin: 0.25rem 0; }
.tiptap-editor li { margin-bottom: 0.2rem; }
.tiptap-editor strong { color: #fff; }
.tiptap-editor em { color: rgba(255,255,255,0.75); }
.tiptap-editor s { color: rgba(255,255,255,0.4); }
.tiptap-editor p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: rgba(255,255,255,0.2);
  pointer-events: none;
  height: 0;
}
</style>
