<template>
  <div class="modal-overlay" @click.self="closeFromOverlay">
    <div class="modal">
      <div class="modal__head">
        <h3>Comentários</h3>
        <a v-if="permalink" :href="permalink" target="_blank" rel="noopener" class="btn-link">Ver no Instagram</a>
      </div>
      <p v-if="title" class="hint title">{{ title }}</p>

      <p v-if="loading" class="hint">Carregando...</p>
      <p v-else-if="error" class="error-msg">{{ error }}</p>
      <p v-else-if="!rows.length && expected" class="warn">
        O post tem {{ expected }} comentários, mas a Meta não liberou os comentários. Causa provável: app da Meta em
        modo desenvolvimento, que só libera comentário de quem tem papel no app (passa pra Live em Configurações →
        Básico). Também pode ser token sem <code>instagram_business_manage_comments</code>, usuário restrito ou post com
        restrição de idade.
      </p>
      <p v-else-if="!rows.length" class="hint">Nenhum comentário ainda.</p>
      <ul v-else class="comments">
        <li
          v-for="row in rows"
          :key="row.comment.id"
          class="comment"
          :class="{ 'comment--reply': row.comment !== row.thread, 'comment--hidden': row.comment.hidden }"
        >
          <div class="comment__head">
            <strong>@{{ row.comment.username }}</strong>
            <span class="hint">{{ when(row.comment.timestamp) }}</span>
            <span v-if="row.comment.like_count" class="hint"><Icon icon="mdi:heart" width="12" /> {{ row.comment.like_count }}</span>
            <span v-if="row.comment.hidden" class="hidden-badge">oculto</span>
          </div>
          <p class="comment__text">{{ row.comment.text }}</p>
          <div class="comment__actions">
            <button v-if="!row.thread.hidden" type="button" class="btn-link" @click="startReply(row)">Responder</button>
            <button
              v-if="!isOwn(row.comment)"
              type="button"
              class="btn-link"
              :disabled="busyId === row.comment.id"
              @click="toggleHidden(row.comment)"
            >
              {{ row.comment.hidden ? 'Mostrar' : 'Ocultar' }}
            </button>
          </div>
        </li>
      </ul>
      <p v-if="comments.length >= MAX_COMMENTS" class="hint">Mostrando os {{ MAX_COMMENTS }} mais recentes.</p>

      <div v-if="replyTarget" class="reply-box">
        <label>Respondendo @{{ replyTarget.username }}</label>
        <textarea v-model="replyText" class="form-input" rows="3" maxlength="2200" />
        <div class="modal-actions">
          <button type="button" class="btn-ghost" @click="replyTarget = null">Cancelar</button>
          <button type="button" class="btn-primary" :disabled="sending || !replyText.trim()" @click="sendReply">
            {{ sending ? 'Enviando...' : 'Responder' }}
          </button>
        </div>
      </div>
      <div v-else class="modal-actions">
        <button type="button" class="btn-ghost" @click="emit('close')">Fechar</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import dayjs from 'dayjs'
import { adminService, type InstagramComment } from '@/services/admin/admin.service'

// expected = contador do post na lista; a Meta entrega o número mesmo quando segura os comentários.
// ownUsername = conta da loja; a Meta nunca oculta comentário do dono do post.
const props = defineProps<{
  mediaId: string
  title: string | null
  permalink: string | null
  expected: number | null
  ownUsername: string | null
}>()
const emit = defineEmits<{ close: [] }>()

// Backend busca só a 1ª página da Meta.
const MAX_COMMENTS = 50

// thread = comentário de topo: a Meta pendura toda resposta nele, mesmo resposta de resposta.
type Row = { comment: InstagramComment; thread: InstagramComment }

const comments = ref<InstagramComment[]>([])
const loading = ref(true)
const error = ref('')
const busyId = ref<string | null>(null)
const replyTarget = ref<{ threadId: string; username: string } | null>(null)
const replyText = ref('')
const sending = ref(false)

const when = (date: string) => dayjs(date).format('DD/MM/YY HH:mm')
const isOwn = (comment: InstagramComment) => comment.username === props.ownUsername

// Clique fora com resposta aberta perderia o rascunho.
const closeFromOverlay = () => {
  if (replyTarget.value) return
  emit('close')
}

const threadRows = (thread: InstagramComment): Row[] => [
  { comment: thread, thread },
  ...(thread.replies?.data ?? []).map((reply) => ({ comment: reply, thread })),
]
const rows = computed(() => comments.value.flatMap(threadRows))

const fetchComments = async () => {
  loading.value = true
  error.value = ''
  try {
    const { data } = await adminService.getInstagramComments(props.mediaId)
    comments.value = data
  } catch (err: any) {
    error.value = err.response?.data?.message ?? 'Não carregou os comentários.'
  } finally {
    loading.value = false
  }
}

const startReply = (row: Row) => {
  replyTarget.value = { threadId: row.thread.id, username: row.comment.username }
  replyText.value = `@${row.comment.username} `
}

const sendReply = async () => {
  if (!replyTarget.value) return
  sending.value = true
  try {
    await adminService.replyInstagramComment(replyTarget.value.threadId, replyText.value.trim())
    replyTarget.value = null
    replyText.value = ''
    await fetchComments()
  } catch (err: any) {
    toast.error(err.response?.data?.message ?? 'Não respondeu.')
  } finally {
    sending.value = false
  }
}

const toggleHidden = async (comment: InstagramComment) => {
  busyId.value = comment.id
  try {
    await adminService.setInstagramCommentHidden(comment.id, !comment.hidden)
    comment.hidden = !comment.hidden
  } catch (err: any) {
    toast.error(err.response?.data?.message ?? 'Não mudou a visibilidade.')
  } finally {
    busyId.value = null
  }
}

onMounted(fetchComments)
</script>

<style lang="stylus" scoped>
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
  width 560px
  max-width 95vw
  max-height 90vh
  display flex
  flex-direction column
  gap 10px
  h3
    margin 0

.modal__head
  display flex
  align-items baseline
  justify-content space-between
  gap 12px

.hint
  margin 0
  color rgba(255,255,255,0.45)
  font-size 0.78rem

.title
  white-space nowrap
  overflow hidden
  text-overflow ellipsis

.warn
  margin 0
  padding 10px 14px
  background rgba(251,191,36,0.08)
  border 1px solid rgba(251,191,36,0.3)
  border-radius 8px
  color #fbbf24
  font-size 0.85rem
  code
    font-size 0.8rem

.comments
  list-style none
  margin 0
  padding 0
  display flex
  flex-direction column
  gap 6px
  overflow-y auto
  min-height 0

.comment
  padding 8px 10px
  background rgba(0,0,0,0.25)
  border-radius 8px

.comment--reply
  margin-left 1.5rem
  background rgba(0,0,0,0.15)

.comment--hidden
  opacity 0.55

.comment__head
  display flex
  align-items center
  gap 8px
  flex-wrap wrap
  font-size 0.82rem

.comment__text
  margin 4px 0
  font-size 0.88rem
  white-space pre-line
  word-break break-word

.comment__actions
  display flex
  gap 12px

.hidden-badge
  padding 1px 8px
  border-radius 999px
  background rgba(251,191,36,0.12)
  color #fbbf24
  font-size 0.7rem
  font-weight 600

.reply-box
  display flex
  flex-direction column
  gap 6px
  label
    font-size 0.8rem
    font-weight 600
    color rgba(255,255,255,0.7)

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

.error-msg
  color #fc8181
  font-size 0.8rem
  margin 0

.modal-actions
  display flex
  justify-content flex-end
  gap 8px
  margin-top 0.5rem

.btn-link
  background none
  border none
  padding 0
  color rgba(255,255,255,0.5)
  font-size 0.78rem
  text-decoration none
  cursor pointer
  &:hover
    color #fff
  &:disabled
    opacity 0.5
    cursor not-allowed

.btn-primary
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
  padding 6px 12px
  background transparent
  border 1px solid rgba(255,255,255,0.12)
  border-radius 6px
  color rgba(255,255,255,0.65)
  font-size 0.85rem
  cursor pointer
  &:hover
    background rgba(255,255,255,0.06)
</style>
