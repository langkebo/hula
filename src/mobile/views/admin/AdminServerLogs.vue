<template>
  <mobile-layout :title="t('admin.server_logs.title')" show-back>
    <div class="mobile-admin-server-logs">
      <van-notice-bar :scrollable="false" mode="closeable" color="#9a5a00" background="#fff8e6">
        {{ t('admin.feature_not_ready') }}
      </van-notice-bar>

      <van-cell-group inset :title="t('admin.server_logs.filters')">
        <van-field
          v-model="levelInput"
          :label="t('admin.server_logs.level')"
          :placeholder="'info | warn | error | debug'" />
        <van-field
          v-model.number="admin.limit.value"
          :label="t('admin.server_logs.limit')"
          type="digit" />
        <div class="action">
          <van-button type="primary" block :loading="admin.loading.value" @click="onLoad">
            {{ t('common.refresh') }}
          </van-button>
        </div>
      </van-cell-group>

      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-cell-group inset :title="t('admin.server_logs.entries')">
          <van-cell
            v-for="(log, idx) in admin.logs.value"
            :key="idx"
            :title="(log.level as string) || '-'"
            :label="(log.message as string) || (log.msg as string) || ''" />
          <van-empty v-if="!admin.logs.value.length" :description="t('admin.no_data')" />
        </van-cell-group>
      </van-pull-refresh>
    </div>
  </mobile-layout>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from 'vant'
import MobileLayout from '@/mobile/layout/index.vue'
import { useAdminServerLogs, type LogLevel } from '@/composables/admin'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileAdminServerLogs')
const { t } = useI18n()

const admin = useAdminServerLogs()
const refreshing = ref(false)
const levelInput = ref('')

watch(levelInput, (val) => {
  const trimmed = val.trim().toLowerCase()
  admin.level.value = (['debug', 'info', 'warn', 'error'] as LogLevel[]).includes(trimmed as LogLevel)
    ? (trimmed as LogLevel)
    : undefined
})

const onLoad = async () => {
  try {
    await admin.loadLogs()
  } catch (error) {
    logger.error('[MobileAdminServerLogs] load failed', error)
    showToast(t('admin.load_failed'))
  }
}

const onRefresh = async () => {
  refreshing.value = true
  try {
    await admin.loadLogs()
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
