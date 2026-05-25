<template>
  <div
    data-tauri-drag-region
    class="chat-header flex truncate p-[8px_16px_10px_16px] justify-between items-center gap-50px">
    <n-flex :size="10" vertical class="truncate">
      <p
        v-if="!isEdit"
        @click="emit('edit')"
        class="leading-6 text-(18px [--hula-text-primary]) truncate font-500 hover:underline cursor-pointer">
        {{ chatTitle || t('ai_assistant.robot.new_conversation_title') }}
      </p>
      <n-input
        v-else
        ref="titleInputRef"
        :value="chatTitle"
        clearable
        :placeholder="t('ai_assistant.robot.input_title')"
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
        <n-select
          :value="aiProvider"
          :options="providerOptions"
          size="tiny"
          style="width: 120px"
          @update:value="handleProviderSelect" />

        <div v-if="aiProvider === 'hula'" class="flex items-center gap-6px">
          <span class="text-(11px [--hula-text-tertiary])">{{ t('ai_assistant.robot.current_model') }}</span>
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
          <n-tag v-if="selectedModel && selectedModel.publicStatus === 0" size="small" type="info">
            {{ t('ai_assistant.robot.official_model') }}
          </n-tag>
          <n-tag v-else-if="selectedModel" size="small" type="warning">
            {{ t('ai_assistant.robot.custom_model') }}
          </n-tag>
          <n-tag v-if="selectedModel && selectedModel.type === 1" size="small" type="info">
            {{ t('ai_assistant.robot.model_type_chat') }}
          </n-tag>
          <n-tag v-if="selectedModel && selectedModel.type === 2" size="small" type="success">
            {{ t('ai_assistant.robot.model_type_image') }}
          </n-tag>
          <n-tag v-if="selectedModel && selectedModel.type === 3" size="small" type="info">
            {{ t('ai_assistant.robot.model_type_audio') }}
          </n-tag>
          <n-tag v-if="selectedModel && selectedModel.type === 4" size="small" type="warning">
            {{ t('ai_assistant.robot.model_type_video') }}
          </n-tag>
          <n-tag v-if="selectedModel && selectedModel.type === 7" size="small" type="warning">
            {{ t('ai_assistant.robot.model_type_text2video') }}
          </n-tag>
          <n-tag v-if="selectedModel && selectedModel.type === 8" size="small" type="success">
            {{ t('ai_assistant.robot.model_type_image2video') }}
          </n-tag>

          <n-tag v-if="remainingUsage !== null" size="small" :type="remainingUsageTagType" round>
            {{ t('ai_assistant.robot.remaining_usage', { count: remainingUsageDisplay }) }}
          </n-tag>

          <n-tag
            v-else-if="!selectedModel"
            size="small"
            type="warning"
            class="cursor-pointer"
            @click="emit('model-click')">
            {{ t('ai_assistant.robot.no_model_selected') }}
            <template #icon>
              <Icon icon="mdi:robot-off" class="text-14px" />
            </template>
          </n-tag>
        </div>

        <p class="text-(11px [--hula-text-tertiary])">
          {{ t('ai_assistant.robot.conversation_count', { count: messageCount }) }}
        </p>
      </n-flex>
    </n-flex>

    <n-flex class="min-w-fit">
      <n-popover trigger="hover" :show-arrow="false" placement="bottom">
        <template #trigger>
          <div class="right-btn" @click="emit('create-new-chat')">
            <svg><use href="#plus"></use></svg>
          </div>
        </template>
        <p>{{ t('ai_assistant.robot.new_conversation_btn') }}</p>
      </n-popover>

      <n-popover trigger="hover" :show-arrow="false" placement="bottom">
        <template #trigger>
          <div class="right-btn" @click="emit('edit')">
            <svg><use href="#edit"></use></svg>
          </div>
        </template>
        <p>{{ t('ai_assistant.robot.edit_title') }}</p>
      </n-popover>

      <n-popover
        :show="showDeleteChatConfirm"
        trigger="click"
        placement="bottom"
        :show-arrow="true"
        style="padding: 16px; width: 280px"
        @update:show="emit('update:show-delete-chat-confirm', $event)">
        <template #trigger>
          <div class="right-btn right-btn-danger" :title="t('ai_assistant.robot.delete_conversation')">
            <svg><use href="#delete"></use></svg>
          </div>
        </template>
        <n-flex vertical :size="12">
          <p class="text-(14px [--hula-text-primary]) font-500">
            {{ t('ai_assistant.robot.confirm_delete_conversation') }}
          </p>
          <p class="text-(12px [--hula-color-danger-500])">{{ t('ai_assistant.robot.irreversible_warning') }}</p>

          <n-checkbox
            :checked="deleteWithMessages"
            size="small"
            @update:checked="emit('update:delete-with-messages', $event)">
            <span class="text-(12px [--hula-text-primary])">{{ t('ai_assistant.robot.delete_with_messages') }}</span>
          </n-checkbox>

          <n-flex justify="end" :size="8">
            <n-button size="small" @click="emit('update:show-delete-chat-confirm', false)">
              {{ t('ai_assistant.robot.cancel') }}
            </n-button>
            <n-button size="small" type="error" @click="emit('delete-chat')">
              {{ t('ai_assistant.robot.confirm_delete_btn') }}
            </n-button>
          </n-flex>
        </n-flex>
      </n-popover>

      <n-popover trigger="hover" :show-arrow="false" placement="bottom">
        <template #trigger>
          <div class="right-btn">
            <svg><use href="#Sharing"></use></svg>
          </div>
        </template>
        <p>{{ t('ai_assistant.robot.share') }}</p>
      </n-popover>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { InputInst } from 'naive-ui'
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AIProvider } from '@/plugins/robot/composables/useAiProviderConfig'
import type { ConversationMeta } from '@/plugins/robot/composables/useRobotChat'
import type { AIModel } from '@/services/matrix/ai/ModelService'

const { t } = useI18n()

const props = defineProps<{
  chatTitle: ConversationMeta['title']
  messageCount: ConversationMeta['messageCount']
  isEdit: boolean
  aiProvider: AIProvider
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
  'update:show-delete-chat-confirm': [value: boolean]
  'update:delete-with-messages': [value: boolean]
  'model-click': []
  'create-new-chat': []
  'delete-chat': []
}>()

const providerOptions: Array<{ label: string; value: AIProvider }> = [
  { label: t('ai_assistant.robot.hula_backend'), value: 'hula' },
  { label: 'SiliconFlow', value: 'siliconflow' },
  { label: 'TrendRadar', value: 'trendradar' }
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
  @apply size-fit border-(1px solid [--hula-border-default]) cursor-pointer bg-[--chat-bt-color] color-[--hula-text-primary] rounded-8px custom-shadow p-[10px_11px];
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
