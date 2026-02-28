<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        class="bg-white"
        style="border-bottom: 1px solid; border-color: #dfdfdf"
        :hidden-right="true"
        :room-name="t('ai_assistant.title')" />
    </template>

    <template #container>
      <div class="bg-cover bg-center flex flex-col overflow-hidden h-full">
        <div class="flex flex-col flex-1 overflow-hidden">
          <div ref="chatContainerRef" class="flex-1 overflow-y-auto p-16px">
            <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full gap-16px">
              <div
                class="w-80px h-80px rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center">
                <Icon icon="mdi:robot" :width="40" color="#fff" />
              </div>
              <div class="text-16px font-bold text-gray-800">{{ t('ai_assistant.welcome') }}</div>
              <div class="text-14px text-gray-500 text-center px-20px">
                {{ t('ai_assistant.welcome_desc') }}
              </div>

              <div class="grid grid-cols-2 gap-12px w-full px-16px mt-16px">
                <div
                  v-for="suggestion in suggestions"
                  :key="suggestion.id"
                  class="bg-white rounded-12px p-12px shadow-sm border border-gray-100 active:bg-gray-50"
                  @click="handleSuggestionClick(suggestion)">
                  <div class="flex items-center gap-8px mb-8px">
                    <Icon :icon="suggestion.icon" :width="18" :color="suggestion.color" />
                    <span class="text-14px font-medium">{{ suggestion.title }}</span>
                  </div>
                  <div class="text-12px text-gray-500">{{ suggestion.desc }}</div>
                </div>
              </div>
            </div>

            <div v-else class="flex flex-col gap-16px">
              <div
                v-for="(message, index) in messages"
                :key="index"
                :class="['flex gap-12px', message.role === 'user' ? 'flex-row-reverse' : 'flex-row']">
                <div
                  :class="[
                    'w-36px h-36px rounded-full flex items-center justify-center flex-shrink-0',
                    message.role === 'user' ? 'bg-blue-500' : 'bg-gradient-to-br from-purple-400 to-blue-500'
                  ]">
                  <Icon :icon="message.role === 'user' ? 'mdi:account' : 'mdi:robot'" :width="20" color="#fff" />
                </div>
                <div
                  :class="[
                    'max-w-75% rounded-16px p-12px text-14px',
                    message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white border border-gray-100 text-gray-800'
                  ]">
                  <div v-if="message.loading" class="flex items-center gap-8px">
                    <van-loading size="14" />
                    <span>{{ t('ai_assistant.thinking') }}</span>
                  </div>
                  <div v-else class="whitespace-pre-wrap">{{ message.content }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex-shrink-0 border-t border-gray-100 bg-white p-12px">
            <div class="flex items-center gap-12px">
              <van-field
                v-model="inputText"
                :placeholder="t('ai_assistant.input_placeholder')"
                autosize
                type="textarea"
                rows="1"
                class="flex-1 bg-gray-50 rounded-20px"
                @keydown.enter.prevent="handleSend" />
              <van-button
                type="primary"
                size="small"
                round
                :disabled="!inputText.trim() || isGenerating"
                :loading="isGenerating"
                @click="handleSend">
                <Icon icon="mdi:send" :width="18" />
              </van-button>
            </div>

            <div class="flex items-center gap-8px mt-12px overflow-x-auto">
              <van-tag
                v-for="model in aiModels"
                :key="model.id"
                :type="selectedModel === model.id ? 'primary' : 'default'"
                round
                size="medium"
                class="flex-shrink-0"
                @click="selectedModel = model.id">
                {{ model.name }}
              </van-tag>
            </div>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Message {
  role: 'user' | 'assistant'
  content: string
  loading?: boolean
}

const messages = ref<Message[]>([])
const inputText = ref('')
const isGenerating = ref(false)
const selectedModel = ref('deepseek-chat')
const chatContainerRef = ref<HTMLElement | null>(null)

const aiModels = [
  { id: 'deepseek-chat', name: 'DeepSeek' },
  { id: 'qwen-plus', name: '通义千问' },
  { id: 'gpt-4', name: 'GPT-4' }
]

const suggestions = [
  {
    id: 1,
    title: t('ai_assistant.suggestions.translate'),
    desc: t('ai_assistant.suggestions.translate_desc'),
    icon: 'mdi:translate',
    color: '#1989fa',
    prompt: t('ai_assistant.suggestions.translate_prompt')
  },
  {
    id: 2,
    title: t('ai_assistant.suggestions.summarize'),
    desc: t('ai_assistant.suggestions.summarize_desc'),
    icon: 'mdi:text-box-outline',
    color: '#52c41a',
    prompt: t('ai_assistant.suggestions.summarize_prompt')
  },
  {
    id: 3,
    title: t('ai_assistant.suggestions.code'),
    desc: t('ai_assistant.suggestions.code_desc'),
    icon: 'mdi:code-tags',
    color: '#722ed1',
    prompt: t('ai_assistant.suggestions.code_prompt')
  },
  {
    id: 4,
    title: t('ai_assistant.suggestions.chat'),
    desc: t('ai_assistant.suggestions.chat_desc'),
    icon: 'mdi:chat-outline',
    color: '#fa8c16',
    prompt: t('ai_assistant.suggestions.chat_prompt')
  }
]

function scrollToBottom() {
  nextTick(() => {
    if (chatContainerRef.value) {
      chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight
    }
  })
}

function handleSuggestionClick(suggestion: (typeof suggestions)[0]) {
  inputText.value = suggestion.prompt
  handleSend()
}

async function handleSend() {
  const text = inputText.value.trim()
  if (!text || isGenerating.value) return

  messages.value.push({
    role: 'user',
    content: text
  })

  inputText.value = ''
  scrollToBottom()

  isGenerating.value = true
  messages.value.push({
    role: 'assistant',
    content: '',
    loading: true
  })
  scrollToBottom()

  try {
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const response = generateMockResponse(text)

    messages.value[messages.value.length - 1] = {
      role: 'assistant',
      content: response,
      loading: false
    }
  } catch (error) {
    messages.value[messages.value.length - 1] = {
      role: 'assistant',
      content: t('ai_assistant.error'),
      loading: false
    }
  } finally {
    isGenerating.value = false
    scrollToBottom()
  }
}

function generateMockResponse(input: string): string {
  if (input.includes(t('ai_assistant.suggestions.translate'))) {
    return t('ai_assistant.mock.translate_response')
  }
  if (input.includes(t('ai_assistant.suggestions.summarize'))) {
    return t('ai_assistant.mock.summarize_response')
  }
  if (input.includes(t('ai_assistant.suggestions.code'))) {
    return t('ai_assistant.mock.code_response')
  }
  return t('ai_assistant.mock.default_response')
}
</script>

<style lang="scss" scoped>
.max-w-75\% {
  max-width: 75%;
}
</style>
