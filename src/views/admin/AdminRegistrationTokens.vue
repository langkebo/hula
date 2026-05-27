<template>
  <div class="registration-token-management">
    <n-flex vertical :size="16">
      <n-flex align="center" justify="space-between">
        <span class="text-16px font-semibold">{{ t('admin.registration_tokens.title') }}</span>
        <n-button type="primary" size="small" @click="openCreateDialog">
          {{ t('admin.registration_tokens.create') }}
        </n-button>
      </n-flex>

      <n-data-table
        :columns="columns"
        :data="tokens"
        :loading="loading"
        :pagination="pagination"
        :bordered="false"
        size="small" />
    </n-flex>

    <!-- Create / Edit Token Dialog -->
    <n-modal
      v-model:show="showDialog"
      :title="isEditing ? t('admin.registration_tokens.edit_title') : t('admin.registration_tokens.create_title')"
      preset="dialog">
      <n-form :model="dialogForm" label-placement="left" label-width="100">
        <n-form-item :label="t('admin.registration_tokens.token')">
          <n-input
            v-model:value="dialogForm.token"
            :placeholder="t('admin.registration_tokens.token_auto')"
            :disabled="isEditing" />
        </n-form-item>
        <n-form-item :label="t('admin.registration_tokens.uses_allowed')">
          <n-input-number
            v-model:value="dialogForm.usesAllowed"
            :min="0"
            :placeholder="t('admin.registration_tokens.unlimited')"
            style="width: 100%" />
        </n-form-item>
        <n-form-item :label="t('admin.registration_tokens.expiry_time')">
          <n-date-picker v-model:value="dialogForm.expiryTime" type="datetime" clearable style="width: 100%" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-flex justify="end" :size="12">
          <n-button @click="showDialog = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :loading="submitting" @click="handleSubmit">
            {{ t('common.confirm') }}
          </n-button>
        </n-flex>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { NButton, NPopconfirm, NSpace, NTag } from 'naive-ui'
import { h, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { type RegistrationToken, useAdminRegistrationTokens } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const registrationTokens = useAdminRegistrationTokens()
const loading = registrationTokens.loading
const tokens = registrationTokens.tokens
const creating = registrationTokens.creating

const showDialog = ref(false)
const isEditing = ref(false)
const submitting = ref(false)
const editingToken = ref<string | null>(null)

const dialogForm = reactive<{
  token: string
  usesAllowed: number | null
  expiryTime: number | null
}>({
  token: '',
  usesAllowed: null,
  expiryTime: null
})

const pagination = { pageSize: 20 }

function openCreateDialog() {
  isEditing.value = false
  editingToken.value = null
  dialogForm.token = ''
  dialogForm.usesAllowed = null
  dialogForm.expiryTime = null
  showDialog.value = true
}

function openEditDialog(row: RegistrationToken) {
  isEditing.value = true
  editingToken.value = row.token
  dialogForm.token = row.token
  dialogForm.usesAllowed = row.usesAllowed ?? null
  dialogForm.expiryTime = row.expiryTime ?? null
  showDialog.value = true
}

const columns = [
  {
    title: t('admin.registration_tokens.token'),
    key: 'token',
    ellipsis: true,
    width: 200
  },
  {
    title: t('admin.registration_tokens.uses_allowed'),
    key: 'usesAllowed',
    width: 120,
    render: (row: RegistrationToken) => row.usesAllowed ?? t('admin.registration_tokens.unlimited')
  },
  {
    title: t('admin.registration_tokens.pending'),
    key: 'pending',
    width: 80
  },
  {
    title: t('admin.registration_tokens.completed'),
    key: 'completed',
    width: 100
  },
  {
    title: t('admin.registration_tokens.expiry_time'),
    key: 'expiryTime',
    width: 180,
    render: (row: RegistrationToken) =>
      row.expiryTime ? new Date(row.expiryTime).toLocaleString() : t('admin.registration_tokens.unlimited')
  },
  {
    title: t('admin.registration_tokens.status'),
    key: 'status',
    width: 100,
    render: (row: RegistrationToken) => {
      const isExpired = row.expiryTime && row.expiryTime < Date.now()
      const isUsedUp = row.usesAllowed !== undefined && row.usesAllowed !== null && row.completed >= row.usesAllowed
      if (isExpired || isUsedUp) {
        return h(NTag, { type: 'error', size: 'small' }, () => t('admin.registration_tokens.expired'))
      }
      return h(NTag, { type: 'success', size: 'small' }, () => t('admin.registration_tokens.active'))
    }
  },
  {
    title: t('admin.registration_tokens.actions'),
    key: 'actions',
    width: 160,
    render: (row: RegistrationToken) =>
      h(NSpace, { size: 8 }, () => [
        h(NButton, { size: 'tiny', onClick: () => openEditDialog(row) }, () => t('common.edit')),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDeleteToken(row.token) },
          {
            trigger: () => h(NButton, { size: 'tiny', type: 'error' }, () => t('common.delete')),
            default: () => t('admin.registration_tokens.delete_confirm')
          }
        )
      ])
  }
]

async function loadTokens() {
  try {
    await registrationTokens.loadTokens()
  } catch {
    showFeedback(t('admin.registration_tokens.load_failed'), 'error')
  }
}

async function handleSubmit() {
  submitting.value = true
  try {
    if (isEditing.value && editingToken.value) {
      const updates: { usesAllowed?: number; expiryTime?: number } = {}
      if (dialogForm.usesAllowed !== null) updates.usesAllowed = dialogForm.usesAllowed
      if (dialogForm.expiryTime !== null) updates.expiryTime = dialogForm.expiryTime
      await registrationTokens.updateToken(editingToken.value, updates)
      showFeedback(t('admin.registration_tokens.update_success'), 'success')
    } else {
      const options: { token?: string; usesAllowed?: number; expiryTime?: number } = {}
      if (dialogForm.token.trim()) options.token = dialogForm.token.trim()
      if (dialogForm.usesAllowed !== null) options.usesAllowed = dialogForm.usesAllowed
      if (dialogForm.expiryTime !== null) options.expiryTime = dialogForm.expiryTime
      await registrationTokens.createToken(options)
      showFeedback(t('admin.registration_tokens.create_success'), 'success')
    }
    showDialog.value = false
    dialogForm.token = ''
    dialogForm.usesAllowed = null
    dialogForm.expiryTime = null
  } catch {
    showFeedback(
      isEditing.value ? t('admin.registration_tokens.update_failed') : t('admin.registration_tokens.create_failed'),
      'error'
    )
  } finally {
    submitting.value = false
  }
}

async function handleDeleteToken(token: string) {
  try {
    await registrationTokens.deleteToken(token)
    showFeedback(t('admin.registration_tokens.delete_success'), 'success')
  } catch {
    showFeedback(t('admin.registration_tokens.delete_failed'), 'error')
  }
}

onMounted(() => {
  loadTokens()
})
</script>
