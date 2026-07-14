<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <h1 class="page-title">Recomendações</h1>
        <p class="page-subtitle">{{ meta.total }} preferências registradas</p>
      </div>
    </header>

    <div class="filters-row">
      <div class="search-wrap">
        <Icon icon="mdi:magnify" class="search-icon" />
        <input
          v-model="search"
          type="search"
          placeholder="Buscar por herói ou usuário..."
          class="search-input"
          @input="onSearchInput"
        />
      </div>
    </div>

    <div class="section">
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Herói</th>
              <th>Score</th>
              <th>Fonte</th>
              <th>Atualizado em</th>
            </tr>
          </thead>
          <tbody>
            <template v-if="loading">
              <tr v-for="n in limit" :key="n" class="skeleton-row">
                <td><div class="skeleton" style="width:140px;height:14px" /></td>
                <td><div class="skeleton" style="width:100px;height:14px" /></td>
                <td><div class="skeleton" style="width:40px;height:14px" /></td>
                <td><div class="skeleton" style="width:80px;height:22px;border-radius:999px" /></td>
                <td><div class="skeleton" style="width:110px;height:14px" /></td>
              </tr>
            </template>
            <template v-else>
              <tr v-for="row in rows" :key="`${row.users?.uuid}-${row.hero_name}`">
                <td>
                  <div class="user-cell">
                    <img v-if="row.users?.avatar" :src="row.users.avatar" class="user-avatar" />
                    <div v-else class="user-avatar-placeholder">
                      <Icon icon="mdi:account" width="14" />
                    </div>
                    <div>
                      <span class="user-name">{{ row.users?.username ?? '—' }}</span>
                      <p class="row-sub">{{ row.users?.steam_id ?? '' }}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="hero-name">{{ row.hero_name }}</span>
                </td>
                <td>
                  <span class="score-badge">{{ row.score }}</span>
                </td>
                <td>
                  <span class="source-badge" :class="row.source === 'opendota' ? 'source-dota' : 'source-purchase'">
                    <Icon :icon="row.source === 'opendota' ? 'mdi:sword-cross' : 'mdi:cart-outline'" width="12" />
                    {{ row.source === 'opendota' ? 'OpenDota' : 'Compras' }}
                  </span>
                </td>
                <td class="text-muted">{{ formatDate(row.updated_at) }}</td>
              </tr>
              <tr v-if="!rows.length">
                <td colspan="5" class="empty-state">Nenhuma recomendação encontrada.</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div v-if="meta.totalPages > 1" class="pagination">
        <button class="page-btn" :disabled="page === 1" @click="goTo(page - 1)">
          <Icon icon="mdi:chevron-left" width="16" />
        </button>
        <span class="page-info">{{ page }} / {{ meta.totalPages }}</span>
        <button class="page-btn" :disabled="page === meta.totalPages" @click="goTo(page + 1)">
          <Icon icon="mdi:chevron-right" width="16" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { adminService } from '@/services/admin/admin.service'

const rows = ref<any[]>([])
const loading = ref(true)
const search = ref('')
const page = ref(1)
const limit = 20
const meta = ref({ total: 0, totalPages: 1 })

let searchTimeout: ReturnType<typeof setTimeout>

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

const loadData = async () => {
  loading.value = true
  try {
    const res = await adminService.getUserHeroPreferences(page.value, limit, search.value || undefined)
    rows.value = res.data.data
    meta.value = res.data.meta
  } finally {
    loading.value = false
  }
}

const onSearchInput = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    page.value = 1
    loadData()
  }, 350)
}

const goTo = (p: number) => {
  page.value = p
  loadData()
}

onMounted(loadData)
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

.filters-row
  display flex
  align-items center
  gap 0.75rem
  flex-wrap wrap
  margin-bottom 1.25rem

.search-wrap
  position relative
  flex 1
  min-width 220px

.search-icon
  position absolute
  left 10px
  top 50%
  transform translateY(-50%)
  color rgba(255,255,255,0.35)
  width 16px

.search-input
  width 100%
  background #1a1a1e
  border 1px solid rgba(255,255,255,0.08)
  border-radius 8px
  color #fff
  padding 0.5rem 0.75rem 0.5rem 2.1rem
  font-size 0.875rem
  outline none
  &:focus
    border-color rgba(99,102,241,0.5)

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

.user-cell
  display flex
  align-items center
  gap 0.6rem

.user-avatar
  width 32px
  height 32px
  border-radius 50%
  object-fit cover
  flex-shrink 0

.user-avatar-placeholder
  width 32px
  height 32px
  border-radius 50%
  background rgba(255,255,255,0.07)
  display flex
  align-items center
  justify-content center
  color rgba(255,255,255,0.35)
  flex-shrink 0

.user-name
  font-weight 600
  font-size 0.875rem

.row-sub
  color rgba(255,255,255,0.38)
  font-size 0.72rem
  margin 2px 0 0

.hero-name
  font-weight 500

.score-badge
  display inline-block
  background rgba(255,255,255,0.08)
  padding 1px 10px
  border-radius 999px
  font-size 0.8rem
  font-weight 700

.source-badge
  display inline-flex
  align-items center
  gap 4px
  padding 2px 10px
  border-radius 999px
  font-size 0.75rem
  font-weight 600

.source-dota
  background rgba(99,102,241,0.12)
  color #a5b4fc

.source-purchase
  background rgba(251,191,36,0.10)
  color #fbbf24

.text-muted
  color rgba(255,255,255,0.38)
  font-size 0.82rem

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

.pagination
  display flex
  align-items center
  justify-content flex-end
  gap 0.5rem
  padding 0.75rem 1rem
  border-top 1px solid rgba(255,255,255,0.05)

.page-btn
  background rgba(255,255,255,0.05)
  border 1px solid rgba(255,255,255,0.08)
  border-radius 6px
  color #fff
  width 30px
  height 30px
  display flex
  align-items center
  justify-content center
  cursor pointer
  &:hover:not(:disabled)
    background rgba(255,255,255,0.10)
  &:disabled
    opacity 0.3
    cursor not-allowed

.page-info
  font-size 0.8rem
  color rgba(255,255,255,0.45)
  min-width 50px
  text-align center
</style>
