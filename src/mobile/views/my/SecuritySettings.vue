<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_security.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <van-cell-group inset>
            <van-cell :title="t('mobile_security.change_password')" is-link @click="showPasswordDialog = true">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-blue-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:lock" :width="20" color="#1989fa" />
                </div>
              </template>
            </van-cell>

            <van-cell
              :title="t('mobile_security.devices')"
              is-link
              :value="deviceCount"
              @click="router.push('/mobile/mobileMy/devices')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-green-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:devices" :width="20" color="#52c41a" />
                </div>
              </template>
            </van-cell>

            <van-cell
              :title="t('mobile_security.login_history')"
              is-link
              @click="router.push('/mobile/mobileMy/loginHistory')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-cyan-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:history" :width="20" color="#13c2c2" />
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_security.encryption_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_security.cross_signing')" :label="crossSigningStatus">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-purple-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:shield-check" :width="20" color="#722ed1" />
                </div>
              </template>
              <template #right-icon>
                <van-tag :type="crossSigningEnabled ? 'success' : 'warning'">
                  {{ crossSigningEnabled ? t('mobile_security.enabled') : t('mobile_security.disabled') }}
                </van-tag>
              </template>
            </van-cell>

            <van-cell
              :title="t('mobile_security.key_backup')"
              :label="keyBackupStatus"
              is-link
              @click="router.push('/mobile/mobileMy/keyBackup')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-orange-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:backup-restore" :width="20" color="#fa8c16" />
                </div>
              </template>
              <template #right-icon>
                <van-tag :type="keyBackupEnabled ? 'success' : 'warning'">
                  {{ keyBackupEnabled ? t('mobile_security.enabled') : t('mobile_security.disabled') }}
                </van-tag>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_security.export_keys')" is-link @click="handleExportKeys">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-cyan-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:download" :width="20" color="#13c2c2" />
                </div>
              </template>
            </van-cell>

            <van-cell
              :title="t('mobile_security.verification')"
              is-link
              @click="showVerificationDialog = true">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-indigo-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:shield-key" :width="20" color="#3f51b5" />
                </div>
              </template>
            </van-cell>

            <van-cell
              :title="t('mobile_security.key_rotation_status')"
              :label="keyRotationStatus"
              is-link
              @click="showKeyRotationDialog = true">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-amber-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:rotate-3d-variant" :width="20" color="#ff9800" />
                </div>
              </template>
              <template #right-icon>
                <van-tag :type="needsRotation ? 'danger' : 'success'">
                  {{ needsRotation ? t('mobile_security.key_rotation_needs') : t('mobile_security.key_rotation_up_to_date') }}
                </van-tag>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_security.privacy_section') }}</div>

          <van-cell-group inset>
            <van-cell
              :title="t('mobile_security.ignored_users')"
              is-link
              :value="ignoredUsersCount"
              @click="router.push('/mobile/mobileMy/ignoredUsers')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-red-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:account-cancel" :width="20" color="#ff4d4f" />
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_security.danger_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_security.deactivate_account')" is-link @click="handleDeactivate">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-red-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:alert-circle" :width="20" color="#ff4d4f" />
                </div>
              </template>
            </van-cell>
          </van-cell-group>
        </div>
      </div>

      <van-dialog
        v-model:show="showPasswordDialog"
        :title="t('mobile_security.change_password')"
        show-cancel-button
        :confirm-button-text="t('mobile_security.confirm')"
        :cancel-button-text="t('mobile_security.cancel')"
        @confirm="handleChangePassword">
        <div class="p-16px">
          <van-field
            v-model="passwordForm.oldPassword"
            type="password"
            :label="t('mobile_security.old_password')"
            :placeholder="t('mobile_security.old_password_placeholder')" />
          <van-field
            v-model="passwordForm.newPassword"
            type="password"
            :label="t('mobile_security.new_password')"
            :placeholder="t('mobile_security.new_password_placeholder')" />
          <van-field
            v-model="passwordForm.confirmPassword"
            type="password"
            :label="t('mobile_security.confirm_password')"
            :placeholder="t('mobile_security.confirm_password_placeholder')" />
        </div>
      </van-dialog>

      <van-dialog
        v-model:show="showBackupDialog"
        :title="t('mobile_security.key_backup')"
        show-cancel-button
        :confirm-button-text="t('mobile_security.confirm')"
        :cancel-button-text="t('mobile_security.cancel')"
        @confirm="handleSetupBackup">
        <div class="p-16px">
          <div class="text-14px text-gray-600 mb-12px">
            {{ t('mobile_security.backup_description') }}
          </div>
          <van-field
            v-model="backupPassphrase"
            type="password"
            :label="t('mobile_security.backup_passphrase')"
            :placeholder="t('mobile_security.backup_passphrase_placeholder')" />
        </div>
      </van-dialog>

      <van-popup
        v-model:show="showVerificationDialog"
        position="bottom"
        :style="{ maxHeight: '80%' }"
        round>
        <div class="p-16px">
          <div class="text-16px font-medium mb-16px">{{ t('mobile_security.verification_title') }}</div>

          <div v-if="verificationPhase === 'idle'" class="verification-content">
            <van-field
              v-model="verificationUserId"
              :label="t('mobile_security.verification_user_id')"
              :placeholder="t('mobile_security.verification_user_id_placeholder')" />
            <van-button type="primary" block class="mt-16px" @click="handleStartVerification">
              {{ t('mobile_security.verification_start') }}
            </van-button>
          </div>

          <div v-else-if="verificationPhase === 'requesting'" class="verification-content">
            <van-loading size="24px" class="loading-container" />
            <p class="text-center mt-12px text-14px text-gray-500">{{ t('mobile_security.verification_requesting') }}</p>
          </div>

          <div v-else-if="verificationPhase === 'waiting'" class="verification-content">
            <div class="text-center py-24px">
              <Icon icon="mdi:clock-outline" :width="48" color="#fa8c16" />
              <p class="mt-12px text-14px">{{ t('mobile_security.verification_waiting') }}</p>
              <p class="text-12px text-gray-400 mt-4px">{{ t('mobile_security.verification_waiting_hint') }}</p>
            </div>
            <van-button type="danger" plain block @click="handleCancelVerification">
              {{ t('mobile_security.verification_cancel') }}
            </van-button>
          </div>

          <div v-else-if="verificationPhase === 'sas-emoji'" class="verification-content">
            <p class="text-center mb-16px text-14px">{{ t('mobile_security.verification_compare_emoji') }}</p>
            <div class="emoji-grid">
              <div v-for="(emoji, index) in sasEmojis" :key="index" class="emoji-item">
                <span class="text-32px">{{ emoji.emoji }}</span>
                <span class="text-10px text-gray-400">{{ emoji.description }}</span>
              </div>
            </div>
            <div class="flex gap-12px mt-16px">
              <van-button type="primary" class="flex-1" @click="handleVerificationConfirm">
                {{ t('mobile_security.verification_confirm') }}
              </van-button>
              <van-button type="danger" plain class="flex-1" @click="handleVerificationDeny">
                {{ t('mobile_security.verification_deny') }}
              </van-button>
            </div>
          </div>

          <div v-else-if="verificationPhase === 'sas-decimal'" class="verification-content">
            <p class="text-center mb-16px text-14px">{{ t('mobile_security.verification_compare_numbers') }}</p>
            <div class="flex justify-center gap-16px mb-16px">
              <span v-for="(num, index) in sasDecimals" :key="index" class="text-28px font-bold">
                {{ num }}
              </span>
            </div>
            <div class="flex gap-12px">
              <van-button type="primary" class="flex-1" @click="handleVerificationConfirm">
                {{ t('mobile_security.verification_confirm') }}
              </van-button>
              <van-button type="danger" plain class="flex-1" @click="handleVerificationDeny">
                {{ t('mobile_security.verification_deny') }}
              </van-button>
            </div>
          </div>

          <div v-else-if="verificationPhase === 'verified'" class="verification-content">
            <div class="text-center py-24px">
              <Icon icon="mdi:check-circle" :width="48" color="#52c41a" />
              <p class="mt-12px text-14px">{{ t('mobile_security.verification_verified') }}</p>
              <p class="text-12px text-gray-400 mt-4px">{{ t('mobile_security.verification_verified_hint') }}</p>
            </div>
            <van-button block @click="showVerificationDialog = false">
              {{ t('mobile_security.verification_close') }}
            </van-button>
          </div>

          <div v-else-if="verificationPhase === 'cancelled'" class="verification-content">
            <div class="text-center py-24px">
              <Icon icon="mdi:close-circle" :width="48" color="#f5222d" />
              <p class="mt-12px text-14px">{{ t('mobile_security.verification_cancelled') }}</p>
            </div>
            <van-button block @click="showVerificationDialog = false">
              {{ t('mobile_security.verification_close') }}
            </van-button>
          </div>

          <div v-else-if="verificationPhase === 'error'" class="verification-content">
            <div class="text-center py-24px">
              <Icon icon="mdi:alert-circle" :width="48" color="#f5222d" />
              <p class="mt-12px text-14px">{{ t('mobile_security.verification_error') }}</p>
            </div>
            <van-button block @click="showVerificationDialog = false">
              {{ t('mobile_security.verification_close') }}
            </van-button>
          </div>
        </div>
      </van-popup>

      <van-popup
        v-model:show="showKeyRotationDialog"
        position="bottom"
        :style="{ maxHeight: '80%' }"
        round>
        <div class="p-16px">
          <div class="text-16px font-medium mb-16px">{{ t('mobile_security.key_rotation_status') }}</div>

          <van-loading v-if="loadingRotation" size="24px" class="loading-container" />

          <template v-else>
            <div class="flex items-center gap-12px mb-16px">
              <Icon
                :icon="needsRotation ? 'mdi:alert-circle' : 'mdi:check-circle'"
                :width="28"
                :color="needsRotation ? '#ff9800' : '#52c41a'" />
              <div>
                <div class="text-14px font-medium">
                  {{ needsRotation ? t('mobile_security.key_rotation_needs') : t('mobile_security.key_rotation_up_to_date') }}
                </div>
                <div class="text-12px text-gray-400">
                  {{ needsRotation ? t('encryption.key_rotation.status_warning') : t('encryption.key_rotation.status_ok') }}
                </div>
              </div>
            </div>

            <van-cell-group inset>
              <van-cell
                v-if="lastRotationTime"
                :title="t('mobile_security.key_rotation_last')"
                :value="formatDate(lastRotationTime)" />
              <van-cell
                v-if="devicesPending > 0"
                :title="t('mobile_security.key_rotation_pending')"
                :value="String(devicesPending)" />
            </van-cell-group>

            <van-button
              type="primary"
              block
              class="mt-16px"
              :loading="rotating"
              @click="handleRotateKeys">
              {{ t('mobile_security.key_rotation_now') }}
            </van-button>

            <div class="mt-16px">
              <van-cell-group inset>
                <van-cell :title="t('mobile_security.key_rotation_auto')">
                  <template #right-icon>
                    <van-switch v-model="autoRotate" size="20" @update:model-value="handleRotationConfigChange" />
                  </template>
                </van-cell>
                <van-cell
                  v-if="autoRotate"
                  :title="t('mobile_security.key_rotation_interval')"
                  :value="rotationIntervalLabel"
                  is-link
                  @click="showIntervalPicker = true" />
              </van-cell-group>
            </div>

            <div class="mt-16px">
              <van-cell
                :title="t('mobile_security.key_rotation_history')"
                is-link
                @click="showRotationHistory = !showRotationHistory" />
              <div v-if="showRotationHistory" class="mt-8px">
                <van-empty v-if="rotationHistory.length === 0" :description="t('mobile_security.key_rotation_no_history')" />
                <van-cell-group v-else inset>
                  <van-cell
                    v-for="(record, index) in rotationHistory"
                    :key="index"
                    :title="formatKeyId(record.new_version || record.old_version)"
                    :label="formatDate(record.rotation_ts)" />
                </van-cell-group>
              </div>
            </div>
          </template>
        </div>
      </van-popup>

      <van-popup v-model:show="showIntervalPicker" position="bottom" round>
        <van-picker
          :columns="intervalOptions"
          @confirm="onIntervalConfirm"
          @cancel="showIntervalPicker = false" />
      </van-popup>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast, showLoadingToast } from 'vant'
import { Icon } from '@iconify/vue'
import { matrixAccountService } from '@/services/matrix/MatrixAccountService'
import { matrixCryptoService, matrixClientService } from '@/services/matrix'
import matrixVerificationService from '@/services/matrix/MatrixVerificationService'
import matrixKeyRotationService, { type KeyRotationHistory } from '@/services/matrix/MatrixKeyRotationService'
import { useLogin } from '@/hooks/useLogin'
import { useI18n } from 'vue-i18n'
import { createLogger } from '@/utils/Logger'

type VerificationPhase = 'idle' | 'requesting' | 'waiting' | 'sas-emoji' | 'sas-decimal' | 'verified' | 'cancelled' | 'error'

interface SasEmoji {
  emoji: string
  description: string
}

const logger = createLogger('SecuritySettings')

const { t } = useI18n()
const router = useRouter()
const { logout, resetLoginState } = useLogin()

const deviceCount = ref('0')
const ignoredUsersCount = ref('0')
const crossSigningEnabled = ref(false)
const keyBackupEnabled = ref(false)
const needsRotation = ref(false)

const showPasswordDialog = ref(false)
const showBackupDialog = ref(false)
const showVerificationDialog = ref(false)
const showKeyRotationDialog = ref(false)
const showIntervalPicker = ref(false)
const showRotationHistory = ref(false)

const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const backupPassphrase = ref('')

const verificationPhase = ref<VerificationPhase>('idle')
const verificationUserId = ref('')
const sasEmojis = ref<SasEmoji[]>([])
const sasDecimals = ref<string[]>([])
const verificationTransactionId = ref('')

const loadingRotation = ref(false)
const rotating = ref(false)
const lastRotationTime = ref<number | null>(null)
const devicesPending = ref(0)
const autoRotate = ref(true)
const rotationInterval = ref(7)
const rotationHistory = ref<KeyRotationHistory[]>([])

const intervalOptions = [
  { text: '7 ' + t('common.days', '天'), value: 7 },
  { text: '14 ' + t('common.days', '天'), value: 14 },
  { text: '30 ' + t('common.days', '天'), value: 30 },
  { text: '60 ' + t('common.days', '天'), value: 60 }
]

const crossSigningStatus = computed(() => {
  return crossSigningEnabled.value
    ? t('mobile_security.cross_signing_enabled')
    : t('mobile_security.cross_signing_disabled')
})

const keyBackupStatus = computed(() => {
  return keyBackupEnabled.value ? t('mobile_security.key_backup_enabled') : t('mobile_security.key_backup_disabled')
})

const keyRotationStatus = computed(() => {
  return needsRotation.value ? t('mobile_security.key_rotation_needs') : t('mobile_security.key_rotation_up_to_date')
})

const rotationIntervalLabel = computed(() => {
  return `${rotationInterval.value} ${t('common.days', '天')}`
})

const formatDate = (timestamp: number | null): string => {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString('zh-CN')
}

const formatKeyId = (keyId: string): string => {
  if (!keyId) return '-'
  if (keyId.length > 20) {
    return keyId.substring(0, 8) + '...' + keyId.substring(keyId.length - 8)
  }
  return keyId
}

onMounted(async () => {
  await loadSecurityInfo()
})

watch(showKeyRotationDialog, (val) => {
  if (val) {
    loadRotationStatus()
    loadRotationHistory()
  }
})

watch(showVerificationDialog, (val) => {
  if (!val) {
    verificationPhase.value = 'idle'
    verificationUserId.value = ''
  }
})

async function loadSecurityInfo() {
  try {
    const devices = await matrixAccountService.getDevices()
    deviceCount.value = devices.length.toString()

    const ignoredUsers = await matrixAccountService.getIgnoredUsers()
    ignoredUsersCount.value = ignoredUsers.length.toString()

    const cryptoStatus = await matrixCryptoService.getCryptoStatus()
    if (cryptoStatus) {
      crossSigningEnabled.value = cryptoStatus.crossSigningReady
      keyBackupEnabled.value = cryptoStatus.keyBackupEnabled
    }

    const rotationStatus = await matrixKeyRotationService.getRotationStatus()
    needsRotation.value = rotationStatus.needs_rotation
  } catch (error) {
    logger.error('加载安全信息失败:', error)
  }
}

async function handleChangePassword() {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    showToast({
      type: 'fail',
      message: t('mobile_security.password_mismatch')
    })
    return
  }

  if (passwordForm.value.newPassword.length < 8) {
    showToast({
      type: 'fail',
      message: t('mobile_security.password_too_short')
    })
    return
  }

  try {
    showLoadingToast({
      message: t('mobile_security.changing_password'),
      forbidClick: true
    })

    await matrixAccountService.changePassword(passwordForm.value.oldPassword, passwordForm.value.newPassword)

    showToast({
      type: 'success',
      message: t('mobile_security.password_changed')
    })

    passwordForm.value = {
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  } catch (error) {
    logger.error('修改密码失败:', error)
    showToast({
      type: 'fail',
      message: t('mobile_security.password_change_failed')
    })
  }
}

async function handleSetupBackup() {
  if (!backupPassphrase.value) {
    showToast({
      type: 'fail',
      message: t('mobile_security.passphrase_required')
    })
    return
  }

  try {
    showLoadingToast({
      message: t('mobile_security.setting_up_backup'),
      forbidClick: true
    })

    await matrixCryptoService.setupKeyBackup(backupPassphrase.value)

    showToast({
      type: 'success',
      message: t('mobile_security.backup_setup_success')
    })

    backupPassphrase.value = ''
    await loadSecurityInfo()
  } catch (error) {
    logger.error('设置备份失败:', error)
    showToast({
      type: 'fail',
      message: t('mobile_security.backup_setup_failed')
    })
  }
}

async function handleExportKeys() {
  try {
    await showConfirmDialog({
      title: t('mobile_security.export_keys_confirm.title'),
      message: t('mobile_security.export_keys_confirm.message'),
      confirmButtonText: t('mobile_security.export_keys_confirm.confirm'),
      cancelButtonText: t('mobile_security.export_keys_confirm.cancel')
    })

    showToast({
      type: 'success',
      message: t('mobile_security.export_keys_success')
    })
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('导出密钥失败:', error)
    }
  }
}

async function handleDeactivate() {
  try {
    await showConfirmDialog({
      title: t('mobile_security.deactivate_confirm.title'),
      message: t('mobile_security.deactivate_confirm.message'),
      confirmButtonText: t('mobile_security.deactivate_confirm.confirm'),
      cancelButtonText: t('mobile_security.deactivate_confirm.cancel')
    })

    await matrixAccountService.deactivateAccount()
    showToast({
      type: 'success',
      message: t('mobile_security.deactivate_success')
    })
    await resetLoginState()
    await logout()
    router.push('/mobile/login')
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('注销账户失败:', error)
      showToast({
        type: 'fail',
        message: t('mobile_security.deactivate_failed')
      })
    }
  }
}

async function handleStartVerification() {
  if (!verificationUserId.value.trim()) {
    showToast({ type: 'fail', message: t('mobile_security.verification_user_id') })
    return
  }
  verificationPhase.value = 'requesting'
  try {
    const request = await matrixVerificationService.requestVerification(verificationUserId.value.trim(), ['m.sas.v1'])
    if (request) {
      verificationTransactionId.value = request.transactionId
      verificationPhase.value = 'waiting'
    }
  } catch (err) {
    verificationPhase.value = 'error'
  }
}

async function handleCancelVerification() {
  if (verificationTransactionId.value) {
    try {
      await matrixVerificationService.cancelVerification(verificationTransactionId.value)
    } catch {
      // ignore cancel errors
    }
  }
  verificationPhase.value = 'cancelled'
}

function handleVerificationConfirm() {
  verificationPhase.value = 'verified'
  showToast({ type: 'success', message: t('mobile_security.verification_verified') })
}

function handleVerificationDeny() {
  handleCancelVerification()
}

async function loadRotationStatus() {
  loadingRotation.value = true
  try {
    const status = await matrixKeyRotationService.getRotationStatus()
    needsRotation.value = status.needs_rotation
    lastRotationTime.value = status.last_rotation_ts || null
    devicesPending.value = status.devices_pending

    const config = await matrixKeyRotationService.getRotationConfig()
    autoRotate.value = config.auto_rotate
    rotationInterval.value = Math.round(config.rotation_interval_ms / (24 * 60 * 60 * 1000)) || 7
  } catch (err) {
    logger.error('加载轮转状态失败:', err)
  } finally {
    loadingRotation.value = false
  }
}

async function loadRotationHistory() {
  try {
    const deviceId = matrixClientService.getDeviceId()
    if (deviceId) {
      rotationHistory.value = await matrixKeyRotationService.getRotationHistory(deviceId)
    }
  } catch (err) {
    logger.error('加载轮转历史失败:', err)
  }
}

async function handleRotateKeys() {
  rotating.value = true
  try {
    const success = await matrixKeyRotationService.rotateKeys()
    if (success) {
      showToast({ type: 'success', message: t('mobile_security.key_rotation_success') })
      needsRotation.value = false
      lastRotationTime.value = Date.now()
      await loadRotationHistory()
    } else {
      showToast({ type: 'fail', message: t('mobile_security.key_rotation_failed') })
    }
  } catch (err) {
    logger.error('轮转失败:', err)
    showToast({ type: 'fail', message: t('mobile_security.key_rotation_failed') })
  } finally {
    rotating.value = false
  }
}

async function handleRotationConfigChange() {
  try {
    const success = await matrixKeyRotationService.updateRotationConfig({
      auto_rotate: autoRotate.value,
      rotation_interval_ms: rotationInterval.value * 24 * 60 * 60 * 1000
    })
    if (success) {
      showToast({ type: 'success', message: t('encryption.key_rotation.config_success') })
    } else {
      showToast({ type: 'fail', message: t('encryption.key_rotation.config_failed') })
    }
  } catch (err) {
    logger.error('配置失败:', err)
  }
}

function onIntervalConfirm({ selectedValues }: { selectedValues: number[] }) {
  rotationInterval.value = selectedValues[0] || 7
  showIntervalPicker.value = false
  handleRotationConfigChange()
}
</script>

<style scoped>
.verification-content {
  padding: 8px 0;
  min-height: 120px;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  max-width: 320px;
  margin: 0 auto;
}

.emoji-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.loading-container {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}
</style>
