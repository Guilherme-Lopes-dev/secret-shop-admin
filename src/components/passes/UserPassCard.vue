<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { adminService } from '@/services/admin/admin.service'
import type { PassProgressDto } from '@/services/admin/types'

const formatBrl = (value: number | null | undefined): string => {
  if (value == null) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const props = defineProps<{ userUuid: string }>()

const data = ref<PassProgressDto | null>(null)
const loading = ref(true)
const error = ref('')

const fetchProgress = async () => {
  const requestedUuid = props.userUuid
  if (!requestedUuid) return
  loading.value = true
  error.value = ''
  try {
    const response = await adminService.getUserPassProgress(requestedUuid)
    if (requestedUuid !== props.userUuid) return
    data.value = response.data
  } catch (e: any) {
    if (requestedUuid !== props.userUuid) return
    error.value = e?.response?.data?.message || 'Erro ao carregar pass.'
  } finally {
    if (requestedUuid === props.userUuid) loading.value = false
  }
}

const currentColor = computed(() => {
  if (!data.value) return '#94a3b8'
  return data.value.all_tiers.find((t) => t.is_current)?.color ?? '#94a3b8'
})

const progressPct = computed(() => {
  if (!data.value) return 0
  return Math.min(100, Math.max(0, data.value.progress_percent))
})

const formatDate = (iso: string | null) => {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const seasonRange = computed(() => {
  if (!data.value) return null
  const start = formatDate(data.value.season_start)
  const end = formatDate(data.value.season_end)
  if (start && end) return `${start} → ${end}`
  if (end) return `até ${end}`
  return null
})

onMounted(fetchProgress)
watch(() => props.userUuid, fetchProgress)
</script>

<template>
  <section class="pass-section">
    <div class="pass-header">
      <div class="pass-header__title">
        <Icon icon="mdi:trophy-variant" width="20" />
        <h2>Secret Pass</h2>
      </div>
      <div v-if="data" class="pass-header__badges">
        <span
          class="status-badge"
          :class="data.pass_active ? 'status-active' : 'status-inactive'"
        >
          {{ data.pass_active ? 'Ativo' : 'Inativo' }}
        </span>
        <span
          class="tier-badge"
          :style="{ background: `${currentColor}22`, color: currentColor }"
        >
          {{ data.current_tier.name }}
        </span>
      </div>
    </div>

    <div v-if="loading" class="state state--loading">Carregando pass...</div>
    <div v-else-if="error" class="state state--error">{{ error }}</div>

    <template v-else-if="data">
      <div class="pass-metrics">
        <div class="metric">
          <span class="metric__label">Pontos</span>
          <span class="metric__value">{{ (data.points_balance ?? 0).toLocaleString('pt-BR') }}</span>
        </div>
        <div class="metric">
          <span class="metric__label">Gasto acumulado</span>
          <span class="metric__value">{{ formatBrl(data.total_spent_brl) }}</span>
        </div>
        <div class="metric">
          <span class="metric__label">Cashback ativo</span>
          <span class="metric__value">
            {{ data.cashback_benefit ? `${data.cashback_benefit.percentage}%` : '—' }}
          </span>
        </div>
      </div>

      <div class="progress-block">
        <div class="progress-block__heads">
          <span class="progress-tier" :style="{ color: currentColor }">
            {{ data.current_tier.name }}
          </span>
          <span v-if="data.next_tier" class="progress-tier progress-tier--next">
            {{ data.next_tier.name }}
          </span>
          <span v-else class="progress-tier progress-tier--next">Tier máximo</span>
        </div>

        <div class="progress-bar">
          <div
            class="progress-bar__fill"
            :style="{ width: `${progressPct}%`, background: currentColor }"
          />
        </div>

        <div class="progress-block__footer">
          <span v-if="data.points_to_next_tier !== null">
            Faltam <strong>{{ formatBrl(data.points_to_next_tier) }}</strong> em compras p/ próximo tier
            ({{ progressPct }}%)
          </span>
          <span v-else>Tier máximo atingido</span>
        </div>
      </div>

      <div class="ladder">
        <div
          v-for="tier in data.all_tiers"
          :key="tier.rank"
          class="ladder__item"
          :class="{
            'ladder__item--unlocked': tier.unlocked,
            'ladder__item--current':  tier.is_current,
          }"
        >
          <div
            class="ladder__dot"
            :style="{
              background: tier.unlocked ? tier.color : 'rgba(255,255,255,0.08)',
              borderColor: tier.is_current ? tier.color : 'transparent',
            }"
          >
            <Icon v-if="tier.unlocked && !tier.is_current" icon="mdi:check" width="12" />
            <Icon v-else-if="tier.is_current" icon="mdi:star" width="12" />
          </div>
          <span class="ladder__name">{{ tier.name }}</span>
          <span class="ladder__min">{{ formatBrl(tier.min_spent_brl) }}</span>
        </div>
      </div>

      <div class="footer-info">
        <div class="footer-info__row">
          <Icon icon="mdi:trending-down" width="16" />
          <span>
            Decay: −{{ data.decay_info.weekly_decay_points }} pts/semana
            após {{ data.decay_info.inactivity_days_trigger }}d sem compra
          </span>
        </div>
        <div v-if="seasonRange" class="footer-info__row">
          <Icon icon="mdi:calendar-range" width="16" />
          <span>Season: {{ seasonRange }}</span>
        </div>
      </div>
    </template>
  </section>
</template>

<style lang="stylus" scoped>
.pass-section
    background #1a1a1e
    padding 1.5rem
    border-radius 12px
    border 1px solid rgba(255,255,255,0.05)
    margin-bottom 1.5rem

.pass-header
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

    &__badges
        display flex
        align-items center
        gap 0.5rem
        flex-wrap wrap

.status-badge
    padding 3px 8px
    border-radius 5px
    font-size 0.72rem
    font-weight 600
    text-transform uppercase

.status-active
    background rgba(76,175,80,0.12)
    color #4caf50

.status-inactive
    background rgba(244,67,54,0.12)
    color #f44336

.tier-badge
    padding 3px 10px
    border-radius 5px
    font-size 0.72rem
    font-weight 700
    text-transform uppercase
    letter-spacing 0.03em

.state
    padding 2rem
    text-align center

    &--loading
        color #94a3b8

    &--error
        color #f44336

.pass-metrics
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
    color #94a3b8

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
        transition width 0.3s ease

.ladder
    display flex
    align-items flex-start
    gap 0.5rem
    overflow-x auto
    padding-bottom 0.5rem
    margin-bottom 1.25rem

    &__item
        flex 1
        min-width 70px
        display flex
        flex-direction column
        align-items center
        gap 0.3rem
        text-align center
        opacity 0.55
        transition opacity 0.15s

        &--unlocked
            opacity 1

        &--current
            opacity 1

            .ladder__name
                color #e2e8f0
                font-weight 700

    &__dot
        width 26px
        height 26px
        border-radius 50%
        border 2px solid transparent
        display flex
        align-items center
        justify-content center
        color #fff

    &__name
        font-size 0.72rem
        color #94a3b8
        font-weight 500

    &__min
        font-size 0.68rem
        color #64748b

.footer-info
    display flex
    flex-direction column
    gap 0.4rem
    padding-top 0.75rem
    border-top 1px solid rgba(255,255,255,0.05)

    &__row
        display flex
        align-items center
        gap 0.4rem
        font-size 0.78rem
        color #94a3b8
</style>
