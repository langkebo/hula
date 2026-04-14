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
          <!-- 连接状态栏 -->
          <div class="flex-shrink-0 bg-white border-b border-gray-100 px-12px py-8px">
            <van-cell-group inset>
              <van-cell center>
                <template #title>
                  <div class="flex items-center gap-8px">
                    <span class="text-14px">{{ t('ai_assistant.provider') }}</span>
                    <van-tag :type="connectionStatusTagType" size="medium">
                      {{ connectionStatusText }}
                    </van-tag>
                  </div>
                </template>
                <template #value>
                  <van-picker v-model="selectedProviderArray" :columns="providerColumns" @change="handleProviderChange" />
                </template>
              </van-cell>
            </van-cell-group>
          </div>

          <!-- AI 模型选择栏 -->
          <div class="flex-shrink-0 bg-white border-b border-gray-100 px-12px py-8px overflow-x-auto">
            <div class="flex items-center gap-8px">
              <van-tag
                v-for="model in filteredModels"
                :key="model.id"
                :type="selectedModel?.id === model.id ? 'primary' : 'default'"
                size="medium"
                round
                class="flex-shrink-0"
                @click="handleModelSelect(model)">
                {{ model.name }}
              </van-tag>
              <van-loading v-if="loadingModels" size="16" class="flex-shrink-0" />
            </div>
          </div>

          <!-- 角色预设选择栏 -->
          <div v-if="characters.length > 0" class="flex-shrink-0 bg-gray-50 px-12px py-8px overflow-x-auto">
            <div class="flex items-center gap-8px">
              <span class="text-12px text-gray-500 flex-shrink-0">{{ t('ai_assistant.character') }}:</span>
              <van-tag
                v-for="char in characters"
                :key="char.id"
                :type="selectedCharacter?.id === char.id ? 'success' : 'default'"
                size="medium"
                round
                class="flex-shrink-0"
                @click="handleCharacterSelect(char)">
                {{ char.name }}
              </van-tag>
            </div>
          </div>

          <!-- 聊天消息区域 -->
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
                  <div v-else-if="message.error" class="text-red-500">
                    {{ message.content }}
                  </div>
                  <div v-else class="whitespace-pre-wrap">{{ message.content }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 输入区域 -->
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
                :disabled="!inputText.trim() || isGenerating || !isConnected"
                :loading="isGenerating"
                @click="handleSend">
                <Icon icon="mdi:send" :width="18" />
              </van-button>
            </div>

            <!-- API Key 管理入口 -->
            <div class="flex items-center justify-between mt-8px">
              <span class="text-12px text-gray-500">
                {{ providerDisplayName }}
              </span>
              <span class="text-12px text-gray-400 cursor-pointer" @click="showApiKeySettings = true">
                {{ t('ai_assistant.settings') }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- API Key 设置弹出层 -->
    <van-popup v-model:show="showApiKeySettings" position="bottom" round :style="{ height: '50%' }">
      <div class="p-16px">
        <div class="text-16px font-bold mb-16px">{{ t('ai_assistant.api_key_settings') }}</div>
        <van-cell-group inset>
          <van-field
            v-model="apiKeySettings.baseUrl"
            :label="t('ai_assistant.base_url')"
            :placeholder="t('ai_assistant.base_url_placeholder')"
            @blur="saveApiKeySettings" />
          <van-field
            v-model="apiKeySettings.apiKey"
            :label="t('ai_assistant.api_key')"
            type="password"
            :placeholder="t('ai_assistant.api_key_placeholder')"
            @blur="saveApiKeySettings" />
        </van-cell-group>
        <van-button type="primary" block class="mt-16px" @click="testConnection">
          {{ t('ai_assistant.test_connection') }}
        </van-button>
      </div>
    </van-popup>

    <!-- 角色预设设置弹出层 -->
    <van-popup v-model:show="showCharacterSettings" position="bottom" round :style="{ height: '60%' }">
      <div class="p-16px h-full flex flex-col">
        <div class="flex items-center justify-between mb-16px">
          <div class="text-16px font-bold">{{ t('ai_assistant.character_management') }}</div>
          <van-button size="small" type="primary" @click="showAddCharacter = true">
            {{ t('ai_assistant.add_character') }}
          </van-button>
        </div>
        <van-cell-group inset class="flex-1 overflow-y-auto">
          <van-cell
            v-for="char in characters"
            :key="char.id"
            :label="char.description"
            @click="handleCharacterSelect(char)">
            <template #title>
              <span>{{ char.name }}</span>
            </template>
            <template #right-icon>
              <van-icon name="edit" class="mr-8px" @click.stop="editCharacter(char)" />
              <van-icon name="delete" @click.stop="deleteCharacter(char.id)" />
            </template>
          </van-cell>
          <van-empty v-if="characters.length === 0" :description="t('ai_assistant.no_characters')" />
        </van-cell-group>
      </div>
    </van-popup>

    <!-- 添加/编辑角色弹出层 -->
    <van-popup v-model:show="showAddCharacter" position="bottom" round :style="{ height: '70%' }">
      <div class="p-16px h-full flex flex-col">
        <div class="text-16px font-bold mb-16px">
          {{ editingCharacter ? t('ai_assistant.edit_character') : t('ai_assistant.add_character') }}
        </div>
        <van-cell-group inset class="flex-1">
          <van-field
            v-model="characterForm.name"
            :label="t('ai_assistant.character_name')"
            :placeholder="t('ai_assistant.character_name_placeholder')" />
          <van-field
            v-model="characterForm.description"
            :label="t('ai_assistant.character_desc')"
            type="textarea"
            rows="2"
            :placeholder="t('ai_assistant.character_desc_placeholder')" />
          <van-field
            v-model="characterForm.systemPrompt"
            :label="t('ai_assistant.character_prompt')"
            type="textarea"
            rows="4"
            :placeholder="t('ai_assistant.character_prompt_placeholder')" />
        </van-cell-group>
        <van-button type="primary" block class="mt-16px" @click="saveCharacter">
          {{ t('ai_assistant.save_character') }}
        </van-button>
      </div>
    </van-popup>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { showToast } from 'vant'
import { useI18n } from 'vue-i18n'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AiAssistant')

const { t } = useI18n()

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  loading?: boolean
  error?: boolean
  timestamp: number
}

interface AIModel {
  id: string
  name: string
  provider: string
}

interface AICharacter {
  id: string
  name: string
  description: string
  systemPrompt: string
}

interface LocalConversation {
  id: string
  title: string
  provider: string
  modelId: string
  characterId?: string
  createdAt: number
  updatedAt: number
}

type AIProvider = 'openclaw' | 'siliconflow'

const messages = ref<Message[]>([])
const inputText = ref('')
const isGenerating = ref(false)
const chatContainerRef = ref<HTMLElement | null>(null)
const currentConversationId = ref<string | null>(null)
const conversations = ref<LocalConversation[]>([])

const openclawModels: AIModel[] = [
  { id: 'gpt-4', name: 'GPT-4', provider: 'openclaw' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openclaw' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openclaw' },
  { id: 'claude-3-opus', name: 'Claude-3 Opus', provider: 'openclaw' },
  { id: 'claude-3-sonnet', name: 'Claude-3 Sonnet', provider: 'openclaw' },
  { id: 'claude-3-haiku', name: 'Claude-3 Haiku', provider: 'openclaw' }
]

const siliconflowModels: AIModel[] = [
  { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen2.5-72B', provider: 'siliconflow' },
  { id: 'deepseek-ai/DeepSeek-V2.5', name: 'DeepSeek V2.5', provider: 'siliconflow' },
  { id: 'THUDM/GLM-4-9B-Chat', name: 'GLM-4-9B', provider: 'siliconflow' },
  { id: 'internlm/internlm2_5-7b-chat', name: 'InternLM2.5-7B', provider: 'siliconflow' },
  { id: 'microsoft Phi-3-medium-4k-instruct', name: 'Phi-3 Medium', provider: 'siliconflow' }
]

const selectedProvider = ref<AIProvider>('openclaw')
const selectedProviderArray = computed({
  get: () => [selectedProvider.value],
  set: (val: string[]) => {
    if (val.length > 0) {
      selectedProvider.value = val[0] as AIProvider
    }
  }
})
const selectedModel = ref<AIModel | null>(null)
const loadingModels = ref(false)

const characters = ref<AICharacter[]>([])
const selectedCharacter = ref<AICharacter | null>(null)
const showCharacterSettings = ref(false)
const showAddCharacter = ref(false)
const editingCharacter = ref<AICharacter | null>(null)
const characterForm = ref({
  name: '',
  description: '',
  systemPrompt: ''
})

const showApiKeySettings = ref(false)
const apiKeySettings = ref({
  baseUrl: '',
  apiKey: ''
})

const isConnected = computed(() => {
  if (!apiKeySettings.value.baseUrl || !apiKeySettings.value.apiKey) {
    return false
  }
  return true
})

const providerDisplayName = computed(() => {
  if (selectedProvider.value === 'openclaw') return 'OpenClaw'
  return 'SiliconFlow'
})

const connectionStatusTagType = computed(() => {
  if (isGenerating.value) return 'warning'
  if (isConnected.value) return 'success'
  return 'danger'
})

const connectionStatusText = computed(() => {
  if (isGenerating.value) return t('ai_assistant.status.connecting')
  if (isConnected.value) return t('ai_assistant.status.connected')
  return t('ai_assistant.status.disconnected')
})

const providerColumns: { text: string; value: string }[] = [
  { text: 'OpenClaw', value: 'openclaw' },
  { text: 'SiliconFlow', value: 'siliconflow' }
]

const filteredModels = computed(() => {
  if (selectedProvider.value === 'openclaw') {
    return openclawModels
  }
  return siliconflowModels
})

const suggestions = [
  {
    id: 1,
    title: 'ai_assistant.suggestions.translate',
    desc: 'ai_assistant.suggestions.translate_desc',
    icon: 'mdi:translate',
    color: '#1989fa',
    prompt: '请帮我翻译以下内容：'
  },
  {
    id: 2,
    title: 'ai_assistant.suggestions.summarize',
    desc: 'ai_assistant.suggestions.summarize_desc',
    icon: 'mdi:text-box-outline',
    color: '#52c41a',
    prompt: '请帮我总结以下内容：'
  },
  {
    id: 3,
    title: 'ai_assistant.suggestions.code',
    desc: 'ai_assistant.suggestions.code_desc',
    icon: 'mdi:code-tags',
    color: '#722ed1',
    prompt: '请帮我解释以下代码：'
  },
  {
    id: 4,
    title: 'ai_assistant.suggestions.chat',
    desc: 'ai_assistant.suggestions.chat_desc',
    icon: 'mdi:chat-outline',
    color: '#fa8c16',
    prompt: '你好，我想和你聊聊'
  }
]

function scrollToBottom() {
  nextTick(() => {
    if (chatContainerRef.value) {
      chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight
    }
  })
}

function loadModels() {
  loadingModels.value = true
  try {
    if (filteredModels.value.length > 0 && !selectedModel.value) {
      selectedModel.value = filteredModels.value[0]
    }
  } finally {
    loadingModels.value = false
  }
}

function loadCharacters() {
  try {
    const stored = localStorage.getItem('ai_characters')
    if (stored) {
      characters.value = JSON.parse(stored)
    } else {
      characters.value = []
    }
  } catch (err) {
    logger.error('加载角色列表失败:', err)
    characters.value = []
  }
}

function loadConversations() {
  try {
    const stored = localStorage.getItem('ai_conversations')
    if (stored) {
      conversations.value = JSON.parse(stored)
      if (conversations.value.length > 0) {
        currentConversationId.value = conversations.value[0].id
        loadMessages(conversations.value[0].id)
      }
    }
  } catch (err) {
    logger.error('加载对话列表失败:', err)
    conversations.value = []
  }
}

function loadMessages(conversationId: string) {
  try {
    const stored = localStorage.getItem(`ai_messages_${conversationId}`)
    if (stored) {
      messages.value = JSON.parse(stored)
      scrollToBottom()
    } else {
      messages.value = []
    }
  } catch (err) {
    logger.error('加载消息列表失败:', err)
    messages.value = []
  }
}

function createNewConversation(): string {
  const id = `conv_${Date.now()}`
  const conversation: LocalConversation = {
    id,
    title: '新的对话',
    provider: selectedProvider.value,
    modelId: selectedModel.value?.id || '',
    characterId: selectedCharacter.value?.id,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  conversations.value.unshift(conversation)
  currentConversationId.value = id
  saveConversations()
  return id
}

function saveConversations() {
  localStorage.setItem('ai_conversations', JSON.stringify(conversations.value))
}

function saveMessages(conversationId: string) {
  localStorage.setItem(`ai_messages_${conversationId}`, JSON.stringify(messages.value))
}

function handleProviderChange({ selectedOptions }: any) {
  selectedProvider.value = selectedOptions[0].value
  selectedModel.value = filteredModels.value[0] || null
  saveProviderSettings()
  loadModels()
}

function handleModelSelect(model: AIModel) {
  selectedModel.value = model
}

function handleCharacterSelect(char: AICharacter) {
  selectedCharacter.value = char
  showCharacterSettings.value = false
}

function editCharacter(char: AICharacter) {
  editingCharacter.value = char
  characterForm.value = {
    name: char.name,
    description: char.description,
    systemPrompt: char.systemPrompt
  }
  showAddCharacter.value = true
}

async function deleteCharacter(id: string) {
  try {
    characters.value = characters.value.filter((c) => c.id !== id)
    localStorage.setItem('ai_characters', JSON.stringify(characters.value))
    if (selectedCharacter.value?.id === id) {
      selectedCharacter.value = null
    }
    showToast(t('ai_assistant.character_deleted'))
  } catch (err) {
    logger.error('删除角色失败:', err)
  }
}

async function saveCharacter() {
  if (!characterForm.value.name.trim()) {
    showToast(t('ai_assistant.character_name_required'))
    return
  }
  try {
    if (editingCharacter.value) {
      const index = characters.value.findIndex((c) => c.id === editingCharacter.value!.id)
      if (index !== -1) {
        characters.value[index] = {
          ...characters.value[index],
          name: characterForm.value.name,
          description: characterForm.value.description,
          systemPrompt: characterForm.value.systemPrompt
        }
      }
    } else {
      const newCharacter: AICharacter = {
        id: `char_${Date.now()}`,
        name: characterForm.value.name,
        description: characterForm.value.description,
        systemPrompt: characterForm.value.systemPrompt
      }
      characters.value.push(newCharacter)
    }
    localStorage.setItem('ai_characters', JSON.stringify(characters.value))
    showAddCharacter.value = false
    editingCharacter.value = null
    characterForm.value = { name: '', description: '', systemPrompt: '' }
  } catch (err) {
    logger.error('保存角色失败:', err)
  }
}

function saveApiKeySettings() {
  localStorage.setItem('ai_api_settings', JSON.stringify(apiKeySettings.value))
}

function loadApiKeySettings() {
  try {
    const stored = localStorage.getItem('ai_api_settings')
    if (stored) {
      apiKeySettings.value = JSON.parse(stored)
    }
  } catch (e) {
    logger.warn('加载 API 设置失败:', e)
  }
}

function saveProviderSettings() {
  localStorage.setItem('ai_provider', selectedProvider.value)
}

function loadProviderSettings() {
  try {
    const stored = localStorage.getItem('ai_provider')
    if (stored) {
      selectedProvider.value = stored as AIProvider
    }
  } catch (e) {
    logger.warn('加载 Provider 设置失败:', e)
  }
}

async function testConnection() {
  if (!apiKeySettings.value.baseUrl || !apiKeySettings.value.apiKey) {
    showToast(t('ai_assistant.base_url_required'))
    return
  }
  try {
    const response = await fetch(`${apiKeySettings.value.baseUrl}/v1/models`, {
      headers: {
        Authorization: `Bearer ${apiKeySettings.value.apiKey}`
      }
    })
    if (response.ok) {
      showToast(t('ai_assistant.connection_success'))
      showApiKeySettings.value = false
    } else {
      showToast(t('ai_assistant.connection_failed'))
    }
  } catch (err) {
    logger.error('测试连接失败:', err)
    showToast(t('ai_assistant.connection_failed'))
  }
}

function handleSuggestionClick(suggestion: (typeof suggestions)[0]) {
  inputText.value = suggestion.prompt
  handleSend()
}

async function handleSend() {
  const text = inputText.value.trim()
  if (!text || isGenerating.value) return

  if (!isConnected.value) {
    showToast(t('ai_assistant.please_configure_api'))
    showApiKeySettings.value = true
    return
  }

  const userMessage: Message = {
    id: `msg_${Date.now()}_user`,
    role: 'user',
    content: text,
    timestamp: Date.now()
  }
  messages.value.push(userMessage)

  inputText.value = ''
  scrollToBottom()

  isGenerating.value = true

  const assistantMessage: Message = {
    id: `msg_${Date.now()}_assistant`,
    role: 'assistant',
    content: '',
    loading: true,
    timestamp: Date.now()
  }
  messages.value.push(assistantMessage)
  scrollToBottom()

  try {
    let conversationId = currentConversationId.value
    if (!conversationId) {
      conversationId = createNewConversation()
    }

    let conversation = conversations.value.find((c) => c.id === conversationId)
    if (conversation) {
      conversation.updatedAt = Date.now()
      saveConversations()
    }

    const systemPrompt = selectedCharacter.value?.systemPrompt

    const messagesForApi = []
    if (systemPrompt) {
      messagesForApi.push({ role: 'system', content: systemPrompt })
    }
    const chatHistory = messages.value
      .filter((m) => !m.loading && !m.error)
      .map((m) => ({ role: m.role, content: m.content }))
    messagesForApi.push(...chatHistory)

    const response = await fetch(`${apiKeySettings.value.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKeySettings.value.apiKey}`
      },
      body: JSON.stringify({
        model: selectedModel.value?.id,
        messages: messagesForApi,
        stream: true
      })
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''

    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                fullContent += content
                const lastMsgIndex = messages.value.length - 1
                messages.value[lastMsgIndex] = {
                  ...messages.value[lastMsgIndex],
                  content: fullContent,
                  loading: false
                }
                scrollToBottom()
              }
            } catch {
              // Ignore parse errors for streaming
            }
          }
        }
      }
    }

    const lastMsgIndex = messages.value.length - 1
    messages.value[lastMsgIndex] = {
      ...messages.value[lastMsgIndex],
      content: fullContent || '收到响应，但内容为空',
      loading: false
    }
    saveMessages(conversationId)
    scrollToBottom()
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : t('ai_assistant.error')
    const lastMsgIndex = messages.value.length - 1
    messages.value[lastMsgIndex] = {
      ...messages.value[lastMsgIndex],
      content: errorMsg,
      loading: false,
      error: true
    }
    scrollToBottom()
  } finally {
    isGenerating.value = false
  }
}

onMounted(async () => {
  loadApiKeySettings()
  loadProviderSettings()
  loadModels()
  loadCharacters()
  loadConversations()
})
</script>

<style lang="scss" scoped>
.max-w-75\% {
  max-width: 75%;
}
</style>
