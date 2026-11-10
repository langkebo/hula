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
  clearSecretChatPendingPath,
  closeSecretChatUnlock,
  consumeSecretChatPendingPath,
  recordSecretChatUnlockFailure,
  useSecretChatGate
} from '@/composables/secretChat/useSecretChatGate'
import { MOBILE_SETTINGS_SECURITY_PRIVACY_PATH } from '@/mobile/views/my/settingsRoutes'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { createLogger } from '@/utils/Logger'

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
const logger = createLogger('MobileSecretChatUnlockDialog')
const { visible, failureCount } = useSecretChatGate()

const password = ref('')
const submitting = ref(false)

const show = computed({
  get: () => visible.value,
  set: (value: boolean) => {
    if (!value) {
      password.value = ''
      // 用户取消关闭时必须丢弃回跳目标，否则下次无参 openSecretChatUnlock() 会误用旧房间
      clearSecretChatPendingPath()
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
    // 无回跳目标时保持当前页面：`togglePrivateRoom` 这类「就地解锁」场景没有待跳转路由，
    // 跳私密列表只会把用户丢进一个空列表（且原本的动作仍未执行，需重新触发）。
    if (target) {
      await router.replace(target)
    }
  } catch (err) {
    logger.error('secret chat unlock failed:', err)
    showToast({ type: 'fail', message: t('login.secret_chat.verify_failed') })
  } finally {
    submitting.value = false
  }
}

/** van-dialog before-close：confirm 走校验，失败保持打开；cancel 直接关。 */
const handleBeforeClose = async (action: string): Promise<boolean> => {
  if (action !== 'confirm') {
    password.value = ''
    clearSecretChatPendingPath()
    return true
  }
  await handleConfirm()
  return false
}

const goSettings = () => {
  password.value = ''
  clearSecretChatPendingPath()
  closeSecretChatUnlock()
  void router.replace(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH)
}
</script>
