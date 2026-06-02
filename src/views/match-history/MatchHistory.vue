<script setup lang="ts">
import { ref } from 'vue'
import Papa from 'papaparse'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { api } from '@/lib/api/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecentMatch {
  matchId: number
  heroId: number
  heroName: string
  won: boolean
  kills: number
  deaths: number
  assists: number
  durationSeconds: number
  startTime: number
}

interface PlayerMatchHistory {
  accountId: string
  steam64: string
  matches: RecentMatch[]
  error?: string
}

// ── State ─────────────────────────────────────────────────────────────────────

const accountIds = ref<string[]>([])
const results = ref<PlayerMatchHistory[]>([])
const expanded = ref<Set<string>>(new Set())
const loading = ref(false)
const fileName = ref('')

// ── CSV ───────────────────────────────────────────────────────────────────────

// Handles plain integers, markdown table pipes (|76561...|),
// and scientific notation with comma decimal (7,65611998466371E+016).
function parseSteamId(raw: string): string | null {
  const stripped = raw.replace(/\|/g, '').trim()
  if (!stripped) return null

  const normalized = stripped.replace(',', '.')

  const sciMatch = normalized.match(/^(\d+(?:\.\d+)?)[Ee]\+?(\d+)$/)
  if (sciMatch) {
    const mantissa = sciMatch[1]
    const exp = parseInt(sciMatch[2])
    const digits = mantissa.replace('.', '')
    const dotIdx = mantissa.indexOf('.')
    const fractLen = dotIdx === -1 ? 0 : mantissa.length - dotIdx - 1
    const shift = exp - fractLen
    if (shift < 0) return null
    return digits + '0'.repeat(shift)
  }

  if (/^\d+$/.test(stripped)) return stripped
  return null
}

function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  fileName.value = file.name

  Papa.parse<string[]>(file, {
    skipEmptyLines: true,
    complete(parsed) {
      const ids = parsed.data
        .flat()
        .map((v) => parseSteamId(String(v)))
        .filter((v): v is string => v !== null)

      accountIds.value = ids
      results.value = []
      expanded.value = new Set()
      toast.success(`${ids.length} IDs carregados`)
    },
    error() {
      toast.error('Erro ao ler o CSV')
    },
  })
}

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchHistory() {
  if (!accountIds.value.length) {
    toast.warning('Importe um CSV primeiro')
    return
  }

  loading.value = true
  results.value = []

  try {
    const { data } = await api.post<PlayerMatchHistory[]>(
      '/match-history/bulk',
      { accountIds: accountIds.value },
      { timeout: 120_000 },
    )
    results.value = data
    toast.success(`Dados carregados para ${data.length} usuários`)
  } catch {
    toast.error('Erro ao buscar histórico de partidas')
  } finally {
    loading.value = false
  }
}

// ── Accordion ─────────────────────────────────────────────────────────────────

function toggle(accountId: string) {
  if (expanded.value.has(accountId)) {
    expanded.value.delete(accountId)
  } else {
    expanded.value.add(accountId)
  }
  expanded.value = new Set(expanded.value)
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="match-history">
    <header class="page-header">
      <h1 class="page-title">Histórico de Partidas</h1>
      <p class="page-subtitle">Importe um CSV com accountIds para consultar partidas recentes via OpenDota</p>
    </header>

    <section class="controls">
      <label class="file-label">
        <Icon icon="mdi:file-upload-outline" class="file-icon" />
        <span>{{ fileName || 'Importar CSV' }}</span>
        <input type="file" accept=".csv" class="file-input" @change="onFileChange" />
      </label>

      <div v-if="accountIds.length" class="ids-badge">
        {{ accountIds.length }} usuários
      </div>

      <button
        class="btn-primary"
        :disabled="loading || !accountIds.length"
        @click="fetchHistory"
      >
        <Icon v-if="loading" icon="mdi:loading" class="spin" />
        <Icon v-else icon="mdi:magnify" />
        {{ loading ? 'Buscando...' : 'Buscar Partidas' }}
      </button>
    </section>

    <div v-if="loading" class="loading-state">
      <Icon icon="mdi:loading" class="spin big" />
      <p>Consultando OpenDota para {{ accountIds.length }} usuários...<br />Isso pode levar alguns minutos.</p>
    </div>

    <div v-else-if="results.length" class="results">
      <div
        v-for="player in results"
        :key="player.accountId"
        class="player-card"
      >
        <button class="player-header" @click="toggle(player.accountId)">
          <div class="player-info">
            <Icon icon="mdi:steam" class="steam-icon" />
            <div class="player-ids">
              <span class="player-account">accountId: {{ player.accountId }}</span>
              <span class="player-steam64">steam64: {{ player.steam64 }}</span>
            </div>
          </div>

          <div class="player-meta">
            <span v-if="player.error" class="badge badge--error">
              <Icon icon="mdi:alert-circle-outline" /> Erro
            </span>
            <span v-else class="badge badge--count">
              {{ player.matches.length }} partidas
            </span>
            <Icon
              :icon="expanded.has(player.accountId) ? 'mdi:chevron-up' : 'mdi:chevron-down'"
              class="chevron"
            />
          </div>
        </button>

        <div v-if="expanded.has(player.accountId)" class="player-body">
          <div v-if="player.error" class="error-msg">
            <Icon icon="mdi:alert" /> {{ player.error }}
          </div>

          <div v-else-if="!player.matches.length" class="empty-msg">
            Nenhuma partida encontrada
          </div>

          <table v-else class="matches-table">
            <thead>
              <tr>
                <th>Herói</th>
                <th>Resultado</th>
                <th>K / D / A</th>
                <th>Duração</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="match in player.matches" :key="match.matchId">
                <td class="hero-cell">{{ match.heroName }}</td>
                <td>
                  <span :class="match.won ? 'result result--win' : 'result result--loss'">
                    {{ match.won ? 'Vitória' : 'Derrota' }}
                  </span>
                </td>
                <td class="kda-cell">{{ match.kills }} / {{ match.deaths }} / {{ match.assists }}</td>
                <td>{{ formatDuration(match.durationSeconds) }}</td>
                <td class="date-cell">{{ formatDate(match.startTime) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="stylus" scoped>
.match-history
  padding 2rem
  max-width 1100px
  margin 0 auto

.page-header
  margin-bottom 2rem

.page-title
  font-size 1.5rem
  font-weight 700
  color #fff
  margin 0 0 0.5rem

.page-subtitle
  color #64748b
  font-size 0.875rem
  margin 0

.controls
  display flex
  align-items center
  gap 1rem
  margin-bottom 2rem
  flex-wrap wrap

.file-label
  display flex
  align-items center
  gap 0.5rem
  padding 0.6rem 1rem
  background #1e1e24
  border 1px solid rgba(255,255,255,0.08)
  border-radius 8px
  color #94a3b8
  cursor pointer
  font-size 0.875rem
  transition all 0.15s

  &:hover
    border-color #6366f1
    color #fff

.file-icon
  font-size 1.1rem

.file-input
  display none

.ids-badge
  padding 0.35rem 0.75rem
  background rgba(99,102,241,0.12)
  border 1px solid rgba(99,102,241,0.3)
  border-radius 6px
  color #818cf8
  font-size 0.8rem
  font-weight 600

.btn-primary
  display flex
  align-items center
  gap 0.5rem
  padding 0.6rem 1.25rem
  background #6366f1
  border none
  border-radius 8px
  color #fff
  font-size 0.875rem
  font-weight 600
  cursor pointer
  transition background 0.15s

  &:hover:not(:disabled)
    background #4f46e5

  &:disabled
    opacity 0.5
    cursor not-allowed

.loading-state
  display flex
  flex-direction column
  align-items center
  gap 1rem
  padding 4rem 2rem
  color #64748b
  text-align center
  line-height 1.6

.spin
  animation spin 1s linear infinite

.big
  font-size 2.5rem

@keyframes spin
  to
    transform rotate(360deg)

.results
  display flex
  flex-direction column
  gap 0.5rem

.player-card
  background #1a1a20
  border 1px solid rgba(255,255,255,0.06)
  border-radius 10px
  overflow hidden

.player-header
  display flex
  align-items center
  justify-content space-between
  width 100%
  padding 0.9rem 1.25rem
  background transparent
  border none
  color #fff
  cursor pointer
  text-align left
  transition background 0.15s

  &:hover
    background rgba(255,255,255,0.03)

.player-info
  display flex
  align-items center
  gap 0.75rem

.steam-icon
  font-size 1.4rem
  color #64748b

.player-ids
  display flex
  flex-direction column
  gap 0.15rem

.player-account
  font-size 0.8rem
  color #94a3b8

.player-steam64
  font-size 0.75rem
  color #475569
  font-family monospace

.player-meta
  display flex
  align-items center
  gap 0.75rem

.badge
  display flex
  align-items center
  gap 0.3rem
  padding 0.2rem 0.6rem
  border-radius 4px
  font-size 0.75rem
  font-weight 600

  &--count
    background rgba(99,102,241,0.12)
    color #818cf8

  &--error
    background rgba(239,68,68,0.12)
    color #f87171

.chevron
  color #64748b
  font-size 1.1rem

.player-body
  border-top 1px solid rgba(255,255,255,0.06)
  padding 0 1.25rem 1rem

.error-msg
  display flex
  align-items center
  gap 0.5rem
  padding 1rem 0
  color #f87171
  font-size 0.875rem

.empty-msg
  padding 1rem 0
  color #475569
  font-size 0.875rem

.matches-table
  width 100%
  border-collapse collapse
  font-size 0.8rem
  margin-top 0.75rem

  th
    text-align left
    padding 0.5rem 0.75rem
    color #475569
    font-weight 600
    border-bottom 1px solid rgba(255,255,255,0.06)

  td
    padding 0.5rem 0.75rem
    color #94a3b8
    border-bottom 1px solid rgba(255,255,255,0.04)

  tr:last-child td
    border-bottom none

  tr:hover td
    background rgba(255,255,255,0.02)

.hero-cell
  color #e2e8f0
  font-weight 500

.result
  display inline-block
  padding 0.15rem 0.5rem
  border-radius 4px
  font-weight 600
  font-size 0.75rem

  &--win
    background rgba(34,197,94,0.15)
    color #4ade80

  &--loss
    background rgba(239,68,68,0.15)
    color #f87171

.kda-cell
  font-family monospace
  color #cbd5e1

.date-cell
  color #475569
  white-space nowrap
</style>
