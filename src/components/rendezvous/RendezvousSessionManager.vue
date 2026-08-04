<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('rendezvous.title')"
    :bordered="false"
    :closable="true"
    :mask-closable="false"
    style="width: 520px; max-width: 90vw"
    class="rendezvous-session-manager">
    <n-spin :show="loading">
      <div class="px-4px py-8px">
        <!-- 步骤条 -->
        <n-steps :current="currentStepIndex" class="mb-24px" size="small">
          <n-step :title="t('rendezvous.steps.create')" />
          <n-step :title="t('rendezvous.steps.connect')" />
          <n-step :title="t('rendezvous.steps.exchange')" />
          <n-step :title="t('rendezvous.steps.complete')" />
        </n-steps>

        <!-- 状态指示 -->
        <div class="status-bar mb-20px">
          <div class="status-icon" :class="statusClass">
            <Icon :icon="statusIcon" :width="24" />
          </div>
          <div class="status-info">
            <span class="status-title">{{ statusTitle }}</span>
            <span class="status-desc">{{ statusDesc }}</span>
          </div>
        </div>

        <!-- 错误提示 -->
        <n-alert v-if="error" type="error" class="mb-16px" closable @close="clearError">
          {{ error }}
        </n-alert>

        <!-- Phase: Idle - 创建会话 -->
        <div v-if="sessionStatus === 'idle'" class="flex flex-col items-center text-center">
          <div class="mb-16px text-[var(--tjg-color-primary-500)] bg-[var(--tjg-surface-search)] p-16px rounded-full">
            <Icon icon="mdi:qrcode-plus" :width="48" />
          </div>
          <p class="text-[var(--text-sm)] color-[var(--tjg-text-secondary)] mb-24px">
            {{ t('rendezvous.create_hint') }}
          </p>
          <n-button type="primary" :loading="loading" @click="handleCreateSession">
            {{ t('rendezvous.create_session') }}
          </n-button>
        </div>

        <!-- Phase: Creating -->
        <div v-else-if="sessionStatus === 'creating'" class="flex flex-col items-center text-center py-24px">
          <n-spin size="large" />
          <p class="mt-16px text-[var(--text-sm)] color-[var(--tjg-text-secondary)]">
            {{ t('rendezvous.creating') }}
          </p>
        </div>

        <!-- Phase: Active - 会话已创建 -->
        <div v-else-if="sessionStatus === 'active'" class="flex flex-col">
          <!-- 会话信息 -->
          <div class="session-info-card mb-16px">
            <div class="info-row">
              <span class="info-label">{{ t('rendezvous.session_id') }}</span>
              <span class="info-value break-all">{{ sessionId }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ t('rendezvous.session_status') }}</span>
              <n-tag :type="sessionTagType" size="small">{{ sessionStatusText }}</n-tag>
            </div>
          </div>

          <!-- QR 码展示 -->
          <div v-if="qrCodeValue" class="qr-section mb-16px">
            <div class="text-[var(--text-xs)] color-[var(--tjg-text-tertiary)] mb-8px text-center">
              {{ t('rendezvous.qr_hint') }}
            </div>
            <div class="flex justify-center">
              <n-qr-code
                :size="200"
                class="rounded-12px"
                :value="qrCodeValue"
                color="var(--tjg-text-primary)"
                bg-color="var(--tjg-surface-panel)"
                type="canvas"
                icon-src="/logo.png"
                :icon-size="36"
                :icon-margin="2"
                error-correction-level="H" />
            </div>
          </div>

          <!-- 消息列表 -->
          <div class="messages-section mb-16px">
            <div class="section-header">
              <Icon icon="mdi:message-text" :width="18" class="color-[var(--tjg-color-primary-500)]" />
              <span class="section-title">{{ t('rendezvous.messages') }}</span>
              <n-button text size="small" @click="handleRefreshMessages">
                <Icon icon="mdi:refresh" :width="16" />
              </n-button>
            </div>
            <div v-if="messages.length === 0" class="empty-messages">
              <span class="text-[var(--text-xs)] color-[var(--tjg-text-tertiary)]">
                {{ t('rendezvous.no_messages') }}
              </span>
            </div>
            <n-list v-else size="small" bordered class="max-h-200px overflow-y-auto">
              <n-list-item v-for="(msg, index) in messages" :key="index">
                <div class="message-item">
                  <Icon icon="mdi:email-outline" :width="16" class="color-[var(--tjg-text-tertiary)]" />
                  <span class="text-[var(--text-xs)] color-[var(--tjg-text-primary)] truncate flex-1">
                    {{ formatMessage(msg) }}
                  </span>
                </div>
              </n-list-item>
            </n-list>
          </div>

          <!-- 发送消息 -->
          <div class="send-section mb-16px">
            <div class="flex gap-8px">
              <n-input
                v-model:value="messageInput"
                size="small"
                :placeholder="t('rendezvous.message_placeholder')"
                @keyup.enter="handleSendMessage" />
              <n-button size="small" type="primary" :disabled="!messageInput.trim()" @click="handleSendMessage">
                <Icon icon="mdi:send" :width="16" />
              </n-button>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="flex justify-end gap-8px">
            <n-button type="primary" :loading="loading" @click="handleCompleteSession">
              {{ t('rendezvous.complete_session') }}
            </n-button>
            <n-button type="error" ghost :loading="loading" @click="handleDeleteSession">
              {{ t('rendezvous.delete_session') }}
            </n-button>
          </div>
        </div>

        <!-- Phase: Completed -->
        <div v-else-if="sessionStatus === 'completed'" class="flex flex-col items-center text-center py-24px">
          <div class="mb-16px text-[var(--tjg-color-success-500)]">
            <Icon icon="mdi:check-circle" :width="64" />
          </div>
          <h3 class="text-[var(--text-lg)] font-medium color-[var(--tjg-text-primary)] mb-8px">
            {{ t('rendezvous.completed_title') }}
          </h3>
          <p class="text-[var(--text-sm)] color-[var(--tjg-text-secondary)] mb-24px">
            {{ t('rendezvous.completed_desc') }}
          </p>
          <n-button type="primary" @click="handleReset">{{ t('common.close') }}</n-button>
        </div>

        <!-- Phase: Failed -->
        <div v-else-if="sessionStatus === 'failed'" class="flex flex-col items-center text-center py-24px">
          <div class="mb-16px text-[var(--tjg-color-danger-500)]">
            <Icon icon="mdi:alert-circle" :width="64" />
          </div>
          <h3 class="text-[var(--text-lg)] font-medium color-[var(--tjg-text-primary)] mb-8px">
            {{ t('rendezvous.failed_title') }}
          </h3>
          <p class="text-[var(--text-sm)] color-[var(--tjg-text-secondary)] mb-24px">
            {{ t('rendezvous.failed_desc') }}
          </p>
          <div class="flex gap-12px">
            <n-button @click="handleReset">{{ t('common.close') }}</n-button>
            <n-button type="primary" @click="handleCreateSession">{{ t('rendezvous.retry') }}</n-button>
          </div>
        </div>
      </div>
    </n-spin>

    <template #footer>
      <n-flex justify="end">
        <n-button @click="handleClose">{{ t('common.close') }}</n-button>
      </n-flex>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NAlert, NButton, NFlex, NInput, NList, NListItem, NModal, NQrCode, NSpin, NStep, NSteps, NTag } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { type SessionPhase, useRendezvous } from '@/composables/rendezvous'
import type { RendezvousMessage } from '@/services/matrix/rendezvous/MatrixRendezvousService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RendezvousSession')

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const {
  loading,
  error,
  currentSession,
  messages,
  sessionStatus,
  createSessionResponse,
  createSession,
  getMessages,
  completeSession,
  deleteSession,
  sendMessage
} = useRendezvous()

defineOptions({
  name: 'RendezvousSessionManager'
})

const visible = defineModel<boolean>('show', { default: false })

const messageInput = ref('')

const sessionId = computed(() => createSessionResponse.value?.session_id ?? currentSession.value?.session_id ?? '')

const qrCodeValue = computed(() => {
  if (!createSessionResponse.value) return ''
  return JSON.stringify({
    type: 'm.rendezvous',
    session_id: createSessionResponse.value.session_id,
    transport: 'http.v1'
  })
})

const currentStepIndex = computed(() => {
  switch (sessionStatus.value) {
    case 'idle':
      return 1
    case 'creating':
      return 1
    case 'active':
      return 3
    case 'completed':
      return 4
    case 'failed':
      return 1
    default:
      return 1
  }
})

const statusClass = computed(() => {
  switch (sessionStatus.value) {
    case 'idle':
      return 'status-idle'
    case 'creating':
      return 'status-creating'
    case 'active':
      return 'status-active'
    case 'completed':
      return 'status-completed'
    case 'failed':
      return 'status-failed'
    default:
      return 'status-idle'
  }
})

const statusIcon = computed(() => {
  switch (sessionStatus.value) {
    case 'idle':
      return 'mdi:qrcode-scan'
    case 'creating':
      return 'mdi:progress-clock'
    case 'active':
      return 'mdi:link-variant'
    case 'completed':
      return 'mdi:check-circle'
    case 'failed':
      return 'mdi:alert-circle'
    default:
      return 'mdi:qrcode-scan'
  }
})

const statusTitle = computed(() => t(`rendezvous.status.${sessionStatus.value}.title`))
const statusDesc = computed(() => t(`rendezvous.status.${sessionStatus.value}.desc`))

const sessionTagType = computed(() => {
  switch (sessionStatus.value) {
    case 'active':
      return 'success'
    case 'completed':
      return 'info'
    case 'failed':
      return 'error'
    default:
      return 'default'
  }
})

const sessionStatusText = computed(() => t(`rendezvous.status.${sessionStatus.value}.title`))

function clearError() {
  error.value = null
}

function formatMessage(msg: RendezvousMessage): string {
  try {
    return JSON.stringify(msg)
  } catch {
    return String(msg)
  }
}

async function handleCreateSession() {
  try {
    await createSession({
      intent: 'login.start',
      transport: 'http.v1'
    })
    showFeedback(t('rendezvous.create_success'), 'success')
  } catch (err) {
    logger.error('创建会话失败:', err)
    showFeedback(t('rendezvous.create_failed'), 'error')
  }
}

async function handleRefreshMessages() {
  if (!sessionId.value) return
  try {
    await getMessages(sessionId.value)
  } catch (err) {
    logger.error('获取消息失败:', err)
    showFeedback(t('rendezvous.get_messages_failed'), 'error')
  }
}

async function handleSendMessage() {
  const text = messageInput.value.trim()
  if (!text || !sessionId.value) return

  try {
    await sendMessage(sessionId.value, { type: 'm.rendezvous.message', content: { body: text } })
    messageInput.value = ''
    showFeedback(t('rendezvous.send_success'), 'success')
    await handleRefreshMessages()
  } catch (err) {
    logger.error('发送消息失败:', err)
    showFeedback(t('rendezvous.send_failed'), 'error')
  }
}

async function handleCompleteSession() {
  if (!sessionId.value) return
  try {
    const result = await completeSession(sessionId.value)
    if (result) {
      showFeedback(t('rendezvous.complete_success'), 'success')
    }
  } catch (err) {
    logger.error('完成会话失败:', err)
    showFeedback(t('rendezvous.complete_failed'), 'error')
  }
}

async function handleDeleteSession() {
  if (!sessionId.value) return
  try {
    await deleteSession(sessionId.value)
    showFeedback(t('rendezvous.delete_success'), 'success')
  } catch (err) {
    logger.error('删除会话失败:', err)
    showFeedback(t('rendezvous.delete_failed'), 'error')
  }
}

function handleReset() {
  messageInput.value = ''
  sessionStatus.value = 'idle'
  currentSession.value = null
  createSessionResponse.value = null
  messages.value = []
  error.value = null
}

function handleClose() {
  visible.value = false
  handleReset()
}

watch(visible, (val) => {
  if (!val) {
    handleReset()
  }
})
</script>

<style scoped lang="scss">
.rendezvous-session-manager {
  :deep(.n-card-header) {
    padding: 16px 20px;
  }

  :deep(.n-card__content) {
    padding: 16px 20px;
  }

  :deep(.n-card__footer) {
    padding: 12px 20px;
    border-top: 1px solid var(--tjg-border-default);
  }
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--tjg-surface-panel-muted);
  border-radius: 8px;
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-idle {
  color: var(--tjg-text-tertiary);
}

.status-creating {
  color: var(--tjg-color-warning-500);
}

.status-active {
  color: var(--tjg-color-success-500);
}

.status-completed {
  color: var(--tjg-color-primary-500);
}

.status-failed {
  color: var(--tjg-color-danger-500);
}

.status-info {
  display: flex;
  flex-direction: column;
}

.status-title {
  font-size: 14px;
  font-weight: 500;
}

.status-desc {
  font-size: 12px;
  color: var(--tjg-text-secondary);
  margin-top: 2px;
}

.session-info-card {
  background: var(--tjg-surface-panel-muted);
  border-radius: 8px;
  padding: 12px 16px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}

.info-row:not(:last-child) {
  border-bottom: 1px solid var(--tjg-border-default);
  margin-bottom: 4px;
}

.info-label {
  font-size: 12px;
  color: var(--tjg-text-tertiary);
  flex-shrink: 0;
  margin-right: 12px;
}

.info-value {
  font-size: 12px;
  font-weight: 500;
  font-family: monospace;
  text-align: right;
}

.qr-section {
  background: var(--tjg-surface-panel-muted);
  border-radius: 8px;
  padding: 16px;
}

.messages-section {
  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .section-title {
    font-size: 13px;
    font-weight: 500;
    flex: 1;
  }
}

.empty-messages {
  text-align: center;
  padding: 16px;
  background: var(--tjg-surface-panel-muted);
  border-radius: 8px;
}

.message-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.send-section {
  :deep(.n-input) {
    flex: 1;
  }
}
</style>
