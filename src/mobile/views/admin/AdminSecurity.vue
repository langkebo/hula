<template>
  <mobile-layout :title="t('admin.security.title')" show-back>
    <div class="mobile-admin-security">
      <van-notice-bar :scrollable="false" mode="closeable" color="#2a5f9e" background="#eef6ff">
        {{ t('admin.security.audit_info') }}
      </van-notice-bar>

      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-cell-group inset :title="t('admin.audit.title')">
          <van-cell
            v-for="(log, idx) in admin.auditLogs.value"
            :key="(log.id as string) || idx"
            :title="(log.action as string) || '-'"
            :label="formatAuditLabel(log)" />
          <van-empty v-if="!admin.auditLogs.value.length" :description="t('admin.logs.empty')" />
        </van-cell-group>
      </van-pull-refresh>
    </div>
  </mobile-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from 'vant'
import MobileLayout from '@/mobile/layout/index.vue'
import { useAdminSecurity } from '@/composables/admin'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileAdminSecurity')
const { t } = useI18n()

const admin = useAdminSecurity()
const refreshing = ref(false)

function formatAuditLabel(log: Record<string, unknown>) {
  const actor = (log.actor_id as string) || '-'
  const resourceType = (log.resource_type as string) || '-'
  const resourceId = (log.resource_id as string) || '-'
  const result = (log.result as string) || '-'
  return `${actor} | ${resourceType}:${resourceId} | ${result}`
}

const onRefresh = async () => {
  refreshing.value = true
  try {
    await admin.loadAuditLogs()
  } catch (error) {
    logger.error('[MobileAdminSecurity] audit load failed', error)
    showToast(t('admin.load_failed'))
  } finally {
    refreshing.value = false
  }
}

onRefresh()
</script>

<style scoped lang="scss">
.mobile-admin-security {
  padding-bottom: 16px;
}
</style>
