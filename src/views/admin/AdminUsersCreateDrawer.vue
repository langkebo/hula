<template>
  <n-drawer :show="show" placement="right" :width="380" @update:show="emit('update:show', $event)">
    <n-drawer-content :title="t('admin.users.createUser')" closable>
      <n-form :model="form" :rules="rules">
        <n-form-item :label="t('admin.users.username')" path="username">
          <n-input v-model:value="form.username" />
        </n-form-item>
        <n-form-item :label="t('admin.users.password')" path="password">
          <n-input v-model:value="form.password" type="password" show-password-on="click" />
        </n-form-item>
        <n-form-item :label="t('admin.users.displayName')" path="displayName">
          <n-input v-model:value="form.displayName" />
        </n-form-item>
        <n-form-item :label="t('admin.users.isAdmin')" path="isAdmin">
          <n-switch v-model:value="form.isAdmin" />
        </n-form-item>
        <n-form-item :label="t('admin.users.useAdminRegister')">
          <n-switch v-model:value="form.useAdminRegister" data-testid="admin-users-register-nonce-switch" />
        </n-form-item>
        <n-form-item v-if="form.useAdminRegister" :label="t('admin.users.registrationNonce')">
          <n-space vertical class="w-full">
            <n-input
              v-model:value="form.nonce"
              data-testid="admin-users-register-nonce"
              :placeholder="t('admin.users.registrationNoncePlaceholder')" />
            <n-button
              size="small"
              data-testid="admin-users-fetch-nonce"
              :loading="registrationNonceLoading"
              @click="handleFetchNonce">
              {{ t('admin.users.fetchNonce') }}
            </n-button>
          </n-space>
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="flex justify-end gap-12px">
          <n-button @click="emit('update:show', false)">{{ t('admin.common.cancel') }}</n-button>
          <n-button type="primary" :loading="creating" @click="handleCreateUser">
            {{ t('admin.common.confirm') }}
          </n-button>
        </div>
      </template>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { NButton, NDrawer, NDrawerContent, NSpace } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UseAdminUsersResult } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAdminErrorHandler } from './useAdminError'

const props = defineProps<{
  /** 父级持有的用户管理 composable 实例；本组件不自行创建，避免状态分叉。 */
  admin: UseAdminUsersResult
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { handleAdminError } = useAdminErrorHandler()
const { registrationNonceLoading } = props.admin

const creating = ref(false)

const form = ref({
  username: '',
  password: '',
  displayName: '',
  isAdmin: false,
  useAdminRegister: false,
  nonce: ''
})

const rules = {
  username: { required: true, message: t('admin.users.usernameRequired') },
  password: { required: true, message: t('admin.users.passwordRequired') }
}

function resetForm() {
  form.value = {
    username: '',
    password: '',
    displayName: '',
    isAdmin: false,
    useAdminRegister: false,
    nonce: ''
  }
}

async function handleFetchNonce() {
  try {
    form.value.nonce = await props.admin.loadRegistrationNonce()
  } catch (err) {
    if (handleAdminError(err)) showFeedback(t('admin.users.fetchNonceFailed'), 'error')
  }
}

async function handleCreateUser() {
  creating.value = true
  try {
    if (form.value.useAdminRegister) {
      const nonce = form.value.nonce.trim()
      if (!nonce) {
        showFeedback(t('admin.users.registrationNonceRequired'), 'error')
        return
      }
      const registered = await props.admin.registerWithNonce(
        form.value.username,
        form.value.password,
        nonce,
        form.value.isAdmin
      )
      if (registered) {
        showFeedback(t('admin.users.createSuccess'), 'success')
        emit('update:show', false)
        resetForm()
      } else {
        showFeedback(t('admin.users.createFailed'), 'error')
      }
      return
    }
    const result = await props.admin.createUser(form.value.username, form.value.password, {
      admin: form.value.isAdmin,
      displayname: form.value.displayName
    })
    if (result) {
      showFeedback(t('admin.users.createSuccess'), 'success')
      emit('update:show', false)
      resetForm()
    } else {
      showFeedback(t('admin.users.createFailed'), 'error')
    }
  } catch (err) {
    if (handleAdminError(err)) showFeedback(t('admin.users.createFailed'), 'error')
  } finally {
    creating.value = false
  }
}
</script>
