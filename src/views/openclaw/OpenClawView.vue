<template>
  <div class="openclaw-view">
    <!-- 顶部导航 -->
    <div class="openclaw-view__header">
      <div class="openclaw-view__header-left">
        <svg class="openclaw-view__back" @click="handleBack">
          <use href="#left-arrow"></use>
        </svg>
        <h2 class="openclaw-view__title">OpenClawX</h2>
      </div>
      <div class="openclaw-view__header-right">
        <ConnectionStatus :status="connectionState.state" :show-retry="true" @retry="handleConnect" />
        <n-button size="small" @click="handleNewChat">
          <template #icon>
            <svg class="openclaw-view__new-chat-icon"><use href="#plus"></use></svg>
          </template>
          新对话
        </n-button>
      </div>
    </div>

    <!-- 对话区域 -->
    <div class="openclaw-view__content" ref="contentRef">
      <!-- 欢迎消息 -->
      <div v-if="messageHistory.length === 0" class="openclaw-view__welcome">
        <div class="openclaw-view__welcome-icon">
          <svg><use href="#robot"></use></svg>
        </div>
        <h3>OpenClawX 助手</h3>
        <p>你好！我是 OpenClawX，请问有什么可以帮助你的？</p>
        <div class="openclaw-view__quick-actions">
          <div
            v-for="(action, index) in quickActions"
            :key="index"
            class="openclaw-view__quick-action"
            @click="handleQuickAction(action.text)">
            {{ action.text }}
          </div>
        </div>
      </div>

      <!-- 消息列表 -->
      <div v-else class="openclaw-view__messages">
        <div
          v-for="(msg, index) in messageHistory"
          :key="index"
          class="openclaw-view__message"
          :class="{
            'openclaw-view__message--user': msg.role === 'user',
            'openclaw-view__message--assistant': msg.role === 'assistant'
          }">
          <div v-if="msg.role === 'assistant'" class="openclaw-view__message-avatar">
            <svg class="openclaw-view__avatar-icon"><use href="#robot"></use></svg>
          </div>
          <div class="openclaw-view__message-content">
            <div class="openclaw-view__message-bubble">
              <span>{{ msg.content }}</span>
            </div>
          </div>
          <div v-if="msg.role === 'user'" class="openclaw-view__message-avatar">
            <svg class="openclaw-view__avatar-icon"><use href="#user"></use></svg>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部输入区 -->
    <div class="openclaw-view__footer">
      <div class="openclaw-view__input-wrapper">
        <ModelSelector
          v-if="availableModels.length > 0"
          :models="modelOptions"
          :current-model-id="currentModel"
          @select="handleModelSelect" />
        <n-input
          v-model:value="inputMessage"
          type="textarea"
          placeholder="输入消息..."
          :autosize="{ minRows: 1, maxRows: 4 }"
          @keydown.enter.exact.prevent="handleSend"
          @keydown.shift.enter="handleShiftEnter" />
        <n-button type="primary" :disabled="!canSend" @click="handleSend">
          <template #icon>
            <svg class="openclaw-view__send-icon"><use href="#send"></use></svg>
          </template>
        </n-button>
      </div>
      <div v-if="connectionState.state !== 'connected'" class="openclaw-view__connection-hint">
        <svg class="openclaw-view__hint-icon"><use href="#alert-circle"></use></svg>
        <span>请确保 OpenClawX 已启动并运行</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useOpenClaw, ConnectionState } from '@/services/openclaw'
import ConnectionStatus from '@/components/openclaw/ConnectionStatus.vue'
import ModelSelector from '@/components/openclaw/ModelSelector.vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('OpenClawView')

interface Model {
  id: string
  name: string
  provider?: string
}

const emit = defineEmits<{
  (event: 'back'): void
  (event: 'newChat'): void
}>()

const {
  isConnected,
  isLoading,
  availableModels,
  currentModel,
  messageHistory,
  connectionState,
  connect,
  disconnect,
  sendMessage,
  setModel,
  clearHistory
} = useOpenClaw()

const inputMessage = ref('')
const contentRef = ref<HTMLElement | null>(null)

const quickActions = [
  { text: '帮我写一段代码' },
  { text: '解释一下这个概念' },
  { text: '今天有什么新闻' },
  { text: '推荐一些电影' }
]

const modelOptions = computed<Model[]>(() =>
  availableModels.value.map((model, _index) => ({
    id: model,
    name: model,
    provider: 'OpenClawX'
  }))
)

const canSend = computed(() => {
  return inputMessage.value.trim().length > 0 && isConnected.value && !isLoading.value
})

const handleBack = () => {
  emit('back')
}

const handleNewChat = () => {
  clearHistory()
  emit('newChat')
}

const handleConnect = async () => {
  try {
    await connect()
  } catch (error) {
    logger.error('连接失败:', error)
  }
}

const handleSend = async () => {
  if (!canSend.value) return
  const message = inputMessage.value.trim()
  inputMessage.value = ''
  await sendMessage(message)
  scrollToBottom()
}

const handleShiftEnter = () => {
  // Shift + Enter 换行，默认行为
}

const handleQuickAction = async (text: string) => {
  inputMessage.value = text
  await handleSend()
}

const handleModelSelect = (modelId: string) => {
  setModel(modelId)
}

const scrollToBottom = () => {
  nextTick(() => {
    if (contentRef.value) {
      contentRef.value.scrollTop = contentRef.value.scrollHeight
    }
  })
}

watch(
  messageHistory,
  () => {
    scrollToBottom()
  },
  { deep: true }
)

onMounted(async () => {
  if (!isConnected.value) {
    await handleConnect()
  }
})
</script>

<style scoped>
.openclaw-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-main);
}

.openclaw-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--hula-border-default);
  background: var(--hula-surface-elevated);
}

.openclaw-view__header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.openclaw-view__back {
  width: 20px;
  height: 20px;
  cursor: pointer;
  color: var(--hula-text-primary);
}

.openclaw-view__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--hula-text-secondary);
  margin: 0;
}

.openclaw-view__header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.openclaw-view__new-chat-icon {
  width: 14px;
  height: 14px;
}

.openclaw-view__content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.openclaw-view__welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: var(--hula-text-secondary);
}

.openclaw-view__welcome-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  color: var(--primary-color);
}

.openclaw-view__welcome-icon svg {
  width: 100%;
  height: 100%;
}

.openclaw-view__welcome h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--hula-text-secondary);
  margin: 0 0 8px 0;
}

.openclaw-view__welcome p {
  font-size: 14px;
  margin: 0 0 24px 0;
}

.openclaw-view__quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  max-width: 400px;
}

.openclaw-view__quick-action {
  padding: 8px 16px;
  background: var(--hula-surface-elevated);
  border: 1px solid var(--hula-border-default);
  border-radius: 16px;
  font-size: 13px;
  color: var(--hula-text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.openclaw-view__quick-action:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.openclaw-view__messages {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.openclaw-view__message {
  display: flex;
  gap: 12px;
  max-width: 80%;
}

.openclaw-view__message--user {
  align-self: flex-end;
  flex-direction: row;
}

.openclaw-view__message--assistant {
  align-self: flex-start;
}

.openclaw-view__message-avatar {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  color: var(--primary-color);
}

.openclaw-view__avatar-icon {
  width: 100%;
  height: 100%;
}

.openclaw-view__message-content {
  flex: 1;
  min-width: 0;
}

.openclaw-view__message-bubble {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}

.openclaw-view__message--user .openclaw-view__message-bubble {
  background: var(--primary-color);
  color: white;
  border-bottom-right-radius: 4px;
}

.openclaw-view__message--assistant .openclaw-view__message-bubble {
  background: var(--hula-surface-elevated);
  color: var(--hula-text-secondary);
  border-bottom-left-radius: 4px;
}

.openclaw-view__footer {
  padding: 12px 16px;
  border-top: 1px solid var(--hula-border-default);
  background: var(--hula-surface-elevated);
}

.openclaw-view__input-wrapper {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.openclaw-view__send-icon {
  width: 16px;
  height: 16px;
}

.openclaw-view__connection-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(245, 108, 108, 0.1);
  border-radius: 6px;
  font-size: 12px;
  color: #f56c6c;
}

.openclaw-view__hint-icon {
  width: 14px;
  height: 14px;
}
</style>
