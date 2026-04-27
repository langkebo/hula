<template>
  <mobile-layout :title="t('admin.logs.title')" show-back>
    <div class="mobile-admin-server-logs">
      <van-notice-bar :scrollable="false" mode="closeable" color="#2a5f9e" background="#eef6ff">
        服务器日志页已改为状态面板，直接展示后端已实现的服务状态数据。
      </van-notice-bar>

      <div class="action">
        <van-button type="primary" block :loading="admin.loading.value" @click="onLoad">
          {{ t('common.refresh') }}
        </van-button>
      </div>

      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-cell-group inset title="运行状态">
          <van-cell title="状态" :value="statusLabel" />
          <van-cell title="运行时长" :value="formatDuration(admin.status.value?.uptime)" />
        </van-cell-group>

        <van-cell-group inset title="健康检查">
          <van-cell title="健康状态" :value="admin.health.value?.healthy ? 'Healthy' : 'Unhealthy'" />
          <van-cell title="检查项" :label="JSON.stringify(admin.health.value?.checks ?? {}, null, 2)" />
        </van-cell-group>

        <van-cell-group inset title="版本信息">
          <van-cell title="Server" :value="admin.version.value?.serverVersion || '-'" />
          <van-cell title="Python" :value="admin.version.value?.pythonVersion || '-'" />
        </van-cell-group>

        <van-cell-group inset title="统计信息">
          <van-cell :title="t('admin.total_users')" :value="String(admin.stats.value?.userCount ?? '-')" />
          <van-cell :title="t('admin.total_rooms')" :value="String(admin.stats.value?.roomCount ?? '-')" />
          <van-cell :title="t('admin.active_users')" :value="String(admin.stats.value?.dailyActiveUsers ?? '-')" />
        </van-cell-group>
      </van-pull-refresh>
    </div>
  </mobile-layout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from 'vant'
import MobileLayout from '@/mobile/layout/index.vue'
import { useAdminServerLogs } from '@/composables/admin'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileAdminServerLogs')
const { t } = useI18n()

const admin = useAdminServerLogs()
const refreshing = ref(false)

const statusLabel = computed(() => {
  switch (admin.status.value?.status) {
    case 'online':
      return 'Online'
    case 'degraded':
      return 'Degraded'
    case 'offline':
      return 'Offline'
    default:
      return '-'
  }
})

function formatDuration(value?: number): string {
  if (!value) return '-'
  const seconds = value > 1_000_000 ? Math.floor(value / 1000) : Math.floor(value)
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${days}d ${hours}h ${minutes}m`
}

const onLoad = async () => {
  try {
    await admin.loadPanel()
  } catch (error) {
    logger.error('[MobileAdminServerLogs] load failed', error)
    showToast(t('admin.load_failed'))
  }
}

const onRefresh = async () => {
  refreshing.value = true
  try {
    await admin.loadPanel()
  } finally {
    refreshing.value = false
  }
}

onRefresh()
</script>

<style scoped lang="scss">
.mobile-admin-server-logs {
  .action {
    padding: 12px 16px;
  }
}
</style>
