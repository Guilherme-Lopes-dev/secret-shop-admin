<template>
  <div class="view-wrap">
    <header class="page-header">
      <h1 class="page-title">Interações no Instagram</h1>
      <p class="page-subtitle">Alcance da conta, desempenho de cada post e comentários</p>
    </header>

    <InstagramOverview @refreshed="loadAll" />

    <section v-for="section in sections" :key="section.key" class="section">
      <h2 class="section-title">{{ section.title }}</h2>
      <p class="hint">{{ section.hint }}</p>

      <p v-if="loading" class="hint">Carregando...</p>
      <p v-else-if="section.error" class="error-msg">{{ section.error }}</p>
      <p v-else-if="!section.rows.length" class="hint">{{ section.empty }}</p>
      <ul v-else class="posts">
        <li v-for="row in section.rows" :key="row.key" class="post">
          <img v-if="row.thumb" :src="row.thumb" referrerpolicy="no-referrer" class="post__thumb" alt="" />
          <div v-else class="post__thumb post__thumb--empty"><Icon icon="mdi:image-off-outline" width="20" /></div>
          <div class="post__info">
            <div class="post__meta">
              <span class="kind-badge">{{ row.badge }}</span>
              <span class="hint">{{ when(row.date) }}</span>
            </div>
            <p class="post__title">{{ row.title }}</p>
            <div class="post__stats">
              <span v-for="stat in row.stats" :key="stat.key" :title="stat.label">
                <Icon :icon="stat.icon" width="14" /> {{ stat.value.toLocaleString('pt-BR') }}
              </span>
              <span v-if="row.statsError" class="stats-error" :title="row.statsError">
                <Icon icon="mdi:alert-outline" width="14" /> métricas indisponíveis
              </span>
              <span v-else-if="!row.stats.length" class="hint">sem métricas</span>
            </div>
            <small v-if="row.insightsAt" class="hint">métricas de {{ when(row.insightsAt) }}</small>
          </div>
          <div class="post__actions">
            <button v-if="row.mediaId" type="button" class="btn-ghost" @click="commentsRow = row">
              <Icon icon="mdi:comment-text-outline" width="14" /> Comentários
            </button>
            <a v-if="row.permalink" :href="row.permalink" target="_blank" rel="noopener" class="btn-ghost">
              Ver no Instagram
            </a>
          </div>
        </li>
      </ul>
    </section>

    <CommentsModal
      v-if="commentsRow?.mediaId"
      :media-id="commentsRow.mediaId"
      :title="commentsRow.title"
      :permalink="commentsRow.permalink"
      :expected="commentsRow.commentsCount"
      :own-username="ownUsername"
      @close="commentsRow = null"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import { mediaUrl } from '@/utils/mediaUrl'
import { adminService, type InstagramMedia, type InstagramStory } from '@/services/admin/admin.service'
import CommentsModal from './CommentsModal.vue'
import InstagramOverview from './InstagramOverview.vue'

type Stat = { key: string; label: string; icon: string; value: number }
type Row = {
  key: string
  thumb: string | null
  badge: string
  date: string
  title: string
  stats: Stat[]
  // Meta recusou as métricas do post (rate limit etc.); diferente de "não tem".
  statsError: string | null
  insightsAt: string | null
  // Só post do perfil abre comentários; story não tem.
  mediaId: string | null
  commentsCount: number | null
  permalink: string | null
}

const POST_STATS = [
  { key: 'likes', label: 'Curtidas', icon: 'mdi:heart-outline' },
  { key: 'comments', label: 'Comentários', icon: 'mdi:comment-outline' },
  { key: 'reach', label: 'Alcance (contas únicas)', icon: 'mdi:account-eye-outline' },
  { key: 'views', label: 'Views', icon: 'mdi:eye-outline' },
  { key: 'saved', label: 'Salvos', icon: 'mdi:bookmark-outline' },
  { key: 'shares', label: 'Compartilhamentos', icon: 'mdi:share-outline' },
  { key: 'replies', label: 'Respostas ao story', icon: 'mdi:reply-outline' },
]

const MEDIA_LABEL: Record<string, string> = { IMAGE: 'Foto', VIDEO: 'Vídeo', CAROUSEL_ALBUM: 'Carrossel' }

const media = ref<InstagramMedia[]>([])
const stories = ref<InstagramStory[]>([])
const mediaError = ref('')
const storiesError = ref('')
const loading = ref(true)
const commentsRow = ref<Row | null>(null)
const ownUsername = ref<string | null>(null)

const when = (date: string) => dayjs(date).format('DD/MM/YY HH:mm')
const errorMessage = (err: any, fallback: string): string => err.response?.data?.message ?? fallback

const statsOf = (metrics: Record<string, number | undefined>): Stat[] =>
  POST_STATS.filter((stat) => metrics[stat.key] != null).map((stat) => ({ ...stat, value: metrics[stat.key]! }))

const mediaLabel = (item: InstagramMedia) =>
  item.media_product_type === 'REELS' ? 'Reels' : (MEDIA_LABEL[item.media_type] ?? 'Post')

// Legenda inteira não cabe na linha: título é a 1ª linha.
const firstLine = (text?: string) => text?.split('\n')[0]?.trim() || 'Sem legenda'

// Contagem da lista só vale se a Meta não tiver insights do post.
const mediaRow = (item: InstagramMedia): Row => {
  const metrics = { likes: item.like_count, comments: item.comments_count, ...item.insights }
  return {
    key: item.id,
    thumb: item.thumbnail_url ?? item.media_url ?? null,
    badge: mediaLabel(item),
    date: item.timestamp,
    title: firstLine(item.caption),
    stats: statsOf(metrics),
    statsError: item.insights_error,
    insightsAt: null,
    mediaId: item.id,
    commentsCount: metrics.comments ?? null,
    permalink: item.permalink,
  }
}

const storyRow = (story: InstagramStory): Row => ({
  key: story.id,
  thumb: story.image_url ? mediaUrl(story.image_url) : null,
  badge: 'Story',
  date: story.published_at,
  title: story.subject ?? 'Sem produto',
  stats: statsOf(story.insights ?? {}),
  statsError: null,
  insightsAt: story.insights_at,
  mediaId: null,
  commentsCount: null,
  permalink: story.permalink,
})

const sections = computed(() => [
  {
    key: 'media',
    title: 'Posts do perfil',
    hint: 'Os 25 mais recentes, inclusive os postados pelo app. Métricas ao vivo.',
    empty: 'Nenhum post no perfil.',
    error: mediaError.value,
    rows: media.value.map(mediaRow),
  },
  {
    key: 'stories',
    title: 'Stories publicados pelo painel',
    hint: 'A Meta apaga as métricas do story em 24h; aqui fica o último snapshot (de hora em hora). Story postado pelo app não entra.',
    empty: 'Nenhum story publicado pelo painel ainda.',
    error: storiesError.value,
    rows: stories.value.map(storyRow),
  },
])

const loadMedia = async () => {
  mediaError.value = ''
  try {
    const { data } = await adminService.getInstagramMedia()
    media.value = data
  } catch (err: any) {
    mediaError.value = errorMessage(err, 'Não carregou os posts do perfil.')
  }
}

const loadStories = async () => {
  storiesError.value = ''
  try {
    const { data } = await adminService.getInstagramStories()
    stories.value = data
  } catch (err: any) {
    storiesError.value = errorMessage(err, 'Não carregou os stories.')
  }
}

const loadAll = async () => {
  await Promise.all([loadMedia(), loadStories()])
  loading.value = false
}

// Se falhar, o modal só deixa de esconder o "Ocultar" nos comentários da loja; não vale erro na tela.
const loadOwnUsername = async () => {
  const { data } = await adminService.getInstagramAccount().catch(() => ({ data: null }))
  ownUsername.value = data?.username ?? null
}

onMounted(() => {
  loadAll()
  loadOwnUsername()
})
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
  gap 10px

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

.posts
  list-style none
  margin 0
  padding 0
  display flex
  flex-direction column
  gap 8px

.post
  display flex
  align-items center
  gap 14px
  padding 10px
  background rgba(0,0,0,0.25)
  border-radius 10px
  @media (max-width: 700px)
    flex-wrap wrap

.post__thumb
  width 56px
  height 56px
  border-radius 6px
  object-fit cover
  flex-shrink 0

.post__thumb--empty
  display grid
  place-items center
  background rgba(255,255,255,0.05)
  color rgba(255,255,255,0.3)

.post__info
  flex 1
  min-width 0
  display flex
  flex-direction column
  gap 4px

.post__meta
  display flex
  align-items center
  gap 8px

.kind-badge
  padding 2px 8px
  border-radius 6px
  background rgba(255,255,255,0.08)
  font-size 0.72rem
  font-weight 600
  text-transform uppercase
  letter-spacing 0.04em

.post__title
  margin 0
  font-size 0.88rem
  font-weight 600
  white-space nowrap
  overflow hidden
  text-overflow ellipsis

.post__stats
  display flex
  align-items center
  gap 14px
  flex-wrap wrap
  font-size 0.82rem
  font-variant-numeric tabular-nums
  color rgba(255,255,255,0.85)
  span
    display inline-flex
    align-items center
    gap 4px

.stats-error
  color #fbbf24

.post__actions
  display flex
  gap 6px
  flex-shrink 0

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
  text-decoration none
  cursor pointer
  &:hover
    background rgba(255,255,255,0.06)
</style>
