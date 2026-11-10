<template>
  <van-cell-group inset>
    <van-cell
      :title="t('mobile_security.secret_chat.password')"
      :value="passwordLabel"
      is-link
      @click="openPasswordDialog" />
    <van-cell :title="t('mobile_security.secret_chat.enable')" :label="t('mobile_security.secret_chat.enable_hint')">
      <template #right-icon>
        <van-switch :model-value="enabled" size="20px" @update:model-value="handleEnabledChange" />
      </template>
    </van-cell>
    <van-cell
      :title="t('mobile_security.secret_chat.auto_lock')"
      :label="t('mobile_security.secret_chat.auto_lock_hint')">
      <template #right-icon>
        <van-switch
          :model-value="autoLock"
          size="20px"
          :disabled="!configured"
          @update:model-value="handleAutoLockChange" />
      </template>
    </van-cell>
    <van-cell
      v-if="autoLock"
      :title="t('mobile_security.secret_chat.lock_timeout')"
      :value="t('mobile_security.secret_chat.minutes', { n: lockTimeout })"
      is-link
      @click="showTimeoutSheet = true" />
    <van-cell
      v-if="configured"
      :title="t('mobile_security.secret_chat.clear')"
      class="text-[var(--tjg-color-danger-500)]"
      is-link
      @click="handleClear" />
  </van-cell-group>

  <van-popup v-model:show="showTimeoutSheet" position="bottom" round>
    <van-picker
      :columns="timeoutColumns"
      :model-value="[String(lockTimeout)]"
      @confirm="handleTimeoutConfirm"
      @cancel="showTimeoutSheet = false" />
  </van-popup>

  <van-dialog
    v-model:show="showPasswordDialog"
    :title="
      configured ? t('mobile_security.secret_chat.change_password') : t('mobile_security.secret_chat.set_password')
    "
    show-cancel-button
    :confirm-button-text="t('mobile_security.confirm')"
    :cancel-button-text="t('mobile_security.cancel')"
    :before-close="handlePasswordConfirm">
    <div class="p-16px">
      <van-field
        v-if="configured"
        v-model="form.oldPassword"
        type="password"
        :label="t('mobile_security.secret_chat.old_password')" />
      <van-field v-model="form.newPassword" type="password" :label="t('mobile_security.secret_chat.new_password')" />
      <van-field
        v-model="form.confirmPassword"
        type="password"
        :label="t('mobile_security.secret_chat.confirm_password')" />
    </div>
  </van-dialog>
</template>

<script setup lang="ts">
import { showConfirmDialog, showToast } from 'vant'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobilePrivateChatSection')

defineOptions({ name: 'MobilePrivateChatSection' })

const { t } = useI18n()
const settingStore = useSettingStore()

const showPasswordDialog = ref(false)
const showTimeoutSheet = ref(false)
const form = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

const configured = computed(() => settingStore.isSecretChatConfigured())
const enabled = computed(() => settingStore.secretChatEnabled)
const autoLock = computed(() => settingStore.secretChatAutoLock)
const lockTimeout = computed(() => settingStore.secretChatLockTimeout)

const passwordLabel = computed(() =>
  configured.value ? t('mobile_security.secret_chat.change_password') : t('mobile_security.secret_chat.set_password')
)

const timeoutColumns = [1, 5, 15, 30].map((n) => ({
  text: t('mobile_security.secret_chat.minutes', { n }),
  value: String(n)
}))

const openPasswordDialog = () => {
  form.oldPassword = ''
  form.newPassword = ''
  form.confirmPassword = ''
  showPasswordDialog.value = true
}

const handleEnabledChange = (value: boolean) => {
  if (value && !configured.value) {
    openPasswordDialog()
    return
  }
  try {
    settingStore.setSecretChatEnabled(value)
  } catch (err) {
    logger.warn('Failed to toggle secret chat:', err)
    showToast({ type: 'fail', message: t('home.secret_chat.no_password') })
  }
}

const handleAutoLockChange = (value: boolean) => {
  settingStore.setSecretChatAutoLock(value)
}

const handleTimeoutConfirm = ({ selectedOptions }: { selectedOptions: Array<{ value: string }> }) => {
  const minutes = Number(selectedOptions?.[0]?.value ?? lockTimeout.value)
  settingStore.setSecretChatLockTimeout(minutes)
  showTimeoutSheet.value = false
}

/** 返回 true 关闭弹窗，false 保持打开。 */
const handlePasswordConfirm = async (action: string): Promise<boolean> => {
  if (action !== 'confirm') return true
  if (form.newPassword.length < 6) {
    showToast({ type: 'fail', message: t('mobile_security.secret_chat.password_too_short') })
    return false
  }
  if (form.newPassword !== form.confirmPassword) {
    showToast({ type: 'fail', message: t('mobile_security.secret_chat.password_mismatch') })
    return false
  }
  if (configured.value) {
    const valid = await settingStore.verifySecretChatPassword(form.oldPassword)
    if (!valid) {
      showToast({ type: 'fail', message: t('home.secret_chat.password_incorrect') })
      return false
    }
  }
  await settingStore.setSecretChatPassword(form.newPassword)
  showToast({ type: 'success', message: t('mobile_security.secret_chat.password_saved') })
  return true
}

const handleClear = async () => {
  try {
    await showConfirmDialog({
      title: t('mobile_security.secret_chat.clear'),
      message: t('mobile_security.secret_chat.clear_confirm'),
      confirmButtonText: t('mobile_security.confirm'),
      cancelButtonText: t('mobile_security.cancel')
    })
  } catch {
    return
  }
  settingStore.clearSecretChatPassword()
  showToast({ type: 'success', message: t('mobile_security.secret_chat.cleared') })
}
</script>
