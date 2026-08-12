<template>
  <div class="flex flex-col items-center text-center">
    <div class="mb-16px text-[var(--tjg-color-primary-500)] bg-[var(--tjg-surface-search)] p-16px rounded-full">
      <Icon icon="mdi:clock-outline" :width="48" />
    </div>
    <h3 class="text-[var(--text-lg)] font-medium color-[var(--tjg-text-primary)] mb-8px">
      {{ t('setting.device_verify_dialog.pending_list_title') }}
    </h3>
    <div class="w-full mb-24px">
      <n-alert v-if="pendingVerifications.length === 0" type="info" class="mb-16px">
        {{ t('setting.device_verify_dialog.pending_list_empty') }}
      </n-alert>
      <n-list v-else size="small" bordered>
        <n-list-item v-for="req in pendingVerifications" :key="req.transactionId">
          <div class="flex items-center justify-between w-full">
            <div class="flex-1 min-w-0">
              <div class="text-[var(--text-sm)] color-[var(--tjg-text-primary)] truncate">
                {{ req.userId }}
              </div>
              <div class="text-[var(--text-xs)] color-[var(--tjg-text-tertiary)]">
                {{ t('setting.device_verify_dialog.pending_request_device') }}: {{ req.deviceId }}
              </div>
              <div class="mt-4px">
                <n-tag v-for="method in req.methods" :key="method" size="small" class="mr-4px">
                  {{ method }}
                </n-tag>
              </div>
            </div>
            <n-space size="small">
              <n-button size="small" type="error" ghost @click="emit('decline-pending', req.transactionId)">
                {{ t('setting.device_verify_dialog.decline_request') }}
              </n-button>
              <n-button size="small" type="primary" @click="emit('accept-pending', req)">
                {{ t('setting.device_verify_dialog.accept_request') }}
              </n-button>
            </n-space>
          </div>
        </n-list-item>
      </n-list>
    </div>
    <div class="w-full flex justify-end gap-12px">
      <n-button @click="emit('back')">{{ t('common.back') }}</n-button>
      <n-button type="primary" @click="emit('refresh')">
        {{ t('common.refresh') }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NAlert, NButton, NList, NListItem, NSpace, NTag } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { VerificationRequest } from '@/services/matrix/crypto/MatrixVerificationService'

defineOptions({ name: 'DeviceVerifyPendingStep' })

defineProps<{
  pendingVerifications: VerificationRequest[]
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'refresh'): void
  (e: 'accept-pending', req: VerificationRequest): void
  (e: 'decline-pending', transactionId: string): void
}>()

const { t } = useI18n()
</script>
