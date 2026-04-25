<template>
  <div
    data-tauri-drag-region
    class="chat-header flex truncate p-[8px_16px_10px_16px] justify-between items-center gap-50px">
    <n-flex :size="10" vertical class="truncate">
      <p
        v-if="!isEdit"
        @click="emit('edit')"
        class="leading-6 text-(18px [--chat-text-color]) truncate font-500 hover:underline cursor-pointer">
        {{ chatTitle || '新的会话' }}
      </p>
      <n-input
        v-else
        ref="titleInputRef"
        :value="chatTitle"
        clearable
        placeholder="输入标题"
        type="text"
        size="small"
        spellCheck="false"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        style="width: 200px; height: 28px"
        class="text-14px rounded-6px"
        @blur="emit('blur')"
        @update:value="emit('update:chat-title', $event)" />

      <n-flex align="center" :size="8" class="mt-4px">
        <n-tag v-if="aiProvider === 'openclaw'" :type="isOpenClawConnected ? 'success' : 'error'" size="small">
          OpenClaw {{ isOpenClawConnected ? '已连接' : '未连接' }}
        </n-tag>

        <n-select
          :value="aiProvider"
          :options="providerOptions"
          size="tiny"
          style="width: 120px"
          @update:value="handleProviderSelect" />

        <n-select
          v-if="aiProvider === 'openclaw' && openClawModels.length > 0"
          :value="openClawCurrentModel"
          :options="openClawModels.map((m) => ({ label: m, value: m }))"
          size="tiny"
          style="width: 180px"
          placeholder="选择模型"
          @update:value="emit('update:open-claw-current-model', $event)" />

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

        <p class="text-(11px #707070)">共{{ messageCount }}条对话</p>
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
          <div class="right-btn" @click="emit('edit')">
            <svg><use href="#edit"></use></svg>
          </div>
        </template>
        <p>编辑标题</p>
      </n-popover>

      <n-popover
        :show="showDeleteChatConfirm"
        trigger="click"
        placement="bottom"
        :show-arrow="true"
        style="padding: 16px; width: 280px"
        @update:show="emit('update:show-delete-chat-confirm', $event)">
        <template #trigger>
          <div class="right-btn right-btn-danger" title="删除会话">
            <svg><use href="#delete"></use></svg>
          </div>
        </template>
        <n-flex vertical :size="12">
          <p class="text-(14px [--chat-text-color]) font-500">确定要删除当前会话吗？</p>
          <p class="text-(12px #d5304f)">删除后将无法恢复！</p>

          <n-checkbox
            :checked="deleteWithMessages"
            size="small"
            @update:checked="emit('update:delete-with-messages', $event)">
            <span class="text-(12px [--chat-text-color])">同时删除会话中的所有消息</span>
          </n-checkbox>

          <n-flex justify="end" :size="8">
            <n-button size="small" @click="emit('update:show-delete-chat-confirm', false)">取消</n-button>
            <n-button size="small" type="error" @click="emit('delete-chat')">确定删除</n-button>
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
import type { InputInst } from 'naive-ui'
import { nextTick, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import type { ConversationMeta } from '@/plugins/robot/composables/useRobotChat'
import type { AIProvider } from '@/plugins/robot/composables/useAiProviderConfig'
import type { AIModel } from '@/services/matrix'

const props = defineProps<{
  chatTitle: ConversationMeta['title']
  messageCount: ConversationMeta['messageCount']
  isEdit: boolean
  aiProvider: AIProvider
  isOpenClawConnected: boolean
  openClawModels: readonly string[]
  openClawCurrentModel: string
  selectedModel: AIModel | null
  remainingUsage: number | null
  remainingUsageDisplay: string
  remainingUsageTagType: 'default' | 'info' | 'warning' | 'error' | 'success' | 'primary'
  showDeleteChatConfirm: boolean
  deleteWithMessages: boolean
}>()

const emit = defineEmits<{
  edit: []
  blur: []
  'update:chat-title': [value: string]
  'update:ai-provider': [value: AIProvider]
  'change-provider': [value: AIProvider]
  'update:open-claw-current-model': [value: string]
  'update:show-delete-chat-confirm': [value: boolean]
  'update:delete-with-messages': [value: boolean]
  'model-click': []
  'create-new-chat': []
  'delete-chat': []
}>()

const providerOptions: Array<{ label: string; value: AIProvider }> = [
  { label: 'OpenClaw', value: 'openclaw' },
  { label: 'HuLa 后端', value: 'hula' }
]

const titleInputRef = ref<InputInst | null>(null)

const handleProviderSelect = (value: AIProvider) => {
  emit('update:ai-provider', value)
  emit('change-provider', value)
}

watch(
  () => props.isEdit,
  (isEdit) => {
    if (!isEdit) return
    void nextTick(() => {
      titleInputRef.value?.select()
    })
  }
)
</script>

<style scoped lang="scss">
.chat-header {
  flex-shrink: 0;
  min-height: 60px;
  max-height: 80px;
}

.right-btn {
  @apply size-fit border-(1px solid [--line-color]) cursor-pointer bg-[--chat-bt-color] color-[--chat-text-color] rounded-8px custom-shadow p-[10px_11px];
  transition: all 0.2s ease;

  svg {
    @apply size-18px;
  }

  &.right-btn-disabled {
    @apply opacity-50 cursor-not-allowed;

    &:hover {
      @apply bg-[--chat-bt-color];
    }
  }
}
</style>
