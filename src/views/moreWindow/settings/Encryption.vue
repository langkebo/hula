<template>
  <n-flex vertical :size="40">
    <!-- 加密状态 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.encryption.status') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.encryption.encryption_enabled') }}</span>
            <span class="text-(12px --color-text-tertiary)">{{ encryptionStatusText }}</span>
          </n-flex>
          <n-tag :type="encryptionEnabled ? 'success' : 'warning'" size="small">
            {{ encryptionEnabled ? t('setting.encryption.enabled') : t('setting.encryption.disabled') }}
          </n-tag>
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.encryption.device_verified') }}</span>
            <span class="text-(12px --color-text-tertiary)">{{ t('setting.encryption.device_verified_desc') }}</span>
          </n-flex>
          <n-tag :type="deviceVerified ? 'success' : 'warning'" size="small">
            {{ deviceVerified ? t('setting.encryption.verified') : t('setting.encryption.not_verified') }}
          </n-tag>
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.encryption.backup_status') }}</span>
            <span class="text-(12px --color-text-tertiary)">{{ backupStatusText }}</span>
          </n-flex>
          <n-tag :type="backupEnabled ? 'success' : 'default'" size="small">
            {{ backupEnabled ? t('setting.encryption.backed_up') : t('setting.encryption.not_backed_up') }}
          </n-tag>
        </n-flex>
      </n-flex>
    </n-flex>

    <!-- 设备管理 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.encryption.device_management') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <n-flex class="mb-12px" justify="space-between" align="center">
          <span class="text-(12px --color-text-tertiary)">{{ t('setting.encryption.current_device') }}: {{ currentDeviceId }}</span>
          <n-button size="small" type="primary" @click="handleRefreshDevices">
            <template #icon>
              <svg class="size-14px"><use href="#refresh"></use></svg>
            </template>
            {{ t('common.refresh') }}
          </n-button>
        </n-flex>

        <div v-if="loading" class="text-center py-20px">
          <n-spin size="small" />
        </div>

        <div v-else-if="devices.length === 0" class="text-(12px --color-text-tertiary) text-center py-20px">
          {{ t('setting.encryption.no_devices') }}
        </div>

        <n-scrollbar v-else style="max-height: 400px">
          <template v-for="(device, index) in devices" :key="device.device_id">
            <n-flex align="center" justify="space-between" class="py-12px">
              <n-flex vertical :size="4" class="flex-1">
                <n-flex align="center" :size="8">
                  <span class="text-14px font-500">{{ device.display_name || device.device_id }}</span>
                  <n-tag v-if="device.device_id === currentDeviceId" type="info" size="small">
                    {{ t('setting.encryption.current') }}
                  </n-tag>
                  <n-tag v-if="device.verified" type="success" size="small">
                    {{ t('setting.encryption.verified') }}
                  </n-tag>
                </n-flex>
                <span class="text-(12px --color-text-tertiary)">{{ device.device_id }}</span>
                <span v-if="device.last_seen_ts" class="text-(12px --color-text-tertiary)">
                  {{ t('setting.encryption.last_seen') }}: {{ formatLastSeen(device.last_seen_ts) }}
                </span>
              </n-flex>
              <n-flex :size="8">
                <n-button
                  v-if="!device.verified"
                  size="small"
                  type="primary"
                  secondary
                  @click="handleVerifyDevice(device)">
                  {{ t('setting.encryption.verify') }}
                </n-button>
                <n-button
                  v-if="device.device_id !== currentDeviceId"
                  size="small"
                  type="error"
                  secondary
                  @click="handleDeleteDevice(device)">
                  {{ t('common.delete') }}
                </n-button>
              </n-flex>
            </n-flex>
            <span v-if="index < devices.length - 1" class="w-full h-1px bg-[--line-color] block"></span>
          </template>
        </n-scrollbar>
      </n-flex>
    </n-flex>

    <!-- 密钥备份 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.encryption.key_backup') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.encryption.enable_backup') }}</span>
            <span class="text-(12px --color-text-tertiary)">{{ t('setting.encryption.enable_backup_desc') }}</span>
          </n-flex>
          <n-button v-if="!backupEnabled" size="small" type="primary" @click="handleSetupBackup">
            {{ t('setting.encryption.setup_backup') }}
          </n-button>
          <n-button v-else size="small" type="default" @click="handleManageBackup">
            {{ t('setting.encryption.manage_backup') }}
          </n-button>
        </n-flex>

        <span v-if="backupEnabled" class="w-full h-1px bg-[--line-color]"></span>

        <n-flex v-if="backupEnabled" align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.encryption.restore_backup') }}</span>
            <span class="text-(12px --color-text-tertiary)">{{ t('setting.encryption.restore_backup_desc') }}</span>
          </n-flex>
          <n-button size="small" type="default" @click="handleRestoreBackup">
            {{ t('setting.encryption.restore') }}
          </n-button>
        </n-flex>
      </n-flex>
    </n-flex>

    <!-- 加密设置 -->
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.encryption.settings') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.encryption.never_send_unencrypted') }}</span>
            <span class="text-(12px --color-text-tertiary)">{{ t('setting.encryption.never_send_unencrypted_desc') }}</span>
          </n-flex>
          <n-switch size="small" v-model:value="neverSendUnencrypted" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.encryption.show_encryption_warnings') }}</span>
            <span class="text-(12px --color-text-tertiary)">{{ t('setting.encryption.show_encryption_warnings_desc') }}</span>
          </n-flex>
          <n-switch size="small" v-model:value="showEncryptionWarnings" />
        </n-flex>
      </n-flex>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage, useDialog } from 'naive-ui'
import {
  matrixDeviceService,
  matrixKeyBackupService,
  matrixVerificationService,
  matrixEncryptionService
} from '@/services/matrix'
import type { Device } from '@/services/matrix/user/MatrixDeviceService'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const devices = ref<Device[]>([])
const currentDeviceId = ref<string | null>(null)
const encryptionEnabled = ref(true)
const deviceVerified = ref(false)
const backupEnabled = ref(false)
const neverSendUnencrypted = ref(false)
const showEncryptionWarnings = ref(true)

const encryptionStatusText = computed(() => {
  return encryptionEnabled.value
    ? t('setting.encryption.encryption_enabled_desc')
    : t('setting.encryption.encryption_disabled_desc')
})

const backupStatusText = computed(() => {
  return backupEnabled.value
    ? t('setting.encryption.backup_enabled_desc')
    : t('setting.encryption.backup_disabled_desc')
})

const formatLastSeen = (timestamp: number) => {
  return formatDistanceToNow(new Date(timestamp), {
    addSuffix: true,
    locale: zhCN
  })
}

const loadEncryptionStatus = async () => {
  try {
    encryptionEnabled.value = await matrixEncryptionService.isEncryptionAvailable()
    deviceVerified.value = encryptionEnabled.value ? await matrixVerificationService.isCurrentDeviceVerified() : false
  } catch {
    encryptionEnabled.value = false
    deviceVerified.value = false
  }
}

const loadBackupStatus = async () => {
  try {
    const versions = await matrixKeyBackupService.getBackupVersions()
    backupEnabled.value = versions.length > 0
  } catch {
    backupEnabled.value = false
  }
}

const loadDevices = async () => {
  try {
    loading.value = true
    currentDeviceId.value = matrixDeviceService.getCurrentDeviceId()
    devices.value = await matrixDeviceService.getDevices()
    const userId = matrixVerificationService.getCurrentUserId()
    for (const device of devices.value) {
      try {
        device.verified = userId ? await matrixVerificationService.isDeviceVerified(userId, device.device_id) : false
      } catch {
        device.verified = false
      }
    }
  } catch (error) {
    message.error(t('setting.encryption.load_devices_failed'))
  } finally {
    loading.value = false
  }
}

const handleRefreshDevices = () => {
  loadDevices()
}

const handleVerifyDevice = async (device: Device) => {
  try {
    const transactionId = await matrixVerificationService.startSasVerificationWithCurrentUser(device.device_id)
    message.info(`验证已开始，事务ID: ${transactionId}`)
  } catch (error) {
    message.error(t('setting.encryption.verify_device_todo'))
  }
}

const handleDeleteDevice = async (device: Device) => {
  dialog.warning({
    title: t('common.confirm'),
    content: t('setting.encryption.delete_device_confirm'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await matrixDeviceService.deleteDevice(device.device_id)
        message.success(t('setting.encryption.delete_device_success'))
        await loadDevices()
      } catch (error) {
        message.error(t('setting.encryption.delete_device_failed'))
      }
    }
  })
}

const handleSetupBackup = async () => {
  try {
    const authData = await matrixEncryptionService.prepareKeyBackupVersionAuthData()
    if (!authData) {
      message.error(t('setting.encryption.disabled'))
      return
    }

    const algorithm = 'm.megolm.backup.v1'
    await matrixKeyBackupService.createBackupVersion(algorithm, authData)
    message.success(t('setting.encryption.setup_backup'))
    await loadBackupStatus()
  } catch (error) {
    message.error(t('setting.encryption.setup_backup_todo'))
  }
}

const handleManageBackup = async () => {
  try {
    const versions = await matrixKeyBackupService.getBackupVersions()
    if (versions.length > 0) {
      const info = await matrixKeyBackupService.getBackupVersion(versions[0].version)
      dialog.info({
        title: t('setting.encryption.manage_backup'),
        content: `${t('setting.encryption.enabled')}: ${info.algorithm}`,
        positiveText: t('common.confirm')
      })
    }
  } catch (error) {
    message.error(t('setting.encryption.manage_backup_todo'))
  }
}

const handleRestoreBackup = async () => {
  dialog.warning({
    title: t('setting.encryption.restore_backup'),
    content: t('setting.encryption.restore_backup_desc'),
    positiveText: t('setting.encryption.restore'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        const versions = await matrixKeyBackupService.getBackupVersions()
        if (versions.length > 0) {
          message.info(t('setting.encryption.restore_backup_todo'))
        }
      } catch (error) {
        message.error(t('setting.encryption.restore_backup_todo'))
      }
    }
  })
}

onMounted(() => {
  loadDevices()
  loadEncryptionStatus()
  loadBackupStatus()
})
</script>

<style scoped lang="scss">
.item {
  background: var(--bg-popover);
  border-radius: 8px;
  border: 1px solid var(--line-color);
}
</style>
