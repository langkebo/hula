<template>
  <mobile-layout :title="t('admin.retention')" show-back>
    <div class="mobile-admin-retention">
      <van-cell-group inset :title="t('admin.retention_status')">
        <van-cell
          v-if="admin.retentionStatus.value"
          :title="t('admin.status')"
          :value="String(admin.retentionStatus.value.status ?? '-')" />
        <van-cell v-else :title="t('admin.status')" value="-" />
        <div class="status-btn">
          <van-button type="primary" :loading="admin.taskLoading.value" block @click="handleRunTask">
            {{ t('admin.run_retention_task') }}
          </van-button>
        </div>
      </van-cell-group>

      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-cell-group :title="t('admin.retention_policies')">
          <van-swipe-cell v-for="policy in admin.policies.value" :key="policy.roomId">
            <van-cell :title="policy.roomId" :label="formatPolicy(policy)" />
            <template #right>
              <van-button square type="danger" :text="t('admin.delete')" @click="handleDelete(policy.roomId)" />
            </template>
          </van-swipe-cell>
        </van-cell-group>
      </van-pull-refresh>

      <div class="add-section">
        <van-button type="primary" block @click="showAddDialog = true">
          {{ t('admin.add_policy') }}
        </van-button>
      </div>

      <van-dialog v-model:show="showAddDialog" :title="t('admin.add_policy')" show-cancel-button @confirm="handleAdd">
        <van-field v-model="newRoomId" :label="t('admin.room_id')" :placeholder="'!room:server'" />
        <van-field v-model="newMaxLifetime" :label="t('admin.max_lifetime_ms')" type="digit" />
        <van-field v-model="newMinLifetime" :label="t('admin.min_lifetime_ms')" type="digit" />
      </van-dialog>
    </div>
  </mobile-layout>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminRetention } from '@/composables/admin'
import type { RetentionPolicyView } from '@/composables/admin/useAdminRetention'
import MobileLayout from '@/mobile/layout/index.vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileAdminRetention')
const { t } = useI18n()

const admin = useAdminRetention()
const refreshing = ref(false)
const showAddDialog = ref(false)
const newRoomId = ref('')
const newMaxLifetime = ref('')
const newMinLifetime = ref('')

const onRefresh = async () => {
  refreshing.value = true
  try {
    await admin.loadAll()
  } catch (error) {
    logger.error('[MobileAdminRetention] 加载失败:', error)
    showToast(t('admin.load_failed'))
  } finally {
    refreshing.value = false
  }
}

const formatPolicy = (p: RetentionPolicyView) => {
  const parts: string[] = []
  if (p.maxLifetime !== undefined) parts.push(`max=${p.maxLifetime}ms`)
  if (p.minLifetime !== undefined) parts.push(`min=${p.minLifetime}ms`)
  return parts.join(' · ') || '-'
}

const handleRunTask = async () => {
  try {
    await admin.runTask()
    showToast(t('admin.operation_success'))
    await onRefresh()
  } catch (error) {
    logger.error('[MobileAdminRetention] 任务失败:', error)
    showToast(t('admin.load_failed'))
  }
}

const handleAdd = async () => {
  if (!newRoomId.value.trim()) return
  try {
    await admin.setPolicy(
      newRoomId.value.trim(),
      newMaxLifetime.value ? Number(newMaxLifetime.value) : undefined,
      newMinLifetime.value ? Number(newMinLifetime.value) : undefined
    )
    showToast(t('admin.operation_success'))
    newRoomId.value = ''
    newMaxLifetime.value = ''
    newMinLifetime.value = ''
    await onRefresh()
  } catch (error) {
    logger.error('[MobileAdminRetention] 添加失败:', error)
    showToast(t('admin.load_failed'))
  }
}

const handleDelete = async (roomId: string) => {
  try {
    await admin.deletePolicy(roomId)
    showToast(t('admin.operation_success'))
  } catch (error) {
    logger.error('[MobileAdminRetention] 删除失败:', error)
    showToast(t('admin.load_failed'))
  }
}

onRefresh()
</script>

<style scoped lang="scss">
.mobile-admin-retention {
  .status-btn {
    padding: 12px 16px;
  }
  .add-section {
    padding: 16px;
  }
}
</style>
