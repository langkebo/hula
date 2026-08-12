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
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-info-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:lock" :width="20" color="var(--tjg-color-info-500)" />
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
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-success-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:devices" :width="20" color="var(--tjg-color-success-500)" />
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-[var(--tjg-text-secondary)] mt-16px mb-8px">
            {{ t('mobile_security.encryption_section') }}
          </div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_security.cross_signing')" :label="crossSigningStatus">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-primary-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:shield-check" :width="20" color="var(--tjg-color-primary-500)" />
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
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-warning-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:backup-restore" :width="20" color="var(--tjg-color-warning-500)" />
                </div>
              </template>
              <template #right-icon>
                <van-tag :type="keyBackupEnabled ? 'success' : 'warning'">
                  {{ keyBackupEnabled ? t('mobile_security.enabled') : t('mobile_security.disabled') }}
                </van-tag>
              </template>
            </van-cell>

            <van-cell
              :title="t('mobile_security.secure_backup.title')"
              :label="t('mobile_security.secure_backup.desc')"
              is-link
              @click="showSecureBackup = true">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-warning-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:shield-lock" :width="20" color="var(--tjg-color-warning-500)" />
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_security.export_keys')" is-link @click="handleExportKeys">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-info-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:download" :width="20" color="var(--tjg-color-info-500)" />
                </div>
              </template>
            </van-cell>

            <van-cell :title="$t('verification.title')" is-link @click="showDeviceVerify = true">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-primary-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:shield-check" :width="20" color="var(--tjg-color-primary-500)" />
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <MobileDeviceVerifyDialog
            v-model="showDeviceVerify"
            :user-id="currentUserId"
            :device-id="currentDeviceId"
            @verified="onDeviceVerified" />

          <MobileSecureBackupDialog v-model="showSecureBackup" @complete="onSecureBackupComplete" />

          <div class="text-14px text-[var(--tjg-text-secondary)] mt-16px mb-8px">
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
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-danger-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:account-cancel" :width="20" color="var(--tjg-color-danger-500)" />
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-[var(--tjg-text-secondary)] mt-16px mb-8px">
            {{ t('mobile_security.danger_section') }}
          </div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_security.deactivate_account')" is-link @click="handleDeactivate">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full bg-[var(--tjg-color-danger-100)] mr-12px flex items-center justify-center">
                  <Icon icon="mdi:alert-circle" :width="20" color="var(--tjg-color-danger-500)" />
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
          <div class="text-14px text-[var(--tjg-text-secondary)] mb-12px">
            {{ t('mobile_security.backup_description') }}
          </div>
          <van-field
            v-model="backupPassphrase"
            type="password"
            :label="t('mobile_security.backup_passphrase')"
            :placeholder="t('mobile_security.backup_passphrase_placeholder')" />
        </div>
      </van-dialog>
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
import MobileSecureBackupDialog from '#/components/encryption/MobileSecureBackupDialog.vue'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import { matrixAccountService } from '@/services/matrix/user/MatrixAccountService'
import { useLoginFlow } from '@/shared/composables/useLoginFlow'
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
const showSecureBackup = ref(false)
const currentUserId = computed(() => matrixStore.userId ?? '')
const currentDeviceId = computed(() => matrixStore.deviceId ?? '')
function onDeviceVerified() {
  showToast(t('verification.result.success_title'))
}
function onSecureBackupComplete() {
  void loadSecurityInfo()
}

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
      a.download = `tjg-keys-${new Date().toISOString().slice(0, 10)}.json`
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
