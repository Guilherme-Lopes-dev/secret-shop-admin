<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Papa from 'papaparse'
import { Icon } from '@iconify/vue'
import { toast } from 'vue3-toastify'
import { adminService } from '@/services/admin/admin.service'

// ── Types ────────────────────────────────────────────────────────────────────

interface BlastUser {
  id: string
  username: string | null
  email: string | null
  contact: string
  sales_count: number
  total_spent: number
  tier_rank: number
  tier_name: string
}

interface CsvContact {
  id: string
  phone: string
  name: string
}

// ── LocalStorage keys ────────────────────────────────────────────────────────

const LS_CSV_CONTACTS = 'wpp_blast_csv_contacts'
const LS_SENT_PHONES  = 'wpp_blast_sent_phones'

// ── Constants ────────────────────────────────────────────────────────────────

const TIERS = [
  { rank: 0, name: 'Common',    color: '#B0C3D9' },
  { rank: 1, name: 'Uncommon',  color: '#5E98D9' },
  { rank: 2, name: 'Rare',      color: '#4B69FF' },
  { rank: 3, name: 'Mythical',  color: '#8847FF' },
  { rank: 4, name: 'Legendary', color: '#D32CE6' },
  { rank: 5, name: 'Ancient',   color: '#EB4B4B' },
  { rank: 6, name: 'Immortal',  color: '#E4AE33' },
]

const SEGMENTS = [
  { value: 'all',          label: 'Todos com WhatsApp',   icon: 'mdi:whatsapp'     },
  { value: 'no_purchases', label: 'Sem compras',           icon: 'mdi:cart-off'     },
  { value: 'top_buyers',   label: 'Maiores compradores',   icon: 'mdi:trending-up'  },
  { value: 'low_buyers',   label: 'Menores compradores',   icon: 'mdi:trending-down'},
]

// ── Mode ─────────────────────────────────────────────────────────────────────

const mode = ref<'filters' | 'csv'>('filters')

function switchMode(next: 'filters' | 'csv') {
  mode.value = next
  selectedIds.value = new Set()
  result.value = null
  error.value = null
}

// ── Filters mode state ───────────────────────────────────────────────────────

const segment      = ref('all')
const previewLimit = ref(500)
const tierRank     = ref<number | ''>('')
const users        = ref<BlastUser[]>([])
const loadingPreview = ref(false)

async function loadPreview() {
  loadingPreview.value = true
  error.value = null
  result.value = null
  selectedIds.value = new Set()

  try {
    const res = await adminService.previewWhatsappBlast(
      segment.value,
      previewLimit.value,
      tierRank.value === '' ? undefined : tierRank.value,
    )
    users.value = res.data
  } catch (e: any) {
    error.value = e?.message ?? 'Erro ao buscar usuários.'
  } finally {
    loadingPreview.value = false
  }
}

// ── Sent phones history ──────────────────────────────────────────────────────

const sentPhones = ref<Set<string>>(new Set())

function loadSentPhones() {
  try {
    const raw = localStorage.getItem(LS_SENT_PHONES)
    if (raw) sentPhones.value = new Set(JSON.parse(raw) as string[])
  } catch {}
}

function stripCsvNoise(phone: string): string {
  return phone.replace(/^'+/, '').trim()
}

function markPhonesAsSent(phones: string[]) {
  const next = new Set(sentPhones.value)
  phones.forEach((p) => next.add(stripCsvNoise(p)))
  sentPhones.value = next
  localStorage.setItem(LS_SENT_PHONES, JSON.stringify([...next]))
}

// ── Shared selection (declared early — used by CSV parse + reset below) ───────

const selectedIds = ref<Set<string>>(new Set())

// ── CSV filter & quick-select ────────────────────────────────────────────────

const csvFilter      = ref<'all' | 'sent' | 'not_sent'>('all')
const csvSelectLimit = ref<number | ''>('')

const filteredCsvContacts = computed(() => {
  if (csvFilter.value === 'sent')
    return csvContacts.value.filter((c) => sentPhones.value.has(stripCsvNoise(c.phone)))
  if (csvFilter.value === 'not_sent')
    return csvContacts.value.filter((c) => !sentPhones.value.has(stripCsvNoise(c.phone)))
  return csvContacts.value
})

const sentCount    = computed(() => csvContacts.value.filter((c) => sentPhones.value.has(stripCsvNoise(c.phone))).length)
const notSentCount = computed(() => csvContacts.value.filter((c) => !sentPhones.value.has(stripCsvNoise(c.phone))).length)

function setCsvFilter(f: 'all' | 'sent' | 'not_sent') {
  csvFilter.value = f
  selectedIds.value = new Set()
}

function selectByLimit() {
  const limit = Number(csvSelectLimit.value)
  if (!limit || limit <= 0) return
  const ids = filteredCsvContacts.value.slice(0, limit).map((c) => c.id)
  selectedIds.value = new Set(ids)
}

// ── CSV mode state ───────────────────────────────────────────────────────────

const fileInput       = ref<HTMLInputElement | null>(null)
const csvFileName     = ref('')
const csvHeaders      = ref<string[]>([])
const csvPreviewRows  = ref<Record<string, string>[]>([])
const csvAllRows      = ref<Record<string, string>[]>([])
const csvPhoneCol1    = ref('')
const csvPhoneCol2    = ref('')
const csvNameColumn   = ref('')
const csvContacts     = ref<CsvContact[]>([])
const csvMapped       = ref(false)

function triggerFileInput() {
  fileInput.value?.click()
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  const file = e.dataTransfer?.files?.[0]
  if (file) parseCsvFile(file)
}

function handleFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) parseCsvFile(file)
}

function parseCsvFile(file: File) {
  csvFileName.value = file.name
  csvHeaders.value = []
  csvPreviewRows.value = []
  csvAllRows.value = []
  csvPhoneCol1.value = ''
  csvPhoneCol2.value = ''
  csvNameColumn.value = ''
  csvContacts.value = []
  csvMapped.value = false
  csvFilter.value = 'all'
  csvSelectLimit.value = ''
  selectedIds.value = new Set()

  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: true,
    complete(results) {
      csvHeaders.value = results.meta.fields ?? []
      csvAllRows.value = results.data
      csvPreviewRows.value = results.data.slice(0, 5)

      const phoneRe = /phone|telefone|celular|whatsapp|contato|contact|number|numero/i
      const phoneCols = csvHeaders.value.filter((h) => phoneRe.test(h))
      if (phoneCols[0]) csvPhoneCol1.value = phoneCols[0]
      if (phoneCols[1]) csvPhoneCol2.value = phoneCols[1]

      const nameLike = csvHeaders.value.find((h) =>
        /name|nome|usuario|username|client|cliente/i.test(h),
      )
      if (nameLike) csvNameColumn.value = nameLike
    },
    error(err) {
      error.value = `Erro ao ler CSV: ${err.message}`
    },
  })
}

function confirmCsvImport() {
  if (!csvPhoneCol1.value) return
  csvFilter.value = 'all'

  const contacts: CsvContact[] = []
  let idx = 0

  for (const row of csvAllRows.value) {
    const name  = csvNameColumn.value ? (row[csvNameColumn.value] ?? '').trim() : ''
    const p1    = (row[csvPhoneCol1.value] ?? '').trim()
    const p2    = csvPhoneCol2.value ? (row[csvPhoneCol2.value] ?? '').trim() : ''

    if (p1) contacts.push({ id: String(idx++), phone: p1, name })
    if (p2 && p2 !== p1) contacts.push({ id: String(idx++), phone: p2, name })
  }

  csvContacts.value = contacts
  csvMapped.value = true
  selectedIds.value = new Set(contacts.map((c) => c.id))
  error.value = null
  result.value = null

  localStorage.setItem(LS_CSV_CONTACTS, JSON.stringify({
    fileName: csvFileName.value,
    contacts,
  }))
}

function resetCsv() {
  csvFileName.value = ''
  csvHeaders.value = []
  csvPreviewRows.value = []
  csvAllRows.value = []
  csvPhoneCol1.value = ''
  csvPhoneCol2.value = ''
  csvNameColumn.value = ''
  csvContacts.value = []
  csvMapped.value = false
  csvFilter.value = 'all'
  csvSelectLimit.value = ''
  selectedIds.value = new Set()
  if (fileInput.value) fileInput.value.value = ''
  localStorage.removeItem(LS_CSV_CONTACTS)
}

// ── Shared selection (continued) ─────────────────────────────────────────────

const activeList = computed<Array<{ id: string }>>(() =>
  mode.value === 'csv' ? filteredCsvContacts.value : users.value,
)

const allSelected = computed(() =>
  activeList.value.length > 0 && activeList.value.every((u) => selectedIds.value.has(u.id)),
)

const selectedCount = computed(() => selectedIds.value.size)

function toggleAll() {
  if (allSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(activeList.value.map((u) => u.id))
  }
}

function toggleItem(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

// ── Message & send ───────────────────────────────────────────────────────────

const message        = ref('')
const sending        = ref(false)
const result         = ref<{ queued: number; skipped?: number; invalid?: string[] } | null>(null)
const error          = ref<string | null>(null)

const showTable = computed(() =>
  mode.value === 'filters' ? users.value.length > 0
                           : csvMapped.value && csvContacts.value.length > 0,
)

const canSend = computed(() =>
  selectedCount.value > 0 && message.value.trim().length > 0 && !sending.value,
)

async function sendBlast() {
  if (!canSend.value) return
  error.value = null
  result.value = null
  sending.value = true

  try {
    if (mode.value === 'csv') {
      const phones = csvContacts.value
        .filter((c) => selectedIds.value.has(c.id))
        .map((c) => c.phone)

      const res = await adminService.sendWhatsappBlastByPhones(phones, message.value.trim())
      result.value = res.data
      markPhonesAsSent(phones)
    } else {
      const res = await adminService.sendWhatsappBlast(
        Array.from(selectedIds.value),
        message.value.trim(),
      )
      result.value = res.data
    }

    selectedIds.value = new Set()
    message.value = ''
    toast.success(`${result.value?.queued ?? 0} mensagem(ns) enfileirada(s) com sucesso!`)
  } catch (e: any) {
    error.value = e?.message ?? 'Erro ao enviar.'
    toast.error(error.value ?? 'Erro ao enviar.')
  } finally {
    sending.value = false
  }
}

function formatCurrency(cents: number) {
  return `R$ ${(cents / 100).toFixed(2)}`
}

onMounted(() => {
  loadSentPhones()

  try {
    const raw = localStorage.getItem(LS_CSV_CONTACTS)
    if (!raw) return
    const saved = JSON.parse(raw) as { fileName: string; contacts: CsvContact[] }
    csvContacts.value = saved.contacts
    csvFileName.value = saved.fileName
    csvMapped.value = true
    selectedIds.value = new Set(saved.contacts.map((c) => c.id))
    mode.value = 'csv'
  } catch {}
})
</script>

<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <h1 class="page-title">
          <Icon icon="mdi:whatsapp" style="color:#25d366;vertical-align:-3px;margin-right:6px" />
          Disparo em Massa — WhatsApp
        </h1>
        <p class="page-subtitle">Filtre usuários ou importe um CSV e envie mensagem via Z-API.</p>
      </div>
    </header>

    <!-- Mode tabs -->
    <div class="mode-tabs">
      <button
        class="mode-tab"
        :class="{ active: mode === 'filters' }"
        @click="switchMode('filters')"
      >
        <Icon icon="mdi:filter-outline" width="16" />
        Filtros
      </button>
      <button
        class="mode-tab"
        :class="{ active: mode === 'csv' }"
        @click="switchMode('csv')"
      >
        <Icon icon="mdi:file-delimited-outline" width="16" />
        Importar CSV
      </button>
    </div>

    <!-- ── Filters mode ── -->
    <template v-if="mode === 'filters'">
      <div class="section">
        <h2 class="section-title">Segmento</h2>
        <div class="segment-grid">
          <button
            v-for="s in SEGMENTS"
            :key="s.value"
            class="segment-card"
            :class="{ active: segment === s.value }"
            @click="segment = s.value"
          >
            <Icon :icon="s.icon" width="20" />
            <span>{{ s.label }}</span>
          </button>
        </div>

        <div class="filter-row">
          <div class="field-inline">
            <label>Nível de passe</label>
            <select v-model="tierRank" class="form-input input-tier">
              <option value="">Todos os níveis</option>
              <option v-for="t in TIERS" :key="t.rank" :value="t.rank">{{ t.name }}</option>
            </select>
          </div>
          <div class="field-inline">
            <label>Limite de usuários</label>
            <input v-model.number="previewLimit" type="number" min="1" max="5000" class="form-input input-sm" />
          </div>
          <button class="btn-primary" :disabled="loadingPreview" @click="loadPreview">
            <Icon icon="mdi:magnify" width="16" />
            {{ loadingPreview ? 'Buscando...' : 'Buscar usuários' }}
          </button>
        </div>
      </div>
    </template>

    <!-- ── CSV mode ── -->
    <template v-if="mode === 'csv'">
      <div class="section">
        <h2 class="section-title">Importar CSV</h2>

        <!-- Upload area -->
        <div
          class="csv-dropzone"
          :class="{ 'has-file': csvFileName }"
          @click="triggerFileInput"
          @dragover="handleDragOver"
          @drop="handleDrop"
        >
          <Icon :icon="csvFileName ? 'mdi:file-check-outline' : 'mdi:file-upload-outline'" width="32" />
          <p v-if="!csvFileName">Clique ou arraste um arquivo <strong>.csv</strong> aqui</p>
          <p v-else class="csv-filename">{{ csvFileName }}</p>
          <span v-if="csvFileName" class="csv-row-count">{{ csvAllRows.length }} linhas</span>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept=".csv,text/csv"
          style="display:none"
          @change="handleFileChange"
        />

        <!-- Column picker (shown after file is loaded) -->
        <div v-if="csvHeaders.length > 0" class="column-picker">
          <div class="column-picker-header">
            <h3 class="column-picker-title">Mapeamento de colunas</h3>
            <button class="btn-ghost btn-sm" @click="resetCsv">
              <Icon icon="mdi:close" width="14" /> Trocar arquivo
            </button>
          </div>

          <!-- Preview table -->
          <div class="csv-preview-wrap">
            <table class="csv-preview-table">
              <thead>
                <tr>
                  <th v-for="h in csvHeaders" :key="h">{{ h }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in csvPreviewRows" :key="i">
                  <td v-for="h in csvHeaders" :key="h">{{ row[h] }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="column-selects">
            <div class="field-inline">
              <label>Telefone 1 <span class="required">*</span></label>
              <select v-model="csvPhoneCol1" class="form-input input-tier">
                <option value="">— selecione —</option>
                <option v-for="h in csvHeaders" :key="h" :value="h">{{ h }}</option>
              </select>
            </div>
            <div class="field-inline">
              <label>Telefone 2 <span class="optional">(opcional)</span></label>
              <select v-model="csvPhoneCol2" class="form-input input-tier">
                <option value="">— não usar —</option>
                <option v-for="h in csvHeaders" :key="h" :value="h" :disabled="h === csvPhoneCol1">{{ h }}</option>
              </select>
            </div>
            <div class="field-inline">
              <label>Coluna de nome <span class="optional">(opcional)</span></label>
              <select v-model="csvNameColumn" class="form-input input-tier">
                <option value="">— não usar —</option>
                <option v-for="h in csvHeaders" :key="h" :value="h">{{ h }}</option>
              </select>
            </div>
            <button class="btn-primary" :disabled="!csvPhoneCol1" @click="confirmCsvImport">
              <Icon icon="mdi:check" width="16" />
              Confirmar importação
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Shared: error / result alerts ── -->
    <div v-if="error" class="alert alert-error">
      <Icon icon="mdi:alert-circle-outline" width="16" /> {{ error }}
    </div>
    <div v-if="result" class="alert alert-success">
      <Icon icon="mdi:check-circle-outline" width="16" />
      {{ result.queued }} mensagem(ns) enfileirada(s) com sucesso!
      <template v-if="result.skipped">
        &nbsp;·&nbsp;
        <span class="skipped-warn">{{ result.skipped }} número(s) inválido(s) ignorado(s)</span>
      </template>
    </div>

    <div v-if="result?.invalid?.length" class="invalid-phones">
      <div class="invalid-phones-header">
        <Icon icon="mdi:alert-circle-outline" width="14" />
        Números que não puderam ser enviados:
      </div>
      <ul>
        <li v-for="p in result.invalid" :key="p" class="mono">{{ p }}</li>
      </ul>
    </div>

    <!-- ── Shared: users/contacts table ── -->
    <div v-if="showTable" class="section">
      <div class="table-header">
        <h2 class="section-title">
          <template v-if="mode === 'filters'">
            {{ users.length }} usuário(s) encontrado(s)
          </template>
          <template v-else>
            {{ csvContacts.length }} contato(s) importado(s)
          </template>
          <span v-if="selectedCount > 0" class="badge-selected">{{ selectedCount }} selecionado(s)</span>
        </h2>
        <div class="table-actions">
          <button class="btn-ghost" @click="toggleAll">
            {{ allSelected ? 'Desmarcar todos' : 'Selecionar todos' }}
          </button>
        </div>
      </div>

      <!-- Filters table -->
      <div v-if="mode === 'filters'" class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th class="col-check">
                <input type="checkbox" :checked="allSelected" @change="toggleAll" />
              </th>
              <th>Usuário</th>
              <th>WhatsApp</th>
              <th>Tier</th>
              <th>Compras</th>
              <th>Total gasto</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="user in users"
              :key="user.id"
              :class="{ selected: selectedIds.has(user.id) }"
              @click="toggleItem(user.id)"
            >
              <td class="col-check" @click.stop>
                <input type="checkbox" :checked="selectedIds.has(user.id)" @change="toggleItem(user.id)" />
              </td>
              <td>
                <div class="user-info">
                  <span class="user-name">{{ user.username ?? '—' }}</span>
                  <span class="user-email">{{ user.email ?? '' }}</span>
                </div>
              </td>
              <td class="mono">{{ user.contact }}</td>
              <td>
                <span
                  class="tier-badge"
                  :style="{ color: TIERS[user.tier_rank]?.color ?? '#B0C3D9', borderColor: TIERS[user.tier_rank]?.color ?? '#B0C3D9' }"
                >
                  {{ user.tier_name }}
                </span>
              </td>
              <td class="center">{{ user.sales_count }}</td>
              <td class="center">{{ formatCurrency(user.total_spent) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- CSV table -->
      <div v-else>
        <!-- Filter bar -->
        <div class="csv-filter-bar">
          <div class="csv-filter-tabs">
            <button
              class="csv-filter-tab"
              :class="{ active: csvFilter === 'all' }"
              @click="setCsvFilter('all')"
            >
              Todos
              <span class="filter-count">{{ csvContacts.length }}</span>
            </button>
            <button
              class="csv-filter-tab"
              :class="{ active: csvFilter === 'not_sent' }"
              @click="setCsvFilter('not_sent')"
            >
              Não enviados
              <span class="filter-count">{{ notSentCount }}</span>
            </button>
            <button
              class="csv-filter-tab csv-filter-tab--sent"
              :class="{ active: csvFilter === 'sent' }"
              @click="setCsvFilter('sent')"
            >
              Já enviados
              <span class="filter-count">{{ sentCount }}</span>
            </button>
          </div>
          <div class="csv-limit-select">
            <input
              v-model.number="csvSelectLimit"
              type="number"
              min="1"
              class="form-input input-sm"
              placeholder="Ex: 500"
            />
            <button class="btn-ghost btn-sm" @click="selectByLimit">
              <Icon icon="mdi:cursor-default-click-outline" width="14" />
              Selecionar
            </button>
          </div>
        </div>

        <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th class="col-check">
                <input type="checkbox" :checked="allSelected" @change="toggleAll" />
              </th>
              <th>#</th>
              <th v-if="csvNameColumn">Nome</th>
              <th>Telefone</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="contact in filteredCsvContacts"
              :key="contact.id"
              :class="{ selected: selectedIds.has(contact.id) }"
              @click="toggleItem(contact.id)"
            >
              <td class="col-check" @click.stop>
                <input type="checkbox" :checked="selectedIds.has(contact.id)" @change="toggleItem(contact.id)" />
              </td>
              <td class="row-num">{{ Number(contact.id) + 1 }}</td>
              <td v-if="csvNameColumn" class="user-name">{{ contact.name || '—' }}</td>
              <td class="mono">
                {{ contact.phone }}
                <span
                  v-if="sentPhones.has(stripCsvNoise(contact.phone))"
                  class="sent-flag"
                  title="Já enviado anteriormente"
                >
                  <Icon icon="mdi:check-circle" width="13" />
                  enviado
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
    </div>

    <div v-else-if="!loadingPreview && !showTable && !error" class="empty-state">
      <Icon :icon="mode === 'csv' ? 'mdi:file-delimited-outline' : 'mdi:account-search-outline'" width="48" />
      <p v-if="mode === 'filters'">Selecione um segmento e clique em "Buscar usuários".</p>
      <p v-else>Faça upload de um CSV e mapeie a coluna de telefone.</p>
    </div>

    <!-- ── Shared: message + send ── -->
    <div v-if="showTable" class="section">
      <h2 class="section-title">Mensagem</h2>
      <p class="section-hint">Será enviada para os {{ selectedCount }} contato(s) selecionado(s).</p>

      <div class="field">
        <textarea
          v-model="message"
          class="form-input message-textarea"
          placeholder="Digite a mensagem que será enviada via WhatsApp..."
          maxlength="4096"
          rows="6"
        />
        <p class="field-hint">{{ message.length }}/4096</p>
      </div>

      <div class="send-row">
        <button class="btn-send" :disabled="!canSend" @click="sendBlast">
          <Icon :icon="sending ? 'mdi:loading' : 'mdi:send'" width="18" :class="{ spin: sending }" />
          {{ sending ? 'Enviando...' : `Enviar para ${selectedCount} contato(s)` }}
        </button>
        <p v-if="selectedCount === 0" class="field-hint field-hint--warn">
          Selecione ao menos um contato.
        </p>
      </div>
    </div>
  </div>
</template>

<style lang="stylus" scoped>
.view-wrap
  padding 2rem
  max-width 1100px
  margin 0 auto

.page-header
  display flex
  justify-content space-between
  align-items flex-start
  margin-bottom 1.5rem

.page-title
  font-size 1.5rem
  font-weight 700
  color #f1f5f9
  margin 0 0 0.25rem

.page-subtitle
  font-size 0.875rem
  color #64748b
  margin 0

// ── Mode tabs ────────────────────────────────────────────────────────────────

.mode-tabs
  display flex
  gap 0.5rem
  margin-bottom 1.25rem
  background #16181d
  border 1px solid rgba(255,255,255,0.06)
  border-radius 10px
  padding 0.35rem
  width fit-content

.mode-tab
  display inline-flex
  align-items center
  gap 0.4rem
  padding 0.45rem 1rem
  border-radius 7px
  font-size 0.85rem
  font-weight 500
  color #64748b
  background transparent
  border none
  cursor pointer
  transition all 0.15s

  &:hover
    color #cbd5e1

  &.active
    background rgba(99,102,241,0.15)
    color #a5b4fc

// ── Sections ─────────────────────────────────────────────────────────────────

.section
  background #16181d
  border 1px solid rgba(255,255,255,0.06)
  border-radius 10px
  padding 1.5rem
  margin-bottom 1.25rem

.section-title
  font-size 0.95rem
  font-weight 600
  color #e2e8f0
  margin 0 0 1rem

.section-hint
  font-size 0.8rem
  color #64748b
  margin -0.5rem 0 1rem

// ── Segments (filters mode) ───────────────────────────────────────────────────

.segment-grid
  display grid
  grid-template-columns repeat(auto-fill, minmax(180px, 1fr))
  gap 0.75rem
  margin-bottom 1.25rem

.segment-card
  display flex
  align-items center
  gap 0.5rem
  padding 0.65rem 1rem
  background rgba(255,255,255,0.03)
  border 1px solid rgba(255,255,255,0.08)
  border-radius 8px
  color #94a3b8
  font-size 0.85rem
  cursor pointer
  transition all 0.15s

  &:hover
    border-color rgba(99,102,241,0.4)
    color #c7d2fe

  &.active
    background rgba(99,102,241,0.12)
    border-color #6366f1
    color #a5b4fc

.filter-row
  display flex
  align-items flex-end
  gap 1rem
  flex-wrap wrap

// ── CSV dropzone ─────────────────────────────────────────────────────────────

.csv-dropzone
  display flex
  flex-direction column
  align-items center
  justify-content center
  gap 0.5rem
  border 2px dashed rgba(255,255,255,0.1)
  border-radius 10px
  padding 2rem 1rem
  cursor pointer
  transition all 0.2s
  color #64748b
  text-align center

  &:hover
    border-color rgba(99,102,241,0.4)
    background rgba(99,102,241,0.04)
    color #a5b4fc

  &.has-file
    border-color rgba(37,211,102,0.35)
    background rgba(37,211,102,0.04)
    color #86efac

  p
    margin 0
    font-size 0.875rem

.csv-filename
  font-weight 600
  font-size 0.9rem !important

.csv-row-count
  font-size 0.78rem
  color #64748b

// ── Column picker ─────────────────────────────────────────────────────────────

.column-picker
  margin-top 1.25rem
  padding-top 1.25rem
  border-top 1px solid rgba(255,255,255,0.06)

.column-picker-header
  display flex
  justify-content space-between
  align-items center
  margin-bottom 0.875rem

.column-picker-title
  font-size 0.875rem
  font-weight 600
  color #e2e8f0
  margin 0

.csv-preview-wrap
  overflow-x auto
  border-radius 7px
  border 1px solid rgba(255,255,255,0.06)
  margin-bottom 1rem

.csv-preview-table
  width 100%
  border-collapse collapse
  font-size 0.8rem

  thead tr
    background rgba(255,255,255,0.03)

  th
    padding 0.5rem 0.75rem
    color #64748b
    font-weight 500
    text-align left
    border-bottom 1px solid rgba(255,255,255,0.06)
    white-space nowrap

  td
    padding 0.45rem 0.75rem
    border-bottom 1px solid rgba(255,255,255,0.04)
    color #94a3b8
    max-width 200px
    overflow hidden
    text-overflow ellipsis
    white-space nowrap

  tbody tr:last-child td
    border-bottom none

.column-selects
  display flex
  align-items flex-end
  gap 1rem
  flex-wrap wrap

.required
  color #f87171
  font-size 0.75rem

.optional
  color #64748b
  font-size 0.75rem
  font-weight 400

// ── Shared form inputs ────────────────────────────────────────────────────────

.field-inline
  display flex
  flex-direction column
  gap 0.3rem

  label
    font-size 0.8rem
    color #64748b

.input-sm
  width 100px

.input-tier
  width 160px

.form-input
  background #1e2028
  border 1px solid rgba(255,255,255,0.1)
  border-radius 6px
  color #e2e8f0
  font-size 0.875rem
  padding 0.5rem 0.75rem
  outline none
  transition border-color 0.15s
  appearance none
  -webkit-appearance none

  &:focus
    border-color rgba(99,102,241,0.5)

  option
    background #1e2028
    color #e2e8f0

.message-textarea
  width 100%
  resize vertical
  font-family inherit

// ── Buttons ───────────────────────────────────────────────────────────────────

.btn-primary
  display inline-flex
  align-items center
  gap 0.4rem
  padding 0.55rem 1.1rem
  background #6366f1
  color #fff
  border none
  border-radius 6px
  font-size 0.875rem
  font-weight 500
  cursor pointer
  transition background 0.15s

  &:hover:not(:disabled)
    background #4f46e5

  &:disabled
    opacity 0.5
    cursor not-allowed

.btn-ghost
  background transparent
  border 1px solid rgba(255,255,255,0.1)
  color #94a3b8
  border-radius 6px
  padding 0.4rem 0.85rem
  font-size 0.8rem
  cursor pointer
  transition all 0.15s

  &:hover
    border-color rgba(255,255,255,0.2)
    color #cbd5e1

.btn-sm
  padding 0.3rem 0.65rem
  font-size 0.75rem

// ── CSV filter bar ────────────────────────────────────────────────────────────

.csv-filter-bar
  display flex
  align-items center
  justify-content space-between
  flex-wrap wrap
  gap 0.75rem
  margin-bottom 0.75rem

.csv-filter-tabs
  display flex
  gap 0.35rem

.csv-filter-tab
  display inline-flex
  align-items center
  gap 0.4rem
  padding 0.35rem 0.85rem
  border-radius 6px
  font-size 0.8rem
  font-weight 500
  color #64748b
  background transparent
  border 1px solid rgba(255,255,255,0.08)
  cursor pointer
  transition all 0.15s

  &:hover
    color #cbd5e1
    border-color rgba(255,255,255,0.15)

  &.active
    background rgba(99,102,241,0.15)
    border-color #6366f1
    color #a5b4fc

  &--sent.active
    background rgba(34,197,94,0.1)
    border-color rgba(34,197,94,0.4)
    color #86efac

.filter-count
  background rgba(255,255,255,0.07)
  border-radius 10px
  padding 0.05rem 0.45rem
  font-size 0.72rem
  font-weight 600

.csv-limit-select
  display flex
  align-items center
  gap 0.5rem

// ── Table ────────────────────────────────────────────────────────────────────

.table-header
  display flex
  justify-content space-between
  align-items center
  margin-bottom 1rem

.table-actions
  display flex
  gap 0.5rem

.badge-selected
  margin-left 0.5rem
  background rgba(99,102,241,0.15)
  color #a5b4fc
  font-size 0.75rem
  padding 0.15rem 0.5rem
  border-radius 10px
  font-weight 500

.table-wrapper
  overflow-x auto
  border-radius 8px
  border 1px solid rgba(255,255,255,0.06)

table
  width 100%
  border-collapse collapse
  font-size 0.875rem

thead tr
  background rgba(255,255,255,0.03)

th
  padding 0.65rem 0.875rem
  color #64748b
  font-weight 500
  text-align left
  border-bottom 1px solid rgba(255,255,255,0.06)
  white-space nowrap

td
  padding 0.65rem 0.875rem
  border-bottom 1px solid rgba(255,255,255,0.04)
  color #cbd5e1

tbody tr
  cursor pointer
  transition background 0.1s

  &:hover
    background rgba(255,255,255,0.03)

  &.selected
    background rgba(99,102,241,0.07)

  &:last-child td
    border-bottom none

.col-check
  width 40px

.row-num
  color #475569
  font-size 0.78rem
  text-align center
  width 40px

.user-info
  display flex
  flex-direction column
  gap 0.15rem

.user-name
  color #e2e8f0
  font-weight 500

.user-email
  font-size 0.75rem
  color #64748b

.mono
  font-family monospace
  font-size 0.82rem

.sent-flag
  display inline-flex
  align-items center
  gap 0.2rem
  margin-left 0.5rem
  font-size 0.7rem
  font-family inherit
  font-weight 600
  color #22c55e
  background rgba(34,197,94,0.1)
  border 1px solid rgba(34,197,94,0.2)
  border-radius 4px
  padding 0.1rem 0.35rem
  vertical-align middle
  white-space nowrap

.tier-badge
  font-size 0.75rem
  font-weight 600
  padding 0.15rem 0.45rem
  border-radius 4px
  border 1px solid
  background rgba(255,255,255,0.04)
  white-space nowrap

.center
  text-align center

// ── Field / send ─────────────────────────────────────────────────────────────

.field
  display flex
  flex-direction column
  gap 0.4rem
  margin-bottom 1rem

.field-hint
  font-size 0.78rem
  color #64748b
  margin 0

  &--warn
    color #f59e0b

.send-row
  display flex
  align-items center
  gap 1rem
  flex-wrap wrap

.btn-send
  display inline-flex
  align-items center
  gap 0.5rem
  padding 0.65rem 1.4rem
  background #25d366
  color #fff
  border none
  border-radius 8px
  font-size 0.9rem
  font-weight 600
  cursor pointer
  transition background 0.15s

  &:hover:not(:disabled)
    background #1ebe5d

  &:disabled
    opacity 0.5
    cursor not-allowed

// ── Misc ─────────────────────────────────────────────────────────────────────

.spin
  animation spin 1s linear infinite

@keyframes spin
  from transform rotate(0deg)
  to transform rotate(360deg)

.empty-state
  display flex
  flex-direction column
  align-items center
  gap 1rem
  padding 4rem 2rem
  color #334155
  text-align center

  p
    font-size 0.9rem

.alert
  display flex
  align-items center
  gap 0.5rem
  padding 0.75rem 1rem
  border-radius 8px
  font-size 0.875rem
  margin-bottom 1rem

  &-error
    background rgba(239,68,68,0.1)
    border 1px solid rgba(239,68,68,0.2)
    color #fca5a5

  &-success
    background rgba(34,197,94,0.1)
    border 1px solid rgba(34,197,94,0.2)
    color #86efac

.skipped-warn
  color #fbbf24
  font-weight 600

.invalid-phones
  background rgba(245,158,11,0.06)
  border 1px solid rgba(245,158,11,0.2)
  border-radius 8px
  padding 0.75rem 1rem
  margin-bottom 1rem
  font-size 0.825rem
  color #fcd34d

  .invalid-phones-header
    display flex
    align-items center
    gap 0.4rem
    font-weight 600
    margin-bottom 0.5rem
    color #fbbf24

  ul
    margin 0
    padding-left 1.25rem
    display flex
    flex-direction column
    gap 0.2rem

  li
    color #94a3b8
</style>
