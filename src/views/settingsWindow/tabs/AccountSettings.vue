<template>
  <div class="account-settings">
    <div class="settings-section" data-settings-anchor="account-profile">
      <h3 class="section-title">{{ t('setting.account.profile') }}</h3>

      <div v-if="extendedProfileLoadFailed" data-test="extended-profile-error">
        <ErrorState
          compact
          :title="t('common.load_failed')"
          :retry-text="t('common.retry')"
          @retry="loadExtendedProfile" />
      </div>

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
            class="hidden"
            @change="handleFileSelect" />
        </div>

        <n-form ref="formRef" :model="formData" label-placement="left" label-width="80">
          <n-form-item :label="t('setting.account.nickname')" path="displayName">
            <n-input
              v-model:value="formData.displayName"
              :placeholder="t('setting.account.nickname_placeholder')"
              :maxlength="50"
              :disabled="displayNameSaving"
              @blur="handleDisplayNameChange" />
          </n-form-item>

          <n-form-item :label="t('setting.account.user_id')">
            <n-input :value="userId" disabled />
          </n-form-item>

          <n-form-item :label="t('setting.account.about')" path="about">
            <n-input
              v-model:value="formData.about"
              type="textarea"
              :placeholder="t('setting.account.about_placeholder')"
              :maxlength="300"
              :disabled="extendedProfileDisabled"
              @blur="handleAboutChange" />
          </n-form-item>

          <n-form-item :label="t('setting.account.gender')" path="sex">
            <n-select
              v-model:value="formData.sex"
              :options="genderOptions"
              clearable
              :disabled="extendedProfileDisabled"
              :placeholder="t('setting.account.gender_placeholder')"
              @update:value="handleSexChange" />
          </n-form-item>

          <n-form-item :label="t('setting.account.region')" path="region">
            <n-input
              v-model:value="formData.region"
              :placeholder="t('setting.account.region_placeholder')"
              :maxlength="120"
              :disabled="extendedProfileDisabled"
              @blur="handleRegionChange" />
          </n-form-item>

          <n-form-item :label="t('setting.account.birthday')" path="birthday">
            <n-input
              v-model:value="formData.birthday"
              :placeholder="t('setting.account.birthday_placeholder')"
              :maxlength="20"
              :disabled="extendedProfileDisabled"
              @blur="handleBirthdayChange" />
          </n-form-item>

          <n-form-item>
            <n-button type="primary" :loading="profileSaving" :disabled="!profileDirty" @click="saveProfile">
              {{ t('setting.account.save_profile') }}
            </n-button>
          </n-form-item>
        </n-form>
        <p v-if="extendedProfileUnsupported" class="extended-profile-hint">
          {{ t('setting.account.extended_profile_unsupported') }}
        </p>
      </div>
    </div>

    <n-divider />

    <div class="settings-section" data-settings-anchor="account-security">
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

    <div class="settings-section danger-zone" data-settings-anchor="account-danger">
      <h3 class="section-title">{{ t('setting.account.danger_zone') }}</h3>
      <n-button type="error" @click="confirmDeactivateAccount">{{ t('setting.account.deactivate_account') }}</n-button>
    </div>

    <AvatarCropper v-model:show="showCropper" :image-url="localImageUrl" @crop="handleCrop" ref="cropperRef" />
  </div>
</template>

<script setup lang="ts">
import { NAvatar, NButton, NCheckbox, NDivider, NForm, NFormItem, NInput, NSelect } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import AvatarCropper from '@/components/common/AvatarCropper.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import { useAccountDeactivation } from '@/composables/user/useAccountDeactivation'
import { useAccountAvatar } from './account/useAccountAvatar'
import { useAccountPassword } from './account/useAccountPassword'
import { useAccountProfileForm } from './account/useAccountProfileForm'

defineOptions({
  name: 'AccountSettings'
})

const { t } = useI18n()
const { confirmDeactivateAccount } = useAccountDeactivation()

const {
  userId,
  extendedProfileUnsupported,
  extendedProfileLoadFailed,
  extendedProfileDisabled,
  displayNameSaving,
  profileSaving,
  profileDirty,
  formData,
  genderOptions,
  loadExtendedProfile,
  saveProfile,
  handleDisplayNameChange,
  handleAboutChange,
  handleSexChange,
  handleRegionChange,
  handleBirthdayChange
} = useAccountProfileForm()

const {
  avatarUploading,
  showCropper,
  localImageUrl,
  defaultAvatar,
  displayAvatarUrl,
  handleAvatarChange,
  handleFileSelect,
  handleCrop
} = useAccountAvatar()

const { passwordLoading, logoutDevices, passwordForm, handlePasswordChange } = useAccountPassword()
</script>

<style scoped>
.account-settings {
  padding: 0 var(--tjg-space-2);
}

.settings-section {
  margin-bottom: var(--tjg-space-4);
}

.section-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin-bottom: var(--tjg-space-4);
  color: var(--tjg-text-primary);
}

.profile-section {
  display: flex;
  gap: 24px;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--tjg-space-3);
}

.danger-zone {
  padding: var(--tjg-space-4);
  border: 1px solid var(--tjg-color-danger-500);
  border-radius: var(--tjg-radius-sm);
  background-color: var(--tjg-color-danger-100);
}

.extended-profile-hint {
  margin-top: var(--tjg-space-2);
  color: var(--tjg-text-secondary);
  font-size: var(--tjg-font-size-sm);
}
</style>
