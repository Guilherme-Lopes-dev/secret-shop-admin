<template>
  <section class="section">
    <div>
      <h2 class="section-title">Histórico de alterações</h2>
      <span class="hint">Últimas 50 mudanças na conta: orçamento, pausa, criação, cobrança. "Meta" = feito pelo sistema deles.</span>
    </div>
    <p v-if="error" class="error-msg">{{ error }}</p>
    <p v-else-if="!activities" class="hint">Carregando...</p>
    <p v-else-if="!activities.length" class="hint">Nenhuma alteração registrada.</p>
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Quando</th>
            <th>O quê</th>
            <th>Onde</th>
            <th>Mudança</th>
            <th>Quem</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(activity, index) in activities" :key="index">
            <td class="nowrap">{{ dayjs(activity.at).format('DD/MM HH:mm') }}</td>
            <td>{{ activity.event }}</td>
            <td>{{ activity.object ?? '-' }}</td>
            <td>{{ activity.change ?? '-' }}</td>
            <td>{{ activity.actor ?? '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { adminService } from '@/services/admin/admin.service'
import { useLive } from './useLive'

const { data: activities, error } = useLive(adminService.getMetaActivities, 'Não carregou o histórico da Meta.')
</script>

<style lang="stylus" scoped>
@import './section.styl'

.nowrap
  white-space nowrap
</style>
