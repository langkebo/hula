<template>
  <div class="ai-connection-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.ai_connection.title') }}</h3>
      <p class="section-desc">{{ t('setting.ai_connection.description') }}</p>

      <n-spin :show="loading">
        <div v-if="connections.length > 0" class="connection-list">
          <div v-for="conn in connections" :key="conn.id" class="connection-item">
            <div class="connection-info">
              <Icon :icon="getConnectionIcon(conn.type)" :width="24" />
              <div class="connection-details">
                <div class="connection-name">{{ conn.name }}</div>
                <div class="connection-meta">
                  <span class="connection-type">{{ conn.type }}</span>
                  <n-tag :type="conn.status === 'active' ? 'success' : 'default'" size="small" round>
                    {{ conn.status }}
                  </n-tag>
                </div>
              </div>
            </div>
            <n-button size="small" quaternary type="error" @click="handleDeleteConnection(conn.id)">
              {{ t('setting.ai_connection.actions.delete') }}
            </n-button>
          </div>
        </div>

        <n-empty v-else :description="t('setting.ai_connection.empty')" />
      </n-spin>

      <n-button class="mt-16px" type="primary" ghost @click="showCreateDialog = true">
        {{ t('setting.ai_connection.actions.create') }}
      </n-button>
    </div>

    <div class="settings-section mt-24px">
      <h3 class="section-title">{{ t('setting.ai_connection.mcp_tools_title') }}</h3>
      <n-spin :show="toolsLoading">
        <div v-if="mcpTools.length > 0" class="tool-list">
          <div v-for="tool in mcpTools" :key="tool.name" class="tool-item">
            <div class="tool-info">
              <Icon icon="mdi:wrench" :width="20" />
              <div class="tool-details">
                <div class="tool-name">{{ tool.name }}</div>
                <div class="tool-desc">{{ tool.description }}</div>
              </div>
            </div>
          </div>
        </div>
        <n-empty v-else :description="t('setting.ai_connection.no_tools')" />
      </n-spin>
    </div>

    <n-modal v-model:show="showCreateDialog" :title="t('setting.ai_connection.create_dialog.title')" preset="dialog">
      <n-form ref="createFormRef" :model="createForm" :rules="createRules">
        <n-form-item :label="t('setting.ai_connection.create_dialog.name_label')" path="name">
          <n-input
            v-model:value="createForm.name"
            :placeholder="t('setting.ai_connection.create_dialog.name_placeholder')" />
        </n-form-item>
        <n-form-item :label="t('setting.ai_connection.create_dialog.type_label')" path="type">
          <n-select v-model:value="createForm.type" :options="connectionTypeOptions" />
        </n-form-item>
        <n-form-item :label="t('setting.ai_connection.create_dialog.config_label')" path="config">
          <n-input
            v-model:value="createForm.config"
            type="textarea"
            :rows="4"
            :placeholder="t('setting.ai_connection.create_dialog.config_placeholder')" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showCreateDialog = false">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="creating" @click="handleCreateConnection">
          {{ t('common.confirm') }}
        </n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { FormInst } from 'naive-ui'
import { NButton, NEmpty, NForm, NFormItem, NInput, NModal, NSelect, NSpin, NTag, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { AIConnectionInfo } from '@/services/matrix/ai/MatrixAIConnectionService'
import { matrixAIConnectionService } from '@/services/matrix/ai/MatrixAIConnectionService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AiConnectionSettings')
const message = useMessage()
const { t } = useI18n()

const loading = ref(false)
const toolsLoading = ref(false)
const creating = ref(false)
const connections = ref<AIConnectionInfo[]>([])
const mcpTools = ref<{ name: string; description: string }[]>([])
const showCreateDialog = ref(false)
const createFormRef = ref<FormInst | null>(null)

const createForm = ref({
  name: '',
  type: 'openai',
  config: '{}'
})

const connectionTypeOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Azure OpenAI', value: 'azure' },
  { label: 'Google AI', value: 'google' },
  { label: 'Custom', value: 'custom' }
]

const createRules = {
  name: [{ required: true, message: t('setting.ai_connection.create_dialog.name_required'), trigger: 'blur' }],
  type: [{ required: true, message: t('setting.ai_connection.create_dialog.type_required'), trigger: 'change' }]
}

function getConnectionIcon(type: string): string {
  const icons: Record<string, string> = {
    openai: 'simple-icons:openai',
    azure: 'mdi:microsoft-azure',
    google: 'mdi:google',
    custom: 'mdi:robot'
  }
  return icons[type] || 'mdi:robot'
}

async function loadConnections() {
  loading.value = true
  try {
    connections.value = await matrixAIConnectionService.listConnections()
  } catch (err) {
    logger.error('Failed to load AI connections', err)
    connections.value = []
  } finally {
    loading.value = false
  }
}

async function loadMcpTools() {
  toolsLoading.value = true
  try {
    const result = await matrixAIConnectionService.listMcpTools()
    mcpTools.value = result.map((tool) => ({ name: tool.name, description: tool.description }))
  } catch (err) {
    logger.error('Failed to load MCP tools', err)
    mcpTools.value = []
  } finally {
    toolsLoading.value = false
  }
}

async function handleCreateConnection() {
  if (!createFormRef.value) return
  try {
    await createFormRef.value.validate()
  } catch {
    return
  }

  creating.value = true
  try {
    let config: Record<string, unknown> = {}
    try {
      config = JSON.parse(createForm.value.config)
    } catch {
      message.error(t('setting.ai_connection.create_dialog.config_invalid'))
      creating.value = false
      return
    }

    await matrixAIConnectionService.createConnection({
      name: createForm.value.name,
      type: createForm.value.type,
      config
    })

    message.success(t('setting.ai_connection.messages.create_success'))
    showCreateDialog.value = false
    createForm.value = { name: '', type: 'openai', config: '{}' }
    await loadConnections()
  } catch (err) {
    logger.error('Failed to create AI connection', err)
    message.error(t('setting.ai_connection.messages.create_failed'))
  } finally {
    creating.value = false
  }
}

async function handleDeleteConnection(id: string) {
  try {
    await matrixAIConnectionService.deleteConnection(id)
    message.success(t('setting.ai_connection.messages.delete_success'))
    await loadConnections()
  } catch (err) {
    logger.error('Failed to delete AI connection', err)
    message.error(t('setting.ai_connection.messages.delete_failed'))
  }
}

onMounted(async () => {
  await Promise.allSettled([loadConnections(), loadMcpTools()])
})
</script>

<style scoped>
.ai-connection-settings {
  padding: 0 var(--hula-space-2);
}

.settings-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--hula-text-primary);
}

.section-desc {
  font-size: 13px;
  color: var(--hula-text-secondary);
  margin-bottom: 16px;
}

.connection-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.connection-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--hula-border-color);
  background: var(--hula-bg-color);
}

.connection-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.connection-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.connection-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--hula-text-primary);
}

.connection-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--hula-text-secondary);
}

.tool-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--hula-border-color);
  background: var(--hula-bg-color);
}

.tool-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tool-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--hula-text-primary);
}

.tool-desc {
  font-size: 12px;
  color: var(--hula-text-secondary);
}
</style>
