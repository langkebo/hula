<template>
  <div class="chat-input-container min-h-180px">
    <n-flex vertical :size="6" class="p-[8px_16px] box-border">
      <n-flex align="center" :size="26" class="options">
        <n-popover
          v-model:show="showRolePopover"
          trigger="click"
          placement="top-start"
          :show-arrow="false"
          style="padding: 0; width: 320px">
          <template #trigger>
            <div class="flex items-center gap-6px cursor-pointer" @click="showRolePopover = !showRolePopover">
              <n-avatar
                v-if="selectedRole"
                :src="selectedRole.avatar"
                :size="24"
                round
                :fallback-src="defaultAvatar" />
              <Icon v-else icon="mdi:account-circle" class="text-24px color-#909090" />
              <span class="text-(12px [--chat-text-color])">
                {{ selectedRole ? selectedRole.name : '选择角色' }}
              </span>
              <Icon icon="mdi:chevron-down" class="text-16px color-#909090" />
            </div>
          </template>
          <div class="role-selector">
            <div class="role-header">
              <span class="role-title">选择角色</span>
              <n-button size="small" @click="emit('open-role-management')">
                <template #icon>
                  <Icon icon="mdi:cog" />
                </template>
                管理
              </n-button>
            </div>
            <div class="role-list">
              <div v-if="roleLoading" class="loading-container">
                <n-spin size="small" />
                <span class="loading-text">加载中...</span>
              </div>
              <div v-else-if="(roleList ?? []).length === 0" class="empty-container">
                <n-empty description="暂无角色数据" size="small">
                  <template #icon>
                    <Icon icon="mdi:account-off" class="text-24px color-#909090" />
                  </template>
                </n-empty>
              </div>
              <div v-else class="roles-container">
                <div
                  v-for="role in (roleList ?? [])"
                  :key="role.id"
                  class="role-item"
                  :class="{ active: selectedRole?.id === role.id }"
                  @click="handleSelectRole(role)">
                  <n-avatar :src="role.avatar" :size="32" round :fallback-src="defaultAvatar" />
                  <n-flex vertical :size="2" class="flex-1 min-w-0">
                    <n-flex align="center" :size="8">
                      <span class="role-name">{{ role.name }}</span>
                      <n-tag v-if="role.status === 0" size="tiny" type="success">可用</n-tag>
                    </n-flex>
                    <span class="role-desc">{{ role.description }}</span>
                  </n-flex>
                  <Icon
                    v-if="selectedRole?.id === role.id"
                    icon="mdi:check-circle"
                    class="text-18px color-[--primary-color]" />
                </div>
              </div>
            </div>
          </div>
        </n-popover>

        <n-popover
          v-model:show="showModelPopover"
          trigger="click"
          placement="top-start"
          :show-arrow="false"
          style="padding: 0; width: 320px">
          <template #trigger>
            <div class="flex items-center gap-6px cursor-pointer" @click="emit('open-model-popover')">
              <svg><use href="#model"></use></svg>
              <span class="text-(12px [--chat-text-color])">
                {{ selectedModel ? selectedModel.name : '选择模型' }}
              </span>
            </div>
          </template>
          <div class="model-selector">
            <div class="model-header">
              <span class="model-title">选择模型</span>
              <n-flex :size="8">
                <n-button size="small" @click="emit('open-model-management')">
                  <template #icon>
                    <Icon icon="mdi:cog" />
                  </template>
                  管理
                </n-button>
                <n-input
                  v-model:value="modelSearch"
                  placeholder="搜索模型..."
                  clearable
                  size="small"
                  style="width: 140px">
                  <template #prefix>
                    <Icon icon="mdi:magnify" class="text-16px color-#909090" />
                  </template>
                </n-input>
              </n-flex>
            </div>
            <div class="model-list">
              <div v-if="modelLoading" class="loading-container">
                <n-spin size="small" />
                <span class="loading-text">加载中...</span>
              </div>
              <div v-else-if="filteredModels.length === 0" class="empty-container">
                <n-empty description="暂无模型数据" size="small">
                  <template #icon>
                    <Icon icon="mdi:package-variant-closed" class="text-24px color-#909090" />
                  </template>
                </n-empty>
              </div>
              <div v-else class="models-container">
                <slot name="model-list" :models="filteredModels" :select-model="handleSelectModel" />
              </div>
            </div>
          </div>
        </n-popover>

        <n-select
          v-if="selectedModel && selectedModel.type === 2"
          v-model:value="imageParams.size"
          :options="imageSizeOptions"
          size="small"
          placeholder="图片尺寸"
          style="width: 150px" />
        <n-select
          v-if="selectedModel && (selectedModel.type === 4 || selectedModel.type === 7 || selectedModel.type === 8)"
          v-model:value="videoParams.size"
          :options="videoSizeOptions"
          size="small"
          placeholder="视频尺寸"
          style="width: 150px" />
        <n-select
          v-if="selectedModel && (selectedModel.type === 4 || selectedModel.type === 7 || selectedModel.type === 8)"
          v-model:value="videoParams.duration"
          :options="videoDurationOptions"
          size="small"
          placeholder="视频时长"
          style="width: 100px" />
        <n-select
          v-if="selectedModel && selectedModel.type === 3"
          v-model:value="audioParams.voice"
          :options="audioVoiceOptions"
          size="small"
          placeholder="选择语音"
          style="width: 150px" />
        <n-select
          v-if="selectedModel && selectedModel.type === 3"
          v-model:value="audioParams.speed"
          :options="audioSpeedOptions"
          size="small"
          placeholder="播放速度"
          style="width: 120px" />

        <div class="flex items-center gap-6px bg-[--chat-hover-color] rounded-50px w-fit h-fit p-[4px_6px]">
          <svg style="width: 22px; height: 22px; outline: none; cursor: pointer"><use href="#explosion"></use></svg>
          <n-popover trigger="hover" :show-arrow="false" placement="top">
            <template #trigger>
              <p class="text-(12px #707070) cursor-default select-none pr-6px">
                Token 使用 {{ tokenUsage }} / {{ selectedModel?.maxTokens || 0 }}
              </p>
            </template>
            <span>按会话累计 Token 进行限制，达到上限后将拒绝继续生成</span>
          </n-popover>
          <n-popover trigger="hover" :show-arrow="false" placement="top">
            <template #trigger>
              <n-switch v-model:value="reasoningEnabled" size="small">
                <template #checked>深度思考</template>
                <template #unchecked>关闭</template>
              </n-switch>
            </template>
            <span v-if="supportsReasoning">开启后将优先展示思考过程</span>
            <span v-else>该模型不支持深度思考</span>
          </n-popover>
        </div>
      </n-flex>

      <div style="height: 100px" class="flex flex-col items-end gap-6px">
        <MsgInput
          ref="msgInputRef"
          :isAIMode="!!selectedModel"
          :isAIStreaming="isAIStreaming"
          @send-ai="handleSendAI"
          @stop-ai="handleStopAIStream" />
      </div>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import MsgInput from '@/components/rightBox/MsgInput.vue'
import type { ModelInfo, RoleInfo } from '../hooks/useRobotChat'

const props = defineProps<{
  selectedModel?: ModelInfo | null
  selectedRole?: RoleInfo | null
  roleList?: RoleInfo[]
  roleLoading?: boolean
  modelList?: ModelInfo[]
  modelLoading?: boolean
  isAIStreaming?: boolean
  tokenUsage?: number
  supportsReasoning?: boolean
}>()

const emit = defineEmits<{
  (e: 'select-role', role: RoleInfo | null): void
  (e: 'select-model', model: ModelInfo): void
  (e: 'send-ai', content: string): void
  (e: 'stop-ai-stream'): void
  (e: 'open-role-management'): void
  (e: 'open-model-management'): void
  (e: 'open-model-popover'): void
  (e: 'update:reasoning-enabled', value: boolean): void
}>()

const showRolePopover = ref(false)
const showModelPopover = ref(false)
const modelSearch = ref('')
const msgInputRef = ref()
const defaultAvatar = '/logoD.png'

const reasoningEnabled = computed({
  get: () => props.supportsReasoning,
  set: (value: boolean) => emit('update:reasoning-enabled', value)
})

const imageParams = ref({
  size: '1024x1024'
})

const videoParams = ref({
  size: '1280x720',
  duration: '5'
})

const audioParams = ref({
  voice: 'alloy',
  speed: '1.0'
})

const imageSizeOptions = [
  { label: '1024x1024', value: '1024x1024' },
  { label: '1792x1024', value: '1792x1024' },
  { label: '1024x1792', value: '1024x1792' }
]

const videoSizeOptions = [
  { label: '1280x720', value: '1280x720' },
  { label: '1920x1080', value: '1920x1080' }
]

const videoDurationOptions = [
  { label: '5秒', value: '5' },
  { label: '10秒', value: '10' }
]

const audioVoiceOptions = [
  { label: 'Alloy', value: 'alloy' },
  { label: 'Echo', value: 'echo' },
  { label: 'Fable', value: 'fable' }
]

const audioSpeedOptions = [
  { label: '0.5x', value: '0.5' },
  { label: '1.0x', value: '1.0' },
  { label: '1.5x', value: '1.5' },
  { label: '2.0x', value: '2.0' }
]

const filteredModels = computed(() => {
  const list = props.modelList ?? []
  if (!modelSearch.value) return list
  const search = modelSearch.value.toLowerCase()
  return list.filter(
    (m) =>
      m.name.toLowerCase().includes(search) ||
      m.description?.toLowerCase().includes(search) ||
      m.platform?.toLowerCase().includes(search)
  )
})

const handleSelectRole = (role: RoleInfo) => {
  emit('select-role', role)
  showRolePopover.value = false
}

const handleSelectModel = (model: ModelInfo) => {
  emit('select-model', model)
  showModelPopover.value = false
}

const handleSendAI = (data: { content: string }) => {
  emit('send-ai', data.content)
}

const handleStopAIStream = () => {
  emit('stop-ai-stream')
}

defineExpose({
  focus: () => msgInputRef.value?.focus(),
  clear: () => msgInputRef.value?.clear()
})
</script>

<style scoped lang="scss">
.chat-input-container {
  @apply flex flex-col;
}

.role-selector,
.model-selector {
  @apply bg-[--bg-color] rounded-8px overflow-hidden;
}

.role-header,
.model-header {
  @apply flex items-center justify-between p-12px border-b-1px border-[--line-color];
}

.role-title,
.model-title {
  @apply text-14px font-500 text-[--chat-text-color];
}

.role-list,
.model-list {
  @apply max-h-300px overflow-y-auto;
}

.loading-container,
.empty-container {
  @apply flex flex-col items-center justify-center py-20px;
}

.loading-text {
  @apply text-12px text-#909090 mt-8px;
}

.roles-container,
.models-container {
  @apply p-8px;
}

.role-item,
.model-item {
  @apply flex items-center gap-8px p-8px rounded-6px cursor-pointer transition-all;
  @apply hover:bg-[--chat-hover-color];

  &.active {
    @apply bg-[--chat-hover-color];
  }
}

.role-name,
.model-name {
  @apply text-14px text-[--chat-text-color] truncate;
}

.role-desc {
  @apply text-12px text-#909090 truncate;
}
</style>
