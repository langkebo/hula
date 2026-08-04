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

    <!-- Widget 详情面板（Capabilities / Sessions / Messages） -->
    <div v-if="selectedWidget" class="widget-detail-panel">
      <n-divider />
      <div class="detail-header">
        <h4>{{ selectedWidget.name || selectedWidget.id }}</h4>
        <n-button text @click="selectedWidget = null">
          <template #icon>
            <n-icon><Icon icon="mdi:close" /></n-icon>
          </template>
        </n-button>
      </div>

      <n-tabs v-model:value="detailTab" type="line" size="small">
        <!-- Config -->
        <n-tab-pane name="config" :tab="t('widget.config')">
          <n-spin :show="configLoading">
            <div class="config-section">
              <div class="section-toolbar">
                <n-button size="small" @click="handleEditConfig">
                  <template #icon>
                    <n-icon><Icon icon="mdi:pencil" /></n-icon>
                  </template>
                  {{ t('widget.edit_config') }}
                </n-button>
              </div>
              <div v-if="!widgetConfig || Object.keys(widgetConfig).length === 0" class="empty-row">
                <n-empty size="small" :description="t('widget.no_config')" />
              </div>
              <n-descriptions v-else bordered :column="1" label-placement="left" size="small">
                <n-descriptions-item v-for="(value, key) in widgetConfig" :key="String(key)" :label="String(key)">
                  <template v-if="typeof value === 'object' && value !== null">
                    {{ JSON.stringify(value) }}
                  </template>
                  <template v-else>{{ value }}</template>
                </n-descriptions-item>
              </n-descriptions>
            </div>
          </n-spin>
        </n-tab-pane>

        <!-- Capabilities -->
        <n-tab-pane name="capabilities" :tab="t('widget.capabilities')">
          <n-spin :show="capabilitiesLoading">
            <div class="capabilities-section">
              <div class="section-toolbar">
                <n-button size="small" @click="handleEditCapabilities">
                  <template #icon>
                    <n-icon><Icon icon="mdi:pencil" /></n-icon>
                  </template>
                  {{ t('widget.edit_capabilities') }}
                </n-button>
              </div>
              <div v-if="capabilities.length === 0" class="empty-row">
                <n-empty size="small" :description="t('widget.no_capabilities')" />
              </div>
              <div v-else class="capabilities-tags">
                <n-tag v-for="cap in capabilities" :key="cap" size="small" type="info" class="cap-tag">
                  {{ cap }}
                </n-tag>
              </div>
            </div>
          </n-spin>
        </n-tab-pane>

        <!-- Sessions -->
        <n-tab-pane name="sessions" :tab="t('widget.sessions')">
          <n-spin :show="sessionsLoading">
            <div v-if="sessions.length === 0" class="empty-row">
              <n-empty size="small" :description="t('widget.no_sessions')" />
            </div>
            <div v-else class="sessions-list">
              <div v-for="session in sessions" :key="session.session_id" class="session-item">
                <div class="session-info">
                  <div class="session-row">
                    <span class="session-label">{{ t('widget.session_id') }}:</span>
                    <span class="session-value">{{ session.session_id }}</span>
                  </div>
                  <div class="session-row">
                    <span class="session-label">{{ t('widget.session_user') }}:</span>
                    <span class="session-value">{{ session.user_id ?? '-' }}</span>
                  </div>
                  <div class="session-row">
                    <span class="session-label">{{ t('widget.session_created') }}:</span>
                    <span class="session-value">
                      {{ session.created_at ? new Date(Number(session.created_at)).toLocaleString() : '-' }}
                    </span>
                  </div>
                  <div class="session-row">
                    <span class="session-label">{{ t('widget.session_last_active') }}:</span>
                    <span class="session-value">
                      {{ session.last_active ? new Date(Number(session.last_active)).toLocaleString() : '-' }}
                    </span>
                  </div>
                </div>
                <n-popconfirm @positive-click="handleTerminateSession(session.session_id)">
                  <template #trigger>
                    <n-button type="error" size="small">
                      {{ t('widget.terminate_session') }}
                    </n-button>
                  </template>
                  {{ t('widget.terminate_session_confirm') }}
                </n-popconfirm>
              </div>
            </div>
          </n-spin>
        </n-tab-pane>

        <!-- Messages -->
        <n-tab-pane name="messages" :tab="t('widget.messages')">
          <div class="messages-section">
            <div class="message-history">
              <div v-if="messageHistory.length === 0" class="empty-row">
                <n-empty size="small" :description="t('widget.no_messages')" />
              </div>
              <div v-for="(msg, index) in messageHistory" :key="index" class="message-item">
                <n-tag size="small" :type="msg.direction === 'sent' ? 'success' : 'info'" class="msg-tag">
                  {{ msg.direction === 'sent' ? t('widget.msg_sent') : t('widget.msg_received') }}
                </n-tag>
                <span class="msg-type">{{ msg.type }}</span>
                <span class="msg-content">{{ msg.content }}</span>
                <span class="msg-time">{{ new Date(msg.timestamp).toLocaleTimeString() }}</span>
              </div>
            </div>
            <div class="message-input-row">
              <n-input
                v-model:value="messageInput"
                :placeholder="t('widget.message_placeholder')"
                size="small"
                style="flex: 1"
                @keyup.enter="handleSendMessage" />
              <n-button type="primary" size="small" :loading="sendingMessage" @click="handleSendMessage">
                <template #icon>
                  <n-icon><Icon icon="mdi:send" /></n-icon>
                </template>
              </n-button>
            </div>
          </div>
        </n-tab-pane>
      </n-tabs>
    </div>

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

    <!-- 编辑 Capabilities 对话框 -->
    <n-modal
      v-model:show="showCapabilitiesDialog"
      preset="card"
      :title="t('widget.edit_capabilities')"
      style="width: 520px">
      <div v-if="selectedWidget" class="capabilities-dialog-content">
        <n-spin :show="capabilitiesLoading">
          <div class="capabilities-toggle-list">
            <n-checkbox
              v-for="cap in availableCapabilities"
              :key="cap"
              :checked="editingCapabilities.includes(cap)"
              @update:checked="(checked: boolean) => toggleCapability(cap, checked)">
              {{ cap }}
            </n-checkbox>
          </div>
          <n-divider />
          <div class="custom-capability-row">
            <n-input
              v-model:value="customCapability"
              :placeholder="t('widget.custom_capability_placeholder')"
              size="small"
              style="flex: 1"
              @keyup.enter="addCustomCapability" />
            <n-button size="small" @click="addCustomCapability">
              {{ t('common.add') }}
            </n-button>
          </div>
        </n-spin>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <n-button @click="showCapabilitiesDialog = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :loading="savingCapabilities" @click="handleSaveCapabilities">
            {{ t('common.save') }}
          </n-button>
        </div>
      </template>
    </n-modal>

    <!-- 编辑 Config 对话框 -->
    <n-modal v-model:show="showConfigDialog" preset="card" :title="t('widget.edit_config')" style="width: 600px">
      <div v-if="selectedWidget" class="config-dialog-content">
        <n-spin :show="savingConfig">
          <n-form :model="configFormData">
            <n-form-item :label="t('widget.name')">
              <n-input v-model:value="configFormData.name" />
            </n-form-item>
            <n-form-item :label="t('widget.url')">
              <n-input v-model:value="configFormData.url" />
            </n-form-item>
            <n-form-item :label="t('widget.type')">
              <n-input v-model:value="configFormData.type" disabled />
            </n-form-item>
          </n-form>
        </n-spin>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <n-button @click="showConfigDialog = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :loading="savingConfig" @click="handleSaveConfig">
            {{ t('common.save') }}
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { type FormInst, useDialog } from 'naive-ui'
import { onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { openExternalUrl } from '@/composables/common/useLinkSegments'
import { type PermissionRow, useWidgetPermissions, useWidgets, type Widget } from '@/composables/widget'
import { matrixWidgetService } from '@/services/matrix/widget/MatrixWidgetService'
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

// ===== Widget 详情面板 =====
const detailTab = ref('config')

// ===== Widget ID 搜索 =====
const searchWidgetId = ref('')
const searchingWidget = ref(false)
const searchedWidget = ref<Widget | null>(null)

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

// ===== Widget Config =====
const widgetConfig = ref<Record<string, unknown>>({})
const configLoading = ref(false)
const savingConfig = ref(false)
const showConfigDialog = ref(false)
const configFormData = reactive({
  name: '',
  url: '',
  type: ''
})

async function loadWidgetConfig() {
  if (!selectedWidget.value) return
  configLoading.value = true
  try {
    const result = await matrixWidgetService.getWidgetConfig(selectedWidget.value.id, false)
    widgetConfig.value = result ?? {}
  } catch (e) {
    logger.error('加载Widget配置失败', e)
    widgetConfig.value = {}
  } finally {
    configLoading.value = false
  }
}

function handleEditConfig() {
  if (!selectedWidget.value) return
  configFormData.name = selectedWidget.value.name || ''
  configFormData.url = selectedWidget.value.url || ''
  configFormData.type = selectedWidget.value.type || ''
  showConfigDialog.value = true
}

async function handleSaveConfig() {
  if (!selectedWidget.value) return
  savingConfig.value = true
  try {
    const result = await matrixWidgetService.updateWidget(
      selectedWidget.value.id,
      {
        name: configFormData.name,
        url: configFormData.url
      },
      false
    )
    if (result) {
      showFeedback(t('widget.config_saved'), 'success')
      showConfigDialog.value = false
      await loadWidgetConfig()
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

// Capabilities
const capabilities = ref<string[]>([])
const capabilitiesLoading = ref(false)
const savingCapabilities = ref(false)
const showCapabilitiesDialog = ref(false)
const editingCapabilities = ref<string[]>([])
const customCapability = ref('')

const availableCapabilities = [
  'camera',
  'microphone',
  'send_event',
  'receive_event',
  'send_to_canvas',
  'receive_from_canvas',
  'modify_turn_servers',
  'm.always_on_screen'
]

async function loadCapabilities() {
  if (!selectedWidget.value) return
  capabilitiesLoading.value = true
  try {
    const result = await matrixWidgetService.getWidgetCapabilities(props.roomId, selectedWidget.value.id, false)
    capabilities.value = result?.capabilities ?? []
  } catch (e) {
    logger.error('加载Widget能力失败', e)
    capabilities.value = []
  } finally {
    capabilitiesLoading.value = false
  }
}

function handleEditCapabilities() {
  editingCapabilities.value = [...capabilities.value]
  customCapability.value = ''
  showCapabilitiesDialog.value = true
}

function toggleCapability(cap: string, checked: boolean) {
  if (checked) {
    if (!editingCapabilities.value.includes(cap)) {
      editingCapabilities.value = [...editingCapabilities.value, cap]
    }
  } else {
    editingCapabilities.value = editingCapabilities.value.filter((c) => c !== cap)
  }
}

function addCustomCapability() {
  const cap = customCapability.value.trim()
  if (!cap) return
  if (!editingCapabilities.value.includes(cap)) {
    editingCapabilities.value = [...editingCapabilities.value, cap]
  }
  customCapability.value = ''
}

async function handleSaveCapabilities() {
  if (!selectedWidget.value) return
  savingCapabilities.value = true
  try {
    const result = await matrixWidgetService.setWidgetCapabilities(
      props.roomId,
      selectedWidget.value.id,
      editingCapabilities.value,
      true
    )
    if (result) {
      capabilities.value = result.capabilities ?? editingCapabilities.value
      showFeedback(t('widget.capabilities_saved'), 'success')
      showCapabilitiesDialog.value = false
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

// Sessions
interface WidgetSession {
  session_id: string
  user_id?: string
  created_at?: number | string
  last_active?: number | string
}

const sessions = ref<WidgetSession[]>([])
const sessionsLoading = ref(false)

async function loadSessions() {
  if (!selectedWidget.value) return
  sessionsLoading.value = true
  try {
    const result = await matrixWidgetService.getWidgetSessions(selectedWidget.value.id, false)
    if (Array.isArray(result)) {
      sessions.value = result as WidgetSession[]
    } else if (result && typeof result === 'object') {
      const sessionsData = (result as Record<string, unknown>).sessions
      if (Array.isArray(sessionsData)) {
        sessions.value = sessionsData as WidgetSession[]
      } else {
        sessions.value = []
      }
    } else {
      sessions.value = []
    }
  } catch (e) {
    logger.error('加载Widget会话失败', e)
    sessions.value = []
  } finally {
    sessionsLoading.value = false
  }
}

async function handleTerminateSession(sessionId: string) {
  try {
    const ok = await matrixWidgetService.terminateWidgetSession(sessionId, true)
    if (ok) {
      showFeedback(t('widget.session_terminated'), 'success')
      await loadSessions()
    } else {
      showFeedback(t('widget.session_terminate_failed'), 'error')
    }
  } catch (e) {
    logger.error('终止Widget会话失败', e)
    showFeedback(t('widget.session_terminate_failed'), 'error')
  }
}

// Messages
interface WidgetMessage {
  direction: 'sent' | 'received'
  type: string
  content: string
  timestamp: number
}

const messageHistory = ref<WidgetMessage[]>([])
const messageInput = ref('')
const sendingMessage = ref(false)

async function handleSendMessage() {
  if (!selectedWidget.value || !messageInput.value.trim()) return
  sendingMessage.value = true
  try {
    const result = await matrixWidgetService.sendWidgetMessage(
      props.roomId,
      selectedWidget.value.id,
      { type: 'm.custom', content: { body: messageInput.value.trim() } },
      true
    )
    messageHistory.value = [
      ...messageHistory.value,
      {
        direction: 'sent',
        type: result?.type ?? 'm.custom',
        content: messageInput.value.trim(),
        timestamp: Date.now()
      }
    ]
    messageInput.value = ''
    showFeedback(t('widget.message_sent'), 'success')
  } catch (e) {
    logger.error('发送Widget消息失败', e)
    showFeedback(t('widget.message_send_failed'), 'error')
  } finally {
    sendingMessage.value = false
  }
}

// Widget 选择
async function handleSelectWidget(widget: Widget) {
  if (selectedWidget.value?.id === widget.id) {
    selectedWidget.value = null
    return
  }
  selectedWidget.value = widget
  detailTab.value = 'config'
  capabilities.value = []
  sessions.value = []
  messageHistory.value = []
  widgetConfig.value = {}

  await loadWidgetConfig()
  await loadCapabilities()
  await loadSessions()
}

watch(
  () => props.roomId,
  () => {
    selectedWidget.value = null
  }
)

// ===== 原有操作 =====
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

.widget-detail-panel {
  margin-top: 8px;

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

.capabilities-section {
  .section-toolbar {
    margin-bottom: 12px;
  }

  .capabilities-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    .cap-tag {
      font-size: 12px;
    }
  }
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.session-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  background: var(--tjg-surface-panel-muted);
  border-radius: 6px;

  .session-info {
    flex: 1;

    .session-row {
      display: flex;
      gap: 8px;
      margin-bottom: 4px;
      font-size: 13px;

      .session-label {
        color: var(--tjg-text-secondary);
        min-width: 80px;
      }

      .session-value {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
}

.messages-section {
  .message-history {
    max-height: 300px;
    overflow-y: auto;
    margin-bottom: 12px;
    padding: 8px;
    background: var(--tjg-surface-panel-muted);
    border-radius: 6px;

    .message-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      font-size: 13px;
      border-bottom: 1px solid var(--tjg-border-default);

      &:last-child {
        border-bottom: none;
      }

      .msg-tag {
        flex-shrink: 0;
      }

      .msg-type {
        color: var(--tjg-text-secondary);
        font-size: 12px;
        min-width: 60px;
      }

      .msg-content {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .msg-time {
        color: var(--tjg-text-tertiary);
        font-size: 11px;
        flex-shrink: 0;
      }
    }
  }

  .message-input-row {
    display: flex;
    gap: 8px;
  }
}

.empty-row {
  padding: 16px 0;
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

  .permission-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: var(--tjg-surface-panel-muted);
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

.capabilities-dialog-content {
  .capabilities-toggle-list {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .custom-capability-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}
</style>
