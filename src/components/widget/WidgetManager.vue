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

    <!-- Widget ID 搜索栏 -->
    <div class="widget-search-bar">
      <n-input
        v-model:value="searchWidgetId"
        :placeholder="t('widget.search_by_id_placeholder')"
        size="small"
        style="flex: 1"
        @keyup.enter="handleSearchWidgetById" />
      <n-button type="primary" size="small" :loading="searchingWidget" @click="handleSearchWidgetById">
        <template #icon>
          <n-icon><Icon icon="mdi:magnify" /></n-icon>
        </template>
        {{ t('widget.search') }}
      </n-button>
    </div>

    <!-- Widget ID 查询结果 -->
    <div v-if="searchedWidget" class="widget-search-result">
      <n-divider />
      <div class="detail-header">
        <h4>{{ t('widget.search_result') }}</h4>
        <n-button text @click="searchedWidget = null">
          <template #icon>
            <n-icon><Icon icon="mdi:close" /></n-icon>
          </template>
        </n-button>
      </div>
      <n-descriptions bordered :column="1" label-placement="left" size="small">
        <n-descriptions-item label="ID">{{ searchedWidget.id }}</n-descriptions-item>
        <n-descriptions-item :label="t('widget.type')">{{ searchedWidget.type }}</n-descriptions-item>
        <n-descriptions-item :label="t('widget.url')">{{ searchedWidget.url }}</n-descriptions-item>
        <n-descriptions-item :label="t('widget.name')">{{ searchedWidget.name || '-' }}</n-descriptions-item>
      </n-descriptions>
    </div>

    <!-- Widget 列表 -->
    <n-spin :show="loading">
      <div v-if="widgets.length === 0" class="empty-state">
        <n-empty :description="t('widget.no_widgets')" />
      </div>
      <div v-else class="widget-list">
        <div
          v-for="widget in widgets"
          :key="widget.id"
          class="widget-item"
          :class="{ selected: selectedWidget?.id === widget.id }"
          @click="handleSelectWidget(widget)">
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
          <div class="widget-actions" @click.stop>
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

    <!-- Widget 详情面板 -->
    <WidgetDetailPanel
      v-if="selectedWidget"
      ref="detailPanelRef"
      :widget="selectedWidget"
      :room-id="roomId"
      @close="selectedWidget = null"
      @edit-config="handleEditConfig"
      @edit-capabilities="handleEditCapabilities" />

    <!-- 对话框组 -->
    <WidgetDialogs
      ref="dialogsRef"
      v-model:show-add-dialog="showAddDialog"
      v-model:show-permissions-dialog="showPermissionsDialog"
      v-model:show-config-dialog="showConfigDialog"
      v-model:show-capabilities-dialog="showCapabilitiesDialog"
      :selected-widget="selectedWidget"
      :permission-rows="permissionRows"
      :permissions-loading="permissionsLoading"
      :saving-permissions="savingPermissions"
      :capabilities-loading="false"
      :saving-capabilities="savingCapabilities"
      :saving-config="savingConfig"
      :adding="adding"
      :current-capabilities="currentCapabilities"
      @add-widget="handleAddWidget"
      @save-config="handleSaveConfig"
      @save-capabilities="handleSaveCapabilities"
      @add-permission="handleAddPermission"
      @remove-permission="handleRemovePermission" />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useDialog } from 'naive-ui'
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { openExternalUrl } from '@/composables/common/useLinkSegments'
import { type PermissionRow, useWidgetPermissions, useWidgets, type Widget } from '@/composables/widget'
import { matrixWidgetService } from '@/services/matrix/widget/MatrixWidgetService'
import { createLogger } from '@/utils/Logger'
import WidgetDetailPanel from './WidgetDetailPanel.vue'
import WidgetDialogs from './WidgetDialogs.vue'

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
const showConfigDialog = ref(false)
const showCapabilitiesDialog = ref(false)
const selectedWidget = ref<Widget | null>(null)
const detailPanelRef = ref<InstanceType<typeof WidgetDetailPanel> | null>(null)
const dialogsRef = ref<InstanceType<typeof WidgetDialogs> | null>(null)

// ===== Widget ID 搜索 =====
const searchWidgetId = ref('')
const searchingWidget = ref(false)
const searchedWidget = ref<Widget | null>(null)

// ===== Capabilities 编辑所需当前值 =====
const currentCapabilities = ref<string[]>([])

// ===== 保存状态 =====
const savingConfig = ref(false)
const savingCapabilities = ref(false)

const getWidgetIcon = (type: string) => {
  const icons: Record<string, string> = {
    jitsi: 'mdi:video',
    etherpad: 'mdi:file-document-edit',
    poll: 'mdi:poll',
    custom: 'mdi:puzzle'
  }
  return icons[type] || 'mdi:puzzle'
}

async function handleSearchWidgetById() {
  const id = searchWidgetId.value.trim()
  if (!id) {
    showFeedback(t('widget.search_id_required'), 'warning')
    return
  }
  searchingWidget.value = true
  try {
    const result = await matrixWidgetService.getWidgetById(id, false)
    searchedWidget.value = result
    if (!result) {
      showFeedback(t('widget.search_not_found'), 'warning')
    }
  } catch (e) {
    logger.error('搜索Widget失败', e)
    showFeedback(t('widget.search_failed'), 'error')
    searchedWidget.value = null
  } finally {
    searchingWidget.value = false
  }
}

async function handleSelectWidget(widget: Widget) {
  if (selectedWidget.value?.id === widget.id) {
    selectedWidget.value = null
    return
  }
  selectedWidget.value = widget
}

// ===== 详情面板事件 =====
function handleEditConfig() {
  showConfigDialog.value = true
}

function handleEditCapabilities(caps: string[]) {
  currentCapabilities.value = caps
  showCapabilitiesDialog.value = true
}

// ===== 对话框事件处理 =====
const handleAddWidget = async (data: { name: string; type: string; url: string }) => {
  try {
    const result = await createWidget({
      widgetType: data.type,
      url: data.url,
      name: data.name
    })
    if (!result) {
      showFeedback(t('widget.add_failed'), 'error')
      return
    }
    showFeedback(t('widget.add_success'), 'success')
    showAddDialog.value = false
    dialogsRef.value?.resetAddWidgetForm()
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
        if (selectedWidget.value?.id === widget.id) {
          selectedWidget.value = null
        }
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
  await loadPermissions(widget.id)
}

const handleAddPermission = async (data: { userId: string; permissions: string[] }) => {
  if (!selectedWidget.value) return
  const userId = data.userId.trim()
  if (!userId) {
    showFeedback(t('widget.permission_user_required'), 'warning')
    return
  }
  if (data.permissions.length === 0) {
    showFeedback(t('widget.permission_scope_required'), 'warning')
    return
  }
  const ok = await grantPermission(selectedWidget.value.id, userId, data.permissions)
  if (ok) {
    showFeedback(t('widget.permission_added'), 'success')
    dialogsRef.value?.resetPermissionForm()
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

async function handleSaveConfig(data: { name: string; url: string }) {
  if (!selectedWidget.value) return
  savingConfig.value = true
  try {
    const result = await matrixWidgetService.updateWidget(
      selectedWidget.value.id,
      { name: data.name, url: data.url },
      false
    )
    if (result) {
      showFeedback(t('widget.config_saved'), 'success')
      showConfigDialog.value = false
      await detailPanelRef.value?.reload()
      await loadWidgets()
    } else {
      showFeedback(t('widget.config_save_failed'), 'error')
    }
  } catch (e) {
    logger.error('保存Widget配置失败', e)
    showFeedback(t('widget.config_save_failed'), 'error')
  } finally {
    savingConfig.value = false
  }
}

async function handleSaveCapabilities(caps: string[]) {
  if (!selectedWidget.value) return
  savingCapabilities.value = true
  try {
    const result = await matrixWidgetService.setWidgetCapabilities(
      props.roomId,
      selectedWidget.value.id,
      caps,
      true
    )
    if (result) {
      showFeedback(t('widget.capabilities_saved'), 'success')
      showCapabilitiesDialog.value = false
      await detailPanelRef.value?.reload()
    } else {
      showFeedback(t('widget.capabilities_save_failed'), 'error')
    }
  } catch (e) {
    logger.error('保存Widget能力失败', e)
    showFeedback(t('widget.capabilities_save_failed'), 'error')
  } finally {
    savingCapabilities.value = false
  }
}

watch(
  () => props.roomId,
  () => {
    selectedWidget.value = null
  }
)

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

.widget-search-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.widget-search-result {
  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;

    h4 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
    }
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
  background: var(--tjg-surface-panel-muted);
  border-radius: 8px;
  transition: all 0.2s;
  cursor: pointer;

  &:hover {
    background: var(--tjg-surface-list-hover);
  }

  &.selected {
    background: var(--tjg-surface-list-hover);
    border: 1px solid var(--tjg-color-primary-500);
  }

  .widget-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;

    .widget-icon {
      color: var(--tjg-color-primary-500);
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
        color: var(--tjg-text-secondary);
        margin-bottom: 2px;
      }

      .widget-url {
        font-size: 11px;
        color: var(--tjg-text-tertiary);
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
</style>
