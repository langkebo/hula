<template>
  <div class="flex flex-col items-center text-center">
    <div class="mb-16px text-[var(--tjg-color-primary-500)] bg-[var(--tjg-surface-search)] p-16px rounded-full">
      <Icon icon="mdi:shield-check" :width="48" />
    </div>
    <div class="mb-24px text-[var(--text-sm)] color-[var(--tjg-text-secondary)]">
      <p class="mb-8px">{{ t('setting.encryption.device_verify_dialog.intro_primary') }}</p>
      <p>{{ t('setting.encryption.device_verify_dialog.intro_secondary') }}</p>
      <p v-if="inboundRequest" class="mt-8px color-[var(--tjg-color-warning-500)]">
        {{ t('setting.encryption.device_verify_dialog.inbound_request_hint') }}
      </p>
    </div>

    <!-- Inbound request details -->
    <div
      v-if="inboundRequest"
      class="w-full bg-[var(--tjg-color-warning-100)] border border-[var(--tjg-color-warning-500)] rounded-8px p-16px mb-24px text-left">
      <div class="flex items-center gap-8px mb-12px">
        <Icon icon="mdi:account-check" :width="20" class="color-[var(--tjg-color-warning-500)]" />
        <span class="text-[var(--text-sm)] font-medium color-[var(--tjg-text-primary)]">
          {{ t('setting.encryption.device_verify_dialog.inbound_request_hint') }}
        </span>
      </div>
      <div class="flex justify-between mb-8px">
        <span class="text-[var(--text-xs)] color-[var(--tjg-text-tertiary)]">
          {{ t('setting.encryption.device_verify_dialog.pending_request_from') }}
        </span>
        <span class="text-[var(--text-xs)] font-medium color-[var(--tjg-text-primary)]">
          {{ inboundRequest.userId }}
        </span>
      </div>
      <div class="flex justify-between mb-8px">
        <span class="text-[var(--text-xs)] color-[var(--tjg-text-tertiary)]">
          {{ t('setting.encryption.device_verify_dialog.pending_request_device') }}
        </span>
        <span class="text-[var(--text-xs)] font-medium color-[var(--tjg-text-primary)]">
          {{ inboundRequest.deviceId }}
        </span>
      </div>
      <div class="flex justify-between">
        <span class="text-[var(--text-xs)] color-[var(--tjg-text-tertiary)]">
          {{ t('setting.encryption.device_verify_dialog.pending_request_methods') }}
        </span>
        <span class="text-[var(--text-xs)] font-medium color-[var(--tjg-text-primary)]">
          {{ inboundRequest.methods.join(', ') }}
        </span>
      </div>
    </div>

    <!-- Device info card (shown when no inbound request) -->
    <div
      v-else
      class="w-full bg-[var(--tjg-surface-panel)] border border-[var(--tjg-border-default)] rounded-8px p-16px mb-24px text-left">
      <div v-if="isOtherUser && targetUserId" class="flex justify-between mb-12px">
        <span class="text-[var(--text-xs)] color-[var(--tjg-text-tertiary)]">
          {{ t('setting.encryption.device_verify_dialog.verify_user_label') }}
        </span>
        <span class="text-[var(--text-xs)] font-medium color-[var(--tjg-text-primary)] break-all ml-16px">
          {{ targetUserId }}
        </span>
      </div>

      <!-- 跨用户验证：目标设备必须显式选择（本账号设备由调用方直接给出 deviceId） -->
      <div v-if="deviceOptions.length > 0" class="mb-12px">
        <div class="text-[var(--text-xs)] color-[var(--tjg-text-tertiary)] mb-8px">
          {{ t('setting.encryption.device_verify_dialog.select_device_label') }}
        </div>
        <n-select
          size="small"
          :value="selectedDeviceId || null"
          :options="deviceSelectOptions"
          :placeholder="t('setting.encryption.device_verify_dialog.select_device_placeholder')"
          data-testid="device-verify-device-select"
          @update:value="handleDeviceSelect" />
      </div>
      <div
        v-else-if="isOtherUser && !selectedDeviceId"
        class="mb-12px text-[var(--text-xs)] color-[var(--tjg-color-warning-500)]">
        {{ t('setting.encryption.device_verify_dialog.no_device_available') }}
      </div>

      <div class="flex justify-between mb-12px">
        <span class="text-[var(--text-xs)] color-[var(--tjg-text-tertiary)]">
          {{ t('setting.encryption.device_verify_dialog.device_id') }}
        </span>
        <span class="text-[var(--text-xs)] font-medium color-[var(--tjg-text-primary)] break-all ml-16px">
          {{ deviceId }}
        </span>
      </div>
      <div class="flex justify-between">
        <span class="text-[var(--text-xs)] color-[var(--tjg-text-tertiary)]">
          {{ t('setting.encryption.device_verify_dialog.device_name') }}
        </span>
        <span class="text-[var(--text-xs)] font-medium color-[var(--tjg-text-primary)]">
          {{ deviceName || t('setting.encryption.device_verify_dialog.unnamed_device') }}
        </span>
      </div>
    </div>

    <!-- Pending verifications section -->
    <div
      v-if="pendingVerifications.length > 0"
      class="w-full bg-[var(--tjg-surface-panel)] border border-[var(--tjg-border-default)] rounded-8px p-16px mb-24px text-left">
      <div class="flex items-center gap-8px mb-12px">
        <Icon icon="mdi:clock-outline" :width="18" class="color-[var(--tjg-color-primary-500)]" />
        <span class="text-[var(--text-sm)] font-medium color-[var(--tjg-text-primary)]">
          {{ t('setting.encryption.device_verify_dialog.pending_list_title') }}
        </span>
      </div>
      <n-list size="small" bordered>
        <n-list-item v-for="req in pendingVerifications" :key="req.transactionId">
          <div class="flex items-center justify-between w-full">
            <div class="flex-1 min-w-0">
              <div class="text-[var(--text-sm)] color-[var(--tjg-text-primary)] truncate">
                {{ req.userId }}
              </div>
              <div class="text-[var(--text-xs)] color-[var(--tjg-text-tertiary)]">
                {{ t('setting.encryption.device_verify_dialog.pending_request_device') }}: {{ req.deviceId }}
              </div>
            </div>
            <n-space size="small">
              <n-button size="small" type="error" ghost @click="emit('decline-pending', req.transactionId)">
                {{ t('setting.encryption.device_verify_dialog.decline_request') }}
              </n-button>
              <n-button size="small" type="primary" @click="emit('accept-pending', req)">
                {{ t('setting.encryption.device_verify_dialog.accept_request') }}
              </n-button>
            </n-space>
          </div>
        </n-list-item>
      </n-list>
    </div>

    <div class="w-full flex justify-end gap-12px">
      <n-button @click="emit('cancel')">{{ t('common.cancel') }}</n-button>
      <n-button v-if="pendingVerifications.length === 0 && !inboundRequest" tertiary @click="emit('view-pending')">
        {{ t('setting.encryption.device_verify_dialog.view_pending') }}
      </n-button>
      <n-button v-if="inboundRequest" type="error" ghost @click="emit('decline')">
        {{ t('setting.encryption.device_verify_dialog.decline_request') }}
      </n-button>
      <n-button type="primary" @click="emit('start')">
        {{
          inboundRequest
            ? t('setting.encryption.device_verify_dialog.accept_request')
            : t('setting.encryption.device_verify_dialog.start_verification')
        }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NList, NListItem, NSelect, NSpace } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DeviceOption } from '@/composables/encryption/useDeviceVerifyDialog'
import type { VerificationTransaction } from '@/services/matrix/crypto/MatrixVerificationService'

defineOptions({ name: 'DeviceVerifyIntroStep' })

const props = withDefaults(
  defineProps<{
    inboundRequest?: VerificationTransaction | null
    deviceId?: string
    deviceName?: string
    pendingVerifications: VerificationTransaction[]
    /** 目标用户 MXID（跨用户验证时展示） */
    targetUserId?: string
    /** 是否在验证他人设备；决定展示设备选择器/无设备提示 */
    isOtherUser?: boolean
    /** 目标用户的可选设备；为空表示走「本账号设备」直连路径 */
    deviceOptions?: DeviceOption[]
    /** 当前选中的目标设备 */
    selectedDeviceId?: string
  }>(),
  {
    inboundRequest: null,
    deviceId: undefined,
    deviceName: undefined,
    targetUserId: undefined,
    isOtherUser: false,
    deviceOptions: () => [],
    selectedDeviceId: undefined
  }
)

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'view-pending'): void
  (e: 'decline'): void
  (e: 'start'): void
  (e: 'accept-pending', req: VerificationTransaction): void
  (e: 'decline-pending', transactionId: string): void
  (e: 'update:selectedDeviceId', value: string): void
}>()

const { t } = useI18n()

/**
 * 设备选择项：有设备名时带上 deviceId 做消歧——同一用户多台设备可能同名，
 * 仅显示名字会让用户无法判断点的是哪一台。
 */
const deviceSelectOptions = computed(() =>
  props.deviceOptions.map((device) => ({
    label: device.displayName ? `${device.displayName} (${device.deviceId})` : device.deviceId,
    value: device.deviceId
  }))
)

function handleDeviceSelect(value: string) {
  emit('update:selectedDeviceId', value)
}
</script>
