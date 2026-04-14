<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_openclaw.title')" />
    </template>

    <template #container>
      <div class="flex flex-col h-full">
        <div class="px-16px py-8px border-b border-gray-100 flex items-center justify-between">
          <div class="flex items-center gap-8px">
            <div
              class="w-8px h-8px rounded-full"
              :class="{
                'bg-green-500': connectionState.state === 'connected',
                'bg-yellow-500': connectionState.state === 'connecting' || connectionState.state === 'reconnecting',
                'bg-red-500': connectionState.state === 'disconnected' || connectionState.state === 'error'
              }"></div>
            <span class="text-12px text-gray-500">{{ statusText }}</span>
          </div>
          <van-button v-if="connectionState.state !== 'connected'" size="mini" type="primary" @click="handleConnect">
            {{ t('mobile_openclaw.connect') }}
          </van-button>
        </div>

        <div ref="contentRef" class="flex-1 overflow-auto p-16px">
          <div v-if="messageHistory.length === 0" class="flex flex-col items-center justify-center h-full">
            <div class="w-64px h-64px rounded-full bg-primary-50 flex items-center justify-center mb-16px">
              <Icon icon="mdi:robot" :width="32" color="#13987f" />
            </div>
            <h3 class="text-16px font-medium text-gray-800 mb-8px">{{ t('mobile_openclaw.welcome_title') }}</h3>
            <p class="text-14px text-gray-500 text-center mb-24px">{{ t('mobile_openclaw.welcome_desc') }}</p>
            <div class="flex flex-wrap gap-8px justify-center max-w-300px">
              <div
                v-for="(action, index) in quickActions"
                :key="index"
                class="px-12px py-8px bg-gray-50 rounded-full text-13px text-gray-600 cursor-pointer active:bg-gray-100"
                @click="handleQuickAction(action.text)">
                {{ action.text }}
              </div>
            </div>
          </div>

          <div v-else class="flex flex-col gap-12px">
            <div
              v-for="(msg, index) in messageHistory"
              :key="index"
              class="flex gap-8px"
              :class="{
                'flex-row-reverse': msg.role === 'user'
              }">
              <div
                v-if="msg.role === 'assistant'"
                class="w-32px h-32px rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Icon icon="mdi:robot" :width="18" color="#13987f" />
              </div>
              <div
                class="max-w-75% px-12px py-8px rounded-12px text-14px leading-relaxed"
                :class="{
                  'bg-primary-500 text-white rounded-tr-4px': msg.role === 'user',
                  'bg-gray-100 text-gray-800 rounded-tl-4px': msg.role === 'assistant'
                }">
                <span class="whitespace-pre-wrap break-words">{{ msg.content }}</span>
              </div>
              <div
                v-if="msg.role === 'user'"
                class="w-32px h-32px rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                <Icon icon="mdi:account" :width="18" color="white" />
              </div>
            </div>

            <div v-if="isLoading" class="flex gap-8px">
              <div class="w-32px h-32px rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Icon icon="mdi:robot" :width="18" color="#13987f" />
              </div>
              <div class="bg-gray-100 px-12px py-8px rounded-12px rounded-tl-4px">
                <van-loading size="14px" color="#666">{{ t('mobile_openclaw.thinking') }}</van-loading>
              </div>
            </div>
          </div>
        </div>

        <div class="border-t border-gray-100 p-12px bg-white">
          <div v-if="connectionState.state !== 'connected'" class="flex items-center gap-8px px-12px py-8px bg-red-50 rounded-8px mb-8px">
            <Icon icon="mdi:alert-circle" :width="16" color="#f56c6c" />
            <span class="text-12px text-red-500">{{ t('mobile_openclaw.connection_hint') }}</span>
          </div>

          <div class="flex items-end gap-8px">
            <van-field
              v-model="inputMessage"
              type="textarea"
              :placeholder="t('mobile_openclaw.input_placeholder')"
              :autosize="{ minHeight: 36, maxHeight: 100 }"
              rows="1"
              class="flex-1 bg-gray-50 rounded-20px"
              @keydown.enter.exact.prevent="handleSend" />
            <van-button
              type="primary"
              size="small"
              round
              :disabled="!canSend"
              :loading="isLoading"
              @click="handleSend">
              <Icon icon="mdi:send" :width="18" />
            </van-button>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useOpenClaw, ConnectionState } from '@/services/openclaw'
import { useI18n } from 'vue-i18n'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileOpenClaw')

const { t } = useI18n()

const { isConnected, isLoading, messageHistory, connectionState, connect, sendMessage, clearHistory } = useOpenClaw()

const inputMessage = ref('')
const contentRef = ref<HTMLElement | null>(null)

const quickActions = [
  { text: t('mobile_openclaw.quick_code') },
  { text: t('mobile_openclaw.quick_explain') },
  { text: t('mobile_openclaw.quick_news') },
  { text: t('mobile_openclaw.quick_help') }
]

const statusText = computed(() => {
  switch (connectionState.value.state) {
    case ConnectionState.Connected:
      return t('mobile_openclaw.status_connected')
    case ConnectionState.Connecting:
      return t('mobile_openclaw.status_connecting')
    case ConnectionState.Reconnecting:
      return t('mobile_openclaw.status_reconnecting')
    case ConnectionState.Disconnected:
      return t('mobile_openclaw.status_disconnected')
    case ConnectionState.Error:
      return t('mobile_openclaw.status_error')
    default:
      return t('mobile_openclaw.status_unknown')
  }
})

const canSend = computed(() => {
  return inputMessage.value.trim().length > 0 && isConnected.value && !isLoading.value
})

async function handleConnect() {
  try {
    await connect()
  } catch (error) {
    logger.error('连接失败:', error)
  }
}

async function handleSend() {
  if (!canSend.value) return
  const message = inputMessage.value.trim()
  inputMessage.value = ''

  try {
    for await (const _chunk of sendMessage(message)) {
      scrollToBottom()
    }
  } catch (error) {
    logger.error('发送消息失败:', error)
  }

  scrollToBottom()
}

async function handleQuickAction(text: string) {
  inputMessage.value = text
  await handleSend()
}

function scrollToBottom() {
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
.max-w-75\% {
  max-width: 75%;
}
</style>
