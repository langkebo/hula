<template>
  <div class="account-settings">
    <div class="settings-section">
      <h3 class="section-title">个人资料</h3>
      
      <div class="profile-section">
        <div class="avatar-section">
          <n-avatar
            round
            :size="80"
            :src="userAvatar"
            :fallback-src="defaultAvatar"
          />
          <n-button size="small" @click="handleAvatarChange">
            更换头像
          </n-button>
        </div>

        <n-form ref="formRef" :model="formData" label-placement="left" label-width="80">
          <n-form-item label="昵称" path="displayName">
            <n-input
              v-model:value="formData.displayName"
              placeholder="请输入昵称"
              :maxlength="50"
              @blur="handleDisplayNameChange"
            />
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
            show-password-on="click"
          />
        </n-form-item>

        <n-form-item label="新密码" path="newPassword">
          <n-input
            v-model:value="passwordForm.newPassword"
            type="password"
            placeholder="请输入新密码"
            show-password-on="click"
          />
        </n-form-item>

        <n-form-item label="确认密码" path="confirmPassword">
          <n-input
            v-model:value="passwordForm.confirmPassword"
            type="password"
            placeholder="请再次输入新密码"
            show-password-on="click"
          />
        </n-form-item>

        <n-form-item>
          <n-button type="primary" :loading="passwordLoading" @click="handlePasswordChange">
            修改密码
          </n-button>
        </n-form-item>
      </n-form>
    </div>

    <n-divider />

    <div class="settings-section danger-zone">
      <h3 class="section-title">危险操作</h3>
      <n-button type="error" @click="handleDeactivateAccount">
        注销账户
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { NAvatar, NButton, NForm, NFormItem, NInput, NDivider, useMessage, useDialog } from 'naive-ui'
import { useUserStore } from '@/stores/user'
import { useMatrixStore } from '@/stores/matrix'
import { matrixAccountService } from '@/services/matrix'
import defaultAvatarImg from '@/assets/img/win.png'

defineOptions({
  name: 'AccountSettings'
})

const message = useMessage()
const dialog = useDialog()
const userStore = useUserStore()
const matrixStore = useMatrixStore()

const passwordLoading = ref(false)

const userAvatar = computed(() => userStore.currentUserAvatarUrl || '')
const defaultAvatar = computed(() => defaultAvatarImg)
const userId = computed(() => matrixStore.userId || '')

const formData = reactive({
  displayName: userStore.currentUserDisplayName || ''
})

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

function handleAvatarChange() {
  message.info('头像修改功能开发中')
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
    await matrixAccountService.changePassword(
      passwordForm.oldPassword,
      passwordForm.newPassword
    )
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
