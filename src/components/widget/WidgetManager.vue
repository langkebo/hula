<template>
  <div class="widget-manager">
    <div class="manager-header">
      <h3>{{ t('widget.title') }}</h3>
      <n-button type="primary" size="small" @click="showAddDialog = true">
        <template #icon>
          <n-icon><Icon icon="mdi:plus" /></n-icon>
        </template>
        {{ t('widget.add') }}
      </n-button>
    </div>

    <!-- Widget 列表 -->
    <n-spin :show="loading">
      <div v-if="widgets.length === 0" class="empty-state">
        <n-empty :description="t('widget.no_widgets')" />
      </div>
      <div v-else class="widget-list">
        <div v-for="widget in widgets" :key="widget.id" class="widget-item">
          <div class="widget-info">
            <n-icon size="24" class="widget-icon">
              <Icon :icon="getWidgetIcon(widget.type)" />
            </n-icon>
            <div class="widget-details">
              <div class="widget-name">{{ widget.name || widget.id }}</div>
              <div class="widget-type">{{ widget.type }}</div>
              <div class="widget-url">{{ widget.url }}</div>
            </div>
          </div>
          <div class="widget-actions">
            <n-button text @click="handleOpenWidget(widget)">
              <template #icon>
                <n-icon><Icon icon="mdi:open-in-new" /></n-icon>
              </template>
            </n-button>
            <n-button text @click="handleEditPermissions(widget)">
              <template #icon>
                <n-icon><Icon icon="mdi:shield-account" /></n-icon>
              </template>
            </n-button>
            <n-button text type="error" @click="handleRemoveWidget(widget)">
              <template #icon>
                <n-icon><Icon icon="mdi:delete" /></n-icon>
              </template>
            </n-button>
          </div>
        </div>
      </div>
    </n-spin>

    <!-- 添加 Widget 对话框 -->
    <n-modal v-model:show="showAddDialog" preset="card" :title="t('widget.add')" style="width: 600px">
      <n-form ref="formRef" :model="formData" :rules="rules">
        <n-form-item :label="t('widget.name')" path="name">
          <n-input v-model:value="formData.name" :placeholder="t('widget.name_placeholder')" />
        </n-form-item>
        <n-form-item :label="t('widget.type')" path="type">
          <n-select v-model:value="formData.type" :options="widgetTypeOptions" />
        </n-form-item>
        <n-form-item :label="t('widget.url')" path="url">
          <n-input v-model:value="formData.url" :placeholder="t('widget.url_placeholder')" />
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="dialog-footer">
          <n-button @click="showAddDialog = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :loading="adding" @click="handleAddWidget">
            {{ t('common.confirm') }}
          </n-button>
        </div>
      </template>
    </n-modal>

    <!-- Widget 权限对话框 -->
    <n-modal v-model:show="showPermissionsDialog" preset="card" :title="t('widget.permissions')" style="width: 560px">
      <div v-if="selectedWidget" class="permissions-content">
        <div class="widget-info-header">
          <strong>{{ selectedWidget.name || selectedWidget.id }}</strong>
        </div>
        <n-divider />

        <n-spin :show="permissionsLoading">
          <div class="permissions-list">
            <div v-if="permissionRows.length === 0" class="empty-row">
              <n-empty size="small" :description="t('widget.no_permissions')" />
            </div>
            <div v-for="row in permissionRows" :key="row.userId" class="permission-row">
              <div class="permission-user">
                <n-icon size="18"><Icon icon="mdi:account" /></n-icon>
                <span class="user-id">{{ row.userId }}</span>
              </div>
              <div class="permission-tags">
                <n-tag v-for="p in row.permissions" :key="p" size="small" type="info">{{ p }}</n-tag>
              </div>
              <n-button
                text
                type="error"
                size="small"
                :disabled="savingPermissions"
                @click="handleRemovePermission(row)">
                <template #icon>
                  <n-icon><Icon icon="mdi:close" /></n-icon>
                </template>
              </n-button>
            </div>
          </div>
        </n-spin>

        <n-divider />

        <div class="add-permission-form">
          <n-input
            v-model:value="newPermission.userId"
            :placeholder="t('widget.permission_user_placeholder')"
            size="small"
            style="flex: 1" />
          <n-select
            v-model:value="newPermission.permissions"
            :options="permissionPresetOptions"
            multiple
            size="small"
            style="width: 200px" />
          <n-button type="primary" size="small" :loading="savingPermissions" @click="handleAddPermission">
            {{ t('common.add') }}
          </n-button>
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <n-button @click="showPermissionsDialog = false">{{ t('common.close') }}</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { type FormInst, useDialog } from 'naive-ui'
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { type PermissionRow, useWidgetPermissions, useWidgets, type Widget } from '@/composables/widget'
import { openExternalUrl } from '@/hooks/useLinkSegments'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('WidgetManager')
const { t } = useI18n()
const dialog = useDialog()
const { showFeedback } = useActionFeedback()

const props = defineProps<{
  roomId: string
}>()

const {
  widgets,
  loading,
  mutating: adding,
  load: loadWidgets,
  create: createWidget,
  remove: removeWidget
} = useWidgets(() => props.roomId)
const {
  rows: permissionRows,
  loading: permissionsLoading,
  mutating: savingPermissions,
  load: loadPermissions,
  grant: grantPermission,
  revoke: revokePermission
} = useWidgetPermissions()

const showAddDialog = ref(false)
const showPermissionsDialog = ref(false)
const selectedWidget = ref<Widget | null>(null)
const formRef = ref<FormInst | null>(null)

const formData = reactive({
  name: '',
  type: 'custom',
  url: ''
})

const newPermission = reactive<{ userId: string; permissions: string[] }>({
  userId: '',
  permissions: ['read']
})

const permissionPresetOptions = [
  { label: t('widget.permission_read'), value: 'read' },
  { label: t('widget.permission_write'), value: 'write' },
  { label: t('widget.permission_admin'), value: 'admin' }
]

const widgetTypeOptions = [
  { label: t('widget.type_custom'), value: 'custom' },
  { label: t('widget.type_jitsi'), value: 'jitsi' },
  { label: t('widget.type_etherpad'), value: 'etherpad' },
  { label: t('widget.type_poll'), value: 'poll' }
]

const rules = {
  name: {
    required: true,
    message: t('widget.name_required')
  },
  type: {
    required: true,
    message: t('widget.type_required')
  },
  url: {
    required: true,
    message: t('widget.url_required'),
    trigger: ['blur', 'input']
  }
}

const getWidgetIcon = (type: string) => {
  const icons: Record<string, string> = {
    jitsi: 'mdi:video',
    etherpad: 'mdi:file-document-edit',
    poll: 'mdi:poll',
    custom: 'mdi:puzzle'
  }
  return icons[type] || 'mdi:puzzle'
}

const handleAddWidget = async () => {
  try {
    await formRef.value?.validate()
    const result = await createWidget({
      widgetType: formData.type,
      url: formData.url,
      name: formData.name
    })
    if (!result) {
      showFeedback(t('widget.add_failed'), 'error')
      return
    }
    showFeedback(t('widget.add_success'), 'success')
    showAddDialog.value = false
    formData.name = ''
    formData.type = 'custom'
    formData.url = ''
  } catch (error) {
    logger.error('[WidgetManager] 添加 Widget 失败:', error)
    showFeedback(t('widget.add_failed'), 'error')
  }
}

const handleRemoveWidget = (widget: Widget) => {
  dialog.warning({
    title: t('widget.remove_confirm_title'),
    content: t('widget.remove_confirm_content', { name: widget.name || widget.id }),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      const ok = await removeWidget(widget.id)
      if (ok) {
        showFeedback(t('widget.remove_success'), 'success')
      } else {
        showFeedback(t('widget.remove_failed'), 'error')
      }
    }
  })
}

const handleOpenWidget = (widget: Widget) => {
  void openExternalUrl(widget.url)
}

const handleEditPermissions = async (widget: Widget) => {
  selectedWidget.value = widget
  showPermissionsDialog.value = true
  newPermission.userId = ''
  newPermission.permissions = ['read']
  await loadPermissions(widget.id)
}

const handleAddPermission = async () => {
  if (!selectedWidget.value) return
  const userId = newPermission.userId.trim()
  if (!userId) {
    showFeedback(t('widget.permission_user_required'), 'warning')
    return
  }
  if (newPermission.permissions.length === 0) {
    showFeedback(t('widget.permission_scope_required'), 'warning')
    return
  }
  const ok = await grantPermission(selectedWidget.value.id, userId, newPermission.permissions)
  if (ok) {
    showFeedback(t('widget.permission_added'), 'success')
    newPermission.userId = ''
    newPermission.permissions = ['read']
  } else {
    showFeedback(t('widget.permission_add_failed'), 'error')
  }
}

const handleRemovePermission = (row: PermissionRow) => {
  if (!selectedWidget.value) return
  const widgetId = selectedWidget.value.id
  dialog.warning({
    title: t('widget.permission_remove_confirm_title'),
    content: t('widget.permission_remove_confirm_content', { user: row.userId }),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      const ok = await revokePermission(widgetId, row.userId)
      if (ok) {
        showFeedback(t('widget.permission_removed'), 'success')
      } else {
        showFeedback(t('widget.permission_remove_failed'), 'error')
      }
    }
  })
}

onMounted(() => {
  loadWidgets()
})
</script>

<style scoped lang="scss">
.widget-manager {
  padding: 16px;
}

.manager-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
}

.empty-state {
  padding: 60px 0;
  text-align: center;
}

.widget-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.widget-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
  transition: all 0.2s;

  &:hover {
    background: var(--hula-surface-list-hover);
  }

  .widget-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;

    .widget-icon {
      color: var(--primary-color);
    }

    .widget-details {
      flex: 1;

      .widget-name {
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 4px;
      }

      .widget-type {
        font-size: 12px;
        color: var(--hula-text-secondary);
        margin-bottom: 2px;
      }

      .widget-url {
        font-size: 11px;
        color: var(--hula-text-tertiary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }

  .widget-actions {
    display: flex;
    gap: 4px;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.permissions-content {
  .widget-info-header {
    font-size: 14px;
    margin-bottom: 8px;
  }

  .permissions-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 80px;
  }

  .empty-row {
    padding: 16px 0;
  }

  .permission-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-radius: 6px;

    .permission-user {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      flex: 1;

      .user-id {
        font-size: 13px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .permission-tags {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
  }

  .add-permission-form {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }
}
</style>
