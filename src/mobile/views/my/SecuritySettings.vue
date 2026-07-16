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
                <div
                  class="w-40px h-40px rounded-full bg-[var(--hula-color-info-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:lock" :width="20" color="var(--hula-color-info-500)" />
                </div>
              </template>
            </van-cell>

            <van-cell
              :title="t('mobile_security.devices')"
              is-link
              :value="deviceCount"
              @click="router.push('/mobile/mobileMy/devices')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--hula-color-success-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:devices" :width="20" color="var(--hula-color-success-500)" />
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-[var(--hula-text-secondary)] mt-16px mb-8px">
            {{ t('mobile_security.encryption_section') }}
          </div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_security.cross_signing')" :label="crossSigningStatus">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--hula-color-primary-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:shield-check" :width="20" color="var(--hula-color-primary-500)" />
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
              @click="showBackupDialog = true">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--hula-color-warning-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:backup-restore" :width="20" color="var(--hula-color-warning-500)" />
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
                <div
                  class="w-40px h-40px rounded-full bg-[var(--hula-color-info-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:download" :width="20" color="var(--hula-color-info-500)" />
                </div>
              </template>
            </van-cell>

            <van-cell :title="$t('encryption.verify.title')" is-link @click="showDeviceVerify = true">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--hula-color-primary-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:shield-check" :width="20" color="var(--hula-color-primary-500)" />
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <MobileDeviceVerifyDialog
            v-model="showDeviceVerify"
            :user-id="currentUserId"
            :device-id="currentDeviceId"
            @verified="onDeviceVerified" />

          <div class="text-14px text-[var(--hula-text-secondary)] mt-16px mb-8px">
            {{ t('mobile_security.secure_backup.title') }}
          </div>

          <van-cell-group inset data-test="secure-backup-section">
            <van-cell
              :title="t('mobile_security.secure_backup.title')"
              :label="t('mobile_security.secure_backup.desc')"
              data-test="secure-backup-status">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--hula-color-primary-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:shield-key" :width="20" color="var(--hula-color-primary-500)" />
                </div>
              </template>
              <template #right-icon>
                <van-tag :type="secureBackupTagType" data-test="secure-backup-tag">
                  {{ secureBackupStatusText }}
                </van-tag>
              </template>
            </van-cell>

            <van-cell
              :title="t('mobile_security.secure_backup.create')"
              :label="t('mobile_security.secure_backup.create_desc')"
              is-link
              data-test="secure-backup-create-entry"
              @click="openSecureBackupCreate" />

            <van-cell
              :title="t('mobile_security.secure_backup.restore')"
              :label="t('mobile_security.secure_backup.restore_desc')"
              is-link
              data-test="secure-backup-restore-entry"
              @click="openSecureBackupRestore" />
          </van-cell-group>

          <div class="text-14px text-[var(--hula-text-secondary)] mt-16px mb-8px">
            {{ t('mobile_security.privacy_section') }}
          </div>

          <van-cell-group inset>
            <van-cell
              :title="t('mobile_security.ignored_users')"
              is-link
              :value="ignoredUsersCount"
              @click="router.push('/mobile/mobileMy/ignoredUsers')">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--hula-color-danger-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:account-cancel" :width="20" color="var(--hula-color-danger-500)" />
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-[var(--hula-text-secondary)] mt-16px mb-8px">
            {{ t('mobile_security.danger_section') }}
          </div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_security.deactivate_account')" is-link @click="handleDeactivate">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--hula-color-danger-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:alert-circle" :width="20" color="var(--hula-color-danger-500)" />
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
          <div class="text-14px text-[var(--hula-text-secondary)] mb-12px">
            {{ t('mobile_security.backup_description') }}
          </div>
          <van-field
            v-model="backupPassphrase"
            type="password"
            :label="t('mobile_security.backup_passphrase')"
            :placeholder="t('mobile_security.backup_passphrase_placeholder')" />
        </div>
      </van-dialog>

      <!-- 安全备份流程 popup(基于 composable) -->
      <van-popup
        v-model:show="showSecureBackupPopup"
        position="bottom"
        round
        :close-on-click-overlay="false"
        data-test="secure-backup-popup">
        <div class="secure-backup-flow">
          <van-nav-bar :title="t('mobile_security.secure_backup.title')">
            <template #right>
              <van-icon name="cross" size="18" @click="closeSecureBackupFlow" />
            </template>
          </van-nav-bar>

          <div v-if="secureBackupLoading" class="flex justify-center items-center py-48px">
            <van-loading type="spinner" />
          </div>

          <template v-else>
            <!-- create: 输入安全短语后创建 -->
            <div v-if="secureBackupPhase === 'create'" class="flow-step p-16px" data-test="secure-backup-create-form">
              <div class="text-14px text-[var(--hula-text-secondary)] mb-12px">
                {{ t('mobile_security.secure_backup.create_desc') }}
              </div>
              <van-field
                v-model="secureBackupPassphrase"
                type="password"
                :label="t('mobile_security.secure_backup.enter_passphrase')"
                :placeholder="t('mobile_security.secure_backup.passphrase_placeholder')" />
              <van-button
                type="primary"
                block
                class="mt-16px"
                data-test="secure-backup-create-confirm"
                @click="handleCreateSecureBackup">
                {{ t('mobile_security.secure_backup.create') }}
              </van-button>
            </div>

            <!-- success: 显示恢复密钥 -->
            <div v-else-if="secureBackupPhase === 'success'" class="flow-step p-16px" data-test="secure-backup-success">
              <van-notice-bar type="warning" :text="t('mobile_security.secure_backup.key_warning')" />
              <div class="recovery-key-title mt-12px">
                {{ t('mobile_security.secure_backup.enter_recovery_key') }}
              </div>
              <div class="recovery-key-value">{{ secureBackupRecoveryKey || '-' }}</div>
              <div class="flex gap-8px my-12px">
                <van-button size="small" @click="copySecureBackupKey">
                  {{ t('mobile_security.secure_backup.title') }}
                </van-button>
              </div>
              <van-button type="primary" block @click="closeSecureBackupFlow">
                {{ t('mobile_security.confirm') }}
              </van-button>
            </div>

            <!-- restore: 输入恢复密钥 -->
            <div
              v-else-if="secureBackupPhase === 'restore'"
              class="flow-step p-16px"
              data-test="secure-backup-restore-form">
              <van-field
                v-model="secureBackupRestoreInput"
                type="textarea"
                rows="3"
                :label="t('mobile_security.secure_backup.enter_recovery_key')"
                :placeholder="t('mobile_security.secure_backup.recovery_key_placeholder')" />
              <van-button
                type="primary"
                block
                class="mt-16px"
                data-test="secure-backup-restore-confirm"
                @click="handleRestoreSecureBackup">
                {{ t('mobile_security.secure_backup.restore') }}
              </van-button>
            </div>

            <!-- error -->
            <div v-else-if="secureBackupPhase === 'error'" class="flow-step p-16px" data-test="secure-backup-error">
              <van-notice-bar
                type="danger"
                :text="secureBackupErrorMessage || t('mobile_security.secure_backup.create_failed')" />
              <van-button type="primary" block class="mt-16px" @click="closeSecureBackupFlow">
                {{ t('mobile_security.confirm') }}
              </van-button>
            </div>
          </template>
        </div>
      </van-popup>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { showConfirmDialog, showLoadingToast, showToast } from 'vant'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import MobileDeviceVerifyDialog from '#/components/encryption/MobileDeviceVerifyDialog.vue'
import { useSecureBackupFlow } from '@/composables/encryption/useSecureBackupFlow'
import { useLoginFlow } from '@/composables/user/useLoginFlow'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import { matrixAccountService } from '@/services/matrix/user/MatrixAccountService'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SecuritySettings')

const { t } = useI18n()
const router = useRouter()
const { logout } = useLoginFlow()

const deviceCount = ref('0')
const ignoredUsersCount = ref('0')
const crossSigningEnabled = ref(false)
const keyBackupEnabled = ref(false)

const showPasswordDialog = ref(false)
const showBackupDialog = ref(false)

const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const backupPassphrase = ref('')

const matrixStore = useMatrixStore()
const showDeviceVerify = ref(false)
const currentUserId = computed(() => matrixStore.userId ?? '')
const currentDeviceId = computed(() => matrixStore.deviceId ?? '')
function onDeviceVerified() {
  showToast(t('encryption.verify.verified'))
}

// 安全备份流程(基于 composable)
const {
  phase: secureBackupPhase,
  loading: secureBackupLoading,
  recoveryKey: secureBackupRecoveryKey,
  passphrase: secureBackupPassphrase,
  restoreInput: secureBackupRestoreInput,
  errorMessage: secureBackupErrorMessage,
  status: secureBackupStatus,
  refreshStatus: refreshSecureBackupStatus,
  createSecureBackup,
  restoreFromSecureBackup
} = useSecureBackupFlow()

const showSecureBackupPopup = ref(false)

const secureBackupStatusText = computed(() => {
  switch (secureBackupStatus.value) {
    case 'active':
      return t('mobile_security.secure_backup.status_active')
    case 'inactive':
      return t('mobile_security.secure_backup.status_inactive')
    case 'incomplete':
      return t('mobile_security.secure_backup.status_incomplete')
    default:
      return t('mobile_security.secure_backup.status_inactive')
  }
})

const secureBackupTagType = computed<'success' | 'warning' | 'danger'>(() => {
  switch (secureBackupStatus.value) {
    case 'active':
      return 'success'
    case 'incomplete':
      return 'warning'
    default:
      return 'warning'
  }
})

const crossSigningStatus = computed(() => {
  return crossSigningEnabled.value
    ? t('mobile_security.cross_signing_enabled')
    : t('mobile_security.cross_signing_disabled')
})

const keyBackupStatus = computed(() => {
  return keyBackupEnabled.value ? t('mobile_security.key_backup_enabled') : t('mobile_security.key_backup_disabled')
})

onMounted(async () => {
  await loadSecurityInfo()
  await refreshSecureBackupStatus()
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
  } catch (error) {
    logger.error('Failed to load security details', error)
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
    logger.error('Failed to change password', error)
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
    logger.error('Failed to set up key backup', error)
    showToast({
      type: 'fail',
      message: t('mobile_security.backup_setup_failed')
    })
  }
}

// === 安全备份流程(基于 composable) ===
function openSecureBackupCreate() {
  secureBackupPassphrase.value = ''
  secureBackupPhase.value = 'create'
  showSecureBackupPopup.value = true
}

function openSecureBackupRestore() {
  secureBackupRestoreInput.value = ''
  secureBackupPhase.value = 'restore'
  showSecureBackupPopup.value = true
}

async function handleCreateSecureBackup() {
  const ok = await createSecureBackup()
  if (!ok && secureBackupPhase.value === 'error') {
    // composable 已切换到 error 阶段,popup 仍展示错误信息
  }
}

async function handleRestoreSecureBackup() {
  const input = secureBackupRestoreInput.value.trim()
  if (!input) {
    showToast({ type: 'fail', message: t('mobile_security.secure_backup.enter_recovery_key') })
    return
  }
  await restoreFromSecureBackup(input)
}

function closeSecureBackupFlow() {
  showSecureBackupPopup.value = false
}

function copySecureBackupKey() {
  if (!secureBackupRecoveryKey.value) return
  navigator.clipboard
    .writeText(secureBackupRecoveryKey.value)
    .then(() => showToast({ type: 'success', message: t('mobile_security.secure_backup.title') }))
    .catch(() => showToast({ type: 'fail', message: t('mobile_security.secure_backup.create_failed') }))
}

async function handleExportKeys() {
  try {
    await showConfirmDialog({
      title: t('mobile_security.export_keys_confirm.title'),
      message: t('mobile_security.export_keys_confirm.message'),
      confirmButtonText: t('mobile_security.export_keys_confirm.confirm'),
      cancelButtonText: t('mobile_security.export_keys_confirm.cancel')
    })

    showLoadingToast({
      message: t('mobile_security.exporting_keys'),
      forbidClick: true
    })

    const keysJson = await matrixCryptoService.exportKeys('')
    if (keysJson) {
      const blob = new Blob([keysJson], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hula-keys-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      showToast({
        type: 'success',
        message: t('mobile_security.export_keys_success')
      })
    } else {
      showToast({
        type: 'fail',
        message: t('mobile_security.export_keys_empty')
      })
    }
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('Failed to export keys', error)
      showToast({
        type: 'fail',
        message: t('mobile_security.export_keys_failed')
      })
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
    await logout()
    router.push('/mobile/login')
  } catch (error) {
    if (error !== 'cancel') {
      logger.error('Failed to deactivate account', error)
      showToast({
        type: 'fail',
        message: t('mobile_security.deactivate_failed')
      })
    }
  }
}
</script>

<style scoped lang="scss">
.secure-backup-flow {
  padding-bottom: env(safe-area-inset-bottom);

  .flow-step {
    background: var(--van-background-2);
  }

  .recovery-key-title {
    font-size: 14px;
    color: var(--hula-text-secondary, #999);
    margin-bottom: 8px;
  }

  .recovery-key-value {
    font-family: monospace;
    font-size: 14px;
    word-break: break-all;
    line-height: 1.6;
    padding: 12px;
    background: var(--van-gray-1, #f7f8fa);
    border-radius: 8px;
    color: var(--hula-text-primary, #333);
  }

  :deep(.dark) .recovery-key-value {
    background: rgba(255, 255, 255, 0.06);
  }
}
</style>
