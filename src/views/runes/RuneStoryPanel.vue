<template>
  <div class="section">
    <h2 class="section-heading">
      <Icon icon="mdi:instagram" width="16" /> Story automático
      <span class="section-heading__hint">toda runa do dia ganha um story com o tipo e o horário; sai sozinho quando ela nasce</span>
    </h2>

    <div v-if="story" class="panel">
      <div class="config">
        <img v-if="story.image_url" :src="mediaUrl(story.image_url)" class="thumb" referrerpolicy="no-referrer" alt="" />
        <div v-else class="thumb thumb--empty">sem fundo</div>

        <div class="actions">
          <label class="btn-ghost">
            <Icon :icon="uploading ? 'mdi:loading' : 'mdi:upload'" :class="{ spin: uploading }" width="15" />
            {{ story.image_url ? 'Trocar fundo' : 'Subir fundo' }}
            <input type="file" accept="image/png,image/jpeg,image/webp" hidden :disabled="uploading" @change="uploadBackground" />
          </label>
          <div class="note-field">
            <label for="rune-story-note">Frase</label>
            <div class="note-row">
              <input id="rune-story-note" ref="noteInput" v-model="noteDraft" type="text" :maxlength="NOTE_MAX_LENGTH" class="note-input" />
              <button type="button" class="btn-ghost" :disabled="!noteChanged || saving" @click="saveNote">Salvar</button>
            </div>
            <div class="variables">
              <button v-for="variable in story.note_variables" :key="variable.marker" type="button" class="variable" :title="`Exemplo: ${variable.sample}`" @mousedown.prevent @click="insertVariable(variable.marker)">
                <code>{{ variable.marker }}</code> {{ variable.label }}
              </button>
            </div>
            <span class="hint">Prévia: {{ sampleNote }}</span>
          </div>
          <button type="button" class="btn-ghost" :disabled="!story.image_url" @click="editorOpen = true">
            <Icon icon="mdi:cursor-move" width="15" /> Posicionar runa e texto
          </button>
          <div class="toggle-row">
            <span>{{ story.is_active ? 'Ligado' : 'Desligado' }}</span>
            <button type="button" class="toggle" :class="{ 'toggle--on': story.is_active }" :disabled="(!canActivate && !story.is_active) || saving" @click="toggleActive">
              <span class="toggle-knob" />
            </button>
          </div>
          <p v-if="!canActivate" class="hint hint--warn">Sobe o fundo e posiciona a runa e o texto pra ligar.</p>
          <p class="hint">Story não notifica ninguém: runa de 5 min quase ninguém vê a tempo. Runa com público restrito (nível ou lista) não ganha story.</p>
        </div>
      </div>

      <div class="today">
        <h3>Hoje</h3>
        <p v-if="!story.stories.length" class="hint">Nenhum story montado hoje. Monta em até 1 min depois que a runa do dia existe.</p>
        <ul v-else class="story-list">
          <li v-for="item in story.stories" :key="item.id">
            <a :href="mediaUrl(item.image_url)" target="_blank" rel="noopener">
              <img :src="mediaUrl(item.image_url)" referrerpolicy="no-referrer" alt="" />
            </a>
            <span class="mono">{{ item.rune?.spawn_time ?? '—' }}</span>
            <span class="status" :class="`status--${item.status.toLowerCase()}`" :title="item.error ?? ''">{{ STATUS[item.status] }}</span>
          </li>
        </ul>
      </div>
    </div>

    <FinishEditor
      v-if="editorOpen && story?.image_url"
      kind="STORY"
      :base-url="mediaUrl(story.image_url)"
      subject="story da runa"
      :price="null"
      :note="sampleNote"
      :initial-layout="story.layout ?? DEFAULT_LAYOUT.STORY"
      :default-layout="DEFAULT_LAYOUT.STORY"
      :applying="saving"
      :logo-src="runeInfo('HASTE').image"
      logo-label="Runa"
      @close="editorOpen = false"
      @apply="applyLayout"
      @save-default="applyLayout"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { adminService, type RuneStory } from '@/services/admin/admin.service'
import { mediaUrl } from '@/utils/mediaUrl'
import { runeInfo } from '@/utils/runes'
import FinishEditor from '@/views/instagram/FinishEditor.vue'
import { DEFAULT_LAYOUT, type FinishLayout } from '@/views/instagram/finishCanvas'

// mesmo limite do UpdateRuneStoryDto
const NOTE_MAX_LENGTH = 120

const STATUS: Record<string, string> = {
  DRAFT: 'Pronto, sai no spawn',
  PUBLISHING: 'Publicando',
  PUBLISHED: 'Publicado',
  FAILED: 'Falhou',
}

const story = ref<RuneStory | null>(null)
const editorOpen = ref(false)
const saving = ref(false)
const uploading = ref(false)

const noteDraft = ref('')
const noteInput = ref<HTMLInputElement | null>(null)

const canActivate = computed(() => !!story.value?.image_url && !!story.value?.layout)
const fillNote = (template: string) =>
  (story.value?.note_variables ?? []).reduce((text, variable) => text.replaceAll(variable.marker, variable.sample), template)

const sampleNote = computed(() => fillNote(noteDraft.value.trim() || story.value?.note || ''))
const noteChanged = computed(() => !!noteDraft.value.trim() && noteDraft.value.trim() !== story.value?.note)

watch(() => story.value?.note, (note) => { noteDraft.value = note ?? '' })

// class-validator manda `message` como lista
const apiMessage = (err: any, fallback: string) => [err?.response?.data?.message ?? fallback].flat().join(' ')

const load = async () => {
  const res = await adminService.getRuneStory()
  story.value = res.data
}

const save = async (data: { layout?: FinishLayout; is_active?: boolean; note?: string }) => {
  saving.value = true
  try {
    const res = await adminService.updateRuneStory(data)
    story.value = res.data
    editorOpen.value = false
  } catch (err) {
    toast.error(apiMessage(err, 'Não deu pra salvar.'))
  } finally {
    saving.value = false
  }
}

const applyLayout = (layout: FinishLayout) => save({ layout })
const toggleActive = () => save({ is_active: !story.value?.is_active })
const saveNote = () => save({ note: noteDraft.value.trim() })

// Sem foco o selectionStart é 0: aí a variável vai pro fim, não pro começo.
const cursorPosition = (input: HTMLInputElement | null) =>
  input && document.activeElement === input ? (input.selectionStart ?? noteDraft.value.length) : noteDraft.value.length

const insertVariable = async (marker: string) => {
  if (noteDraft.value.length + marker.length > NOTE_MAX_LENGTH) return
  const input = noteInput.value
  const at = cursorPosition(input)
  noteDraft.value = noteDraft.value.slice(0, at) + marker + noteDraft.value.slice(at)
  await nextTick()
  input?.focus()
  input?.setSelectionRange(at + marker.length, at + marker.length)
}

const uploadBackground = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  uploading.value = true
  try {
    const res = await adminService.uploadRuneStoryBackground(file)
    story.value = res.data
    editorOpen.value = true
  } catch (err) {
    toast.error(apiMessage(err, 'Não deu pra subir o fundo.'))
  } finally {
    uploading.value = false
  }
}

onMounted(load)
</script>

<style lang="stylus" scoped>
.section
  background #16161a
  border 1px solid rgba(255,255,255,0.06)
  border-radius 12px
  overflow hidden
  margin-bottom 1.5rem

.section-heading
  display flex
  align-items center
  gap 8px
  margin 0
  padding 0.9rem 1rem
  font-size 0.95rem
  font-weight 700
  border-bottom 1px solid rgba(255,255,255,0.06)

  &__hint
    font-size 0.78rem
    font-weight 400
    color rgba(255,255,255,0.38)

.panel
  display grid
  grid-template-columns minmax(0, 1fr) minmax(0, 1.4fr)
  gap 1.5rem
  padding 1rem
  @media (max-width: 900px)
    grid-template-columns 1fr

.config
  display flex
  gap 1rem

.thumb
  width 96px
  aspect-ratio 9 / 16
  object-fit cover
  border-radius 8px
  border 1px solid rgba(255,255,255,0.08)
  flex-shrink 0

.thumb--empty
  display flex
  align-items center
  justify-content center
  color rgba(255,255,255,0.35)
  font-size 0.72rem
  background rgba(0,0,0,0.25)

.actions
  display flex
  flex-direction column
  align-items flex-start
  gap 8px

.note-field
  display flex
  flex-direction column
  gap 4px
  width 100%
  font-size 0.8rem
  color rgba(255,255,255,0.6)
  code
    color rgba(255,255,255,0.75)

.note-row
  display flex
  gap 6px

.variables
  display flex
  flex-wrap wrap
  gap 4px

.variable
  padding 2px 8px
  background rgba(255,255,255,0.05)
  border 1px solid rgba(255,255,255,0.1)
  border-radius 999px
  color rgba(255,255,255,0.6)
  font-size 0.72rem
  cursor pointer
  &:hover
    background rgba(255,255,255,0.1)

.note-input
  flex 1
  min-width 0
  padding 4px 8px
  background rgba(0,0,0,0.25)
  border 1px solid rgba(255,255,255,0.12)
  border-radius 6px
  color #fff
  font-size 0.85rem

.today h3
  margin 0 0 8px
  font-size 0.85rem
  color rgba(255,255,255,0.7)

.story-list
  list-style none
  margin 0
  padding 0
  display flex
  flex-wrap wrap
  gap 10px
  li
    display flex
    flex-direction column
    align-items center
    gap 4px
    width 72px
  img
    width 72px
    aspect-ratio 9 / 16
    object-fit cover
    border-radius 6px
    display block

.mono
  font-family 'Courier New', monospace
  font-size 0.8rem

.status
  font-size 0.68rem
  text-align center
  color rgba(255,255,255,0.5)

.status--published
  color #4ade80

.status--failed
  color #fc8181

.status--publishing
  color #fbbf24

.hint
  font-size 0.75rem
  color rgba(255,255,255,0.38)
  margin 0

.hint--warn
  color #fbbf24

.toggle-row
  display flex
  align-items center
  gap 10px
  font-size 0.85rem
  color rgba(255,255,255,0.7)

.toggle
  width 40px
  height 22px
  background rgba(255,255,255,0.12)
  border none
  border-radius 999px
  position relative
  cursor pointer
  transition background 0.2s
  padding 0
  &:disabled
    opacity 0.4
    cursor not-allowed

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
  &:disabled
    opacity 0.4
    cursor not-allowed

.spin
  animation spin 1s linear infinite

@keyframes spin
  to
    transform rotate(360deg)
</style>
