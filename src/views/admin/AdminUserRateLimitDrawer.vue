<template>
  <n-drawer :show="show" placement="right" :width="380" @update:show="emit('update:show', $event)">
    <n-drawer-content :title="t('admin.users.overrideUserRateLimit')" closable>
      <span>{{ t('admin.users.overrideRateLimitConfirm') }}</span>
      <template #footer>
        <div class="flex justify-end gap-12px">
          <n-button @click="emit('update:show', false)">{{ t('admin.common.cancel') }}</n-button>
          <n-button type="warning" :loading="settingRateLimit" @click="handleOverrideRateLimit">
            {{ t('admin.common.confirm') }}
          </n-button>
        </div>
      </template>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { NButton, NDrawer, NDrawerContent } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UseAdminUsersResult } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAdminErrorHandler } from './useAdminError'

const props = defineProps<{
  /** 父级持有的用户管理 composable 实例；本组件不自行创建，避免状态分叉。 */
  admin: UseAdminUsersResult
  /** 目标用户；为空时提交直接返回。 */
  userId: string
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { handleAdminError } = useAdminErrorHandler()

const settingRateLimit = ref(false)

async function handleOverrideRateLimit() {
  if (!props.userId) return
  settingRateLimit.value = true
  try {
    await props.admin.overrideUserRateLimit(props.userId)
    showFeedback(t('admin.users.rateLimitSetSuccess'), 'success')
    emit('update:show', false)
  } catch (err) {
    if (handleAdminError(err)) showFeedback(t('admin.users.rateLimitSetFailed'), 'error')
  } finally {
    settingRateLimit.value = false
  }
}
</script>
