<template>
  <van-dialog
    v-model:show="dialogVisible"
    :title="t('mobile_encryption.dehydrated_device.title')"
    show-cancel-button
    :confirm-button-text="t('common.confirm')"
    :cancel-button-text="t('common.cancel')"
    @confirm="handleConfirm">
    <div class="dehydrated-content">
      <p class="description">{{ t('mobile_encryption.dehydrated_device.description') }}</p>

      <van-loading v-if="ddFlow.loading.value" size="20px" class="loading-center" />

      <template v-else>
        <div v-if="ddFlow.devices.value.length === 0" class="empty-state">
          {{ t('mobile_encryption.dehydrated_device.no_devices') }}
        </div>

        <van-cell-group v-else inset>
          <van-cell
            v-for="device in ddFlow.devices.value"
            :key="device.deviceId"
            :title="device.deviceId"
            :label="t('mobile_encryption.dehydrated_device.device_id_label')">
            <template #right-icon>
              <van-button size="small" type="danger" plain @click="handleDelete(device.deviceId)">
                {{ t('common.delete') }}
              </van-button>
            </template>
          </van-cell>
        </van-cell-group>
      </template>

      <div class="actions">
        <van-button type="primary" block :loading="ddFlow.loading.value" @click="handleCreate">
          {{ t('mobile_encryption.dehydrated_device.create') }}
        </van-button>
      </div>
    </div>
  </van-dialog>
</template>

<script setup lang="ts">
import { showConfirmDialog, showToast } from 'vant'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDehydratedDevice } from '@/composables/encryption/useDehydratedDevice'

defineOptions({ name: 'MobileDehydratedDeviceDialog' })

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'complete'): void
}>()

const { t } = useI18n()
const ddFlow = useDehydratedDevice()

const dialogVisible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

watch(
  () => props.show,
  async (isVisible) => {
    if (isVisible) {
      await ddFlow.loadDehydratedDevices()
    }
  }
)

const handleCreate = async () => {
  try {
    await ddFlow.createDehydratedDevice()
    showToast(t('mobile_encryption.dehydrated_device.create_success'))
    await ddFlow.loadDehydratedDevices()
    emit('complete')
  } catch {
    showToast(t('mobile_encryption.dehydrated_device.create_failed'))
  }
}

const handleDelete = async (deviceId: string) => {
  try {
    await showConfirmDialog({
      title: t('common.confirm'),
      message: t('mobile_encryption.dehydrated_device.delete_confirm')
    })
    await ddFlow.deleteDehydratedDevice(deviceId)
    showToast(t('mobile_encryption.dehydrated_device.delete_success'))
    await ddFlow.loadDehydratedDevices()
    emit('complete')
  } catch {
    // user cancelled or delete failed
  }
}

const handleConfirm = () => {
  emit('update:show', false)
}
</script>

<style scoped lang="scss">
.dehydrated-content {
  padding: 16px;

  .description {
    font-size: 14px;
    color: var(--hula-text-secondary);
    margin-bottom: 12px;
    line-height: 1.5;
  }

  .loading-center {
    display: flex;
    justify-content: center;
    padding: 24px;
  }

  .empty-state {
    text-align: center;
    padding: 24px;
    color: var(--hula-text-secondary);
    font-size: 14px;
  }

  .actions {
    margin-top: 16px;
  }
}
</style>
