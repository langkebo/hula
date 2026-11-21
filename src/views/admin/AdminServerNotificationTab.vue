<template>
  <n-space vertical size="large">
    <n-alert :bordered="false" type="info">{{ t('admin.notifications.server.hint') }}</n-alert>

    <n-alert v-if="error" data-testid="server-notification-error" type="error" closable @close="error = null">
      {{ error }}
    </n-alert>

    <n-space>
      <n-button data-testid="server-notification-create" type="primary" @click="openCreate">
        {{ t('admin.notifications.server.create') }}
      </n-button>
      <n-button data-testid="server-notification-refresh" :loading="loading" @click="loadNotifications">
        <template #icon>
          <Icon icon="ion:refresh-outline" />
        </template>
        {{ t('common.refresh') }}
      </n-button>
    </n-space>

    <AdminTable
      :columns="columns"
      :data="notifications"
      :loading="loading"
      :row-key="(row: SystemNotificationInfo) => row.id"
      :scroll-x="720">
      <template #empty>
        <EmptyState data-testid="server-notification-empty" :description="t('admin.notifications.server.empty')" />
      </template>
    </AdminTable>
  </n-space>

  <n-drawer v-model:show="drawerVisible" :width="420" placement="right">
    <n-drawer-content :title="drawerTitle" closable>
      <n-form label-placement="top">
        <n-form-item :label="t('admin.notifications.server.content')">
          <n-input
            v-model:value="draft.content"
            data-testid="server-notification-content"
            :placeholder="t('admin.notifications.server.contentPlaceholder')"
            :rows="4"
            type="textarea" />
        </n-form-item>
        <n-form-item :label="t('admin.notifications.server.type')">
          <n-select v-model:value="draft.type" data-testid="server-notification-type" :options="typeOptions" />
        </n-form-item>
        <n-form-item :label="t('admin.notifications.server.targets')">
          <n-input
            v-model:value="targetsInput"
            data-testid="server-notification-targets"
            :placeholder="t('admin.notifications.server.targetsPlaceholder')" />
        </n-form-item>
      </n-form>

      <template #footer>
        <div class="flex justify-end gap-12px">
          <n-button data-testid="server-notification-cancel" @click="drawerVisible = false">
            {{ t('common.cancel') }}
          </n-button>
          <n-button data-testid="server-notification-submit" type="primary" :loading="saving" @click="handleSubmit">
            {{ t('common.confirm') }}
          </n-button>
        </div>
      </template>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  type DataTableColumns,
  NAlert,
  NButton,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NPopconfirm,
  NSelect,
  NSpace,
  NTag
} from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminTable from '@/components/admin/AdminTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useAdminServerNotifications } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { SystemNotificationInfo } from '@/services/matrix/admin'

defineOptions({
  name: 'AdminServerNotificationTab'
})

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const {
  notifications,
  loading,
  error,
  saving,
  loadNotifications,
  loadDetail,
  createNotification,
  updateNotification,
  removeNotification
} = useAdminServerNotifications()

const drawerVisible = ref(false)
const editingId = ref<string | null>(null)
const targetsInput = ref('')
const draft = ref({ content: '', type: 'info' })

const typeOptions = computed(() => [
  { label: t('admin.notifications.server.typeOptions.info'), value: 'info' },
  { label: t('admin.notifications.server.typeOptions.warning'), value: 'warning' },
  { label: t('admin.notifications.server.typeOptions.error'), value: 'error' }
])

const drawerTitle = computed(() =>
  editingId.value ? t('admin.notifications.server.editTitle') : t('admin.notifications.server.createTitle')
)

const columns: DataTableColumns<SystemNotificationInfo> = [
  { title: 'ID', key: 'id', width: 140, ellipsis: { tooltip: true } },
  { title: t('admin.notifications.server.table.content'), key: 'content', ellipsis: { tooltip: true } },
  {
    title: t('admin.notifications.server.table.type'),
    key: 'type',
    width: 110,
    render: (row) =>
      h(
        NTag,
        { size: 'small', type: row.type === 'error' ? 'error' : row.type === 'warning' ? 'warning' : 'info' },
        { default: () => row.type }
      )
  },
  {
    title: t('admin.notifications.server.table.targets'),
    key: 'targetUsers',
    width: 100,
    render: (row) => String(row.targetUsers.length)
  },
  {
    title: t('admin.notifications.server.table.createdAt'),
    key: 'createdAt',
    width: 180,
    render: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleString() : '-')
  },
  {
    title: t('admin.notifications.server.table.actions'),
    key: 'actions',
    width: 150,
    render: (row) =>
      h(
        NSpace,
        { size: 'small' },
        {
          default: () => [
            h(
              NButton,
              {
                size: 'small',
                'data-testid': `server-notification-edit-${row.id}`,
                onClick: () => openEdit(row.id)
              },
              { default: () => t('admin.notifications.server.edit') }
            ),
            h(
              NPopconfirm,
              { onPositiveClick: () => handleRemove(row.id) },
              {
                trigger: () =>
                  h(
                    NButton,
                    {
                      size: 'small',
                      type: 'error',
                      'data-testid': `server-notification-delete-${row.id}`
                    },
                    { default: () => t('admin.notifications.server.delete') }
                  ),
                default: () => t('admin.notifications.server.deleteConfirm')
              }
            )
          ]
        }
      )
  }
]

function openCreate() {
  editingId.value = null
  draft.value = { content: '', type: 'info' }
  targetsInput.value = ''
  drawerVisible.value = true
}

async function openEdit(notificationId: string) {
  const detail = await loadDetail(notificationId)
  if (!detail) {
    showFeedback(t('admin.notifications.server.loadFailed'), 'error')
    return
  }
  editingId.value = detail.id
  draft.value = { content: detail.content, type: detail.type }
  targetsInput.value = detail.targetUsers.join(', ')
  drawerVisible.value = true
}

async function handleSubmit() {
  if (!draft.value.content.trim()) {
    showFeedback(t('admin.notifications.server.contentRequired'), 'error')
    return
  }
  const payload = {
    content: draft.value.content,
    type: draft.value.type,
    targetUsers: targetsInput.value.split(',')
  }
  const ok = editingId.value ? await updateNotification(editingId.value, payload) : await createNotification(payload)
  if (!ok) {
    showFeedback(t('admin.notifications.server.saveFailed'), 'error')
    return
  }
  drawerVisible.value = false
  showFeedback(
    editingId.value ? t('admin.notifications.server.updated') : t('admin.notifications.server.created'),
    'success'
  )
}

async function handleRemove(notificationId: string) {
  const ok = await removeNotification(notificationId)
  showFeedback(
    ok ? t('admin.notifications.server.deleted') : t('admin.notifications.server.deleteFailed'),
    ok ? 'success' : 'error'
  )
}

onMounted(() => {
  loadNotifications()
})
</script>
