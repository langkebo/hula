<template>
  <!-- 添加 Widget 对话框 -->
  <n-modal :show="showAddDialog" preset="card" :title="t('widget.add')" style="width: 600px" @update:show="emit('update:showAddDialog', $event)">
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
        <n-button @click="emit('update:showAddDialog', false)">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="adding" @click="handleSubmitAddWidget">
          {{ t('common.confirm') }}
        </n-button>
      </div>
    </template>
  </n-modal>

  <!-- Widget 权限对话框 -->
  <n-modal :show="showPermissionsDialog" preset="card" :title="t('widget.permissions')" style="width: 560px" @update:show="emit('update:showPermissionsDialog', $event)">
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
              @click="emit('remove-permission', row)">
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
        <n-button type="primary" size="small" :loading="savingPermissions" @click="handleSubmitAddPermission">
          {{ t('common.add') }}
        </n-button>
      </div>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <n-button @click="emit('update:showPermissionsDialog', false)">{{ t('common.close') }}</n-button>
      </div>
    </template>
  </n-modal>

  <!-- 编辑 Capabilities 对话框 -->
  <n-modal
    :show="showCapabilitiesDialog"
    preset="card"
    :title="t('widget.edit_capabilities')"
    style="width: 520px"
    @update:show="emit('update:showCapabilitiesDialog', $event)">
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
        <n-button @click="emit('update:showCapabilitiesDialog', false)">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="savingCapabilities" @click="handleSubmitSaveCapabilities">
          {{ t('common.save') }}
        </n-button>
      </div>
    </template>
  </n-modal>

  <!-- 编辑 Config 对话框 -->
  <n-modal :show="showConfigDialog" preset="card" :title="t('widget.edit_config')" style="width: 600px" @update:show="emit('update:showConfigDialog', $event)">
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
        <n-button @click="emit('update:showConfigDialog', false)">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="savingConfig" @click="handleSubmitSaveConfig">
          {{ t('common.save') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { type FormInst } from 'naive-ui'
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type PermissionRow, type Widget } from '@/composables/widget'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('WidgetDialogs')
const { t } = useI18n()

const props = defineProps<{
  showAddDialog: boolean
  showPermissionsDialog: boolean
  showConfigDialog: boolean
  showCapabilitiesDialog: boolean
  selectedWidget: Widget | null
  permissionRows: PermissionRow[]
  permissionsLoading: boolean
  savingPermissions: boolean
  capabilitiesLoading: boolean
  savingCapabilities: boolean
  savingConfig: boolean
  adding: boolean
  currentCapabilities: string[]
}>()

const emit = defineEmits<{
  'update:showAddDialog': [value: boolean]
  'update:showPermissionsDialog': [value: boolean]
  'update:showConfigDialog': [value: boolean]
  'update:showCapabilitiesDialog': [value: boolean]
  'add-widget': [data: { name: string; type: string; url: string }]
  'save-config': [data: { name: string; url: string }]
  'save-capabilities': [capabilities: string[]]
  'add-permission': [data: { userId: string; permissions: string[] }]
  'remove-permission': [row: PermissionRow]
}>()

// ===== Add Widget form =====
const formRef = ref<FormInst | null>(null)

const formData = reactive({
  name: '',
  type: 'custom',
  url: ''
})

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

async function handleSubmitAddWidget() {
  try {
    await formRef.value?.validate()
    emit('add-widget', { name: formData.name, type: formData.type, url: formData.url })
  } catch (error) {
    logger.error('[WidgetDialogs] 添加 Widget 表单验证失败:', error)
  }
}

function resetAddWidgetForm() {
  formData.name = ''
  formData.type = 'custom'
  formData.url = ''
}

// ===== Config edit form =====
const configFormData = reactive({
  name: '',
  url: '',
  type: ''
})

function handleSubmitSaveConfig() {
  emit('save-config', { name: configFormData.name, url: configFormData.url })
}

// ===== Capabilities edit form =====
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

function handleSubmitSaveCapabilities() {
  emit('save-capabilities', editingCapabilities.value)
}

// ===== Permission form =====
const newPermission = reactive<{ userId: string; permissions: string[] }>({
  userId: '',
  permissions: ['read']
})

const permissionPresetOptions = [
  { label: t('widget.permission_read'), value: 'read' },
  { label: t('widget.permission_write'), value: 'write' },
  { label: t('widget.permission_admin'), value: 'admin' }
]

function handleSubmitAddPermission() {
  emit('add-permission', {
    userId: newPermission.userId,
    permissions: newPermission.permissions
  })
}

function resetPermissionForm() {
  newPermission.userId = ''
  newPermission.permissions = ['read']
}

// ===== Watch dialog visibility to init forms =====
watch(
  () => props.showConfigDialog,
  (show) => {
    if (show && props.selectedWidget) {
      configFormData.name = props.selectedWidget.name || ''
      configFormData.url = props.selectedWidget.url || ''
      configFormData.type = props.selectedWidget.type || ''
    }
  }
)

watch(
  () => props.showCapabilitiesDialog,
  (show) => {
    if (show) {
      editingCapabilities.value = [...props.currentCapabilities]
      customCapability.value = ''
    }
  }
)

watch(
  () => props.showPermissionsDialog,
  (show) => {
    if (show) {
      resetPermissionForm()
    }
  }
)

defineExpose({ resetAddWidgetForm, resetPermissionForm })
</script>

<style scoped lang="scss">
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

.empty-row {
  padding: 16px 0;
}
</style>
