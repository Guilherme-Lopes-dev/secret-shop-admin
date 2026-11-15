<template>
  <section class="section">
    <div>
      <h2 class="section-title">Novo anúncio</h2>
      <span class="hint">
        Cria campanha, conjunto e anúncio de imagem, tudo pausado. Público aberto no Brasil (Advantage+), link com utm.
        Depois confira e ative em "Gerenciar campanhas".
      </span>
    </div>
    <form class="form" @submit.prevent="submit">
      <label class="field">
        <span>Nome</span>
        <input v-model.trim="form.name" required maxlength="200" placeholder="Arcanas novembro" />
      </label>
      <div class="field">
        <span>Objetivo</span>
        <div class="choices">
          <label><input v-model="form.objective" type="radio" value="traffic" /> Tráfego (cliques no site)</label>
          <label><input v-model="form.objective" type="radio" value="sales" /> Vendas (compra no Pixel)</label>
        </div>
        <span v-if="form.objective === 'sales'" class="hint">
          Vendas só otimiza depois que a compra começar a chegar no Pixel. Hoje não chega: veja "Pixel e Conversions API".
        </span>
      </div>
      <label class="field">
        <span>Orçamento por dia (R$)</span>
        <input v-model.number="form.daily_budget_brl" type="number" min="6" max="500" step="0.01" required />
      </label>
      <label class="field">
        <span>Link</span>
        <input v-model.trim="form.link" type="url" required />
      </label>
      <div class="field">
        <span>Imagem</span>
        <input :key="fileInputKey" type="file" accept="image/png,image/jpeg" :disabled="uploading" @change="upload" />
        <input v-model.trim="form.image_url" type="url" required placeholder="ou cole uma URL https" />
        <img v-if="form.image_url" :src="form.image_url" alt="Prévia da imagem" class="preview" />
      </div>
      <label class="field">
        <span>Texto principal</span>
        <textarea v-model.trim="form.message" required maxlength="2000" rows="3"></textarea>
      </label>
      <label class="field">
        <span>Título</span>
        <input v-model.trim="form.headline" required maxlength="255" />
      </label>
      <label class="field">
        <span>Botão</span>
        <select v-model="form.call_to_action">
          <option v-for="(label, value) in CALLS_TO_ACTION" :key="value" :value="value">{{ label }}</option>
        </select>
      </label>
      <button type="submit" class="submit" :disabled="!writable || saving || uploading">
        {{ saving ? 'Criando na Meta...' : 'Criar pausado' }}
      </button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { toast } from 'vue3-toastify'
import { adminService, type MetaNewAd } from '@/services/admin/admin.service'
import { mediaUrl } from '@/utils/mediaUrl'

defineProps<{ writable: boolean }>()
const emit = defineEmits<{ created: [] }>()

const CALLS_TO_ACTION = {
  SHOP_NOW: 'Comprar agora',
  BUY_NOW: 'Comprar',
  GET_OFFER: 'Obter oferta',
  SEE_MORE: 'Ver mais',
  LEARN_MORE: 'Saiba mais',
}

const emptyForm = (): MetaNewAd => ({
  name: '',
  objective: 'traffic',
  daily_budget_brl: 20,
  link: 'https://www.secretshopgg.com',
  image_url: '',
  message: '',
  headline: 'Secret Shop',
  call_to_action: 'SHOP_NOW',
})

const form = reactive(emptyForm())
const uploading = ref(false)
const saving = ref(false)
// Trocar a key recria o input de arquivo: é o jeito de limpar o nome do arquivo escolhido.
const fileInputKey = ref(0)

const errorOf = (err: any, fallback: string) => err.response?.data?.message ?? fallback

const upload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const { data } = await adminService.uploadMedia(file)
    form.image_url = mediaUrl(data.url)
  } catch (err: any) {
    toast.error(errorOf(err, 'Não subiu a imagem.'))
  } finally {
    uploading.value = false
  }
}

const submit = async () => {
  if (!window.confirm(`Criar "${form.name}" pausado, com R$ ${form.daily_budget_brl}/dia quando for ativado?`)) return
  saving.value = true
  try {
    await adminService.createMetaAd({ ...form })
    toast.success('Criado pausado na Meta. Confira e ative em "Gerenciar campanhas".')
    Object.assign(form, emptyForm())
    fileInputKey.value++
    emit('created')
  } catch (err: any) {
    toast.error(errorOf(err, 'A Meta recusou o anúncio.'))
  } finally {
    saving.value = false
  }
}
</script>

<style lang="stylus" scoped>
@import './section.styl'

.form
  display grid
  gap 12px
  max-width 560px

.field
  display flex
  flex-direction column
  gap 4px
  font-size 0.8rem
  color rgba(255,255,255,0.6)
  input:not([type=radio]), textarea, select
    padding 7px 12px
    background rgba(0,0,0,0.25)
    border 1px solid rgba(255,255,255,0.12)
    border-radius 6px
    color #fff
    font-size 0.85rem
    font-family inherit

.choices
  display flex
  gap 16px
  flex-wrap wrap
  color rgba(255,255,255,0.8)

.preview
  max-width 220px
  border-radius 8px

.submit
  justify-self start
  padding 8px 16px
  background #6366f1
  border none
  border-radius 6px
  color #fff
  font-size 0.85rem
  cursor pointer
  &:disabled
    opacity 0.5
    cursor not-allowed
</style>
