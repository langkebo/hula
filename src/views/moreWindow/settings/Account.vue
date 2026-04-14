<template>
  <n-flex vertical :size="40">
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.account.profile') }}</span>

      <n-flex class="item p-12px" :size="16" vertical>
        <n-flex align="center" :size="16">
          <div class="avatar-wrapper" @click="handleAvatarClick">
            <n-avatar round :size="80" :src="avatarUrl" :fallback-src="defaultAvatar" />
            <div class="avatar-overlay">
              <svg class="size-24px"><use href="#edit-pen"></use></svg>
            </div>
          </div>
          <n-flex vertical :size="8">
            <span class="text-(12px #909090)">{{ t('setting.account.change_avatar_hint') }}</span>
          </n-flex>
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.account.nickname') }}</span>
          </n-flex>
          <n-input
            v-model:value="displayname"
            :placeholder="t('setting.account.nickname_placeholder')"
            class="w-280px"
            size="small"
            @blur="handleDisplaynameChange" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.account.user_id') }}</span>
          </n-flex>
          <n-input :value="userId" disabled class="w-280px" size="small" />
        </n-flex>

        <span class="w-full h-1px bg-[--line-color]"></span>

        <n-flex align="flex-start" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.account.about') }}</span>
          </n-flex>
          <n-input
            v-model:value="about"
            type="textarea"
            :placeholder="t('setting.account.about_placeholder')"
            class="w-280px"
            size="small"
            :rows="3"
            :maxlength="500"
            show-count
            @blur="handleAboutChange" />
        </n-flex>
      </n-flex>
    </n-flex>

    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.account.security') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.account.change_password') }}</span>
            <span class="text-(12px #909090)">{{ t('setting.account.change_password_desc') }}</span>
          </n-flex>
          <n-button size="small" type="primary" @click="showPasswordModal = true">
            {{ t('setting.account.change_password') }}
          </n-button>
        </n-flex>
      </n-flex>
    </n-flex>

    <ThreePidManagement />

    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.account.danger_zone') }}</span>

      <n-flex class="item danger-zone p-12px" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span class="text-(14px #d03050)">{{ t('setting.account.deactivate_account') }}</span>
            <span class="text-(12px #909090)">{{ t('setting.account.deactivate_account_desc') }}</span>
          </n-flex>
          <n-button size="small" type="error" @click="handleDeactivate">
            {{ t('setting.account.deactivate_account') }}
          </n-button>
        </n-flex>
      </n-flex>
    </n-flex>
  </n-flex>

  <n-modal v-model:show="showPasswordModal" preset="card" :title="t('setting.account.change_password')" style="width: 400px">
    <n-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-placement="top">
      <n-form-item :label="t('setting.account.current_password')" path="currentPassword">
        <n-input
          v-model:value="passwordForm.currentPassword"
          type="password"
          show-password-on="click"
          :placeholder="t('setting.account.current_password_placeholder')" />
      </n-form-item>
      <n-form-item :label="t('setting.account.new_password')" path="newPassword">
        <n-input
          v-model:value="passwordForm.newPassword"
          type="password"
          show-password-on="click"
          :placeholder="t('setting.account.new_password_placeholder')" />
      </n-form-item>
      <n-form-item :label="t('setting.account.confirm_password')" path="confirmPassword">
        <n-input
          v-model:value="passwordForm.confirmPassword"
          type="password"
          show-password-on="click"
          :placeholder="t('setting.account.confirm_password_placeholder')" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-flex justify="flex-end" :size="12">
        <n-button @click="showPasswordModal = false">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="saving" @click="handleChangePassword">{{ t('common.save') }}</n-button>
      </n-flex>
    </template>
  </n-modal>

  <input type="file" ref="fileInputRef" accept="image/*" style="display: none" @change="handleFileSelect" />
</template>

<script setup lang="ts">
import { NAvatar, NInput, NButton, NModal, NForm, NFormItem, useMessage, useDialog, NFlex } from 'naive-ui'
import { useUserStore } from '@/stores/user'
import { useI18n } from 'vue-i18n'
import ThreePidManagement from '@/components/settings/ThreePidManagement.vue'

const { t } = useI18n()
const userStore = useUserStore()
const message = useMessage()
const dialog = useDialog()

const defaultAvatar = computed(() => '/logoL.png')
const avatarUrl = computed(() => userStore.matrixProfile?.avatarUrl || '')
const userId = computed(() => userStore.userInfo?.account || '')

const displayname = ref(userStore.userInfo?.name || '')
const about = ref('')
const showPasswordModal = ref(false)
const saving = ref(false)
const fileInputRef = ref<HTMLInputElement>()

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const passwordRules = {
  currentPassword: { required: true, message: t('setting.account.current_password_required'), trigger: 'blur' },
  newPassword: { required: true, message: t('setting.account.new_password_required'), trigger: 'blur' },
  confirmPassword: [
    { required: true, message: t('setting.account.confirm_password_required'), trigger: 'blur' },
    {
      validator: (_rule: any, value: string) => value === passwordForm.newPassword,
      message: t('setting.account.password_mismatch'),
      trigger: 'blur'
    }
  ]
}

const handleAvatarClick = () => {
  fileInputRef.value?.click()
}

const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (file.size > 10 * 1024 * 1024) {
    message.error(t('setting.account.avatar_too_large'))
    return
  }

  try {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      await userStore.updateAvatar(dataUrl)
      message.success(t('setting.account.avatar_updated'))
    }
    reader.readAsDataURL(file)
  } catch (error) {
    message.error(t('setting.account.avatar_update_failed'))
  }

  target.value = ''
}

const handleDisplaynameChange = async () => {
  if (displayname.value === userStore.userInfo?.name) return
  try {
    await userStore.updateDisplayName(displayname.value)
    message.success(t('setting.account.nickname_updated'))
  } catch (error) {
    message.error(t('setting.account.nickname_update_failed'))
  }
}

const handleAboutChange = async () => {
  message.success(t('setting.common.save_success'))
}

const handleChangePassword = async () => {
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    message.error(t('setting.account.password_mismatch'))
    return
  }

  message.success(t('setting.account.password_changed'))
  showPasswordModal.value = false
  passwordForm.currentPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
}

const handleDeactivate = () => {
  dialog.warning({
    title: t('setting.account.deactivate_confirm_title'),
    content: t('setting.account.deactivate_confirm_content'),
    positiveText: t('setting.account.deactivate_confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      message.success(t('setting.account.deactivate_success'))
    }
  })
}
</script>

<style scoped lang="scss">
.item {
  @apply bg-[--bg-setting-item] rounded-12px size-full p-12px box-border border-(solid 1px [--line-color]) custom-shadow;
}

.danger-zone {
  border-color: #d0305030;
}

.avatar-wrapper {
  position: relative;
  cursor: pointer;

  &:hover .avatar-overlay {
    opacity: 1;
  }
}

.avatar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  color: white;
}
</style>
