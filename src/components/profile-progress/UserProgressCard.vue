<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { adminService } from '@/services/admin/admin.service'
import type { ProfileProgressDto } from '@/services/admin/types'

const props = defineProps<{ userUuid: string }>()

const data = ref<ProfileProgressDto | null>(null)
const loading = ref(true)
const error = ref('')

const fetchProgress = async () => {
  const requestedUuid = props.userUuid
  if (!requestedUuid) return

  loading.value = true
  error.value = ''

  try {
    const response = await adminService.getUserProfileProgress(requestedUuid)
    if (requestedUuid !== props.userUuid) return
    data.value = response.data
  } catch (e: any) {
    if (requestedUuid !== props.userUuid) return
    error.value = e?.response?.data?.message || 'Erro ao carregar progresso.'
  } finally {
    if (requestedUuid === props.userUuid) loading.value = false
  }
}

const progressPct = computed(() => {
  if (!data.value) return 0
  return Math.min(100, Math.max(0, data.value.progress_pct))
})

const remainingXp = computed(() => {
  if (!data.value?.next_tier_xp) return null
  return data.value.next_tier_xp - data.value.xp
})

const achievementXp = computed(() => {
  if (!data.value) return 0
  return data.value.xp - data.value.purchase_xp
})

const formatDate = (iso: string | null) => {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

onMounted(fetchProgress)
watch(() => props.userUuid, fetchProgress)
</script>

<template>
  <section class="progress-section">
    <div class="progress-header">
      <div class="progress-header__title">
        <Icon icon="mdi:shield-star" width="20" />
        <h2>Nível do Perfil</h2>
      </div>
      <span v-if="data" class="tier-badge">Nível {{ data.tier }} / {{ data.tier_max }}</span>
    </div>

    <div v-if="loading" class="state state--loading">Carregando progresso...</div>
    <div v-else-if="error" class="state state--error">{{ error }}</div>

    <template v-else-if="data">
      <div class="progress-metrics">
        <div class="metric">
          <span class="metric__label">XP total</span>
          <span class="metric__value">{{ data.xp.toLocaleString('pt-BR') }}</span>
        </div>
        <div class="metric">
          <span class="metric__label">XP de compras</span>
          <span class="metric__value">
            {{ data.purchase_xp.toLocaleString('pt-BR') }}
            <small>{{ data.purchase_count }} compra(s)</small>
          </span>
        </div>
        <div class="metric">
          <span class="metric__label">XP de conquistas</span>
          <span class="metric__value">{{ achievementXp.toLocaleString('pt-BR') }}</span>
        </div>
      </div>

      <div class="progress-block">
        <div class="progress-block__heads">
          <span class="progress-tier">Nível {{ data.tier }}</span>
          <span v-if="data.next_tier_xp" class="progress-tier progress-tier--next">
            Nível {{ data.tier + 1 }}
          </span>
          <span v-else class="progress-tier progress-tier--next">Nível máximo</span>
        </div>

        <div class="progress-bar">
          <div class="progress-bar__fill" :style="{ width: `${progressPct}%` }" />
        </div>

        <div class="progress-block__footer">
          <span v-if="remainingXp">
            Faltam <strong>{{ remainingXp }} XP</strong> para o próximo nível ({{ progressPct }}%)
          </span>
          <span v-else>Nível máximo atingido</span>
        </div>
      </div>

      <div class="achievements">
        <div
          v-for="achievement in data.achievements"
          :key="achievement.code"
          class="achievement"
          :class="{ 'achievement--done': achievement.done }"
        >
          <Icon
            :icon="achievement.done ? 'mdi:check-circle' : 'mdi:circle-outline'"
            width="18"
            class="achievement__icon"
          />
          <div class="achievement__text">
            <span class="achievement__label">{{ achievement.label }}</span>
            <span class="achievement__date">
              {{ achievement.done ? formatDate(achievement.awarded_at) : 'Pendente' }}
            </span>
          </div>
          <span class="achievement__xp">+{{ achievement.xp }}</span>
        </div>
      </div>
    </template>
  </section>
</template>

<style lang="stylus" scoped>
.progress-section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)
    margin-bottom 1.5rem

.progress-header
    display flex
    align-items center
    justify-content space-between
    gap 1rem
    flex-wrap wrap
    margin-bottom 1.25rem
    padding-bottom 0.75rem
    border-bottom 1px solid rgba(255,255,255,0.05)

    &__title
        display flex
        align-items center
        gap 0.5rem
        color #e2e8f0

        h2
            font-size 1rem
            font-weight 600
            margin 0

.tier-badge
    padding 3px 10px
    border-radius 5px
    font-size 0.72rem
    font-weight 700
    text-transform uppercase
    letter-spacing 0.03em
    background rgba(129,84,255,0.14)
    color #a78bfa

.state
    padding 2rem
    text-align center

    &--loading
        color #94a3b8

    &--error
        color #f44336

.progress-metrics
    display grid
    grid-template-columns repeat(3, 1fr)
    gap 0.75rem
    margin-bottom 1.5rem

    @media (max-width: 600px)
        grid-template-columns 1fr

.metric
    background rgba(255,255,255,0.02)
    border 1px solid rgba(255,255,255,0.04)
    border-radius 8px
    padding 0.75rem 0.9rem
    display flex
    flex-direction column
    gap 0.25rem

    &__label
        font-size 0.72rem
        color #64748b
        text-transform uppercase
        letter-spacing 0.04em

    &__value
        font-size 1.05rem
        font-weight 700
        color #e2e8f0

        small
            display block
            font-size 0.7rem
            font-weight 500
            color #64748b
            margin-top 2px

.progress-block
    margin-bottom 1.5rem

    &__heads
        display flex
        justify-content space-between
        font-size 0.78rem
        font-weight 600
        text-transform uppercase
        letter-spacing 0.05em
        margin-bottom 0.5rem

    &__footer
        margin-top 0.5rem
        font-size 0.8rem
        color #94a3b8

        strong
            color #e2e8f0

.progress-tier
    color #a78bfa

    &--next
        color #64748b

.progress-bar
    width 100%
    height 8px
    background rgba(255,255,255,0.05)
    border-radius 999px
    overflow hidden

    &__fill
        height 100%
        border-radius 999px
        background linear-gradient(90deg, #3d8bc2, #8154ff)
        transition width 0.3s ease

.achievements
    display grid
    grid-template-columns repeat(2, 1fr)
    gap 0.6rem
    padding-top 0.75rem
    border-top 1px solid rgba(255,255,255,0.05)

    @media (max-width: 600px)
        grid-template-columns 1fr

.achievement
    display flex
    align-items center
    gap 0.6rem
    padding 0.6rem 0.75rem
    border-radius 8px
    background rgba(255,255,255,0.02)
    border 1px solid rgba(255,255,255,0.04)
    opacity 0.6

    &--done
        opacity 1

        .achievement__icon
            color #4caf50

    &__icon
        flex-shrink 0
        color #64748b

    &__text
        display flex
        flex-direction column
        gap 1px
        flex 1
        min-width 0

    &__label
        font-size 0.8rem
        font-weight 600
        color #e2e8f0

    &__date
        font-size 0.7rem
        color #64748b

    &__xp
        flex-shrink 0
        font-size 0.78rem
        font-weight 700
        color #a78bfa
</style>
