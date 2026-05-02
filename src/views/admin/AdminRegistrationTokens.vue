<template>
  <div class="registration-token-management">
    <n-flex vertical :size="16">
      <n-flex align="center" justify="space-between">
        <span class="text-16px font-semibold">{{ t('admin.registration_tokens.title') }}</span>
        <n-button type="primary" size="small" @click="showCreateDialog = true">
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

    <n-modal v-model:show="showCreateDialog" :title="t('admin.registration_tokens.create_title')" preset="dialog">
      <n-form :model="createForm" label-placement="left" label-width="100">
        <n-form-item :label="t('admin.registration_tokens.token')">
          <n-input v-model:value="createForm.token" :placeholder="t('admin.registration_tokens.token_auto')" />
        </n-form-item>
        <n-form-item :label="t('admin.registration_tokens.uses_allowed')">
          <n-input-number
            v-model:value="createForm.usesAllowed"
            :min="0"
            :placeholder="t('admin.registration_tokens.unlimited')"
            style="width: 100%" />
        </n-form-item>
        <n-form-item :label="t('admin.registration_tokens.expiry_time')">
          <n-date-picker v-model:value="createForm.expiryTime" type="datetime" clearable style="width: 100%" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-flex justify="end" :size="12">
          <n-button @click="showCreateDialog = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :loading="creating" @click="handleCreateToken">
            {{ t('common.confirm') }}
          </n-button>
        </n-flex>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { NButton, NSpace, NTag, useMessage } from 'naive-ui'
import { h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminRegistrationTokens } from '@/composables/admin'
import type { RegistrationToken } from '@/services/matrix/admin'

const { t } = useI18n()
const message = useMessage()

const registrationTokens = useAdminRegistrationTokens()
const loading = registrationTokens.loading
const tokens = registrationTokens.tokens
const creating = registrationTokens.creating

const showCreateDialog = ref(false)

const createForm = ref<{
  token: string
  usesAllowed: number | null
  expiryTime: number | null
}>({
  token: '',
  usesAllowed: null,
  expiryTime: null
})

const pagination = { pageSize: 20 }

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
        h(NButton, { size: 'tiny', onClick: () => handleEditToken(row) }, () => t('common.edit')),
        h(NButton, { size: 'tiny', type: 'error', onClick: () => handleDeleteToken(row.token) }, () =>
          t('common.delete')
        )
      ])
  }
]

async function loadTokens() {
  try {
    await registrationTokens.loadTokens()
  } catch {
    message.error(t('admin.registration_tokens.load_failed'))
  }
}

async function handleCreateToken() {
  try {
    const options: { token?: string; usesAllowed?: number; expiryTime?: number } = {}
    if (createForm.value.token.trim()) options.token = createForm.value.token.trim()
    if (createForm.value.usesAllowed !== null) options.usesAllowed = createForm.value.usesAllowed
    if (createForm.value.expiryTime !== null) options.expiryTime = createForm.value.expiryTime
    await registrationTokens.createToken(options)
    message.success(t('admin.registration_tokens.create_success'))
    showCreateDialog.value = false
    createForm.value = { token: '', usesAllowed: null, expiryTime: null }
  } catch {
    message.error(t('admin.registration_tokens.create_failed'))
  }
}

function handleEditToken(_row: RegistrationToken) {
  message.info(t('admin.registration_tokens.edit_hint'))
}

async function handleDeleteToken(token: string) {
  try {
    await registrationTokens.deleteToken(token)
    message.success(t('admin.registration_tokens.delete_success'))
  } catch {
    message.error(t('admin.registration_tokens.delete_failed'))
  }
}

onMounted(() => {
  loadTokens()
})
</script>
