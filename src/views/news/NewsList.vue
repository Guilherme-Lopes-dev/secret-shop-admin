<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <h1 class="page-title">Novidades</h1>
        <p class="page-subtitle">{{ total }} novidades cadastradas</p>
      </div>
      <button class="btn-primary" @click="router.push('/news/new')">
        <Icon icon="mdi:plus" width="16" /> Nova novidade
      </button>
    </header>

    <div class="section">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Título</th>
              <th>Status</th>
              <th>Publicação</th>
              <th>Criado em</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <template v-if="loading">
              <tr v-for="n in 5" :key="n" class="skeleton-row">
                <td><div class="skeleton" style="width:200px;height:14px" /></td>
                <td><div class="skeleton" style="width:70px;height:22px;border-radius:999px" /></td>
                <td><div class="skeleton" style="width:110px;height:14px" /></td>
                <td><div class="skeleton" style="width:90px;height:14px" /></td>
                <td><div class="skeleton" style="width:100px;height:28px;border-radius:8px" /></td>
              </tr>
            </template>
            <template v-else>
              <tr v-for="item in news" :key="item.id">
                <td>
                  <span class="title-cell">{{ item.title }}</span>
                  <p v-if="item.cover_url" class="row-sub">Com imagem de capa</p>
                </td>
                <td>
                  <span class="status-badge" :class="statusClass(item)" :title="statusTooltip(item)">
                    {{ statusLabel(item) }}
                  </span>
                </td>
                <td>
                  <span v-if="item.published_at" class="text-muted">
                    {{ $dayjs(item.published_at).format('DD/MM/YY HH:mm') }}
                  </span>
                  <span v-else class="text-muted">Imediata</span>
                </td>
                <td class="text-muted">{{ $dayjs(item.created_at).format('DD/MM/YY') }}</td>
                <td>
                  <div class="action-row">
                    <button class="btn-view" @click="router.push(`/news/${item.id}/edit`)">Editar</button>
                    <button class="btn-danger" @click="confirmDelete(item)">Remover</button>
                  </div>
                </td>
              </tr>
              <tr v-if="!loading && news.length === 0">
                <td colspan="5" class="empty-state">Nenhuma novidade cadastrada.</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal">
        <h3>Remover novidade</h3>
        <p>Tem certeza que deseja remover <strong>{{ deleteTarget.title }}</strong>?</p>
        <p class="modal-hint">Esta ação é irreversível.</p>
        <div class="modal-actions">
          <button class="btn-ghost" @click="deleteTarget = null">Cancelar</button>
          <button class="btn-danger" :disabled="deleting" @click="doDelete">
            {{ deleting ? 'Removendo...' : 'Remover' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { adminService } from '@/services/admin/admin.service'

const router = useRouter()
const news = ref<any[]>([])
const total = ref(0)
const loading = ref(true)
const deleteTarget = ref<any>(null)
const deleting = ref(false)

const now = () => new Date()

const statusLabel = (item: any) => {
  if (!item.is_active) return 'Inativo'
  if (item.published_at && new Date(item.published_at) > now()) return 'Agendado'
  if (!item.published_at || new Date(item.published_at) <= now()) return 'Ativo'
  return 'Rascunho'
}

const statusClass = (item: any) => {
  const s = statusLabel(item)
  if (s === 'Ativo') return 'status-active'
  if (s === 'Agendado') return 'status-scheduled'
  if (s === 'Inativo') return 'status-inactive'
  return 'status-draft'
}

const statusTooltip = (item: any) => {
  if (!item.is_active) return 'Desativado manualmente — não aparece para usuários'
  if (item.published_at && new Date(item.published_at) > now()) return `Vai aparecer a partir de ${new Date(item.published_at).toLocaleString('pt-BR')}`
  if (!item.published_at) return 'Ativo imediatamente — aparece para usuários logados'
  return 'Ativo — aparece para usuários logados'
}

const fetchNews = async () => {
  loading.value = true
  try {
    const res = await adminService.getNewsList()
    news.value = res.data.data
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

const confirmDelete = (item: any) => { deleteTarget.value = item }

const doDelete = async () => {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await adminService.deleteNews(deleteTarget.value.id)
    news.value = news.value.filter((n) => n.id !== deleteTarget.value.id)
    total.value--
    deleteTarget.value = null
  } finally {
    deleting.value = false
  }
}

onMounted(fetchNews)
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

.status-badge
  display inline-block
  padding 2px 10px
  border-radius 999px
  font-size 0.75rem
  font-weight 600
  cursor default

.status-active
  background rgba(46,220,138,0.12)
  color #4ade80

.status-inactive
  background rgba(255,255,255,0.06)
  color rgba(255,255,255,0.45)

.status-scheduled
  background rgba(251,191,36,0.12)
  color #fbbf24

.status-draft
  background rgba(255,255,255,0.06)
  color rgba(255,255,255,0.4)

.action-row
  display flex
  gap 6px

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
  font-size 0.875rem
  cursor pointer
  &:hover
    background #4f46e5

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

.empty-state
  text-align center
  padding 2.5rem
  color rgba(255,255,255,0.35)
  font-size 0.9rem

.skeleton-row td
  padding 0.85rem 1rem

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

  h3
    margin 0 0 12px
    font-size 1.1rem
    font-weight 700

  p
    color rgba(255,255,255,0.7)
    font-size 0.9rem
    margin 0 0 8px

  strong
    color #fff

.modal-hint
  color rgba(255,255,255,0.4) !important
  font-size 0.8rem !important

.modal-actions
  display flex
  justify-content flex-end
  gap 8px
  margin-top 1.25rem
</style>
