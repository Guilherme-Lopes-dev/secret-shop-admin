<template>
  <ul class="changes">
    <li v-for="(change, index) in changes" :key="index" class="change">
      <span class="impact" :class="change.impact">{{ IMPACT_LABELS[change.impact] }}</span>
      <span class="where">{{ whereOf(change) }}</span>
      <span class="text">
        {{ change.text }}
        <small v-if="change.info" class="info">{{ change.info }}</small>
      </span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import type { PatchChange } from './patchAnalysisApi'
import { IMPACT_LABELS } from './recommendations'

defineProps<{ changes: PatchChange[] }>()

const SCOPE_LABELS: Record<PatchChange['scope'], string> = {
  hero: 'Atributos',
  talent: 'Talento',
  ability: 'Habilidade',
}

const whereOf = (change: PatchChange) => change.ability ?? SCOPE_LABELS[change.scope]
</script>

<style lang="stylus" scoped>
.changes
  list-style none
  margin 0
  padding 0.25rem 0
  display flex
  flex-direction column
  gap 0.4rem

.change
  display grid
  grid-template-columns 70px 160px 1fr
  gap 0.75rem
  align-items baseline
  font-size 0.82rem
  @media (max-width 800px)
    grid-template-columns 70px 1fr
    .where
      display none

.impact
  font-size 0.7rem
  padding 2px 6px
  border-radius 99px
  text-align center
  background rgba(255,255,255,0.08)
  color #cbd5e1
  &.buff
    background rgba(52,211,153,0.15)
    color #34d399
  &.nerf
    background rgba(252,129,129,0.12)
    color #fc8181
  &.review
    background rgba(99,102,241,0.15)
    color #a5b4fc

.where
  color #94a3b8

.text
  color #e2e8f0

.info
  display block
  color #64748b
  margin-top 2px
</style>
