<template>
  <div class="account-settings">
    <div class="settings-section">
      <h3 class="section-title">个人资料</h3>

      <div class="profile-section">
        <div class="avatar-section">
          <n-avatar round :size="80" :src="displayAvatarUrl" :fallback-src="defaultAvatar" />
          <n-button size="small" :loading="avatarUploading" @click="handleAvatarChange">
            {{ avatarUploading ? '上传中...' : '更换头像' }}
          </n-button>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style="display: none"
            @change="handleFileSelect" />
        </div>

        <n-form ref="formRef" :model="formData" label-placement="left" label-width="80">
          <n-form-item label="昵称" path="displayName">
            <n-input
              v-model:value="formData.displayName"
              placeholder="请输入昵称"
              :maxlength="50"
              @blur="handleDisplayNameChange" />
          </n-form-item>

          <n-form-item label="用户ID">
            <n-input :value="userId" disabled />
          </n-form-item>
        </n-form>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">账户安全</h3>

      <n-form ref="passwordFormRef" :model="passwordForm" label-placement="left" label-width="100">
        <n-form-item label="当前密码" path="oldPassword">
          <n-input
            v-model:value="passwordForm.oldPassword"
            type="password"
            placeholder="请输入当前密码"
            show-password-on="click" />
        </n-form-item>

        <n-form-item label="新密码" path="newPassword">
          <n-input
            v-model:value="passwordForm.newPassword"
            type="password"
            placeholder="请输入新密码"
            show-password-on="click" />
        </n-form-item>

        <n-form-item label="确认密码" path="confirmPassword">
          <n-input
            v-model:value="passwordForm.confirmPassword"
            type="password"
            placeholder="请再次输入新密码"
            show-password-on="click" />
        </n-form-item>

        <n-form-item>
          <n-button type="primary" :loading="passwordLoading" @click="handlePasswordChange">修改密码</n-button>
        </n-form-item>
      </n-form>
    </div>

    <n-divider />

    <div class="settings-section danger-zone">
      <h3 class="section-title">危险操作</h3>
      <n-button type="error" @click="handleDeactivateAccount">注销账户</n-button>
    </div>

    <AvatarCropper v-model:show="showCropper" :image-url="localImageUrl" @crop="handleCrop" ref="cropperRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { NAvatar, NButton, NForm, NFormItem, NInput, NDivider, useMessage, useDialog } from 'naive-ui'
import { useUserStore } from '@/stores/user'
import { useMatrixStore } from '@/stores/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AccountSettings')
import { matrixAccountService } from '@/services/matrix'
import { matrixMediaService } from '@/services/matrix/MatrixMediaService'
import AvatarCropper from '@/components/common/AvatarCropper.vue'
import type { AvatarCropperInstance } from '@/components/common/AvatarCropper.vue'
import defaultAvatarImg from '@/assets/img/win.png'

defineOptions({
  name: 'AccountSettings'
})

const message = useMessage()
const dialog = useDialog()
const userStore = useUserStore()
const matrixStore = useMatrixStore()

const passwordLoading = ref(false)
const avatarUploading = ref(false)
const showCropper = ref(false)
const localImageUrl = ref('')
const fileInputRef = ref<HTMLInputElement>()
const cropperRef = ref<AvatarCropperInstance>()

const userAvatar = computed(() => userStore.currentUserAvatarUrl || '')
const defaultAvatar = computed(() => defaultAvatarImg)
const userId = computed(() => matrixStore.userId || '')

const displayAvatarUrl = computed(() => {
  if (userAvatar.value && userAvatar.value.startsWith('mxc://')) {
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

function handleAvatarChange() {
  fileInputRef.value?.click()
}

function handleFileSelect(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    message.error('只支持 JPG、PNG、WebP 格式的图片')
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    message.error('图片大小不能超过 5MB')
    return
  }

  const url = URL.createObjectURL(file)
  localImageUrl.value = url
  showCropper.value = true

  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

async function handleCrop(blob: Blob) {
  avatarUploading.value = true

  try {
    const fileName = `avatar_${Date.now()}.webp`
    const file = new File([blob], fileName, { type: 'image/webp' })

    const uploadResult = await matrixMediaService.uploadImage(file, (progress) => {
      logger.debug(`上传进度: ${progress}%`)
    })

    const mxcUrl = uploadResult.contentUri

    await matrixAccountService.updateAvatar(mxcUrl)

    await userStore.updateAvatar(mxcUrl)

    message.success('头像修改成功')
    showCropper.value = false

    if (localImageUrl.value) {
      URL.revokeObjectURL(localImageUrl.value)
      localImageUrl.value = ''
    }
  } catch (error) {
    logger.error('头像上传失败:', error)
    message.error('头像上传失败，请稍后重试')
    cropperRef.value?.finishLoading()
  } finally {
    avatarUploading.value = false
  }
}

async function handleDisplayNameChange() {
  if (formData.displayName === userStore.currentUserDisplayName) return

  try {
    await matrixAccountService.updateDisplayName(formData.displayName)
    message.success('昵称修改成功')
  } catch (error) {
    message.error('昵称修改失败')
    formData.displayName = userStore.currentUserDisplayName || ''
  }
}

async function handlePasswordChange() {
  if (!passwordForm.oldPassword || !passwordForm.newPassword) {
    message.warning('请填写完整密码信息')
    return
  }

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    message.warning('两次输入的密码不一致')
    return
  }

  passwordLoading.value = true
  try {
    await matrixAccountService.changePassword(passwordForm.oldPassword, passwordForm.newPassword)
    message.success('密码修改成功')
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  } catch (error) {
    message.error('密码修改失败，请检查当前密码是否正确')
  } finally {
    passwordLoading.value = false
  }
}

function handleDeactivateAccount() {
  dialog.warning({
    title: '注销账户',
    content: '确定要注销账户吗？此操作不可撤销，所有数据将被永久删除。',
    positiveText: '确定注销',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await matrixAccountService.deactivateAccount()
        message.success('账户已注销')
      } catch (error) {
        message.error('账户注销失败')
      }
    }
  })
}
</script>

<style scoped>
.account-settings {
  padding: 0 8px;
}

.settings-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
}

.profile-section {
  display: flex;
  gap: 24px;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.danger-zone {
  padding: 16px;
  border: 1px solid #ff4d4f;
  border-radius: 8px;
  background-color: rgba(255, 77, 79, 0.05);
}
</style>
