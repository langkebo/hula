<template>
  <div class="account-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.account.profile') }}</h3>

      <div class="profile-section">
        <div class="avatar-section">
          <n-avatar round :size="80" :src="displayAvatarUrl" :fallback-src="defaultAvatar" />
          <n-button size="small" :loading="avatarUploading" @click="handleAvatarChange">
            {{ avatarUploading ? t('setting.account.avatar_uploading') : t('setting.account.change_avatar') }}
          </n-button>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style="display: none"
            @change="handleFileSelect" />
        </div>

        <n-form ref="formRef" :model="formData" label-placement="left" label-width="80">
          <n-form-item :label="t('setting.account.nickname')" path="displayName">
            <n-input
              v-model:value="formData.displayName"
              :placeholder="t('setting.account.nickname_placeholder')"
              :maxlength="50"
              @blur="handleDisplayNameChange" />
          </n-form-item>

          <n-form-item :label="t('setting.account.user_id')">
            <n-input :value="userId" disabled />
          </n-form-item>
        </n-form>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.account.security') }}</h3>

      <n-form ref="passwordFormRef" :model="passwordForm" label-placement="left" label-width="100">
        <n-form-item :label="t('setting.account.current_password')" path="oldPassword">
          <n-input
            v-model:value="passwordForm.oldPassword"
            type="password"
            :placeholder="t('setting.account.current_password_placeholder')"
            show-password-on="click" />
        </n-form-item>

        <n-form-item :label="t('setting.account.new_password')" path="newPassword">
          <n-input
            v-model:value="passwordForm.newPassword"
            type="password"
            :placeholder="t('setting.account.new_password_placeholder')"
            show-password-on="click" />
        </n-form-item>

        <n-form-item :label="t('setting.account.confirm_password')" path="confirmPassword">
          <n-input
            v-model:value="passwordForm.confirmPassword"
            type="password"
            :placeholder="t('setting.account.confirm_password_placeholder')"
            show-password-on="click" />
        </n-form-item>

        <n-form-item>
          <n-checkbox v-model:checked="logoutDevices">
            {{ t('setting.account.logout_other_devices') }}
          </n-checkbox>
        </n-form-item>

        <n-form-item>
          <n-button type="primary" :loading="passwordLoading" @click="handlePasswordChange">
            {{ t('setting.account.change_password') }}
          </n-button>
        </n-form-item>
      </n-form>
    </div>

    <n-divider />

    <div class="settings-section danger-zone">
      <h3 class="section-title">{{ t('setting.account.danger_zone') }}</h3>
      <n-button type="error" @click="handleDeactivateAccount">{{ t('setting.account.deactivate_account') }}</n-button>
    </div>

    <AvatarCropper v-model:show="showCropper" :image-url="localImageUrl" @crop="handleCrop" ref="cropperRef" />
  </div>
</template>

<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { NAvatar, NButton, NCheckbox, NDivider, NForm, NFormItem, NInput, useDialog } from 'naive-ui'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import defaultAvatarImg from '@/assets/img/win.png'
import { formatMatrixError } from '@/common/matrixErrorTranslator'
import type { AvatarCropperInstance } from '@/components/common/AvatarCropper.vue'
import AvatarCropper from '@/components/common/AvatarCropper.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSettingsTabDirty } from '@/composables/settings/useSettingsDirtyRegistry'
import { useAccount } from '@/composables/user/useAccount'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import { matrixAccountService } from '@/services/matrix/user/MatrixAccountService'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { useUserStore } from '@/stores/domains/user/user'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AccountSettings')

defineOptions({
  name: 'AccountSettings'
})

const { showFeedback } = useActionFeedback()
const dialog = useDialog()
const { t } = useI18n()
const { changePassword, deactivateAccount } = useAccount()
const userStore = useUserStore()
const matrixStore = useMatrixStore()

const passwordLoading = ref(false)
const avatarUploading = ref(false)
const showCropper = ref(false)
const localImageUrl = ref('')
const fileInputRef = ref<HTMLInputElement>()
const cropperRef = ref<AvatarCropperInstance>()
const logoutDevices = ref(false)

const userAvatar = computed(() => userStore.currentUserAvatarUrl || '')
const defaultAvatar = computed(() => defaultAvatarImg)
const userId = computed(() => matrixStore.userId || '')

const displayAvatarUrl = computed(() => {
  if (userAvatar.value?.startsWith('mxc://')) {
    return matrixMediaService.getMediaUrl(userAvatar.value, 160, 160) || userAvatar.value
  }
  return userAvatar.value
})

const formData = reactive({
  displayName: userStore.currentUserDisplayName || ''
})

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const hasUnsavedPasswordChanges = computed(() => {
  return Boolean(passwordForm.oldPassword || passwordForm.newPassword || passwordForm.confirmPassword)
})

useSettingsTabDirty('account', hasUnsavedPasswordChanges)

function handleAvatarChange() {
  if (hasTauriRuntime()) {
    openAvatarCropperViaTauri()
  } else {
    fileInputRef.value?.click()
  }
}

async function openAvatarCropperViaTauri() {
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['jpeg', 'jpg', 'png', 'webp'] }]
    })
    if (!selected) return

    const filePath = typeof selected === 'string' ? selected : (selected as string)

    // 直接使用 convertFileSrc 将本地路径转为 WebView 可访问的 asset URL
    const assetUrl = convertFileSrc(filePath)
    localImageUrl.value = assetUrl
    nextTick(() => {
      showCropper.value = true
    })
  } catch (error) {
    logger.error('打开文件选择器失败:', error)
  }
}

function processImageFile(file: File) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    showFeedback(t('setting.account.avatar_format_invalid'), 'error')
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    showFeedback(t('setting.account.avatar_too_large'), 'error')
    return
  }

  const url = URL.createObjectURL(file)
  localImageUrl.value = url
  showCropper.value = true
}

function handleFileSelect(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  processImageFile(file)

  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

async function handleCrop(blob: Blob) {
  avatarUploading.value = true

  try {
    const mimeType = blob.type || 'image/png'
    const ext = mimeType.split('/')[1] || 'png'
    const fileName = `avatar_${Date.now()}.${ext}`
    const file = new File([blob], fileName, { type: mimeType })

    const uploadResult = await matrixMediaService.uploadImage(file, (progress) => {
      logger.debug(`Avatar upload progress: ${progress}%`)
    })

    const mxcUrl = uploadResult.contentUri

    // 只通过 userStore 更新头像（内部会调用 profileService.setAvatarUrl）
    await userStore.updateAvatar(mxcUrl)

    showFeedback(t('setting.account.avatar_updated'), 'success')
    showCropper.value = false

    if (localImageUrl.value) {
      URL.revokeObjectURL(localImageUrl.value)
      localImageUrl.value = ''
    }
  } catch (error) {
    logger.error('Failed to upload avatar', error)
    showFeedback(t('setting.account.avatar_update_failed_retry'), 'error')
    cropperRef.value?.finishLoading()
  } finally {
    avatarUploading.value = false
  }
}

async function handleDisplayNameChange() {
  if (formData.displayName === userStore.currentUserDisplayName) return

  try {
    await matrixAccountService.updateDisplayName(formData.displayName)
    showFeedback(t('setting.account.nickname_updated'), 'success')
  } catch (error) {
    showFeedback(t('setting.account.nickname_update_failed'), 'error')
    formData.displayName = userStore.currentUserDisplayName || ''
  }
}

/** 校验密码强度（与后端 synapse-rust 策略一致） */
function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return t('setting.account.password_too_short')
  if (password.length > 128) return t('setting.account.password_too_long')
  if (!/[A-Z]/.test(password)) return t('setting.account.password_need_uppercase')
  if (!/[a-z]/.test(password)) return t('setting.account.password_need_lowercase')
  if (!/[0-9]/.test(password)) return t('setting.account.password_need_digit')
  if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) return t('setting.account.password_need_special')
  return null
}

async function handlePasswordChange() {
  if (!passwordForm.oldPassword || !passwordForm.newPassword) {
    showFeedback(t('setting.account.password_incomplete'), 'warning')
    return
  }

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    showFeedback(t('setting.account.password_mismatch'), 'warning')
    return
  }

  const strengthError = validatePasswordStrength(passwordForm.newPassword)
  if (strengthError) {
    showFeedback(strengthError, 'warning')
    return
  }

  passwordLoading.value = true
  try {
    await changePassword(passwordForm.oldPassword, passwordForm.newPassword, logoutDevices.value)
    showFeedback(t('setting.account.password_changed'), 'success')
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  } catch (error) {
    const errMsg = formatMatrixError(error)
    // 根据错误码提供更精确的提示
    const errObj = error as Record<string, unknown>
    const errcode = (errObj?.errcode as string) || (errObj?.code as string) || ''
    if (errcode === 'M_WEAK_PASSWORD') {
      showFeedback(t('setting.account.password_too_weak'), 'error')
    } else if (errcode === 'M_FORBIDDEN' || errMsg.includes('403')) {
      showFeedback(t('setting.account.password_wrong_current'), 'error')
    } else {
      showFeedback(t('setting.account.password_change_failed_with_hint'), 'error')
    }
  } finally {
    passwordLoading.value = false
  }
}

function handleDeactivateAccount() {
  dialog.warning({
    title: t('setting.account.deactivate_confirm_title'),
    content: t('setting.account.deactivate_confirm_content'),
    positiveText: t('setting.common.confirm'),
    negativeText: t('setting.common.cancel'),
    onPositiveClick: async () => {
      try {
        await deactivateAccount()
        showFeedback(t('setting.account.deactivate_success'), 'success')
      } catch (error) {
        showFeedback(t('setting.account.deactivate_failed'), 'error')
      }
    }
  })
}
</script>

<style scoped>
.account-settings {
  padding: 0 var(--hula-space-2);
}

.settings-section {
  margin-bottom: var(--hula-space-4);
}

.section-title {
  font-size: var(--hula-font-size-lg);
  font-weight: var(--hula-font-weight-medium);
  margin-bottom: var(--hula-space-4);
  color: var(--hula-text-primary);
}

.profile-section {
  display: flex;
  gap: 24px;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--hula-space-3);
}

.danger-zone {
  padding: var(--hula-space-4);
  border: 1px solid var(--hula-color-danger-500);
  border-radius: var(--hula-radius-sm);
  background-color: var(--hula-color-danger-100);
}
</style>
