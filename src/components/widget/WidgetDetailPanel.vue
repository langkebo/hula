<template>
  <div v-if="widget" class="widget-detail-panel">
    <n-divider />
    <div class="detail-header">
      <h4>{{ widget.name || widget.id }}</h4>
      <n-button text @click="emit('close')">
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
              <n-button size="small" @click="emit('edit-config')">
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
              <n-button size="small" @click="emit('edit-capabilities', capabilities)">
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
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { type Widget } from '@/composables/widget'
import { matrixWidgetService } from '@/services/matrix/widget/MatrixWidgetService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('WidgetDetailPanel')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const props = defineProps<{
  widget: Widget | null
  roomId: string
}>()

const emit = defineEmits<{
  close: []
  'edit-config': []
  'edit-capabilities': [capabilities: string[]]
}>()

const detailTab = ref('config')

// ===== Widget Config =====
const widgetConfig = ref<Record<string, unknown>>({})
const configLoading = ref(false)

async function loadWidgetConfig() {
  if (!props.widget) return
  configLoading.value = true
  try {
    const result = await matrixWidgetService.getWidgetConfig(props.widget.id, false)
    widgetConfig.value = result ?? {}
  } catch (e) {
    logger.error('加载Widget配置失败', e)
    widgetConfig.value = {}
  } finally {
    configLoading.value = false
  }
}

// ===== Capabilities =====
const capabilities = ref<string[]>([])
const capabilitiesLoading = ref(false)

async function loadCapabilities() {
  if (!props.widget) return
  capabilitiesLoading.value = true
  try {
    const result = await matrixWidgetService.getWidgetCapabilities(props.roomId, props.widget.id, false)
    capabilities.value = result?.capabilities ?? []
  } catch (e) {
    logger.error('加载Widget能力失败', e)
    capabilities.value = []
  } finally {
    capabilitiesLoading.value = false
  }
}

// ===== Sessions =====
interface WidgetSession {
  session_id: string
  user_id?: string
  created_at?: number | string
  last_active?: number | string
}

const sessions = ref<WidgetSession[]>([])
const sessionsLoading = ref(false)

async function loadSessions() {
  if (!props.widget) return
  sessionsLoading.value = true
  try {
    const result = await matrixWidgetService.getWidgetSessions(props.widget.id, false)
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

// ===== Messages =====
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
  if (!props.widget || !messageInput.value.trim()) return
  sendingMessage.value = true
  try {
    const result = await matrixWidgetService.sendWidgetMessage(
      props.roomId,
      props.widget.id,
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

// ===== Reload all data =====
async function reload() {
  await Promise.all([loadWidgetConfig(), loadCapabilities(), loadSessions()])
}

// ===== Watch widget prop =====
watch(
  () => props.widget,
  (widget) => {
    if (!widget) return
    detailTab.value = 'config'
    capabilities.value = []
    sessions.value = []
    messageHistory.value = []
    widgetConfig.value = {}
    void reload()
  }
)

defineExpose({ reload })
</script>

<style scoped lang="scss">
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
</style>
