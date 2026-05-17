<template>
  <div class="admin-notices">
    <n-page-header :title="t('admin.notices.title')" :subtitle="t('admin.notices.subtitle')">
      <template #extra>
        <n-space>
          <n-button @click="loadNotices" :loading="loading">
            {{ t('common.refresh') }}
          </n-button>
          <n-button type="primary" @click="showSendDialog = true">
            {{ t('admin.notices.send') }}
          </n-button>
        </n-space>
      </template>
    </n-page-header>

    <n-data-table
      :columns="columns"
      :data="notices"
      :loading="loading"
      :pagination="pagination"
      :row-key="(row: ServerNoticeInfo) => row.userId + (row.sentTs ?? 0)"
      striped
      class="mt-16px" />

    <n-modal v-model:show="showSendDialog" preset="dialog" :title="t('admin.notices.send_title')">
      <n-form :model="sendForm" label-placement="left" label-width="100px">
        <n-form-item :label="t('admin.notices.target_user')">
          <n-input v-model:value="sendForm.userId" :placeholder="t('admin.notices.user_placeholder')" />
        </n-form-item>
        <n-form-item :label="t('admin.notices.content')">
          <n-input
            v-model:value="sendForm.body"
            type="textarea"
            :rows="4"
            :placeholder="t('admin.notices.content_placeholder')" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showSendDialog = false">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="sendLoading" @click="handleSend">{{ t('common.confirm') }}</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import {
  type DataTableColumns,
  NButton,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPageHeader,
  NSpace
} from 'naive-ui'
import { h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { type ServerNoticeInfo, useAdminNotices } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminNotices')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const adminNotices = useAdminNotices()
const notices = adminNotices.notices
const loading = adminNotices.loading
const sendLoading = adminNotices.sending

const showSendDialog = ref(false)
const sendForm = ref({ userId: '', body: '' })

const pagination = { pageSize: 20 }

const columns: DataTableColumns<ServerNoticeInfo> = [
  { title: t('admin.notices.col_user'), key: 'userId', width: 240, ellipsis: { tooltip: true } },
  {
    title: t('admin.notices.col_time'),
    key: 'sentTs',
    width: 180,
    render: (row) => h('span', {}, row.sentTs ? new Date(row.sentTs).toLocaleString() : '-')
  },
  {
    title: t('admin.notices.col_content'),
    key: 'content',
    ellipsis: { tooltip: true },
    render: (row) => h('span', {}, JSON.stringify(row.content ?? {}))
  }
]

async function loadNotices() {
  try {
    await adminNotices.loadNotices()
  } catch (err) {
    logger.error('Failed to load notices:', err)
  }
}

async function handleSend() {
  if (!sendForm.value.userId || !sendForm.value.body) {
    showFeedback(t('admin.notices.fill_required'), 'warning')
    return
  }
  try {
    await adminNotices.sendNotice(sendForm.value.userId, sendForm.value.body)
    showFeedback(t('admin.notices.send_success'), 'success')
    showSendDialog.value = false
    sendForm.value = { userId: '', body: '' }
  } catch (err) {
    logger.error('Failed to send notice:', err)
    showFeedback(t('admin.notices.send_failed'), 'error')
  }
}

onMounted(() => loadNotices())
</script>

<style scoped>
.admin-notices {
  padding: 16px 24px;
}
</style>
