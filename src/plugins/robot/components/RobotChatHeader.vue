<template>
  <div
    data-tauri-drag-region
    class="chat-header flex truncate p-[8px_16px_10px_16px] justify-between items-center gap-50px">
    <n-flex :size="10" vertical class="truncate">
      <p
        v-if="!isEdit"
        @click="handleEdit"
        class="leading-6 text-(18px [--chat-text-color]) truncate font-500 hover:underline cursor-pointer">
        {{ currentChat.title || '新的会话' }}
      </p>
      <n-input
        v-else
        @blur="handleBlur"
        ref="inputInstRef"
        v-model:value="editTitle"
        clearable
        placeholder="输入标题"
        type="text"
        size="small"
        spellCheck="false"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        style="width: 200px; height: 28px"
        class="text-14px rounded-6px"></n-input>

      <n-flex align="center" :size="8" class="mt-4px">
        <n-tag v-if="aiProvider === 'openclaw'" :type="isOpenClawConnected ? 'success' : 'error'" size="small">
          OpenClaw {{ isOpenClawConnected ? '已连接' : '未连接' }}
        </n-tag>

        <n-select
          v-model:value="localAiProvider"
          :options="providerOptions"
          size="tiny"
          style="width: 120px"
          @update:value="handleProviderChange" />

        <n-select
          v-if="aiProvider === 'openclaw' && openClawModels.length > 0"
          v-model:value="localOpenClawModel"
          :options="openClawModelOptions"
          size="tiny"
          style="width: 180px"
          placeholder="选择模型" />

        <div v-if="aiProvider === 'hula'" class="flex items-center gap-6px">
          <span class="text-(11px #909090)">当前模型:</span>
          <n-tag
            v-if="selectedModel"
            size="small"
            :type="selectedModel.status === 0 ? 'success' : 'error'"
            class="cursor-pointer"
            @click="emit('model-click')">
            {{ selectedModel.name }}
            <template #icon>
              <Icon icon="mdi:robot" class="text-14px" />
            </template>
          </n-tag>
          <n-tag v-if="selectedModel && selectedModel.publicStatus === 0" size="small" type="info">官网模型</n-tag>
          <n-tag v-else-if="selectedModel" size="small" type="warning">自建模型</n-tag>
          <n-tag v-if="selectedModel && selectedModel.type === 1" size="small" type="info">文字</n-tag>
          <n-tag v-if="selectedModel && selectedModel.type === 2" size="small" type="success">图片</n-tag>
          <n-tag v-if="selectedModel && selectedModel.type === 3" size="small" type="info">音频</n-tag>
          <n-tag v-if="selectedModel && selectedModel.type === 4" size="small" type="warning">视频</n-tag>
          <n-tag v-if="selectedModel && selectedModel.type === 7" size="small" type="warning">文生视频</n-tag>
          <n-tag v-if="selectedModel && selectedModel.type === 8" size="small" type="success">图生视频</n-tag>

          <n-tag v-if="remainingUsage !== null" size="small" :type="remainingUsageTagType" round>
            剩余次数: {{ remainingUsageDisplay }}
          </n-tag>

          <n-tag
            v-else-if="!selectedModel"
            size="small"
            type="warning"
            class="cursor-pointer"
            @click="emit('model-click')">
            未选择模型
            <template #icon>
              <Icon icon="mdi:robot-off" class="text-14px" />
            </template>
          </n-tag>
        </div>
        <p class="text-(11px #707070)">共{{ currentChat.messageCount }}条对话</p>
      </n-flex>
    </n-flex>

    <n-flex class="min-w-fit">
      <n-popover trigger="hover" :show-arrow="false" placement="bottom">
        <template #trigger>
          <div class="right-btn" @click="emit('create-new-chat')">
            <svg><use href="#plus"></use></svg>
          </div>
        </template>
        <p>新建会话</p>
      </n-popover>

      <n-popover trigger="hover" :show-arrow="false" placement="bottom">
        <template #trigger>
          <div class="right-btn" @click="handleEdit">
            <svg><use href="#edit"></use></svg>
          </div>
        </template>
        <p>编辑标题</p>
      </n-popover>

      <n-popover
        v-model:show="showDeleteConfirm"
        trigger="click"
        placement="bottom"
        :show-arrow="true"
        style="padding: 16px; width: 280px">
        <template #trigger>
          <div class="right-btn right-btn-danger" title="删除会话">
            <svg><use href="#delete"></use></svg>
          </div>
        </template>
        <n-flex vertical :size="12">
          <p class="text-(14px [--chat-text-color]) font-500">确定要删除当前会话吗？</p>
          <p class="text-(12px #d5304f)">删除后将无法恢复！</p>
          <n-checkbox v-model:checked="deleteWithMessages" size="small">
            <span class="text-(12px [--chat-text-color])">同时删除会话中的所有消息</span>
          </n-checkbox>
          <n-flex justify="end" :size="8">
            <n-button size="small" @click="showDeleteConfirm = false">取消</n-button>
            <n-button size="small" type="error" @click="handleDeleteChat">确定删除</n-button>
          </n-flex>
        </n-flex>
      </n-popover>

      <n-popover trigger="hover" :show-arrow="false" placement="bottom">
        <template #trigger>
          <div class="right-btn">
            <svg><use href="#Sharing"></use></svg>
          </div>
        </template>
        <p>分享</p>
      </n-popover>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Icon } from '@iconify/vue'
import type { ChatInfo, ModelInfo, AIProvider } from '../hooks/useRobotChat'

const props = defineProps<{
  currentChat: ChatInfo
  aiProvider: AIProvider
  isOpenClawConnected: boolean
  openClawModels: string[]
  openClawCurrentModel: string
  selectedModel: ModelInfo | null
  remainingUsage: number | null
  remainingUsageDisplay: string
  remainingUsageTagType: 'success' | 'info' | 'error'
}>()

const emit = defineEmits<{
  (e: 'update:aiProvider', value: AIProvider): void
  (e: 'update:openClawCurrentModel', value: string): void
  (e: 'edit-title', title: string): void
  (e: 'create-new-chat'): void
  (e: 'delete-chat', withMessages: boolean): void
  (e: 'model-click'): void
}>()

const isEdit = ref(false)
const editTitle = ref('')
const inputInstRef = ref()
const showDeleteConfirm = ref(false)
const deleteWithMessages = ref(false)

const localAiProvider = computed({
  get: () => props.aiProvider,
  set: (value: AIProvider) => emit('update:aiProvider', value)
})

const localOpenClawModel = computed({
  get: () => props.openClawCurrentModel,
  set: (value: string) => emit('update:openClawCurrentModel', value)
})

const providerOptions = [
  { label: 'OpenClaw', value: 'openclaw' },
  { label: 'HuLa 后端', value: 'hula' }
]

const openClawModelOptions = computed(() => props.openClawModels.map((m: string) => ({ label: m, value: m })))

watch(
  () => props.currentChat.title,
  (newTitle) => {
    editTitle.value = newTitle || ''
  },
  { immediate: true }
)

const handleEdit = () => {
  isEdit.value = true
  editTitle.value = props.currentChat.title || ''
  setTimeout(() => {
    inputInstRef.value?.focus()
  }, 0)
}

const handleBlur = () => {
  isEdit.value = false
  if (editTitle.value !== props.currentChat.title) {
    emit('edit-title', editTitle.value)
  }
}

const handleProviderChange = (value: AIProvider) => {
  emit('update:aiProvider', value)
}

const handleDeleteChat = () => {
  showDeleteConfirm.value = false
  emit('delete-chat', deleteWithMessages.value)
  deleteWithMessages.value = false
}
</script>

<style scoped lang="scss">
.right-btn {
  @apply flex-center w-32px h-32px rounded-8px cursor-pointer transition-all;
  @apply hover:bg-[--chat-hover-color];

  svg {
    @apply w-18px h-18px color-#909090;
  }

  &:hover svg {
    @apply color-[--primary-color];
  }
}

.right-btn-danger:hover {
  @apply bg-#fef0f0;

  svg {
    @apply color-#d5304f;
  }
}
</style>
