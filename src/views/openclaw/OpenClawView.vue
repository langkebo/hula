<template>
  <div class="openclaw-view h-full flex bg-[--tjg-surface-app] font-sans">
    <!-- 未安装时显示安装引导 -->
    <OpenClawInstallGuide
      v-if="installStep !== 'ready'"
      @open-settings="handleOpenSettingsFromGuide"
      @ready="handleInstallReady" />

    <!-- 已安装时显示正常聊天界面 -->
    <template v-else>
      <!-- Sidebar for history -->
      <div
        class="w-260px flex-shrink-0 border-r border-[--tjg-border-default] bg-[--tjg-surface-panel] flex flex-col transition-all duration-300">
        <div class="p-4 border-b border-[--tjg-border-default] flex items-center justify-between">
          <button
            class="w-32px h-32px rounded-md border-none bg-transparent flex items-center justify-center cursor-pointer hover:bg-[--tjg-surface-list-hover] text-[--tjg-text-primary] transition-colors"
            @click="handleBack">
            <svg class="w-18px h-18px"><use href="#left-arrow" /></svg>
          </button>
          <n-button type="primary" size="small" @click="handleNewChat" class="ml-3 flex-1">
            <template #icon>
              <svg class="w-14px h-14px"><use href="#plus" /></svg>
            </template>
            {{ t('ai_assistant.openclaw.new_chat') }}
          </n-button>
        </div>

        <div class="flex-1 overflow-y-auto p-2 scrollbar-container">
          <div
            v-for="conv in store.conversations"
            :key="conv.id"
            class="p-3 mb-2 rounded-lg cursor-pointer transition-colors"
            :class="
              store.activeConversationId === conv.id
                ? 'bg-[--tjg-surface-list-active]'
                : 'hover:bg-[--tjg-surface-list-hover]'
            "
            @click="store.activeConversationId = conv.id">
            <div class="flex items-center justify-between group">
              <div class="truncate flex-1 text-[--tjg-text-primary] text-14px font-medium">{{ conv.title }}</div>
              <div class="hidden group-hover:flex items-center gap-1 pl-2">
                <n-popconfirm @positive-click="store.handleDeleteConversation(conv.id)">
                  <template #trigger>
                    <button
                      class="border-none bg-transparent p-1 rounded hover:bg-[--tjg-color-danger-100] cursor-pointer flex items-center justify-center">
                      <svg class="w-14px h-14px text-[--tjg-text-tertiary] hover:text-[--tjg-color-danger-500]">
                        <use href="#delete" />
                      </svg>
                    </button>
                  </template>
                  {{ t('ai_assistant.robot.confirm_delete_message') }}
                </n-popconfirm>
              </div>
            </div>
            <div class="text-12px text-[--tjg-text-tertiary] mt-1">
              {{ new Date(conv.updatedAt).toLocaleString() }}
            </div>
          </div>
        </div>
        <div class="p-3 border-t border-[--tjg-border-default]">
          <n-button quaternary block @click="showSettings = true">
            <template #icon>
              <svg class="w-16px h-16px"><use href="#setting" /></svg>
            </template>
            {{ t('ai_assistant.openclaw.settings.title') || 'Settings' }}
          </n-button>
        </div>
      </div>

      <!-- Main Chat Area -->
      <div class="flex-1 flex flex-col min-w-0 bg-[--tjg-surface-app]">
        <!-- Header -->
        <header
          class="flex items-center justify-between p-4 border-b border-[--tjg-border-default] bg-[--tjg-surface-panel] shrink-0">
          <div class="flex items-center gap-2">
            <div
              class="w-28px h-28px rounded bg-[--tjg-color-primary-100] text-[--tjg-color-primary-500] flex items-center justify-center">
              <svg class="w-16px h-16px"><use href="#robot" /></svg>
            </div>
            <h2 class="text-16px font-semibold text-[--tjg-text-primary] m-0 truncate">
              {{ store.currentConversation?.title || t('ai_assistant.openclaw.title') }}
            </h2>
            <n-tag v-if="settingsStore.selectedModel" size="small" type="info" :bordered="false" class="ml-2">
              {{ settingsStore.selectedModel }}
            </n-tag>
          </div>
        </header>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4 scrollbar-container" ref="contentRef">
          <!-- Welcome -->
          <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full text-center">
            <div
              class="w-72px h-72px mb-4 text-[--tjg-color-primary-500] bg-[--tjg-color-primary-100] rounded-2xl flex items-center justify-center shadow-sm">
              <svg class="w-40px h-40px"><use href="#robot" /></svg>
            </div>
            <h3 class="text-20px font-semibold text-[--tjg-text-primary] mb-2">
              {{ t('ai_assistant.openclaw.title') }}
            </h3>
            <p class="text-14px text-[--tjg-text-tertiary] mb-6 max-w-md leading-relaxed">
              {{ t('ai_assistant.openclaw.welcome') }}
            </p>
            <div class="flex flex-wrap gap-2 justify-center max-w-420px">
              <button
                v-for="(action, index) in quickActions"
                :key="index"
                class="px-4 py-2 bg-[--tjg-surface-panel] border border-[--tjg-border-default] rounded-full text-14px text-[--tjg-text-secondary] cursor-pointer hover:border-[--tjg-color-primary-500] hover:text-[--tjg-color-primary-500] hover:bg-[--tjg-color-primary-100] transition-colors"
                @click="handleQuickAction(action)">
                {{ action }}
              </button>
            </div>
          </div>

          <!-- Messages -->
          <div v-else class="flex flex-col gap-6">
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="flex gap-3 max-w-[85%]"
              :class="msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'">
              <div class="flex-shrink-0 mt-1">
                <div
                  v-if="msg.role === 'assistant'"
                  class="w-36px h-36px rounded-lg bg-[--tjg-color-primary-100] text-[--tjg-color-primary-500] flex items-center justify-center shadow-sm">
                  <svg class="w-20px h-20px"><use href="#robot" /></svg>
                </div>
                <div
                  v-else
                  class="w-36px h-36px rounded-lg bg-[--tjg-surface-subtle] text-[--tjg-text-tertiary] flex items-center justify-center shadow-sm">
                  <svg class="w-20px h-20px"><use href="#user" /></svg>
                </div>
              </div>

              <div class="flex-1 min-w-0 flex flex-col" :class="msg.role === 'user' ? 'items-end' : 'items-start'">
                <div class="text-12px text-[--tjg-text-tertiary] mb-1 px-1">
                  {{ msg.role === 'user' ? t('ai_assistant.robot.me') : settingsStore.selectedModel || 'AI' }}
                </div>

                <!-- Reasoning -->
                <div
                  v-if="msg.role === 'assistant' && msg.reasoningContent"
                  class="mb-2 w-full rounded-lg bg-[--tjg-surface-panel-muted] border border-[--tjg-border-muted] overflow-hidden">
                  <button
                    class="flex items-center gap-2 w-full p-2.5 border-none bg-transparent text-[--tjg-text-tertiary] text-13px cursor-pointer hover:text-[--tjg-text-secondary] transition-colors"
                    @click="toggleReasoning(msg.id)">
                    <svg class="w-16px h-16px text-[--tjg-color-info-500]"><use href="#lightbulb" /></svg>
                    <span class="font-medium">{{ t('ai_assistant.openclaw.reasoning') }}</span>
                    <svg
                      class="w-14px h-14px ml-auto transition-transform duration-200"
                      :class="{ 'rotate-90': isReasoningExpanded(msg.id) }">
                      <use href="#right-arrow" />
                    </svg>
                  </button>
                  <div v-if="isReasoningExpanded(msg.id)" class="px-3 pb-3 text-13px text-[--tjg-text-tertiary]">
                    <MarkdownRender :content="msg.reasoningContent" :is-dark="isDarkTheme" :enable-monaco="false" />
                  </div>
                </div>

                <!-- Bubble -->
                <div
                  class="p-3 rounded-xl text-14px leading-relaxed break-words"
                  :class="
                    msg.role === 'user'
                      ? 'bg-[--chat-right-bg] text-[--tjg-text-primary] rounded-tr-sm'
                      : 'bg-[--chat-left-bg] text-[--tjg-text-primary] rounded-tl-sm border border-[--tjg-border-default]'
                  ">
                  <MarkdownRender
                    v-if="msg.role === 'assistant'"
                    :content="msg.content || (msg.status === 'streaming' ? '' : '...')"
                    :is-dark="isDarkTheme"
                    :enable-monaco="false" />
                  <span v-else class="whitespace-pre-wrap">{{ msg.content }}</span>
                  <span
                    v-if="msg.status === 'streaming'"
                    class="inline-block w-2px h-[1em] bg-[--tjg-color-primary-500] ml-[2px] align-text-bottom animate-pulse" />
                </div>

                <!-- Error -->
                <div
                  v-if="msg.status === 'error'"
                  class="flex items-center gap-2 mt-2 p-2.5 rounded-lg bg-[--tjg-color-danger-100] text-[--tjg-color-danger-500] text-13px w-full border border-[--tjg-color-danger-200]">
                  <svg class="w-16px h-16px shrink-0"><use href="#warning" /></svg>
                  <span class="flex-1">{{ msg.errorMessage || t('ai_assistant.openclaw.error_default') }}</span>
                  <button
                    class="shrink-0 px-3 py-1 border border-[--tjg-color-danger-500] rounded-md bg-transparent text-[--tjg-color-danger-500] text-12px cursor-pointer hover:bg-[--tjg-color-danger-500] hover:text-white transition-colors"
                    @click="handleRetry(msg)">
                    {{ t('ai_assistant.openclaw.retry') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Input -->
        <footer class="p-4 border-t border-[--tjg-border-default] bg-[--tjg-surface-panel] shrink-0">
          <div class="flex gap-3 items-end max-w-4xl mx-auto w-full relative">
            <n-input
              v-model:value="store.inputMessage"
              type="textarea"
              :placeholder="t('ai_assistant.openclaw.input_placeholder')"
              :autosize="{ minRows: 1, maxRows: 6 }"
              :disabled="store.isSending"
              @keydown="handleKeyDown"
              class="flex-1" />
            <n-button
              type="primary"
              :disabled="!store.canSend"
              :loading="store.isSending"
              @click="handleSend"
              class="shrink-0 mb-1"
              circle>
              <template #icon>
                <svg v-if="!store.isSending" class="w-18px h-18px"><use href="#send" /></svg>
              </template>
            </n-button>
          </div>
          <div class="text-12px text-[--tjg-text-tertiary] mt-3 text-center">OpenClaw UI Enhanced Edition</div>
        </footer>
      </div>

      <!-- Settings Modal -->
      <OpenClawSettings v-model:show="showSettings" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOpenClawInstaller } from '@/composables/openclaw/useOpenClawInstaller'
import { ThemeEnum } from '@/enums'
import { useOpenClawConversationStore } from '@/stores/domains/chat/openClawConversation'
import { useRobotChatSettingsStore } from '@/stores/domains/chat/robotChatSettings'
import { useSettingStore } from '@/stores/domains/settings/setting'
import OpenClawInstallGuide from './components/OpenClawInstallGuide.vue'
import OpenClawSettings from './components/OpenClawSettings.vue'
import type { OpenClawWorkbenchMessage } from './types'

const MarkdownRender = defineAsyncComponent(async () => {
  const { initMarkdownRenderer } = await import('@/plugins/robot/utils/markdown')
  await initMarkdownRenderer()
  await import('markstream-vue/index.css')
  const mod = await import('markstream-vue')
  return mod.default
})

const { t } = useI18n()

const emit = defineEmits<(event: 'back') => void>()

const store = useOpenClawConversationStore()
const settingsStore = useRobotChatSettingsStore()
const appSettingStore = useSettingStore()
const { step: installStep, checkInstallation } = useOpenClawInstaller()

const contentRef = ref<HTMLElement | null>(null)
const showSettings = ref(false)

const quickActions = [
  t('ai_assistant.openclaw.quick_action.code'),
  t('ai_assistant.openclaw.quick_action.explain'),
  t('ai_assistant.openclaw.quick_action.news'),
  t('ai_assistant.openclaw.quick_action.movie')
]

const messages = computed(() => store.currentConversation?.messages ?? [])

const isDarkTheme = computed(() => {
  const content = appSettingStore.themeContent
  if (!content) {
    return document.documentElement.dataset.theme === ThemeEnum.DARK
  }
  return content === ThemeEnum.DARK
})

const isReasoningExpanded = (msgId: string) => {
  return store.expandedReasoningIds.includes(msgId)
}

const toggleReasoning = (msgId: string) => {
  store.toggleReasoning(msgId)
}

const handleBack = () => {
  emit('back')
}

const handleOpenSettingsFromGuide = () => {
  showSettings.value = true
}

const handleInstallReady = () => {
  // 安装完成，installStep 已变为 'ready'，界面自动切换到聊天模式
  store.ensureConversation()
}

const handleNewChat = () => {
  store.handleCreateConversation()
  scrollToBottom()
}

const handleKeyDown = (e: KeyboardEvent) => {
  const sendKey = settingsStore.sendKey

  if (e.key === 'Enter' && !e.isComposing) {
    if (sendKey === 'Enter') {
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        handleSend()
      }
    } else if (sendKey === 'Ctrl+Enter') {
      if (e.ctrlKey) {
        e.preventDefault()
        handleSend()
      }
    } else if (sendKey === 'Cmd+Enter') {
      if (e.metaKey) {
        e.preventDefault()
        handleSend()
      }
    }
  }
}

const handleSend = async () => {
  if (!store.canSend) return
  const content = store.inputMessage.trim()
  store.inputMessage = ''

  const conversation = store.currentConversation
  if (!conversation) {
    store.handleCreateConversation()
  }

  store.updateCurrentConversation((conv) => {
    conv.messages.push({
      id: store.createId(),
      role: 'user',
      content,
      createdAt: Date.now(),
      status: 'done'
    })
    if (conv.messages.length === 1 && settingsStore.autoGenerateTitle) {
      conv.title = store.buildConversationTitle(content)
    }
  })

  scrollToBottom()
  await fetchAIStream(store.activeConversationId, content)
}

const handleQuickAction = (text: string) => {
  store.inputMessage = text
  handleSend()
}

const handleRetry = async (msg: OpenClawWorkbenchMessage) => {
  if (msg.role === 'assistant' && msg.errorMessage) {
    let prevUserMsgContent = ''
    store.updateCurrentConversation((conv) => {
      const idx = conv.messages.findIndex((m) => m.id === msg.id)
      if (idx !== -1) {
        const prevMsg = conv.messages[idx - 1]
        if (prevMsg && prevMsg.role === 'user') {
          prevUserMsgContent = prevMsg.content
        }
        conv.messages.splice(idx, 1)
      }
    })

    if (prevUserMsgContent) {
      await fetchAIStream(store.activeConversationId, prevUserMsgContent, true)
    }
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    if (contentRef.value) {
      contentRef.value.scrollTo({ top: contentRef.value.scrollHeight, behavior: 'smooth' })
    }
  })
}

watch(
  () => messages.value.length,
  () => {
    scrollToBottom()
  }
)

onMounted(async () => {
  const result = await checkInstallation()
  if (result.installed) {
    store.ensureConversation()
    scrollToBottom()
  }
})

const fetchAIStream = async (conversationId: string, userMessageContent: string, isRetry = false) => {
  store.isSending = true
  const assistantMsgId = store.createId()

  store.updateCurrentConversation((conv) => {
    conv.messages.push({
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      reasoningContent: '',
      createdAt: Date.now(),
      status: 'streaming'
    })
  })
  scrollToBottom()

  try {
    const settings = settingsStore
    if (!settings.apiEndpoint) throw new Error(t('ai_assistant.openclaw.error_no_endpoint'))
    if (!settings.apiKey) throw new Error(t('ai_assistant.openclaw.error_no_key'))

    const conv = store.conversations.find((c) => c.id === conversationId)
    if (!conv) return

    let history: { role: string; content: string }[] = []

    if (settings.historyMessageCount > 0) {
      history = conv.messages
        .filter((m) => m.status === 'done' && m.id !== assistantMsgId && (m.role as string) !== 'system')
        .slice(-(settings.historyMessageCount * 2))
        .map((m) => ({ role: m.role, content: m.content }))
    }

    if (isRetry) {
      history.pop()
    }

    const messagesPayload = []

    if (settings.injectSystemPrompt && settings.userInputPreprocess) {
      messagesPayload.push({
        role: 'system',
        content: settings.userInputPreprocess
      })
    }

    messagesPayload.push(...history)
    messagesPayload.push({ role: 'user', content: userMessageContent })

    const response = await fetch(`${settings.apiEndpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.selectedModel || 'gpt-3.5-turbo',
        messages: messagesPayload,
        temperature: settings.randomness / 10,
        top_p: settings.topP / 10,
        max_tokens: settings.maxTokens,
        presence_penalty: settings.presencePenalty / 10,
        frequency_penalty: settings.frequencyPenalty / 10,
        stream: true
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error: ${response.status} ${errorText}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    if (!reader) throw new Error('No reader')

    let done = false
    while (!done) {
      const { value, done: readerDone } = await reader.read()
      done = readerDone
      if (value) {
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter((line) => line.trim() !== '')
        for (const line of lines) {
          if (line === 'data: [DONE]') continue
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              const delta = data.choices[0]?.delta
              if (delta) {
                store.updateCurrentConversation((c) => {
                  const msg = c.messages.find((m) => m.id === assistantMsgId)
                  if (msg) {
                    if (delta.content) msg.content += delta.content
                    if (delta.reasoning_content) {
                      msg.reasoningContent = (msg.reasoningContent || '') + delta.reasoning_content
                      if (!store.expandedReasoningIds.includes(msg.id)) {
                        store.expandedReasoningIds.push(msg.id)
                      }
                    }
                  }
                })
                scrollToBottom()
              }
            } catch (e) {}
          }
        }
      }
    }

    store.updateCurrentConversation((c) => {
      const msg = c.messages.find((m) => m.id === assistantMsgId)
      if (msg) msg.status = 'done'
    })
  } catch (err: unknown) {
    const error = err as Error & { message?: string }
    store.updateCurrentConversation((c) => {
      const msg = c.messages.find((m) => m.id === assistantMsgId)
      if (msg) {
        msg.status = 'error'
        msg.errorMessage = error.message
      }
    })
  } finally {
    store.isSending = false
  }
}
</script>

<style scoped>
.scrollbar-container::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.scrollbar-container::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--tjg-text-tertiary) 30%, transparent);
  border-radius: 3px;
}
.scrollbar-container::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--tjg-text-tertiary) 50%, transparent);
}
.word-break {
  word-break: break-word;
}
</style>
