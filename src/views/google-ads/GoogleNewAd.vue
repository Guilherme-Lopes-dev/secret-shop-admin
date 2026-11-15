<template>
  <section class="section">
    <div>
      <h2 class="section-title">Novo anúncio no Google</h2>
      <span class="hint">
        Anúncio de pesquisa num grupo que já existe, com as palavras-chave, tudo pausado. Depois confira e ative em "Editar".
      </span>
    </div>
    <p v-if="!writable" class="warn">Escrita no Google desligada: falta <code>GOOGLE_ADS_APPLY_ENABLED=true</code> no backend.</p>
    <p v-if="error" class="error-msg">{{ error }}</p>
    <form class="form" @submit.prevent="submit">
      <label class="field">
        <span>Grupo</span>
        <select v-model="form.ad_group" required>
          <option value="" disabled>Escolha o grupo</option>
          <option v-for="group in adGroups" :key="group.value" :value="group.value">{{ group.label }}</option>
        </select>
      </label>
      <label class="field">
        <span>Link</span>
        <input v-model.trim="form.final_url" type="url" pattern="https://.*" title="Precisa começar com https://" required />
      </label>
      <div class="field">
        <span>Caminho exibido (opcional, até 15 cada)</span>
        <div class="paths">
          <span class="hint">secretshopgg.com /</span>
          <input v-model.trim="form.path1" maxlength="15" placeholder="skins" aria-label="Caminho 1" />
          <span class="hint">/</span>
          <input v-model.trim="form.path2" maxlength="15" placeholder="arcanas" aria-label="Caminho 2" />
        </div>
      </div>
      <label class="field">
        <span>Títulos, um por linha ({{ headlines.length }}/15, mínimo 3, até 30 caracteres)</span>
        <textarea v-model="headlinesText" rows="6" required></textarea>
      </label>
      <label class="field">
        <span>Descrições, uma por linha ({{ descriptions.length }}/4, mínimo 2, até 90 caracteres)</span>
        <textarea v-model="descriptionsText" rows="4" required></textarea>
      </label>
      <label class="field">
        <span>Palavras-chave, uma por linha ({{ keywords.length }}, opcional)</span>
        <textarea v-model="keywordsText" rows="4"></textarea>
      </label>
      <label class="field">
        <span>Correspondência das palavras-chave</span>
        <select v-model="matchType">
          <option v-for="(label, value) in MATCH_TYPES" :key="value" :value="value">{{ label }}</option>
        </select>
      </label>
      <ul v-if="problems.length" class="problems">
        <li v-for="problem in problems" :key="problem">{{ problem }}</li>
      </ul>
      <button type="submit" class="submit" :disabled="!writable || saving || problems.length > 0">
        {{ saving ? 'Criando no Google...' : 'Criar pausado' }}
      </button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue3-toastify'
import { adminService, type GoogleMatchType } from '@/services/admin/admin.service'
import { useApplyEnabled, useLive } from '@/views/ads/useLive'

const MATCH_TYPES: Record<GoogleMatchType, string> = {
  PHRASE: 'Frase (busca contém o termo)',
  EXACT: 'Exata (busca é o termo)',
  BROAD: 'Ampla (o Google interpreta)',
}

const router = useRouter()
const writable = useApplyEnabled(adminService.getGoogleAdsStatus)
const { data: structure, error } = useLive(adminService.getGoogleStructure, 'Não carregou os grupos do Google Ads.')

const adGroups = computed(() =>
  (structure.value ?? []).flatMap((campaign) =>
    campaign.ad_groups.map((group) => ({ value: group.resource_name, label: `${campaign.name} › ${group.name}` })),
  ),
)

const form = reactive({ ad_group: '', final_url: 'https://www.secretshopgg.com', path1: '', path2: '' })
const headlinesText = ref('')
const descriptionsText = ref('')
const keywordsText = ref('')
const matchType = ref<GoogleMatchType>('PHRASE')
const saving = ref(false)

const linesOf = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

const headlines = computed(() => linesOf(headlinesText.value))
const descriptions = computed(() => linesOf(descriptionsText.value))
const keywords = computed(() => linesOf(keywordsText.value))

const tooLong = (lines: string[], max: number) => lines.filter((line) => line.length > max)

// O Google trata "Skins Dota" e "skins dota" como o mesmo texto.
const repeated = (lines: string[]) =>
  lines.filter((line, index) => lines.findIndex((other) => other.toLowerCase() === line.toLowerCase()) !== index)

// Mesmos limites do Google (e do DTO no backend): avisar aqui evita ida e volta.
const problems = computed(() =>
  [
    { broken: headlines.value.length < 3 || headlines.value.length > 15, message: 'Títulos: de 3 a 15.' },
    { broken: descriptions.value.length < 2 || descriptions.value.length > 4, message: 'Descrições: de 2 a 4.' },
    { broken: !!form.path2 && !form.path1, message: 'O caminho 2 precisa do caminho 1.' },
    ...repeated(headlines.value).map((line) => ({ broken: true, message: `Título repetido: "${line}"` })),
    ...repeated(descriptions.value).map((line) => ({ broken: true, message: `Descrição repetida: "${line}"` })),
    ...repeated(keywords.value).map((line) => ({ broken: true, message: `Palavra-chave repetida: "${line}"` })),
    ...tooLong(headlines.value, 30).map((line) => ({ broken: true, message: `Título com mais de 30: "${line}"` })),
    ...tooLong(descriptions.value, 90).map((line) => ({ broken: true, message: `Descrição com mais de 90: "${line}"` })),
    ...tooLong(keywords.value, 80).map((line) => ({ broken: true, message: `Palavra-chave com mais de 80: "${line}"` })),
  ]
    .filter(({ broken }) => broken)
    .map(({ message }) => message),
)

const payload = () => ({
  ad_group: form.ad_group,
  final_url: form.final_url,
  headlines: headlines.value,
  descriptions: descriptions.value,
  ...(form.path1 ? { path1: form.path1 } : {}),
  ...(form.path2 ? { path2: form.path2 } : {}),
  keywords: keywords.value.map((text) => ({ text, match_type: matchType.value })),
})

const submit = async () => {
  const summary = `${headlines.value.length} títulos e ${keywords.value.length} palavras-chave`
  if (!window.confirm(`Criar anúncio pausado com ${summary}?`)) return
  saving.value = true
  try {
    await adminService.createGoogleSearchAd(payload())
    toast.success('Criado pausado no Google. Confira e ative aqui.')
    router.push({ name: 'campaigns-edit' })
  } catch (err: any) {
    toast.error(err.response?.data?.message ?? 'O Google recusou o anúncio.')
  } finally {
    saving.value = false
  }
}
</script>

<style lang="stylus" scoped>
@import '../ads/section.styl'

.form
  display grid
  gap 12px
  max-width 640px

.field
  display flex
  flex-direction column
  gap 4px
  font-size 0.8rem
  color rgba(255,255,255,0.6)
  input, textarea, select
    padding 7px 12px
    background rgba(0,0,0,0.25)
    border 1px solid rgba(255,255,255,0.12)
    border-radius 6px
    color #fff
    font-size 0.85rem
    font-family inherit

.paths
  display flex
  align-items center
  gap 6px
  flex-wrap wrap
  input
    width 130px

.problems
  margin 0
  padding-left 18px
  color #fbbf24
  font-size 0.8rem

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
