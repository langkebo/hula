<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('setting.encryption.title')" />
    </template>

    <template #container>
      <div class="encryption-settings">
        <!-- 加密状态 -->
        <van-cell-group :title="t('setting.encryption.status')" inset>
          <van-cell :title="t('setting.encryption.encryption_enabled')" :value="encryptionStatusText">
            <template #right-icon>
              <van-tag :type="encryptionEnabled ? 'success' : 'warning'" size="medium">
                {{ encryptionEnabled ? t('setting.encryption.enabled') : t('setting.encryption.disabled') }}
              </van-tag>
            </template>
          </van-cell>

          <van-cell
            :title="t('setting.encryption.device_verified')"
            :label="t('setting.encryption.device_verified_desc')">
            <template #right-icon>
              <van-tag :type="deviceVerified ? 'success' : 'warning'" size="medium">
                {{ deviceVerified ? t('setting.encryption.verified') : t('setting.encryption.not_verified') }}
              </van-tag>
            </template>
          </van-cell>

          <van-cell :title="t('setting.encryption.backup_status')" :value="backupStatusText">
            <template #right-icon>
              <van-tag :type="backupEnabled ? 'success' : 'default'" size="medium">
                {{ backupEnabled ? t('setting.encryption.backed_up') : t('setting.encryption.not_backed_up') }}
              </van-tag>
            </template>
          </van-cell>
        </van-cell-group>

        <!-- 设备管理 -->
        <van-cell-group :title="t('setting.encryption.device_management')" inset>
          <van-cell :title="t('setting.encryption.current_device')" :value="currentDeviceId || ''" />

          <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
            <van-list
              v-model:loading="loading"
              :finished="finished"
              :finished-text="t('common.no_more')"
              @load="loadDevices">
              <van-cell
                v-for="device in devices"
                :key="device.device_id"
                :title="device.display_name || device.device_id"
                :label="device.device_id"
                is-link
                @click="handleDeviceClick(device)">
                <template #value>
                  <div class="device-tags">
                    <van-tag v-if="device.device_id === currentDeviceId" type="primary" size="medium">
                      {{ t('setting.encryption.current') }}
                    </van-tag>
                    <van-tag v-if="device.verified" type="success" size="medium">
                      {{ t('setting.encryption.verified') }}
                    </van-tag>
                  </div>
                </template>
              </van-cell>
            </van-list>
          </van-pull-refresh>
        </van-cell-group>

        <!-- 密钥备份 -->
        <van-cell-group :title="t('setting.encryption.key_backup')" inset>
          <van-cell
            :title="t('setting.encryption.enable_backup')"
            :label="t('setting.encryption.enable_backup_desc')"
            is-link
            @click="handleBackupClick">
            <template #right-icon>
              <van-button v-if="!backupEnabled" type="primary" size="small">
                {{ t('setting.encryption.setup_backup') }}
              </van-button>
              <van-button v-else type="default" size="small">
                {{ t('setting.encryption.manage_backup') }}
              </van-button>
            </template>
          </van-cell>

          <van-cell
            v-if="backupEnabled"
            :title="t('setting.encryption.restore_backup')"
            :label="t('setting.encryption.restore_backup_desc')"
            is-link
            @click="handleRestoreBackup" />
        </van-cell-group>

        <!-- Key backup dialog entry -->
        <van-cell-group :title="t('encryption.backup.title')" inset>
          <van-cell :title="t('encryption.keyBackup.setup')" is-link @click="showKeyBackupSetup = true" />
          <van-cell :title="t('encryption.keyBackup.restore')" is-link @click="showKeyBackupRestore = true" />
        </van-cell-group>

        <!-- 加密设置 -->
        <van-cell-group :title="t('setting.encryption.settings')" inset>
          <van-cell
            :title="t('setting.encryption.never_send_unencrypted')"
            :label="t('setting.encryption.never_send_unencrypted_desc')">
            <template #right-icon>
              <van-switch v-model="neverSendUnencrypted" size="20px" />
            </template>
          </van-cell>

          <van-cell
            :title="t('setting.encryption.show_encryption_warnings')"
            :label="t('setting.encryption.show_encryption_warnings_desc')">
            <template #right-icon>
              <van-switch v-model="showEncryptionWarnings" size="20px" />
            </template>
          </van-cell>
        </van-cell-group>
      </div>

      <!-- 设备详情弹出层 -->
      <van-action-sheet
        v-model:show="showDeviceSheet"
        :title="selectedDevice?.display_name || selectedDevice?.device_id">
        <div class="device-detail">
          <van-cell-group>
            <van-cell :title="t('setting.encryption.device_id')" :value="selectedDevice?.device_id" />
            <van-cell
              v-if="selectedDevice?.last_seen_ts"
              :title="t('setting.encryption.last_seen')"
              :value="formatLastSeen(selectedDevice.last_seen_ts)" />
          </van-cell-group>

          <div class="device-actions">
            <van-button v-if="!selectedDevice?.verified" type="primary" block @click="handleVerifyDevice">
              {{ t('setting.encryption.verify') }}
            </van-button>
            <van-button
              v-if="selectedDevice?.device_id !== currentDeviceId"
              type="danger"
              block
              @click="handleDeleteDevice">
              {{ t('common.delete') }}
            </van-button>
          </div>
        </div>
      </van-action-sheet>

      <van-dialog
        v-model:show="showRestoreDialog"
        :title="t('setting.encryption.restore_backup')"
        show-cancel-button
        @confirm="handleRestoreConfirm">
        <div class="p-16px">
          <div class="text-14px text-[--hula-text-secondary] mb-12px">
            {{ t('setting.encryption.restore_backup_desc') }}
          </div>
          <van-field
            v-model="recoveryKey"
            type="textarea"
            rows="3"
            :placeholder="t('setting.encryption.recovery_key_placeholder')" />
        </div>
      </van-dialog>

      <!-- Key backup dialog components -->
      <MobileKeyBackupDialog v-model="showKeyBackupSetup" mode="setup" @complete="onKeyBackupComplete" />
      <MobileKeyBackupDialog v-model="showKeyBackupRestore" mode="restore" @complete="onKeyBackupComplete" />
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { showConfirmDialog, showToast } from 'vant'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import MobileKeyBackupDialog from '@/mobile/components/encryption/MobileKeyBackupDialog.vue'
import { matrixEncryptionContextService } from '@/services/matrix/crypto/MatrixEncryptionContextService'
import { matrixKeyBackupService } from '@/services/matrix/crypto/MatrixKeyBackupService'
import { matrixVerificationService } from '@/services/matrix/crypto/MatrixVerificationService'
import type { Device } from '@/services/matrix/user/MatrixDeviceService'
import { matrixDeviceService } from '@/services/matrix/user/MatrixDeviceService'

const { t } = useI18n()

const loading = ref(false)
const refreshing = ref(false)
const finished = ref(false)
const devices = ref<Device[]>([])
const currentDeviceId = ref<string | null>(null)
const encryptionEnabled = ref(true)
const deviceVerified = ref(false)
const backupEnabled = ref(false)
const neverSendUnencrypted = ref(false)
const showEncryptionWarnings = ref(true)
const showDeviceSheet = ref(false)
const selectedDevice = ref<Device | null>(null)
// MobileKeyBackupDialog state
const showKeyBackupSetup = ref(false)
const showKeyBackupRestore = ref(false)
function onKeyBackupComplete() {
  loadBackupStatus()
}

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

dayjs.extend(relativeTime)

const formatLastSeen = (timestamp: number) => {
  return dayjs(timestamp).fromNow()
}

const loadEncryptionStatus = async () => {
  try {
    const { userId, deviceId, isCryptoEnabled } = matrixEncryptionContextService.getCurrentSessionContext()
    encryptionEnabled.value = isCryptoEnabled

    if (isCryptoEnabled && userId && deviceId) {
      deviceVerified.value = await matrixVerificationService.isDeviceVerified(userId, deviceId)
    }
  } catch {
    encryptionEnabled.value = false
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
    const deviceList = await matrixDeviceService.getDevices()
    devices.value = deviceList
    finished.value = true

    const { userId } = matrixEncryptionContextService.getCurrentSessionContext()
    if (userId) {
      for (const device of devices.value) {
        try {
          device.verified = await matrixVerificationService.isDeviceVerified(userId, device.device_id)
        } catch {
          device.verified = false
        }
      }
    }
  } catch (error) {
    showToast(t('setting.encryption.load_devices_failed'))
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

const onRefresh = () => {
  finished.value = false
  devices.value = []
  loadDevices()
}

const handleDeviceClick = (device: Device) => {
  selectedDevice.value = device
  showDeviceSheet.value = true
}

const handleVerifyDevice = async () => {
  if (!selectedDevice.value) return

  const { userId } = matrixEncryptionContextService.getCurrentSessionContext()
  if (!userId) return

  try {
    const transactionId = await matrixVerificationService.startSasVerification(userId, selectedDevice.value.device_id)
    showToast(t('mobile_devices.verification_started', { transactionId }))
  } catch (error) {
    showToast(t('setting.encryption.verify_device_todo'))
  }
  showDeviceSheet.value = false
}

const handleDeleteDevice = async () => {
  if (!selectedDevice.value) return

  try {
    await showConfirmDialog({
      title: t('common.confirm'),
      message: t('setting.encryption.delete_device_confirm')
    })

    await matrixDeviceService.deleteDevice(selectedDevice.value.device_id)
    showToast(t('setting.encryption.delete_device_success'))
    showDeviceSheet.value = false
    onRefresh()
  } catch (error) {
    if (error !== 'cancel') {
      showToast(t('setting.encryption.delete_device_failed'))
    }
  }
}

const handleBackupClick = async () => {
  if (backupEnabled.value) {
    try {
      const versions = await matrixKeyBackupService.getBackupVersions()
      if (versions.length > 0) {
        showToast(`${t('setting.encryption.manage_backup')}: v${versions[0].version}`)
      }
    } catch {
      showToast(t('setting.encryption.manage_backup_todo'))
    }
  } else {
    try {
      const preparedBackup = await matrixEncryptionContextService.prepareKeyBackupVersion()
      if (!preparedBackup) {
        showToast(t('setting.encryption.disabled'))
        return
      }

      await matrixKeyBackupService.createBackupVersion(preparedBackup.algorithm, preparedBackup.authData)
      showToast(t('setting.encryption.setup_backup'))
      await loadBackupStatus()
    } catch {
      showToast(t('setting.encryption.setup_backup_todo'))
    }
  }
}

const showRestoreDialog = ref(false)
const recoveryKey = ref('')

const handleRestoreBackup = () => {
  showRestoreDialog.value = true
}

const handleRestoreConfirm = async () => {
  if (!recoveryKey.value.trim()) {
    showToast(t('setting.encryption.recovery_key_required'))
    return
  }

  try {
    const versions = await matrixKeyBackupService.getBackupVersions()
    if (versions.length === 0) {
      showToast(t('setting.encryption.no_backup_found'))
      return
    }

    const latestVersion = versions[versions.length - 1]
    await matrixKeyBackupService.recoverKeys(latestVersion.version)

    showToast(t('setting.encryption.restore_backup_success'))
    showRestoreDialog.value = false
    recoveryKey.value = ''
    await loadBackupStatus()
  } catch (error) {
    showToast(t('setting.encryption.restore_backup_failed'))
  }
}
onMounted(() => {
  loadDevices()
  loadEncryptionStatus()
  loadBackupStatus()
})
</script>

<style scoped lang="scss">
.encryption-settings {
  padding: 16px 0;
  background: var(--van-background-2);
  min-height: 100vh;

  :deep(.van-cell-group) {
    margin-bottom: 16px;
  }
}

.device-tags {
  display: flex;
  gap: 4px;
  align-items: center;
}

.device-detail {
  padding: 16px;

  .device-actions {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
}
</style>
