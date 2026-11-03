<template>
  <div class="view-wrap">
    <header class="page-header">
      <h1 class="page-title">Voz da loja</h1>
      <p class="page-subtitle">Falas que o Opus pode usar nos vídeos. Uma frase por gravação.</p>
    </header>

    <section class="section">
      <h2 class="section-title">Nova fala</h2>
      <p class="hint">Escreva exatamente o que vai falar: é assim que o Opus sabe o que tem no áudio. O silêncio das pontas é cortado e o volume é igualado sozinho.</p>

      <div class="suggestions">
        <button
          v-for="phrase in SUGGESTIONS"
          :key="phrase"
          type="button"
          class="chip"
          :class="{ 'chip--done': recorded.has(slug(phrase)) }"
          @click="text = phrase"
        >
          <Icon v-if="recorded.has(slug(phrase))" icon="mdi:check" width="12" />
          {{ phrase }}
        </button>
      </div>

      <label class="field-label" for="voice-text">Ou escreva a sua própria frase</label>
      <input id="voice-text" v-model="text" class="text-input" maxlength="60" placeholder="Digite o que vai falar e clique em Gravar" />
      <p class="hint">{{ text.length }}/60 caracteres · até 4 segundos de fala, pra caber dentro de uma cena do vídeo.</p>

      <div class="recorder">
        <button v-if="!recording" type="button" class="btn-record" :disabled="!text.trim()" @click="startRecording">
          <Icon icon="mdi:microphone" width="16" /> Gravar
        </button>
        <button v-else type="button" class="btn-record btn-record--on" @click="stopRecording">
          <Icon icon="mdi:stop" width="16" /> Parar
        </button>
        <label class="btn-ghost">
          <Icon icon="mdi:upload" width="14" /> Enviar arquivo
          <input type="file" accept="audio/*" hidden @change="pickFile" />
        </label>
      </div>

      <div v-if="takeUrl" class="take">
        <audio :src="takeUrl" controls />
        <button type="button" class="btn-primary" :disabled="saving || !text.trim()" @click="save">
          {{ saving ? 'Salvando...' : 'Salvar fala' }}
        </button>
        <button type="button" class="btn-ghost" @click="discardTake">Descartar</button>
      </div>
      <p v-if="error" class="error-msg">{{ error }}</p>
    </section>

    <section class="section">
      <h2 class="section-title">Falas gravadas</h2>
      <p v-if="loading" class="hint">Carregando...</p>
      <p v-else-if="!voices.length" class="hint">Nenhuma fala ainda. Comece pelo nome da loja: ele assina o fim dos vídeos.</p>
      <ul v-else class="voices">
        <li v-for="voice in voices" :key="voice.id" class="voice">
          <div class="voice__info">
            <p class="voice__text">"{{ voice.text }}"</p>
            <small class="hint">{{ voice.duration.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) }}s</small>
          </div>
          <audio :src="mediaUrl(voice.url)" controls preload="none" />
          <button type="button" class="btn-ghost" @click="text = voice.text">Regravar</button>
          <button type="button" class="btn-ghost btn-ghost--danger" @click="remove(voice)">
            <Icon icon="mdi:trash-can-outline" width="14" />
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { mediaUrl } from '@/utils/mediaUrl'
import { adminService, type InstagramVoice } from '@/services/admin/admin.service'

// Frases que servem pra qualquer skin: a mesma gravação entra em vários vídeos.
const SUGGESTIONS = [
  'Secret Shop',
  'olha isso',
  'chegou',
  'cê viu essa?',
  'tá na mão',
  'link na bio',
  'confere no site',
  'corre lá',
  'tem cupom',
  'bonita demais',
  'essa é braba',
]

// Mesmo id do backend (voice.ts): frase igual com acento/pontuação diferente é a mesma fala.
const slug = (phrase: string) =>
  phrase
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const voices = ref<InstagramVoice[]>([])
const loading = ref(true)
const text = ref('')
const recording = ref(false)
const take = ref<Blob | null>(null)
const saving = ref(false)
const error = ref('')
let recorder: MediaRecorder | null = null

const recorded = computed(() => new Set(voices.value.map((voice) => voice.id.replace(/^voz-/, ''))))
const takeUrl = computed(() => (take.value ? URL.createObjectURL(take.value) : ''))
watch(takeUrl, (_, previous) => previous && URL.revokeObjectURL(previous))

const load = async () => {
  try {
    voices.value = (await adminService.getInstagramVoices()).data
  } catch (err: any) {
    error.value = err.response?.data?.message ?? 'Não consegui carregar as falas.'
  } finally {
    loading.value = false
  }
}

const stopTracks = (stream: MediaStream) => stream.getTracks().forEach((track) => track.stop())

const startRecording = async () => {
  error.value = ''
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null)
  if (!stream) {
    error.value = 'Não consegui acessar o microfone. Libera a permissão no navegador.'
    return
  }
  const chunks: Blob[] = []
  recorder = new MediaRecorder(stream)
  recorder.ondataavailable = (event) => chunks.push(event.data)
  recorder.onstop = () => {
    take.value = new Blob(chunks, { type: recorder?.mimeType })
    stopTracks(stream)
  }
  recorder.start()
  recording.value = true
}

const stopRecording = () => {
  recorder?.stop()
  recording.value = false
}

const pickFile = (event: Event) => {
  const input = event.target as HTMLInputElement
  take.value = input.files?.[0] ?? null
  input.value = ''
}

const discardTake = () => {
  take.value = null
  error.value = ''
}

const save = async () => {
  if (!take.value) return
  saving.value = true
  error.value = ''
  try {
    const saved = (await adminService.addInstagramVoice(text.value.trim(), take.value)).data
    toast.success(`Fala "${saved.text}" salva (${saved.duration.toLocaleString('pt-BR')}s).`)
    take.value = null
    text.value = ''
    await load()
  } catch (err: any) {
    error.value = err.response?.data?.message ?? 'Não consegui salvar a fala.'
  } finally {
    saving.value = false
  }
}

const remove = async (voice: InstagramVoice) => {
  if (!confirm(`Apagar a fala "${voice.text}"?`)) return
  try {
    await adminService.deleteInstagramVoice(voice.id)
    voices.value = voices.value.filter((other) => other.id !== voice.id)
  } catch (err: any) {
    toast.error(err.response?.data?.message ?? 'Não consegui apagar a fala.')
  }
}

onMounted(load)
onBeforeUnmount(() => recorder?.state === 'recording' && recorder.stop())
</script>

<style lang="stylus" scoped>
.view-wrap
  padding 2rem
  color #fff
  min-height 100vh

.page-header
  margin-bottom 2rem

.page-title
  font-size 1.8rem
  font-weight 700
  margin 0 0 4px

.page-subtitle
  font-size 0.85rem
  color rgba(255,255,255,0.45)
  margin 0

.section
  background #16161a
  border 1px solid rgba(255,255,255,0.06)
  border-radius 12px
  padding 1.25rem
  margin-bottom 1.5rem
  display flex
  flex-direction column
  gap 12px

.section-title
  font-size 1rem
  font-weight 600
  margin 0

.hint
  margin 0
  font-size 0.75rem
  color rgba(255,255,255,0.45)

.error-msg
  color #fc8181
  font-size 0.85rem
  margin 0

.suggestions
  display flex
  flex-wrap wrap
  gap 6px

.chip
  display inline-flex
  align-items center
  gap 4px
  padding 4px 10px
  border-radius 999px
  border 1px solid rgba(255,255,255,0.12)
  background transparent
  color rgba(255,255,255,0.75)
  font-size 0.78rem
  cursor pointer
  &:hover
    background rgba(255,255,255,0.06)

.chip--done
  border-color rgba(102,35,197,0.6)
  background rgba(102,35,197,0.15)
  color #c9b3ec

.field-label
  font-size 0.8rem
  font-weight 600
  color rgba(255,255,255,0.75)
  margin-top 4px

.text-input
  max-width 420px
  padding 9px 12px
  background rgba(0,0,0,0.3)
  border 1px solid rgba(255,255,255,0.12)
  border-radius 8px
  color #fff
  font-size 0.9rem
  &:focus
    outline none
    border-color #6623C5

.recorder, .take
  display flex
  align-items center
  gap 8px
  flex-wrap wrap

.btn-record
  display inline-flex
  align-items center
  gap 6px
  padding 8px 16px
  border none
  border-radius 8px
  background #6623C5
  color #fff
  font-size 0.85rem
  font-weight 600
  cursor pointer
  &:disabled
    opacity 0.4
    cursor not-allowed

.btn-record--on
  background #e53e3e
  animation pulse 1.2s ease-in-out infinite

@keyframes pulse
  50%
    opacity 0.7

.btn-primary
  padding 8px 16px
  border none
  border-radius 8px
  background #6623C5
  color #fff
  font-size 0.85rem
  font-weight 600
  cursor pointer
  &:disabled
    opacity 0.4
    cursor not-allowed

.btn-ghost
  display inline-flex
  align-items center
  gap 6px
  padding 6px 12px
  background transparent
  border 1px solid rgba(255,255,255,0.12)
  border-radius 6px
  color rgba(255,255,255,0.65)
  font-size 0.8rem
  cursor pointer
  &:hover
    background rgba(255,255,255,0.06)

.btn-ghost--danger:hover
  color #fc8181
  border-color rgba(252,129,129,0.4)

.voices
  list-style none
  margin 0
  padding 0
  display flex
  flex-direction column
  gap 8px

.voice
  display flex
  align-items center
  gap 12px
  padding 10px
  background rgba(0,0,0,0.25)
  border-radius 10px
  flex-wrap wrap
  audio
    height 36px

.voice__info
  flex 1
  min-width 140px

.voice__text
  margin 0
  font-size 0.9rem
  font-weight 600
</style>
