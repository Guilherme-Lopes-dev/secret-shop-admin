<template>
  <div class="view-wrap">
    <header class="page-header">
      <div>
        <button class="btn-back" @click="router.push('/coupons')">
          <Icon icon="mdi:arrow-left" width="16" /> Cupons
        </button>
        <h1 class="page-title">{{ isEdit ? 'Editar cupom' : 'Novo cupom' }}</h1>
      </div>
    </header>

    <div v-if="loadingCoupon" class="loading-state">
      <Icon icon="mdi:loading" class="spin" width="32" />
    </div>

    <form v-else class="form-grid" @submit.prevent="submit">
      <!-- Left column -->
      <div class="form-col">
        <section class="form-section">
          <h2 class="section-title">Identificação</h2>

          <div class="field">
            <label>Código <span class="required">*</span></label>
            <input
              v-model="form.code"
              type="text"
              placeholder="EX: WELCOME10"
              maxlength="50"
              class="form-input"
              style="text-transform:uppercase"
              required
            />
            <p class="field-hint">Código que o cliente digita. Será salvo em maiúsculas.</p>
          </div>

          <div class="field">
            <label>Descrição</label>
            <input
              v-model="form.description"
              type="text"
              placeholder="Ex: Cupom de boas-vindas"
              maxlength="255"
              class="form-input"
            />
          </div>
        </section>

        <section class="form-section">
          <h2 class="section-title">Desconto</h2>

          <div class="field-row">
            <div class="field">
              <label>Tipo <span class="required">*</span></label>
              <select v-model="form.discount_type" class="form-input" required>
                <option value="PERCENTAGE">Percentual (%)</option>
                <option value="FIXED">Fixo (R$)</option>
              </select>
            </div>
            <div class="field">
              <label>
                Valor <span class="required">*</span>
                <span class="field-unit">{{ form.discount_type === 'PERCENTAGE' ? '%' : 'centavos' }}</span>
              </label>
              <input
                v-model.number="form.discount_value"
                type="number"
                min="1"
                :max="form.discount_type === 'PERCENTAGE' ? 100 : undefined"
                class="form-input"
                required
              />
              <p class="field-hint">
                {{ form.discount_type === 'FIXED' ? `R$ ${(form.discount_value / 100).toFixed(2)}` : `${form.discount_value}% off` }}
              </p>
            </div>
          </div>

          <div class="field toggle-row">
            <label class="toggle-label">
              <div>
                <span>Acumulável com Secret Pass</span>
                <p class="field-hint">Se ativo: cupom aplica sobre o valor já com desconto do passe. Se desativo: aplica sobre subtotal bruto e o maior desconto (passe ou cupom) vence.</p>
              </div>
              <button
                type="button"
                class="toggle"
                :class="{ 'toggle--on': form.stackable_with_pass }"
                @click="form.stackable_with_pass = !form.stackable_with_pass"
              >
                <span class="toggle-knob" />
              </button>
            </label>
          </div>
        </section>

        <section class="form-section">
          <h2 class="section-title">Limites de uso</h2>

          <div class="field-row">
            <div class="field">
              <label>Total de usos</label>
              <input
                v-model.number="form.max_uses"
                type="number"
                min="1"
                placeholder="Sem limite"
                class="form-input"
              />
              <p class="field-hint">Deixe vazio para uso ilimitado.</p>
            </div>
            <div class="field">
              <label>Usos por usuário</label>
              <input
                v-model.number="form.max_uses_per_user"
                type="number"
                min="1"
                placeholder="1"
                class="form-input"
              />
            </div>
          </div>
        </section>

        <section class="form-section">
          <h2 class="section-title">Validade e status</h2>

          <div class="field-row">
            <div class="field">
              <label>Expira em</label>
              <input v-model="form.expires_at" type="datetime-local" class="form-input" />
              <p class="field-hint">Deixe vazio para sem expiração.</p>
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
      </div>

      <!-- Right column: conditions builder -->
      <div class="form-col">
        <section class="form-section">
          <h2 class="section-title">Condições de uso</h2>
          <p class="section-hint">Todas as condições devem ser satisfeitas (lógica AND).</p>

          <CouponConditions v-model="form.conditions" />
        </section>

        <!-- Preview -->
        <section class="form-section preview-section">
          <h2 class="section-title">Preview</h2>
          <div class="preview-card">
            <div class="preview-code">{{ form.code || 'CÓDIGO' }}</div>
            <div class="preview-desc">{{ form.description || 'Sem descrição' }}</div>
            <div class="preview-discount">
              {{ form.discount_type === 'PERCENTAGE' ? `${form.discount_value || 0}% off` : `R$ ${((form.discount_value || 0) / 100).toFixed(2)} off` }}
            </div>
            <div class="preview-meta">
              <span v-if="form.expires_at">Expira {{ $dayjs(form.expires_at).format('DD/MM/YY') }}</span>
              <span v-else>Sem expiração</span>
              &middot;
              <span v-if="form.max_uses">Limite {{ form.max_uses }} usos</span>
              <span v-else>Usos ilimitados</span>
            </div>
          </div>
        </section>

        <!-- Discord notification: only on creation -->
        <section v-if="!isEdit" class="form-section discord-section">
          <h2 class="section-title">
            <Icon icon="ic:baseline-discord" width="16" style="vertical-align:-2px;margin-right:6px;color:#5865f2" />
            Notificação Discord
          </h2>
          <p class="section-hint">Opcional. Envia mensagem em um canal ao criar o cupom.</p>

          <div class="field">
            <label>Canal</label>
            <select v-model="discord.channelId" class="form-input" :disabled="loadingChannels">
              <option value="">{{ loadingChannels ? 'Carregando canais...' : 'Não enviar' }}</option>
              <option
                v-for="ch in textChannels"
                :key="ch.discord_id"
                :value="ch.discord_id"
              >
                {{ ch.guild?.name ? `${ch.guild.name} · ` : '' }}#{{ ch.name }}
              </option>
            </select>
            <p v-if="!loadingChannels && textChannels.length === 0" class="field-hint field-hint--warn">
              Nenhum canal sincronizado. Sincronize uma guild primeiro.
            </p>
          </div>

          <div v-if="discord.channelId" class="field">
            <label>Mensagem</label>
            <textarea
              v-model="discord.message"
              class="form-input discord-textarea"
              placeholder="Ex: Novo cupom disponível: use WELCOME10 para 10% off!"
              maxlength="2000"
              rows="4"
            />
            <p class="field-hint">{{ discord.message.length }}/2000</p>
          </div>
        </section>
      </div>

      <!-- Submit -->
      <div class="form-footer">
        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        <div class="form-footer__actions">
          <button type="button" class="btn-ghost" @click="router.push('/coupons')">Cancelar</button>
          <button type="submit" class="btn-primary" :disabled="submitting">
            {{ submitting ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar cupom' }}
          </button>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Icon } from '@iconify/vue'
import { adminService } from '@/services/admin/admin.service'
import CouponConditions from '@/components/coupons/CouponConditions.vue'
import type { DiscordChannelDto } from '@/services/admin/types'

interface ChannelWithGuild extends DiscordChannelDto {
  guild?: { discord_id: string; name: string }
}

const router = useRouter()
const route = useRoute()

const uuid = computed(() => route.params.uuid as string | undefined)
const isEdit = computed(() => !!uuid.value)
const loadingCoupon = ref(false)
const submitting = ref(false)
const errorMsg = ref('')

const discord = reactive({ channelId: '', message: '' })
const loadingChannels = ref(false)
const channels = ref<ChannelWithGuild[]>([])
const textChannels = computed(() =>
  channels.value.filter((ch) => ch.type === 0 || ch.type === 5)
)

const form = reactive({
  code: '',
  description: '',
  discount_type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
  discount_value: 10,
  max_uses: null as number | null,
  max_uses_per_user: 1 as number | null,
  stackable_with_pass: true,
  is_active: true,
  expires_at: '',
  conditions: [] as any[],
})

const toISOorNull = (val: string) => val ? new Date(val).toISOString() : null

const submit = async () => {
  errorMsg.value = ''
  submitting.value = true
  try {
    const payload: Record<string, unknown> = {
      code: form.code.toUpperCase().trim(),
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: form.discount_value,
      max_uses: form.max_uses || null,
      max_uses_per_user: form.max_uses_per_user ?? 1,
      stackable_with_pass: form.stackable_with_pass,
      is_active: form.is_active,
      expires_at: toISOorNull(form.expires_at),
      conditions: form.conditions,
    }

    if (isEdit.value) {
      await adminService.updateCoupon(uuid.value!, payload)
    } else {
      await adminService.createCoupon(payload)
      if (discord.channelId && discord.message.trim()) {
        await adminService.sendDiscordMessage({
          channelId: discord.channelId,
          content: discord.message.trim(),
          queue: false,
        })
      }
    }

    router.push('/coupons')
  } catch (err: any) {
    errorMsg.value = err?.response?.data?.message ?? 'Erro ao salvar cupom.'
  } finally {
    submitting.value = false
  }
}

const fillForm = (data: any) => {
  form.code = data.code ?? ''
  form.description = data.description ?? ''
  form.discount_type = data.discount_type ?? 'PERCENTAGE'
  form.discount_value = data.discount_value ?? 10
  form.max_uses = data.max_uses ?? null
  form.max_uses_per_user = data.max_uses_per_user ?? 1
  form.stackable_with_pass = data.stackable_with_pass ?? true
  form.is_active = data.is_active ?? true
  form.expires_at = data.expires_at ? new Date(data.expires_at).toISOString().slice(0, 16) : ''
  form.conditions = Array.isArray(data.conditions) ? data.conditions : []
}

onMounted(async () => {
  if (isEdit.value) {
    loadingCoupon.value = true
    try {
      const res = await adminService.getCoupon(uuid.value!)
      fillForm(res.data)
    } finally {
      loadingCoupon.value = false
    }
    return
  }

  loadingChannels.value = true
  try {
    const res = await adminService.getDiscordAllChannels()
    channels.value = res.data as ChannelWithGuild[]
  } catch {
    // silently ignore — discord may not be configured
  } finally {
    loadingChannels.value = false
  }
})
</script>

<style lang="stylus" scoped>
.view-wrap
  padding 2rem
  color #fff
  min-height 100vh

.page-header
  margin-bottom 2rem

.btn-back
  display inline-flex
  align-items center
  gap 6px
  background transparent
  border none
  color rgba(255,255,255,0.45)
  font-size 0.82rem
  cursor pointer
  padding 0 0 8px
  &:hover
    color rgba(255,255,255,0.8)

.page-title
  font-size 1.6rem
  font-weight 700
  margin 0

.loading-state
  display flex
  justify-content center
  padding 4rem
  color rgba(255,255,255,0.4)

.form-grid
  display grid
  grid-template-columns 1fr 1fr
  grid-template-rows auto auto
  gap 1.5rem
  @media (max-width: 900px)
    grid-template-columns 1fr

.form-col
  display flex
  flex-direction column
  gap 1.5rem

.form-footer
  grid-column 1 / -1
  display flex
  align-items center
  justify-content flex-end
  gap 1rem
  padding-top 0.5rem

.form-footer__actions
  display flex
  gap 8px

.error-msg
  color #fc8181
  font-size 0.875rem

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

.section-hint
  font-size 0.8rem
  color rgba(255,255,255,0.4)
  margin -0.5rem 0 1rem

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

.field-unit
  font-weight 400
  color rgba(255,255,255,0.35)
  margin-left 4px

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

  option
    background #1a1a1e
    color #fff

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

// Preview card
.preview-section
  background rgba(99,102,241,0.05)
  border-color rgba(99,102,241,0.15)

.preview-card
  text-align center
  padding 1rem

.preview-code
  font-family 'Courier New', monospace
  font-size 1.4rem
  font-weight 800
  color #a5b4fc
  letter-spacing 0.1em
  margin-bottom 4px

.preview-desc
  font-size 0.85rem
  color rgba(255,255,255,0.5)
  margin-bottom 8px

.preview-discount
  font-size 1.5rem
  font-weight 700
  color #4ade80
  margin-bottom 8px

.preview-meta
  font-size 0.75rem
  color rgba(255,255,255,0.3)

// Discord section
.discord-section
  border-color rgba(88,101,242,0.2)
  background rgba(88,101,242,0.04)

.discord-textarea
  resize vertical
  min-height 80px
  font-family inherit

.field-hint--warn
  color #fbbf24

// Buttons
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

.spin
  animation spin 0.8s linear infinite

@keyframes spin
  from
    transform rotate(0deg)
  to
    transform rotate(360deg)
</style>
