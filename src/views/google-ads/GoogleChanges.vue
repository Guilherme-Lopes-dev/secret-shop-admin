<template>
  <section class="section">
    <div>
      <h2 class="section-title">Histórico de alterações</h2>
      <span class="hint">Últimas 50 mudanças na conta nos últimos 30 dias (o Google não guarda mais que isso).</span>
    </div>
    <p v-if="error" class="error-msg">{{ error }}</p>
    <p v-else-if="!changes" class="hint">Carregando...</p>
    <p v-else-if="!changes.length" class="hint">Nenhuma alteração nos últimos 30 dias.</p>
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Quando</th>
            <th>O quê</th>
            <th>Onde</th>
            <th>Campos</th>
            <th>Quem</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(change, index) in changes" :key="index">
            <td class="nowrap">{{ dayjs(change.at).format('DD/MM HH:mm') }}</td>
            <td>{{ change.operation }} {{ change.resource.toLowerCase() }}</td>
            <td>{{ [change.campaign, change.ad_group].filter(Boolean).join(' › ') || '-' }}</td>
            <td>{{ change.fields ?? '-' }}</td>
            <td>
              {{ change.user ?? '-' }}
              <span v-if="change.source" class="hint">{{ change.source }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { adminService } from '@/services/admin/admin.service'
import { useLive } from '@/views/ads/useLive'

const { data: changes, error } = useLive(adminService.getGoogleChanges, 'Não carregou o histórico do Google Ads.')
</script>

<style lang="stylus" scoped>
@import '../ads/section.styl'

.nowrap
  white-space nowrap
</style>
