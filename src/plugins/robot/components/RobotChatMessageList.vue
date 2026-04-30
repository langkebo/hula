<template>
  <div class="chat-messages-container w-full box-border flex flex-col">
    <div
      ref="scrollContainerRef"
      class="chat-scrollbar flex-1 min-h-0 scrollbar-container"
      :class="{ 'hide-scrollbar': !showScrollbar }"
      @scroll="handleScroll"
      @mouseenter="showScrollbar = true"
      @mouseleave="showScrollbar = false">
      <div ref="messageContentRef" class="p-[16px_16px] box-border">
        <div class="flex gap-12px mb-12px">
          <n-avatar
            class="rounded-8px flex-shrink-0"
            :src="getModelAvatar(selectedModel)"
            :fallback-src="getDefaultAvatar()" />
          <n-flex vertical justify="space-between">
            <p class="text-(12px [--hula-text-primary])">
              {{ selectedModel ? selectedModel.name : 'GPT-4' }}
              <n-tag
                v-if="selectedModel"
                :type="selectedModel.status === 0 ? 'success' : 'error'"
                size="tiny"
                class="ml-8px">
                {{ selectedModel.status === 0 ? '可用' : '不可用' }}
              </n-tag>
            </p>
            <div class="bubble select-text text-14px">
              <p>{{ `你好，我是${selectedModel?.name || ''}，很高兴为您服务。` }}</p>
            </div>
          </n-flex>
        </div>

        <div v-if="loadingMessages" class="flex justify-center items-center py-20px text-(12px #909090)">
          <n-spin size="small" />
          <span class="ml-10px">加载消息中...</span>
        </div>

        <div
          v-for="(message, index) in messageList"
          :key="message.id || `${message.type}-${index}-${message.createTime || 0}`"
          class="message-row group flex flex-col mb-12px"
          :data-message-index="index"
          :data-message-id="message.id">
          <div class="flex items-start gap-10px" :class="message.type === 'user' ? 'flex-row-reverse' : ''">
            <n-avatar
              v-if="message.type === 'user'"
              :size="34"
              class="select-none rounded-8px flex-shrink-0"
              :class="message.type === 'user' ? 'ml-2px' : 'mr-2px'"
              :src="resolvedUserAvatar"
              :fallback-src="getDefaultAvatar()" />
            <n-avatar
              v-else
              :size="34"
              class="select-none rounded-8px flex-shrink-0"
              :class="message.type === 'assistant' ? 'mr-2px' : 'ml-2px'"
              :src="getModelAvatar(selectedModel)"
              :fallback-src="getDefaultAvatar()" />
            <n-flex vertical :size="6" class="flex-1" :class="message.type === 'user' ? 'items-end' : 'items-start'">
              <n-flex
                align="center"
                :size="8"
                class="select-none text-(12px #909090)"
                :class="message.type === 'user' ? 'flex-row-reverse' : ''">
                <p>{{ message.type === 'user' ? '我' : selectedModel ? selectedModel.name : 'AI' }}</p>
                <n-popconfirm
                  v-if="message.id"
                  @positive-click="emit('delete-message', message.id, index)"
                  positive-text="删除"
                  negative-text="取消">
                  <template #trigger>
                    <div
                      class="delete-btn opacity-0 group-hover:opacity-100 cursor-pointer text-#909090 hover:text-#d5304f transition-all"
                      title="删除消息">
                      <svg class="w-14px h-14px"><use href="#delete"></use></svg>
                    </div>
                  </template>
                  <p>确定要删除这条消息吗？</p>
                </n-popconfirm>
              </n-flex>
              <div :class="getMessageBubbleClass(message)" class="select-text text-14px" style="white-space: pre-wrap">
                <template v-if="message.type === 'user'">
                  {{ message.content }}
                </template>
                <template v-else>
                  <template v-if="message.msgType === AiMsgContentTypeEnum.IMAGE">
                    <template v-if="isRenderableAiImage(message)">
                      <img
                        :src="message.content"
                        alt="生成的图片"
                        class="max-w-400px max-h-400px rounded-8px cursor-pointer"
                        @click="emit('preview-image', message.content)" />
                    </template>
                    <template v-else>
                      <div class="flex flex-col gap-8px">
                        <div class="bubble bubble-ai select-text text-14px" style="white-space: pre-wrap">
                          {{ getAiPlaceholderText(message) }}
                        </div>
                      </div>
                    </template>
                  </template>
                  <template v-else-if="message.msgType === AiMsgContentTypeEnum.VIDEO">
                    <template v-if="isLikelyMediaUrl(message.content)">
                      <video
                        :src="message.content"
                        controls
                        class="max-w-600px max-h-400px rounded-8px"
                        preload="metadata">
                        您的浏览器不支持视频播放
                      </video>
                    </template>
                    <template v-else>
                      <div class="bubble bubble-ai select-text text-14px" style="white-space: pre-wrap">
                        {{ getAiPlaceholderText(message) }}
                      </div>
                    </template>
                  </template>
                  <template v-else-if="message.msgType === AiMsgContentTypeEnum.AUDIO">
                    <template v-if="isLikelyMediaUrl(message.content)">
                      <audio :src="message.content" controls class="w-300px" preload="metadata">
                        您的浏览器不支持音频播放
                      </audio>
                    </template>
                    <template v-else>
                      <div class="bubble bubble-ai select-text text-14px" style="white-space: pre-wrap">
                        {{ getAiPlaceholderText(message) }}
                      </div>
                    </template>
                  </template>
                  <template v-else>
                    <div class="flex flex-col gap-8px">
                      <div
                        v-if="message.reasoningContent"
                        class="reasoning-content p-12px rounded-8px bg-[#f5f5f5] dark:bg-[#2a2a2a] border-(1px solid #e0e0e0) dark:border-(1px solid #404040)">
                        <div class="flex items-center gap-6px mb-8px">
                          <Icon icon="mdi:brain" class="text-16px text-[#1890ff]" />
                          <span class="text-12px text-[#666] dark:text-[#aaa] font-500">思考过程</span>
                        </div>
                        <div class="code-block-wrapper" :class="isDarkTheme ? 'code-block-dark' : 'code-block-light'">
                          <MarkdownRender
                            :content="message.reasoningContent"
                            :custom-id="markdownCustomId"
                            :is-dark="isDarkTheme"
                            :enable-monaco="false"
                            :viewportPriority="false"
                            :themes="markdownThemes"
                            :code-block-props="markdownCodeBlockProps" />
                        </div>
                      </div>

                      <div class="code-block-wrapper" :class="isDarkTheme ? 'code-block-dark' : 'code-block-light'">
                        <MarkdownRender
                          :content="message.content"
                          :custom-id="markdownCustomId"
                          :is-dark="isDarkTheme"
                          :enable-monaco="false"
                          :viewportPriority="false"
                          :themes="markdownThemes"
                          :code-block-props="markdownCodeBlockProps" />
                      </div>
                    </div>
                  </template>
                </template>
              </div>
            </n-flex>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useResizeObserver } from '@vueuse/core'
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue'
import { AiMsgContentTypeEnum, ThemeEnum } from '@/enums'
import type { Message } from '@/plugins/robot/composables/useRobotChat'
import { ROBOT_MARKDOWN_CUSTOM_ID } from '@/plugins/robot/utils/markdown'
import type { AIModel } from '@/services/matrix'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'

const MarkdownRender = defineAsyncComponent(async () => {
  const { initMarkdownRenderer } = await import('@/plugins/robot/utils/markdown')
  await initMarkdownRenderer()
  await import('markstream-vue/index.css')
  const mod = await import('markstream-vue')
  return mod.default
})

const SHIKI_LIGHT_THEME = 'vitesse-light'
const SHIKI_DARK_THEME = 'vitesse-dark'
const markdownCustomId = ROBOT_MARKDOWN_CUSTOM_ID
const markdownThemes = [SHIKI_LIGHT_THEME, SHIKI_DARK_THEME]

const props = defineProps<{
  messageList: Message[]
  loadingMessages: boolean
  messageRenderVersion: number
  selectedModel: AIModel | null
  userAvatar?: string
  getModelAvatar: (model: AIModel | null) => string
  getDefaultAvatar: () => string
  getMessageBubbleClass: (message: Message) => string[]
  getAiPlaceholderText: (message: Message) => string
  isLikelyMediaUrl: (value?: string) => boolean
}>()

const emit = defineEmits<{
  'preview-image': [imageUrl: string]
  'delete-message': [messageId: string, index: number]
}>()

const settingStore = useSettingStore()
const resolvedUserAvatar = computed(() => (props.userAvatar ? AvatarUtils.getAvatarUrl(props.userAvatar) : ''))
const isDarkTheme = computed(() => {
  const content = settingStore.themeContent
  if (!content) {
    return document.documentElement.dataset.theme === ThemeEnum.DARK
  }
  return content === ThemeEnum.DARK
})
const markdownCodeBlockProps = computed(() => ({
  isDark: isDarkTheme.value,
  darkTheme: SHIKI_DARK_THEME,
  lightTheme: SHIKI_LIGHT_THEME,
  themes: [SHIKI_DARK_THEME, SHIKI_LIGHT_THEME] as const,
  showHeader: true
}))

const scrollContainerRef = ref<HTMLElement | null>(null)
const messageContentRef = ref<HTMLElement | null>(null)
const shouldAutoStickBottom = ref(true)
const showScrollbar = ref(true)

const isRenderableAiImage = (message: Message) => {
  if (message.type !== 'assistant') return false
  if (!message.content) return false
  const lower = message.content.toLowerCase()
  const isImage =
    /^https?:\/\//.test(message.content) ||
    lower.startsWith('data:image/') ||
    lower.startsWith('asset:') ||
    lower.startsWith('file:') ||
    lower.startsWith('tauri://') ||
    lower.startsWith('blob:')
  return (
    isImage &&
    (message.msgType === AiMsgContentTypeEnum.IMAGE || message.msgType === undefined || message.msgType === null)
  )
}

const getScrollContainer = () => scrollContainerRef.value

const isNearBottom = () => {
  const container = getScrollContainer()
  if (!container) return true
  const offset = container.scrollHeight - (container.scrollTop + container.clientHeight)
  return offset <= 80
}

const scrollToBottom = (retryCount = 2) => {
  shouldAutoStickBottom.value = true
  const raf =
    typeof window === 'undefined'
      ? (cb: FrameRequestCallback) => setTimeout(() => cb(0), 16)
      : window.requestAnimationFrame

  const scroll = () => {
    const container = getScrollContainer()
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior: 'auto' })
  }

  const runWithRetry = (remaining: number) => {
    raf(() => {
      scroll()
      if (remaining > 0) {
        runWithRetry(remaining - 1)
      }
    })
  }

  nextTick(() => {
    runWithRetry(retryCount)
  })
}

const handleScroll = () => {
  shouldAutoStickBottom.value = isNearBottom()
}

watch(scrollContainerRef, () => {
  handleScroll()
})

watch(
  () => props.messageRenderVersion,
  () => {
    if (shouldAutoStickBottom.value) {
      scrollToBottom()
    }
  },
  { immediate: true }
)

useResizeObserver(messageContentRef, () => {
  if (shouldAutoStickBottom.value) {
    scrollToBottom()
  }
})
</script>

<style scoped lang="scss">
:deep(.link-node),
:deep(.footnote-link) {
  --link-color: #13987f;
  color: #13987f;
}
</style>
