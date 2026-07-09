<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { adminService, type SkinPriceCatalogItem } from '@/services/admin/admin.service'
import { formatCurrency } from '@/utils/formatCurrency'
import { Icon } from '@iconify/vue'

const router = useRouter()
const items = ref<SkinPriceCatalogItem[]>([])
const loading = ref(true)
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const limit = ref(20)
const searchQuery = ref('')
let searchTimeout: ReturnType<typeof setTimeout> | null = null

const fetchCatalog = async (page: number) => {
    loading.value = true
    try {
        const response = await adminService.getSkinsPriceCatalog(page, limit.value, searchQuery.value || undefined)
        if (response.data) {
            items.value = response.data.data
            totalPages.value = response.data.pages
            totalItems.value = response.data.total
            currentPage.value = response.data.page
        }
    } catch (error) {
        console.error('Erro ao buscar catálogo de preços:', error)
    } finally {
        loading.value = false
    }
}

const onSearchInput = () => {
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => fetchCatalog(1), 400)
}
const nextPage = () => { if (currentPage.value < totalPages.value) fetchCatalog(currentPage.value + 1) }
const prevPage = () => { if (currentPage.value > 1) fetchCatalog(currentPage.value - 1) }

onMounted(() => fetchCatalog(1))
</script>

<template>
    <div class="view-wrap">
        <header class="page-header">
            <div>
                <h1 class="page-title">Evolução de Preços</h1>
                <p class="page-subtitle">{{ totalItems }} skins no catálogo</p>
            </div>
        </header>

        <div class="filters-row">
            <div class="search-wrap">
                <Icon icon="mdi:magnify" class="search-icon" />
                <input
                    v-model="searchQuery"
                    @input="onSearchInput"
                    type="text"
                    placeholder="Buscar por nome..."
                    class="search-input"
                />
            </div>
        </div>

        <div class="section">
            <div v-if="loading" class="loading-state">Carregando catálogo...</div>
            <div v-else>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Skin</th>
                                <th>Menor Preço</th>
                                <th>Preço Mediano</th>
                                <th>Preço Catálogo</th>
                                <th>Última atualização</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="item in items"
                                :key="item.uuid"
                                class="row-clickable"
                                @click="router.push(`/skins/prices/${item.uuid}`)"
                            >
                                <td>
                                    <div class="item-cell">
                                        <img
                                            v-if="item.icon_url_large"
                                            :src="`https://steamcommunity-a.akamaihd.net/economy/image/${item.icon_url_large}/62fx62f`"
                                            class="item-thumb"
                                            alt=""
                                        />
                                        <div v-else class="item-thumb-placeholder">
                                            <Icon icon="mdi:sword" />
                                        </div>
                                        <div>
                                            <span class="item-name">{{ item.name }}</span>
                                            <small class="item-hero">{{ item.hero || '' }}</small>
                                        </div>
                                    </div>
                                </td>
                                <td class="price">{{ formatCurrency(item.lowest_price) }}</td>
                                <td class="price">{{ formatCurrency(item.median_price) }}</td>
                                <td class="price">{{ formatCurrency(item.manual_price) }}</td>
                                <td>{{ item.last_price_update_at ? $dayjs(item.last_price_update_at).format('DD/MM/YY HH:mm') : '—' }}</td>
                            </tr>
                            <tr v-if="items.length === 0">
                                <td colspan="5" class="empty-state">Nenhuma skin encontrada.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="pagination" v-if="totalPages > 1">
                    <button class="page-btn" :disabled="currentPage === 1" @click="prevPage">Anterior</button>
                    <span class="page-info">Página {{ currentPage }} de {{ totalPages }}</span>
                    <button class="page-btn" :disabled="currentPage === totalPages" @click="nextPage">Próxima</button>
                </div>
            </div>
        </div>
    </div>
</template>

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
    flex-wrap wrap
    margin-bottom 2rem

.page-title
    font-size 1.8rem
    font-weight 700
    margin-bottom 0.25rem

.page-subtitle
    color #94a3b8
    font-size 0.9rem

.filters-row
    display flex
    align-items center
    gap 0.75rem
    flex-wrap wrap
    margin-bottom 1.25rem

.search-wrap
    position relative
    flex 1
    min-width 200px

.search-icon
    position absolute
    left 0.65rem
    top 50%
    transform translateY(-50%)
    color #64748b
    font-size 1rem
    pointer-events none

.search-input
    width 100%
    background #1a1a1e
    border 1px solid rgba(255,255,255,0.08)
    border-radius 8px
    color #fff
    padding 0.5rem 0.75rem 0.5rem 2.1rem
    font-size 0.875rem
    outline none
    box-sizing border-box

    &::placeholder
        color #64748b

    &:focus
        border-color rgba(99,102,241,0.4)

.section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)

.loading-state
    padding 3rem
    text-align center
    color #94a3b8

.table-wrapper
    overflow-x auto
    margin-bottom 1.5rem

table
    width 100%
    border-collapse collapse

    th
        text-align left
        color #94a3b8
        font-size 0.78rem
        font-weight 500
        padding 0.75rem
        border-bottom 1px solid rgba(255,255,255,0.05)
        white-space nowrap
        text-transform uppercase

    td
        padding 0.85rem 0.75rem
        font-size 0.875rem
        border-bottom 1px solid rgba(255,255,255,0.04)
        vertical-align middle

        &.price
            font-weight 600
            color #4caf50

.row-clickable
    cursor pointer
    transition background 0.15s

    &:hover
        background rgba(255,255,255,0.03)

.item-cell
    display flex
    align-items center
    gap 0.625rem

.item-thumb
    width 40px
    height 40px
    object-fit contain
    border-radius 4px
    background rgba(255,255,255,0.04)

.item-thumb-placeholder
    width 40px
    height 40px
    border-radius 4px
    background rgba(255,255,255,0.05)
    display flex
    align-items center
    justify-content center
    color #64748b

.item-name
    display block
    font-weight 500
    font-size 0.85rem

.item-hero
    display block
    color #64748b
    font-size 0.73rem

.empty-state
    text-align center
    padding 3rem
    color #94a3b8

.pagination
    display flex
    justify-content flex-end
    align-items center
    gap 1rem
    padding-top 1rem
    border-top 1px solid rgba(255,255,255,0.05)

.page-btn
    background #2a2a30
    color #fff
    border 1px solid rgba(255,255,255,0.1)
    padding 0.45rem 1rem
    border-radius 6px
    cursor pointer
    font-size 0.85rem
    transition all 0.2s

    &:hover:not(:disabled)
        background #3a3a42

    &:disabled
        opacity 0.4
        cursor not-allowed

.page-info
    color #94a3b8
    font-size 0.875rem
</style>
