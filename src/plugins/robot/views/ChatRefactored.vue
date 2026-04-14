<template>
  <main class="chat-main-container">
    <div class="chat-content-area">
      <RobotChatHeader
        :current-chat="currentChat"
        :ai-provider="aiProvider"
        :is-open-claw-connected="isOpenClawConnected"
        :open-claw-models="[...openClawModels]"
        :open-claw-current-model="openClawCurrentModel"
        :selected-model="selectedModel"
        :remaining-usage="remainingUsage"
        :remaining-usage-display="remainingUsageDisplay"
        :remaining-usage-tag-type="remainingUsageTagType"
        @update:ai-provider="handleProviderChange"
        @update:open-claw-current-model="openClawCurrentModel = $event"
        @edit-title="handleEditTitle"
        @create-new-chat="handleCreateNewChat"
        @delete-chat="handleDeleteChat"
        @model-click="showModelPopover = true" />

      <div class="h-1px bg-[--line-color]"></div>

      <RobotMessageList
        ref="messageListRef"
        :message-list="messageList"
        :loading-messages="loadingMessages"
        :selected-model="selectedModel"
        :is-dark-theme="isDarkTheme"
        :page-shadow="page.shadow"
        :user-avatar="userAvatar"
        @delete-message="deleteMessage"
        @image-preview="handleImagePreview"
        @scroll="handleScroll" />

      <div class="h-1px bg-[--line-color]"></div>

      <RobotInputArea
        ref="inputAreaRef"
        :selected-model="selectedModel"
        :selected-role="selectedRole"
        :role-list="roleList"
        :role-loading="roleLoading"
        :model-list="modelList"
        :model-loading="modelLoading"
        :is-ai-streaming="isAIStreaming"
        :token-usage="serverTokenUsage ?? conversationTokens"
        :supports-reasoning="supportsReasoning"
        @select-role="selectRole"
        @select-model="selectModel"
        @send-ai="handleSendAI"
        @stop-ai-stream="handleStopAIStream"
        @open-role-management="handleOpenRoleManagement"
        @open-model-management="handleOpenModelManagement" />
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import RobotChatHeader from '../components/RobotChatHeader.vue'
import RobotMessageList from '../components/RobotMessageList.vue'
import RobotInputArea from '../components/RobotInputArea.vue'
import { useRobotChat, type ModelInfo, type RoleInfo } from '../hooks/useRobotChat'

const {
  currentChat,
  messageList,
  loadingMessages,
  selectedModel,
  selectedRole,
  aiProvider,
  isOpenClawConnected,
  openClawModels,
  openClawCurrentModel,
  isAIStreaming,
  remainingUsage,
  remainingUsageDisplay,
  remainingUsageTagType,
  conversationTokens,
  serverTokenUsage,
  supportsReasoning,
  isDarkTheme,
  page,
  loadSavedConfig,
  handleProviderChange,
  selectModel,
  selectRole,
  addMessage,
  deleteMessage,
  getMessageBubbleClass
} = useRobotChat()

const messageListRef = ref()
const inputAreaRef = ref()
const showModelPopover = ref(false)
const roleList = ref<RoleInfo[]>([])
const roleLoading = ref(false)
const modelList = ref<ModelInfo[]>([])
const modelLoading = ref(false)

const userAvatar = computed(() => '')

onMounted(() => {
  loadSavedConfig()
})

const handleEditTitle = (title: string) => {
  currentChat.value.title = title
}

const handleCreateNewChat = () => {
  currentChat.value = {
    id: '0',
    title: '',
    messageCount: 0,
    createTime: Date.now()
  }
  messageList.value = []
}

const handleDeleteChat = (withMessages: boolean) => {
  if (withMessages) {
    messageList.value = []
  }
  handleCreateNewChat()
}

const handleImagePreview = (_url: string) => {}

const handleScroll = (_event: Event) => {}

const handleSendAI = async (content: string) => {
  addMessage({
    type: 'user',
    content
  })

  addMessage({
    type: 'assistant',
    content: '',
    isGenerating: true
  })

  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: content })
    })
    const data = await response.json()

    const lastIndex = messageList.value.length - 1
    if (lastIndex >= 0) {
      messageList.value[lastIndex].content = data.response
      messageList.value[lastIndex].isGenerating = false
    }
  } catch (error) {
    const lastIndex = messageList.value.length - 1
    if (lastIndex >= 0) {
      messageList.value[lastIndex].content = '请求失败，请重试'
      messageList.value[lastIndex].isGenerating = false
    }
  }
}

const handleStopAIStream = () => {
  isAIStreaming.value = false
}

const handleOpenRoleManagement = () => {}

const handleOpenModelManagement = () => {}
</script>

<style scoped lang="scss">
.chat-main-container {
  @apply flex flex-col h-full bg-[--bg-color];
}

.chat-content-area {
  @apply flex flex-col h-full;
}
</style>
