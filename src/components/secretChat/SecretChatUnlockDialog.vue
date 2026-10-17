<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    class="secret-chat-unlock"
    :title="t('login.secret_chat.title')"
    :bordered="false"
    :mask-closable="false"
    :close-on-esc="true"
    @after-leave="handleAfterLeave">
    <div class="flex flex-col gap-12px">
      <div class="text-(13px [--tjg-text-tertiary]) leading-relaxed">
        {{ t('login.secret_chat.unlock_description') }}
      </div>

      <n-input
        v-model:value="password"
        type="password"
        show-password-on="click"
        size="large"
        :placeholder="t('login.secret_chat.password_placeholder')"
        :disabled="loading"
        v-bind="errorMsg ? { status: 'error' } : {}"
        @keyup.enter="handleUnlock" />

      <div v-if="errorMsg" class="text-(12px [--tjg-color-danger-500])" role="alert">
        {{ errorMsg }}
      </div>

      <div class="flex justify-end gap-8px">
        <n-button :disabled="loading" @click="handleCancel">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="loading" :disabled="!password" @click="handleUnlock">
          {{ t('login.secret_chat.confirm') }}
        </n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  clearSecretChatPendingPath,
  closeSecretChatUnlock,
  consumeSecretChatPendingPath,
  recordSecretChatUnlockFailure,
  useSecretChatGate
} from '@/composables/secretChat/useSecretChatGate'
import { getSecretChatDbKey } from '@/stores/domains/settings/secretChatSession'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { createLogger } from '@/utils/Logger'

/**
 * 私密聊天解锁对话框（应用内，非独立窗口）。
 *
 * 解锁成功：写入内存态 dbKey（`secretChatSession`），随后回跳到守卫记录的 `pendingPath`。
 * 失败：清空输入并累加失败计数；不泄露「密码是否存在」以外的任何信息。
 */
defineOptions({ name: 'SecretChatUnlockDialog' })

const { t } = useI18n()
const router = useRouter()
const settingStore = useSettingStore()
const logger = createLogger('SecretChatUnlockDialog')

const { visible } = useSecretChatGate()

const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

const handleUnlock = async () => {
  if (!password.value || loading.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const ok = await settingStore.unlockSecretChat(password.value)
    if (!ok) {
      const attempts = recordSecretChatUnlockFailure()
      errorMsg.value =
        attempts >= 3 ? t('login.secret_chat.password_incorrect_retry') : t('login.secret_chat.password_incorrect')
      password.value = ''
      return
    }
    if (!getSecretChatDbKey()) {
      // 理论上不可达：解锁成功必须带出 dbKey，否则后续本地加密无密钥可用
      logger.error('unlocked but dbKey is missing; treating as failure')
      errorMsg.value = t('login.secret_chat.verify_failed')
      return
    }
    const target = consumeSecretChatPendingPath()
    closeSecretChatUnlock()
    await router.push(target ?? '/secretChat')
  } catch (err) {
    logger.error('secret chat unlock failed:', err)
    errorMsg.value = t('login.secret_chat.verify_failed')
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  clearSecretChatPendingPath()
  closeSecretChatUnlock()
}

const handleAfterLeave = () => {
  password.value = ''
  errorMsg.value = ''
}
</script>

<style scoped>
.secret-chat-unlock {
  width: 360px;
  max-width: calc(100vw - 32px);
}
</style>
