<template>
  <div class="view-wrap">
    <header class="page-header">
      <h1 class="page-title">Bots Steam</h1>
    </header>

    <div class="page-grid">
      <!-- Create form -->
      <form class="form-col" @submit.prevent="submit">
        <section class="form-section">
          <h2 class="section-title">{{ editingUuid ? `Editar bot: ${form.name}` : 'Novo bot' }}</h2>

          <div class="field-row">
            <div class="field">
              <label>Nome <span class="required">*</span></label>
              <input v-model="form.name" type="text" placeholder="bot-dota-01" maxlength="100" class="form-input" required />
            </div>
            <div class="field">
              <label>Steam ID <span v-if="!editingUuid" class="required">*</span></label>
              <input v-model="form.steam_id" type="text" placeholder="76561198000000000" maxlength="50" class="form-input" :disabled="!!editingUuid" :required="!editingUuid" />
              <p v-if="editingUuid" class="field-hint">Steam ID não pode ser alterado.</p>
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label>Usuário Steam <span v-if="!editingUuid" class="required">*</span></label>
              <input v-model="form.steam_user" type="text" maxlength="100" class="form-input" autocomplete="off" :required="!editingUuid" :placeholder="editingUuid ? 'Deixe vazio para manter' : ''" />
            </div>
            <div class="field">
              <label>Senha Steam <span v-if="!editingUuid" class="required">*</span></label>
              <input v-model="form.steam_pass" type="password" maxlength="255" class="form-input" autocomplete="new-password" :required="!editingUuid" :placeholder="editingUuid ? 'Deixe vazio para manter' : ''" />
            </div>
          </div>

          <div class="field">
            <label>Steam API Key <span v-if="!editingUuid" class="required">*</span></label>
            <input v-model="form.steam_api_key" type="password" maxlength="255" class="form-input" autocomplete="off" :required="!editingUuid" :placeholder="editingUuid ? 'Deixe vazio para manter' : ''" />
          </div>

          <div class="field">
            <label>Webhook URL <span class="required">*</span></label>
            <input v-model="form.webhook_url" type="url" placeholder="https://seu-bot.com/webhook" maxlength="255" class="form-input" required />
          </div>

          <div class="field-row">
            <div class="field">
              <label>Máx. trades ativas <span class="required">*</span></label>
              <input v-model.number="form.max_active_trades" type="number" min="1" max="100" class="form-input" required />
            </div>
            <div class="field toggle-row">
              <label class="toggle-label">
                <span>Ativo</span>
                <button
                  type="button"
                  class="toggle"
                  :class="{ 'toggle--on': form.is_active }"
                  @click="form.is_active = !form.is_active"
                >
                  <span class="toggle-knob" />
                </button>
              </label>
            </div>
          </div>
        </section>

        <section class="form-section">
          <h2 class="section-title">Secrets (opcional)</h2>
          <p v-if="editingUuid" class="field-hint" style="margin:-0.5rem 0 1rem">Deixe vazio para manter os valores atuais.</p>

          <div class="field">
            <label>Shared secret</label>
            <input v-model="form.steam_shared_secret" type="password" maxlength="255" class="form-input" autocomplete="off" />
          </div>

          <div class="field">
            <label>Identity secret</label>
            <input v-model="form.steam_identity_secret" type="password" maxlength="255" class="form-input" autocomplete="off" />
          </div>

          <div class="field">
            <label>Webhook secret</label>
            <input v-model="form.webhook_secret" type="password" maxlength="100" class="form-input" autocomplete="off" />
          </div>
        </section>

        <div class="form-footer">
          <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
          <button v-if="editingUuid" type="button" class="btn-ghost" @click="resetForm">Cancelar</button>
          <button type="submit" class="btn-primary" :disabled="submitting">
            {{ submitting ? 'Salvando...' : editingUuid ? 'Salvar alterações' : 'Cadastrar bot' }}
          </button>
        </div>
      </form>

      <!-- Bot list -->
      <div class="list-col">
        <div v-if="loading" class="loading-state">
          <Icon icon="mdi:loading" class="spin" width="32" />
        </div>

        <div v-else-if="bots.length === 0" class="list-empty">Nenhum bot cadastrado.</div>

        <div v-else class="bot-list">
          <div
            v-for="bot in bots"
            :key="bot.uuid"
            class="bot-card"
            :class="{ 'bot-card--editing': bot.uuid === editingUuid }"
          >
            <div class="bot-card__main">
              <span class="bot-card__name">{{ bot.name }}</span>
              <span class="bot-card__steamid">{{ bot.steam_id }}</span>
            </div>
            <div class="bot-card__meta">
              <span>{{ bot.current_active_trades ?? 0 }}/{{ bot.max_active_trades }} trades</span>
              <span class="bot-status" :class="bot.is_active ? 'bot-status--on' : 'bot-status--off'">
                {{ bot.is_active ? 'Ativo' : 'Inativo' }}
              </span>
              <button type="button" class="bot-action" title="Editar" @click="startEdit(bot)">
                <Icon icon="mdi:pencil-outline" width="16" />
              </button>
              <button type="button" class="bot-action bot-action--danger" title="Deletar" @click="removeBot(bot)">
                <Icon icon="mdi:trash-can-outline" width="16" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { adminService } from '@/services/admin/admin.service'

interface SteamBot {
  uuid: string
  name: string
  steam_id: string
  is_active: boolean | null
  max_active_trades: number | null
  current_active_trades: number | null
  webhook_url: string | null
}

const bots = ref<SteamBot[]>([])
const loading = ref(false)
const submitting = ref(false)
const errorMsg = ref('')
const editingUuid = ref('')

const emptyForm = () => ({
  name: '',
  steam_id: '',
  steam_user: '',
  steam_pass: '',
  steam_api_key: '',
  webhook_url: '',
  max_active_trades: 20,
  is_active: true,
  steam_shared_secret: '',
  steam_identity_secret: '',
  webhook_secret: '',
})

const form = reactive(emptyForm())

const loadBots = async () => {
  loading.value = true
  try {
    const res = await adminService.getSteamBots()
    bots.value = res.data as SteamBot[]
  } finally {
    loading.value = false
  }
}

const buildPayload = () => {
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    webhook_url: form.webhook_url.trim(),
    max_active_trades: form.max_active_trades,
    is_active: form.is_active,
  }
  if (!editingUuid.value) payload.steam_id = form.steam_id.trim()

  const credentialKeys = ['steam_user', 'steam_pass', 'steam_api_key', 'steam_shared_secret', 'steam_identity_secret', 'webhook_secret'] as const
  credentialKeys.forEach((key) => {
    const value = form[key].trim()
    if (value) payload[key] = value
  })

  return payload
}

const resetForm = () => {
  editingUuid.value = ''
  errorMsg.value = ''
  Object.assign(form, emptyForm())
}

const startEdit = (bot: SteamBot) => {
  resetForm()
  editingUuid.value = bot.uuid
  form.name = bot.name
  form.steam_id = bot.steam_id
  form.webhook_url = bot.webhook_url ?? ''
  form.max_active_trades = bot.max_active_trades ?? 20
  form.is_active = bot.is_active ?? true
}

const submit = async () => {
  errorMsg.value = ''
  submitting.value = true
  try {
    const payload = buildPayload()
    if (editingUuid.value) {
      await adminService.updateSteamBot(editingUuid.value, payload)
    } else {
      await adminService.createSteamBot(payload)
    }
    resetForm()
    await loadBots()
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.message ?? 'Erro ao salvar bot.'
  } finally {
    submitting.value = false
  }
}

const removeBot = async (bot: SteamBot) => {
  if (!confirm(`Deletar o bot "${bot.name}" (${bot.steam_id})?`)) return
  try {
    await adminService.deleteSteamBot(bot.uuid)
    if (editingUuid.value === bot.uuid) resetForm()
    await loadBots()
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.message ?? 'Erro ao deletar bot.'
  }
}

onMounted(loadBots)
</script>

<style lang="stylus" scoped>
.view-wrap
  padding 2rem
  color #fff
  min-height 100vh

.page-header
  margin-bottom 2rem

.page-title
  font-size 1.6rem
  font-weight 700
  margin 0

.page-grid
  display grid
  grid-template-columns 1fr 1fr
  gap 1.5rem
  align-items start
  @media (max-width: 900px)
    grid-template-columns 1fr

.form-col
  display flex
  flex-direction column
  gap 1.5rem

.form-section
  background #16161a
  border 1px solid rgba(255,255,255,0.06)
  border-radius 12px
  padding 1.25rem 1.5rem

.section-title
  font-size 0.95rem
  font-weight 700
  color rgba(255,255,255,0.85)
  margin 0 0 1rem
  padding-bottom 0.5rem
  border-bottom 1px solid rgba(255,255,255,0.06)

.field
  display flex
  flex-direction column
  gap 6px
  margin-bottom 1rem

  label
    font-size 0.82rem
    font-weight 600
    color rgba(255,255,255,0.65)

  &:last-child
    margin-bottom 0

.field-row
  display grid
  grid-template-columns 1fr 1fr
  gap 0.75rem

.required
  color #fc8181

.field-hint
  font-size 0.75rem
  color rgba(255,255,255,0.35)
  margin 0

.form-input
  background rgba(0,0,0,0.25)
  border 1px solid rgba(255,255,255,0.1)
  border-radius 8px
  color #fff
  padding 0.5rem 0.75rem
  font-size 0.875rem
  outline none
  width 100%
  box-sizing border-box
  &:focus
    border-color rgba(99,102,241,0.5)
  &:disabled
    opacity 0.5
    cursor not-allowed

.toggle-row
  display flex
  flex-direction column
  justify-content center
  margin-bottom 0

.toggle-label
  display flex
  align-items center
  justify-content space-between
  gap 1rem
  cursor default
  font-size 0.875rem
  color rgba(255,255,255,0.7)

.toggle
  flex-shrink 0
  width 40px
  height 22px
  background rgba(255,255,255,0.12)
  border none
  border-radius 999px
  position relative
  cursor pointer
  transition background 0.2s
  padding 0

.toggle--on
  background #6366f1

.toggle-knob
  display block
  width 16px
  height 16px
  background #fff
  border-radius 50%
  position absolute
  top 3px
  left 3px
  transition transform 0.2s

.toggle--on .toggle-knob
  transform translateX(18px)

.form-footer
  display flex
  align-items center
  justify-content flex-end
  gap 1rem

.error-msg
  color #fc8181
  font-size 0.875rem

.btn-primary
  display inline-flex
  align-items center
  gap 6px
  padding 0.55rem 1.25rem
  background #6366f1
  border none
  border-radius 8px
  color #fff
  font-weight 600
  font-size 0.875rem
  cursor pointer
  &:hover:not(:disabled)
    background #4f46e5
  &:disabled
    opacity 0.5
    cursor not-allowed

.btn-ghost
  padding 0.55rem 1.25rem
  background transparent
  border 1px solid rgba(255,255,255,0.12)
  border-radius 8px
  color rgba(255,255,255,0.65)
  font-size 0.875rem
  cursor pointer
  &:hover
    background rgba(255,255,255,0.06)

.loading-state
  display flex
  justify-content center
  padding 4rem
  color rgba(255,255,255,0.4)

.list-empty
  text-align center
  padding 2rem
  color rgba(255,255,255,0.3)
  font-size 0.85rem
  border 1px dashed rgba(255,255,255,0.1)
  border-radius 12px

.bot-list
  display flex
  flex-direction column
  gap 0.75rem

.bot-card
  display flex
  align-items center
  justify-content space-between
  gap 1rem
  background #16161a
  border 1px solid rgba(255,255,255,0.06)
  border-radius 12px
  padding 0.9rem 1.25rem

.bot-card__main
  display flex
  flex-direction column
  gap 2px
  min-width 0

.bot-card__name
  font-weight 700
  font-size 0.9rem

.bot-card__steamid
  font-family 'Courier New', monospace
  font-size 0.78rem
  color rgba(255,255,255,0.4)

.bot-card__meta
  display flex
  align-items center
  gap 0.75rem
  font-size 0.78rem
  color rgba(255,255,255,0.5)
  white-space nowrap

.bot-status
  font-weight 700
  padding 2px 10px
  border-radius 999px
  font-size 0.72rem

.bot-status--on
  color #4ade80
  background rgba(74,222,128,0.1)

.bot-status--off
  color #fc8181
  background rgba(252,129,129,0.1)

.bot-card--editing
  border-color rgba(99,102,241,0.5)

.bot-action
  display flex
  align-items center
  background transparent
  border none
  color rgba(255,255,255,0.4)
  cursor pointer
  padding 4px
  border-radius 6px
  &:hover
    color #a5b4fc
    background rgba(99,102,241,0.12)

.bot-action--danger
  &:hover
    color #fc8181
    background rgba(252,129,129,0.1)

.spin
  animation spin 0.8s linear infinite

@keyframes spin
  from
    transform rotate(0deg)
  to
    transform rotate(360deg)
</style>
