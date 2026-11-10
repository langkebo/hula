<template>
  <van-dialog
    v-model:show="show"
    :title="t('home.secret_chat.unlock_title')"
    :show-cancel-button="true"
    :confirm-button-text="t('home.secret_chat.unlock_action')"
    :cancel-button-text="t('common.cancel')"
    :before-close="handleBeforeClose">
    <div class="p-16px flex flex-col gap-12px">
      <van-field
        v-model="password"
        type="password"
        :label="t('home.secret_chat.password_label')"
        :placeholder="t('home.secret_chat.password_placeholder')"
        :maxlength="64"
        autocomplete="current-password" />
      <div v-if="failureCount >= 3" class="flex flex-col gap-8px" data-testid="mobile-secret-chat-failure-hint">
        <span class="text-12px text-[--tjg-color-warning-500]">
          {{ t('home.secret_chat.password_incorrect_retry') }}
        </span>
        <van-button size="small" plain type="primary" @click="goSettings">
          {{ t('mobile_security.secret_chat.go_settings') }}
        </van-button>
      </div>
    </div>
  </van-dialog>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  closeSecretChatUnlock,
  consumeSecretChatPendingPath,
  recordSecretChatUnlockFailure,
  useSecretChatGate
} from '@/composables/secretChat/useSecretChatGate'
import { MOBILE_SETTINGS_SECURITY_PRIVACY_PATH } from '@/mobile/views/my/settingsRoutes'
import { useSettingStore } from '@/stores/domains/settings/setting'

/**
 * 移动端私密聊天解锁弹窗（Vant）。
 *
 * 与桌面端 `SecretChatUnlockDialog` 语义对齐：成功时先消费 `pendingPath`、再关闭 gate、最后回跳；
 * 失败时累加失败计数并清空输入，保持弹窗打开。
 */
defineOptions({ name: 'MobileSecretChatUnlockDialog' })

const { t } = useI18n()
const router = useRouter()
const settingStore = useSettingStore()
const { visible, failureCount } = useSecretChatGate()

const password = ref('')
const submitting = ref(false)

const show = computed({
  get: () => visible.value,
  set: (value: boolean) => {
    if (!value) {
      password.value = ''
      closeSecretChatUnlock()
    }
  }
})

const handleConfirm = async () => {
  if (submitting.value) return
  if (!password.value) {
    showToast({ type: 'fail', message: t('home.secret_chat.password_required') })
    return
  }
  submitting.value = true
  try {
    const ok = await settingStore.unlockSecretChat(password.value)
    if (!ok) {
      recordSecretChatUnlockFailure()
      password.value = ''
      showToast({ type: 'fail', message: t('home.secret_chat.password_incorrect') })
      return
    }
    const target = consumeSecretChatPendingPath()
    closeSecretChatUnlock()
    await router.replace(target ?? '/mobile/secretChat')
  } finally {
    submitting.value = false
  }
}

/** van-dialog before-close：confirm 走校验，失败保持打开；cancel 直接关。 */
const handleBeforeClose = async (action: string): Promise<boolean> => {
  if (action !== 'confirm') {
    password.value = ''
    return true
  }
  await handleConfirm()
  return false
}

const goSettings = () => {
  closeSecretChatUnlock()
  void router.replace(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH)
}
</script>
