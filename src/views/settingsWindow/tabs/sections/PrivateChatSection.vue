<template>
  <div class="settings-section">
    <h3 class="section-title">{{ t('setting.private_chat.title') }}</h3>
    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.private_chat.enable') }}</span>
        <span class="setting-desc">{{ t('setting.private_chat.enable_desc') }}</span>
      </div>
      <n-switch v-model:value="secretChatEnabled" @update:value="handleSecretChatEnabledChange" />
    </div>
    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.private_chat.password') }}</span>
        <span class="setting-desc">
          {{
            secretChatConfigured
              ? t('setting.security.private_chat_password_configured')
              : t('setting.security.private_chat_password_not_configured')
          }}
        </span>
      </div>
      <n-button size="small" @click="handleSetupSecretChat">
        {{ secretChatConfigured ? t('setting.private_chat.change_password') : t('setting.private_chat.set_password') }}
      </n-button>
    </div>
    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.private_chat.hide_sessions') }}</span>
        <span class="setting-desc">{{ t('setting.private_chat.hide_sessions_desc') }}</span>
      </div>
      <n-switch v-model:value="secretChatHideSessions" :disabled="!secretChatEnabled" />
    </div>
    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.private_chat.auto_lock') }}</span>
        <span class="setting-desc">{{ t('setting.private_chat.auto_lock_desc') }}</span>
      </div>
      <n-switch v-model:value="secretChatAutoLock" :disabled="!secretChatEnabled" />
    </div>
    <div v-if="secretChatAutoLock" class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.private_chat.lock_timeout') }}</span>
        <span class="setting-desc">{{ t('setting.security.private_chat_lock_timeout_desc') }}</span>
      </div>
      <n-select v-model:value="secretChatLockTimeout" size="small" style="width: 140px" :options="lockTimeoutOptions" />
    </div>
    <div v-if="secretChatConfigured" class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.private_chat.clear') }}</span>
        <span class="setting-desc">{{ t('setting.private_chat.clear_desc') }}</span>
      </div>
      <n-button size="small" @click="handleClearSecretChat">{{ t('setting.private_chat.clear') }}</n-button>
    </div>
  </div>

  <n-modal
    v-model:show="showSecretChatDialog"
    preset="card"
    :title="t('setting.private_chat.set_password')"
    style="width: 400px">
    <div class="secret-chat-form">
      <n-form :model="secretChatForm" :rules="secretChatRules">
        <n-form-item path="password" :label="t('setting.private_chat.password')">
          <n-input
            v-model:value="secretChatForm.password"
            type="password"
            :placeholder="t('setting.private_chat.password_placeholder')"
            show-password-on="click" />
        </n-form-item>
        <n-form-item path="confirmPassword" :label="t('setting.private_chat.confirm_password')">
          <n-input
            v-model:value="secretChatForm.confirmPassword"
            type="password"
            :placeholder="t('setting.private_chat.confirm_password_placeholder')"
            show-password-on="click" />
        </n-form-item>
      </n-form>
      <div class="dialog-footer">
        <n-button @click="showSecretChatDialog = false">{{ t('setting.common.cancel') }}</n-button>
        <n-button type="primary" @click="handleSaveSecretChat" :loading="savingSecretChat">
          {{ t('setting.common.save') }}
        </n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { NButton, NForm, NFormItem, NInput, NModal, NSelect, NSwitch, useDialog } from 'naive-ui'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSettingStore } from '@/stores/domains/settings/setting'

defineOptions({
  name: 'PrivateChatSection'
})

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const dialog = useDialog()
const settingStore = useSettingStore()

const secretChatConfigured = computed(() => settingStore.isSecretChatConfigured())
const secretChatEnabled = computed({
  get: () => settingStore.secretChatEnabled,
  set: (value: boolean) => settingStore.setSecretChatEnabled(value)
})
const secretChatHideSessions = computed({
  get: () => settingStore.secretChatHideSessions,
  set: (value: boolean) => settingStore.setSecretChatHideSessions(value)
})
const secretChatAutoLock = computed({
  get: () => settingStore.secretChatAutoLock,
  set: (value: boolean) => settingStore.setSecretChatAutoLock(value)
})
const secretChatLockTimeout = computed({
  get: () => settingStore.secretChatLockTimeout,
  set: (value: number) => settingStore.setSecretChatLockTimeout(value)
})

const showSecretChatDialog = ref(false)
const savingSecretChat = ref(false)
const secretChatForm = reactive({
  password: '',
  confirmPassword: ''
})
const secretChatRules = {
  password: {
    required: true,
    message: t('setting.private_chat.password_required'),
    trigger: 'blur'
  },
  confirmPassword: {
    required: true,
    message: t('setting.private_chat.confirm_password_required'),
    trigger: 'blur'
  }
}

const lockTimeoutOptions = computed(() => [
  { label: t('setting.private_chat.1_minute'), value: 1 },
  { label: t('setting.private_chat.5_minutes'), value: 5 },
  { label: t('setting.private_chat.15_minutes'), value: 15 },
  { label: t('setting.private_chat.30_minutes'), value: 30 },
  { label: t('setting.private_chat.1_hour'), value: 60 }
])

function handleSetupSecretChat() {
  secretChatForm.password = ''
  secretChatForm.confirmPassword = ''
  showSecretChatDialog.value = true
}

async function handleSaveSecretChat() {
  if (secretChatForm.password !== secretChatForm.confirmPassword) {
    showFeedback(t('setting.private_chat.password_mismatch'), 'error')
    return
  }

  if (secretChatForm.password.length < 4) {
    showFeedback(t('setting.private_chat.password_too_short'), 'error')
    return
  }

  try {
    savingSecretChat.value = true
    await settingStore.setSecretChatPassword(secretChatForm.password)
    showSecretChatDialog.value = false
    showFeedback(t('setting.private_chat.password_set_success'), 'success')
  } catch (error) {
    showFeedback(t('setting.private_chat.password_set_failed'), 'error')
  } finally {
    savingSecretChat.value = false
  }
}

function handleSecretChatEnabledChange(value: boolean) {
  showFeedback(
    value ? t('setting.security.private_chat_enabled') : t('setting.security.private_chat_disabled'),
    'success'
  )
}

function handleClearSecretChat() {
  dialog.warning({
    title: t('setting.private_chat.clear_confirm_title'),
    content: t('setting.private_chat.clear_confirm_content'),
    positiveText: t('setting.common.confirm'),
    negativeText: t('setting.common.cancel'),
    onPositiveClick: () => {
      settingStore.clearSecretChatPassword()
      showFeedback(t('setting.private_chat.clear_success'), 'success')
    }
  })
}
</script>

<style scoped>
.settings-section {
  margin-bottom: var(--tjg-space-4);
}

.section-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin-bottom: var(--tjg-space-4);
  color: var(--tjg-text-primary);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-3) 0;
  border-bottom: 1px solid var(--tjg-settings-divider);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
}

.setting-desc {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  margin-top: var(--tjg-space-1);
}
</style>
