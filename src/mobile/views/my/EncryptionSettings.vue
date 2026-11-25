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
                :key="device.deviceId"
                :title="device.displayName || device.deviceId"
                :label="device.deviceId"
                is-link
                @click="handleDeviceClick(device)">
                <template #value>
                  <div class="device-tags">
                    <van-tag v-if="device.deviceId === currentDeviceId" type="primary" size="medium">
                      {{ t('setting.encryption.current') }}
                    </van-tag>
                    <van-tag v-if="device.isVerified" type="success" size="medium">
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

        <!-- 脱水设备管理 -->
        <van-cell-group :title="t('mobile_encryption.dehydrated_device.title')" inset>
          <van-cell
            :title="t('mobile_encryption.dehydrated_device.manage')"
            :label="t('mobile_encryption.dehydrated_device.description')"
            is-link
            @click="showDehydratedDevice = true" />
        </van-cell-group>

        <!-- 交叉签名状态 -->
        <van-cell-group :title="t('setting.encryption.cross_signing_section')" inset>
          <van-cell :title="t('setting.encryption.cross_signing_status')">
            <template #right-icon>
              <van-tag :type="crossSigningConfigured ? 'success' : 'warning'" size="medium">
                {{
                  crossSigningConfigured
                    ? t('setting.encryption.cross_signing_configured')
                    : t('setting.encryption.cross_signing_not_setup')
                }}
              </van-tag>
            </template>
          </van-cell>
          <van-cell
            v-if="!crossSigningConfigured"
            :title="t('setting.encryption.cross_signing_setup')"
            :label="t('setting.encryption.cross_signing_not_setup_desc')"
            is-link
            @click="handleSetupCrossSigning" />
        </van-cell-group>

        <!-- 安全密钥（SSSS 恢复密钥）入口：方案 4.2 -->
        <van-cell-group :title="t('mobile_security_key.title')" inset>
          <van-cell
            :title="t('mobile_security_key.manage')"
            :label="t('mobile_security_key.intro')"
            is-link
            @click="router.push(MOBILE_SETTINGS_SECURITY_KEY_PATH)" />
        </van-cell-group>

        <!-- 设备信任管理入口 -->
        <van-cell-group :title="t('setting.encryption.trust_section')" inset>
          <van-cell
            :title="t('encryption.device_trust.device_list_tab')"
            :label="t('setting.encryption.device_management')"
            is-link
            @click="showDeviceTrustManager = true" />
        </van-cell-group>

        <!-- 加密设置 -->
        <van-cell-group :title="t('setting.encryption.settings')" inset>
          <van-cell
            :title="t('setting.encryption.never_send_unencrypted')"
            :label="t('setting.encryption.never_send_unencrypted_desc')">
            <template #right-icon>
              <van-switch
                :model-value="strictEnabled"
                :disabled="!encryptionEnabled"
                size="20px"
                @update:model-value="setStrictEnabled" />
            </template>
          </van-cell>
        </van-cell-group>
      </div>

      <!-- 设备详情弹出层 -->
      <van-action-sheet
        v-model:show="showDeviceSheet"
        :title="(selectedDevice?.displayName || selectedDevice?.deviceId) ?? ''">
        <div class="device-detail">
          <van-cell-group>
            <van-cell
              :title="t('setting.encryption.device_id')"
              v-bind="selectedDevice?.deviceId !== undefined ? { value: selectedDevice.deviceId } : {}" />
            <van-cell
              v-if="selectedDevice?.lastSeenTs"
              :title="t('setting.encryption.last_seen')"
              :value="formatLastSeen(selectedDevice.lastSeenTs)" />
          </van-cell-group>

          <div class="device-actions">
            <van-button v-if="!selectedDevice?.isVerified" type="primary" block @click="handleVerifyDevice">
              {{ t('setting.encryption.verify') }}
            </van-button>
            <van-button
              v-if="selectedDevice?.deviceId !== currentDeviceId"
              type="danger"
              block
              @click="handleDeleteDevice">
              {{ t('common.delete') }}
            </van-button>
          </div>
        </div>
      </van-action-sheet>

      <!-- 已启用备份时的管理操作（恢复 / 删除） -->
      <van-action-sheet
        v-model:show="showBackupSheet"
        :title="t('setting.encryption.manage_backup')"
        :actions="backupActions"
        @select="handleBackupAction" />

      <!-- 密钥备份流程统一走共享弹窗（useKeyBackupFlow），页面不再直连备份服务 -->
      <MobileKeyBackupDialog v-model="showKeyBackupSetup" mode="setup" @complete="onKeyBackupComplete" />
      <MobileKeyBackupDialog v-model="showKeyBackupRestore" mode="restore" @complete="onKeyBackupComplete" />
      <MobileDehydratedDeviceDialog v-model:show="showDehydratedDevice" @complete="loadOverview()" />
      <MobileDeviceTrustManager
        v-model:show="showDeviceTrustManager"
        @complete="loadDevices()"
        @setup-cross-signing="handleSetupCrossSigning" />

      <MobileCrossSigningSetup
        v-model="showCrossSigningSetup"
        @completed="handleCrossSigningCompleted"
        @needs-security-key="handleNeedsSecurityKey" />
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { showConfirmDialog, showToast } from 'vant'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { DeviceSessionInfo } from '@/composables/encryption/useDeviceSessions'
import { useEncryptionSettings } from '@/composables/encryption/useEncryptionSettings'
import { useKeyBackupFlow } from '@/composables/encryption/useKeyBackupFlow'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import MobileCrossSigningSetup from '@/mobile/components/encryption/MobileCrossSigningSetup.vue'
import MobileDehydratedDeviceDialog from '@/mobile/components/encryption/MobileDehydratedDeviceDialog.vue'
import MobileDeviceTrustManager from '@/mobile/components/encryption/MobileDeviceTrustManager.vue'
import MobileKeyBackupDialog from '@/mobile/components/encryption/MobileKeyBackupDialog.vue'
import { createLogger } from '@/utils/Logger'
import { MOBILE_SETTINGS_SECURITY_KEY_PATH } from './settingsRoutes'

const logger = createLogger('MobileEncryptionSettings')

const { t } = useI18n()
const router = useRouter()

const refreshing = ref(false)
const finished = ref(false)
// 加密总览、设备会话、严格模式与刷新编排统一由 useEncryptionSettings 提供（与桌面端共用同一份实现）
const {
  encryptionEnabled,
  deviceVerified,
  backupEnabled,
  backupVersion,
  crossSigningSetup: crossSigningConfigured,
  loadOverview,
  refreshBackup,
  devicesLoading: loading,
  devices,
  currentDeviceId,
  loadDevices: loadDeviceSessions,
  deleteDevice: removeDevice,
  startDeviceVerification: startVerification,
  strictModeEnabled: strictEnabled,
  setStrictMode: setStrictEnabled,
  refreshEncryptionSettings
} = useEncryptionSettings()
const showDeviceSheet = ref(false)
const selectedDevice = ref<DeviceSessionInfo | null>(null)
// MobileKeyBackupDialog state
const showKeyBackupSetup = ref(false)
const showKeyBackupRestore = ref(false)
const showDehydratedDevice = ref(false)
// Device trust manager
const showDeviceTrustManager = ref(false)
// 交叉签名（安全检查）流程
const showCrossSigningSetup = ref(false)

/**
 * 打开「完成安全检查」（bootstrap cross-signing）流程。
 *
 * 设备管理器是模态弹窗，先关掉它，否则安全检查弹窗会被压在下面。
 */
function handleSetupCrossSigning() {
  showDeviceTrustManager.value = false
  showCrossSigningSetup.value = true
}

/**
 * 交叉签名建立后必须重算结论。
 *
 * 建立之前「所有设备都未验证」是必然结果（`crossSigningVerified` 恒 false）；
 * 建立之后同一条判断可能改变，不刷新就会把过期的「全红」列表留在界面上。
 */
async function handleCrossSigningCompleted() {
  await refreshEncryptionSettings()
  await loadDeviceSessions()
}

/** 私钥未入 4S：安全检查已完成但还差「可恢复」，引导去设置安全密钥 */
function handleNeedsSecurityKey() {
  showCrossSigningSetup.value = false
  router.push(MOBILE_SETTINGS_SECURITY_KEY_PATH)
}
// 已启用备份时的管理操作面板
const showBackupSheet = ref(false)
const { deleteBackupVersion } = useKeyBackupFlow()

const backupActions = computed(() => [
  { name: t('setting.encryption.restore_backup'), value: 'restore' },
  {
    name: t('encryption.secure_backup.delete_action'),
    value: 'delete',
    color: 'var(--tjg-color-danger-500)'
  }
])
function onKeyBackupComplete() {
  refreshBackup()
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

const loadDevices = async () => {
  const loaded = await loadDeviceSessions()
  finished.value = true
  if (!loaded) {
    showToast(t('setting.encryption.load_devices_failed'))
  }
}

const onRefresh = async () => {
  finished.value = false
  await loadDevices()
  refreshing.value = false
}

const handleDeviceClick = (device: DeviceSessionInfo) => {
  selectedDevice.value = device
  showDeviceSheet.value = true
}

const handleVerifyDevice = async () => {
  if (!selectedDevice.value) return

  try {
    const transactionId = await startVerification(selectedDevice.value.deviceId)
    showToast(t('mobile_devices.verification_started', { transactionId }))
  } catch (error) {
    logger.error('Failed to start device verification:', error)
    showToast(t('setting.encryption.verify_device_failed'))
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

    await removeDevice(selectedDevice.value.deviceId)
    showToast(t('setting.encryption.delete_device_success'))
    showDeviceSheet.value = false
  } catch (error) {
    if (error !== 'cancel') {
      showToast(t('setting.encryption.delete_device_failed'))
    }
  }
}

const handleBackupClick = () => {
  if (backupEnabled.value) {
    // 已启用备份：打开管理面板（恢复 / 删除），不再走占位提示
    showBackupSheet.value = true
    return
  }
  // 设置流程统一由 MobileKeyBackupDialog（useKeyBackupFlow）承担
  showKeyBackupSetup.value = true
}

const handleBackupAction = (action: { value?: unknown }) => {
  showBackupSheet.value = false
  if (action.value === 'restore') {
    handleRestoreBackup()
    return
  }
  if (action.value === 'delete') {
    void handleDeleteBackup()
  }
}

const handleDeleteBackup = async () => {
  let version = backupVersion.value
  if (!version) {
    await refreshBackup()
    version = backupVersion.value
  }
  if (!version) return

  try {
    await showConfirmDialog({
      title: t('common.confirm'),
      message: t('encryption.secure_backup.delete_confirm'),
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel')
    })
  } catch {
    return
  }

  const deleted = await deleteBackupVersion(version)
  if (deleted) {
    await refreshBackup()
  }
}

const handleRestoreBackup = () => {
  // 恢复流程统一由 MobileKeyBackupDialog（useKeyBackupFlow）读取恢复密钥并恢复
  showKeyBackupRestore.value = true
}

onMounted(async () => {
  // 加密开关、设备验证、备份与交叉签名状态，以及设备列表，统一由共享 composable 编排
  const { devicesLoaded } = await refreshEncryptionSettings()
  finished.value = true
  if (!devicesLoaded) {
    showToast(t('setting.encryption.load_devices_failed'))
  }
})
</script>

<style scoped lang="scss">
.encryption-settings {
  padding: 16px 0;
  background: var(--van-background-2);
  min-height: 100vh;
  min-height: 100dvh;
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
