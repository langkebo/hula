<template>
  <n-flex vertical :size="30">
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.private_chat.title') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <div class="setting-info-box">
          <Icon :icon="secretChatConfigured ? 'mdi:shield-check' : 'mdi:shield-off'" :width="48" />
          <div class="setting-info-text">
            <span class="setting-title">{{ secretChatConfigured ? t('setting.private_chat.configured') : t('setting.private_chat.not_configured') }}</span>
            <span class="setting-desc">{{ t('setting.private_chat.description') }}</span>
          </div>
        </div>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.private_chat.enable') }}</span>
            <span class="text-(12px #909090)">{{ t('setting.private_chat.enable_desc') }}</span>
          </n-flex>
          <n-switch size="small" v-model:value="secretChatEnabled" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.private_chat.password') }}</span>
            <span class="text-(12px #909090)">{{ t('setting.private_chat.password_desc') }}</span>
          </n-flex>
          <n-button size="small" type="primary" @click="handleSetupPassword">
            {{ secretChatConfigured ? t('setting.private_chat.change_password') : t('setting.private_chat.set_password') }}
          </n-button>
        </n-flex>

        <span v-if="secretChatConfigured" class="w-full h-1px bg-[--line-color]"></span>

        <n-flex v-if="secretChatConfigured" align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.private_chat.clear') }}</span>
            <span class="text-(12px #909090)">{{ t('setting.private_chat.clear_desc') }}</span>
          </n-flex>
          <n-button size="small" type="error" @click="handleClearSecretChat">
            {{ t('setting.private_chat.clear') }}
          </n-button>
        </n-flex>
      </n-flex>
    </n-flex>

    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.private_chat.privacy_title') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.private_chat.hide_sessions') }}</span>
            <span class="text-(12px #909090)">{{ t('setting.private_chat.hide_sessions_desc') }}</span>
          </n-flex>
          <n-switch size="small" v-model:value="hideSessions" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.private_chat.auto_lock') }}</span>
            <span class="text-(12px #909090)">{{ t('setting.private_chat.auto_lock_desc') }}</span>
          </n-flex>
          <n-switch size="small" v-model:value="autoLock" />
        </n-flex>

        <span v-if="autoLock" class="w-full h-1px bg-[--line-color]"></span>

        <n-flex v-if="autoLock" align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.private_chat.lock_timeout') }}</span>
          </n-flex>
          <n-select
            class="w-140px"
            size="small"
            v-model:value="lockTimeout"
            :options="lockTimeoutOptions" />
        </n-flex>
      </n-flex>
    </n-flex>
  </n-flex>

  <n-modal v-model:show="showPasswordDialog" preset="card" :title="t('setting.private_chat.set_password')" style="width: 400px">
    <div class="password-form">
      <n-form ref="formRef" :model="passwordForm" :rules="formRules">
        <n-form-item path="password" :label="t('setting.private_chat.new_password')">
          <n-input
            v-model:value="passwordForm.password"
            type="password"
            :placeholder="t('setting.private_chat.password_placeholder')"
            show-password-on="click" />
        </n-form-item>
        <n-form-item path="confirmPassword" :label="t('setting.private_chat.confirm_password')">
          <n-input
            v-model:value="passwordForm.confirmPassword"
            type="password"
            :placeholder="t('setting.private_chat.confirm_password_placeholder')"
            show-password-on="click" />
        </n-form-item>
      </n-form>
      <div class="dialog-footer">
        <n-button @click="showPasswordDialog = false">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="saving" @click="handleSavePassword">{{ t('common.save') }}</n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NSwitch, NSelect, NModal, NForm, NFormItem, useMessage, useDialog } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useSettingStore } from '@/stores/setting'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()
const settingStore = useSettingStore()

const secretChatConfigured = computed(() => settingStore.isSecretChatConfigured())

const secretChatEnabled = computed({
  get: () => settingStore.secretChat.enabled,
  set: (value: boolean) => {
    settingStore.$patch((state) => {
      state.secretChat.enabled = value
    })
  }
})

const hideSessions = ref(false)
const autoLock = ref(false)
const lockTimeout = ref(5)

const lockTimeoutOptions = [
  { label: t('setting.private_chat.1_minute'), value: 1 },
  { label: t('setting.private_chat.5_minutes'), value: 5 },
  { label: t('setting.private_chat.15_minutes'), value: 15 },
  { label: t('setting.private_chat.30_minutes'), value: 30 },
  { label: t('setting.private_chat.1_hour'), value: 60 }
]

const showPasswordDialog = ref(false)
const saving = ref(false)
const formRef = ref()
const passwordForm = reactive({
  password: '',
  confirmPassword: ''
})

const formRules = {
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

function handleSetupPassword() {
  passwordForm.password = ''
  passwordForm.confirmPassword = ''
  showPasswordDialog.value = true
}

async function handleSavePassword() {
  if (passwordForm.password !== passwordForm.confirmPassword) {
    message.error(t('setting.private_chat.password_mismatch'))
    return
  }

  if (passwordForm.password.length < 4) {
    message.error(t('setting.private_chat.password_too_short'))
    return
  }

  try {
    saving.value = true
    settingStore.setSecretChatPassword(passwordForm.password)
    showPasswordDialog.value = false
    message.success(t('setting.private_chat.password_set_success'))
  } catch (error) {
    message.error(t('setting.private_chat.password_set_failed'))
  } finally {
    saving.value = false
  }
}

function handleClearSecretChat() {
  dialog.warning({
    title: t('setting.private_chat.clear_confirm_title'),
    content: t('setting.private_chat.clear_confirm_content'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: () => {
      settingStore.clearSecretChatPassword()
      secretChatEnabled.value = false
      hideSessions.value = false
      autoLock.value = false
      message.success(t('setting.private_chat.clear_success'))
    }
  })
}
</script>

<style scoped lang="scss">
.item {
  @apply bg-[--bg-setting-item] rounded-12px size-full p-12px box-border border-(solid 1px [--line-color]) custom-shadow;
}

.setting-info-box {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;

  :deep(.dark) & {
    background-color: rgba(255, 255, 255, 0.05);
  }
}

.setting-info-text {
  display: flex;
  flex-direction: column;
}

.setting-title {
  font-size: 16px;
  font-weight: 500;
}

.setting-desc {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.password-form {
  padding: 8px 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
</style>
