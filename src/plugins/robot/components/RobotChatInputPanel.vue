<template>
  <div class="chat-input-container min-h-180px">
    <n-flex vertical :size="6" class="p-[8px_16px] box-border">
      <n-flex align="center" :size="26" class="options">
        <RobotChatRolePopover
          :show="showRolePopover"
          :selected-role="selectedRole"
          :role-list="roleList"
          :role-loading="roleLoading"
          :get-default-avatar="getDefaultAvatar"
          @update:show="emit('update:show-role-popover', $event)"
          @select-role="emit('select-role', $event)"
          @open-management="emit('open-role-management')" />

        <RobotChatModelPopover
          :show="showModelPopover"
          :selected-model="selectedModel"
          :model-search="modelSearch"
          :model-loading="modelLoading"
          :filtered-models="filteredModels"
          :official-models="officialModels"
          :user-models="userModels"
          :model-pagination="modelPagination"
          :get-default-avatar="getDefaultAvatar"
          :get-model-avatar="getModelAvatar"
          @update:show="emit('update:show-model-popover', $event)"
          @update:model-search="emit('update:model-search', $event)"
          @select-model="emit('select-model', $event)"
          @open-management="emit('open-model-management')"
          @page-change="emit('model-page-change', $event)" />

        <n-select
          v-if="selectedModel && selectedModel.type === 2"
          v-model:value="imageParams.size"
          :options="imageSizeOptions"
          size="small"
          :placeholder="t('ai_assistant.robot.image_size')"
          style="width: 150px" />
        <n-select
          v-if="selectedModel && (selectedModel.type === 4 || selectedModel.type === 7 || selectedModel.type === 8)"
          v-model:value="videoParams.size"
          :options="videoSizeOptions"
          size="small"
          :placeholder="t('ai_assistant.robot.video_size')"
          style="width: 150px" />
        <n-select
          v-if="selectedModel && (selectedModel.type === 4 || selectedModel.type === 7 || selectedModel.type === 8)"
          v-model:value="videoParams.duration"
          :options="videoDurationOptions"
          size="small"
          :placeholder="t('ai_assistant.robot.video_duration')"
          style="width: 100px" />

        <n-select
          v-if="selectedModel && selectedModel.type === 3"
          v-model:value="audioParams.voice"
          :options="audioVoiceOptions"
          size="small"
          :placeholder="t('ai_assistant.robot.select_voice')"
          style="width: 150px" />
        <n-select
          v-if="selectedModel && selectedModel.type === 3"
          v-model:value="audioParams.speed"
          :options="audioSpeedOptions"
          size="small"
          :placeholder="t('ai_assistant.robot.playback_speed')"
          style="width: 120px" />

        <n-popover v-if="selectedModel && selectedModel.type === 8" trigger="hover" :show-arrow="false" placement="top">
          <template #trigger>
            <div style="position: relative; display: inline-block">
              <n-upload
                ref="videoImageUploadRef"
                :show-file-list="false"
                :custom-request="handleVideoImageUpload"
                :disabled="isUploadingVideoImage"
                accept="image/jpeg,image/jpg,image/png,image/webp">
                <n-button
                  size="small"
                  :type="videoImagePreview ? 'success' : 'default'"
                  :loading="isUploadingVideoImage"
                  :disabled="isUploadingVideoImage"
                  style="margin-left: 8px">
                  <template #icon v-if="!isUploadingVideoImage">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                  </template>
                  {{
                    isUploadingVideoImage
                      ? t('ai_assistant.robot.uploading')
                      : videoImagePreview
                        ? t('ai_assistant.robot.uploaded')
                        : t('ai_assistant.robot.reference_image')
                  }}
                </n-button>
              </n-upload>
              <n-button
                v-if="videoImagePreview"
                size="tiny"
                circle
                type="error"
                @click="emit('clear-video-image')"
                style="
                  position: absolute;
                  top: -6px;
                  right: -6px;
                  width: 18px;
                  height: 18px;
                  padding: 0;
                  min-width: 18px;
                ">
                <template #icon>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </template>
              </n-button>
            </div>
          </template>
          <div style="max-width: 300px">
            <div v-if="videoImagePreview" style="margin-bottom: 8px">
              <img :src="videoImagePreview" style="max-width: 100%; border-radius: 4px" alt="视频预览" />
            </div>
            <div style="font-size: 12px; color: #666">
              <div v-if="isUploadingVideoImage" style="color: #18a058">
                {{ t('ai_assistant.robot.uploading_reference_image') }}
              </div>
              <div v-else>
                {{
                  videoImagePreview
                    ? t('ai_assistant.robot.reference_image_uploaded')
                    : t('ai_assistant.robot.upload_reference_image')
                }}
                <br />
                {{ t('ai_assistant.robot.supported_formats') }}
                <br />
                {{ t('ai_assistant.robot.max_size_10mb') }}
                <br />
                <span style="color: #999; font-size: 11px">{{ t('ai_assistant.robot.image_upload_to_storage') }}</span>
              </div>
            </div>
          </div>
        </n-popover>

        <n-popover
          v-for="(item, index) in otherFeatures"
          :key="index"
          trigger="hover"
          :show-arrow="false"
          placement="top">
          <template #trigger>
            <svg><use :href="`#${item.icon}`"></use></svg>
          </template>
          <p>{{ item.label }}</p>
        </n-popover>

        <div class="flex items-center gap-6px bg-[--chat-hover-color] rounded-50px w-fit h-fit p-[4px_6px]">
          <svg style="width: 22px; height: 22px; outline: none; cursor: pointer"><use href="#explosion"></use></svg>
          <n-popover trigger="hover" :show-arrow="false" placement="top">
            <template #trigger>
              <p class="text-(12px #707070) cursor-default select-none pr-6px">
                {{ t('ai_assistant.robot.token_usage') }} {{ serverTokenUsage ?? conversationTokens }} /
                {{ selectedModel?.maxTokens || 0 }}
              </p>
            </template>
            <span>{{ t('ai_assistant.robot.token_limit_hint') }}</span>
          </n-popover>
          <n-popover trigger="hover" :show-arrow="false" placement="top">
            <template #trigger>
              <n-switch :value="reasoningEnabled" size="small" @update:value="emit('update:reasoning-enabled', $event)">
                <template #checked>{{ t('ai_assistant.robot.deep_thinking') }}</template>
                <template #unchecked>{{ t('ai_assistant.robot.close') }}</template>
              </n-switch>
            </template>
            <span v-if="supportsReasoning">{{ t('ai_assistant.robot.deep_thinking_enabled_hint') }}</span>
            <span v-else>{{ t('ai_assistant.robot.deep_thinking_unsupported') }}</span>
          </n-popover>
        </div>
      </n-flex>

      <div style="height: 100px" class="flex flex-col items-end gap-6px">
        <MsgInput
          ref="innerMsgInputRef"
          :isAIMode="!!selectedModel"
          :isAIStreaming="isAIStreaming"
          @send-ai="emit('send-ai', $event)"
          @stop-ai="emit('stop-ai-stream')" />
      </div>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MsgInput from '@/components/rightBox/MsgInput.vue'
import RobotChatModelPopover from '@/plugins/robot/components/RobotChatModelPopover.vue'
import RobotChatRolePopover from '@/plugins/robot/components/RobotChatRolePopover.vue'
import type { VideoImageUploadPayload } from '@/plugins/robot/composables/useAiGenerationParams'
import type { PaginationState } from '@/plugins/robot/composables/useRobotChat'
import type { ChatRole } from '@/services/matrix/ai/ChatRoleService'
import type { AIModel } from '@/services/matrix/ai/ModelService'

const { t } = useI18n()

type SelectOption<T extends string | number> = {
  label: string
  value: T
}

const props = defineProps<{
  showRolePopover: boolean
  selectedRole: ChatRole | null
  roleList: ChatRole[]
  roleLoading: boolean
  showModelPopover: boolean
  selectedModel: AIModel | null
  modelSearch: string
  modelLoading: boolean
  filteredModels: AIModel[]
  officialModels: AIModel[]
  userModels: AIModel[]
  modelPagination: PaginationState
  imageParams: { size: string }
  imageSizeOptions: Array<SelectOption<string>>
  videoParams: { size: string; duration: number; image: string | null }
  videoSizeOptions: Array<SelectOption<string>>
  videoDurationOptions: Array<SelectOption<number>>
  audioParams: { voice: string; speed: number }
  audioVoiceOptions: Array<SelectOption<string>>
  audioSpeedOptions: Array<SelectOption<number>>
  videoImagePreview: string | null
  isUploadingVideoImage: boolean
  otherFeatures: Array<{ icon: string; label: string }>
  serverTokenUsage: number | null
  conversationTokens: number
  reasoningEnabled: boolean
  supportsReasoning: boolean
  isAIStreaming: boolean
  getDefaultAvatar: () => string
  getModelAvatar: (model: AIModel | null) => string
  handleVideoImageUpload: (payload: VideoImageUploadPayload) => void | Promise<void>
}>()

const emit = defineEmits<{
  'update:show-role-popover': [value: boolean]
  'update:show-model-popover': [value: boolean]
  'update:model-search': [value: string]
  'update:reasoning-enabled': [value: boolean]
  'select-role': [role: ChatRole]
  'open-role-management': []
  'select-model': [model: AIModel]
  'open-model-management': []
  'model-page-change': [page: number]
  'clear-video-image': []
  'send-ai': [payload: { content: string }]
  'stop-ai-stream': []
}>()

const innerMsgInputRef = ref<{ clearInput?: () => void }>()
const videoImageUploadRef = ref<{ clear?: () => void } | null>(null)

watch(
  () => props.videoImagePreview,
  (preview) => {
    if (!preview) {
      videoImageUploadRef.value?.clear?.()
    }
  }
)

defineExpose({
  clearInput: () => innerMsgInputRef.value?.clearInput?.()
})
</script>

<style scoped lang="scss">
.chat-input-container {
  flex-shrink: 0;
  background: var(--bg-color);
}

.options {
  padding-left: 4px;

  svg {
    @apply size-22px cursor-pointer outline-none;
  }
}
</style>
