<template>
  <!-- 没有更多消息提示 -->
  <div
    v-show="isMainViewReady && chatStore.shouldShowNoMoreMessage"
    class="flex-center gap-6px h-32px flex-shrink-0 cursor-default select-none">
    <p class="text-[var(--text-sm)] text-[--tjg-text-tertiary]">{{ t('home.chat_main.no_more') }}</p>
  </div>

  <!-- 空状态 -->
  <EmptyState
    v-if="isMainViewReady && chatStore.chatMessageList.length === 0"
    illustration="no-conversations"
    :title="t('home.chat_main.empty_title')"
    :description="t('home.chat_main.empty_desc')"
    class="flex-1 py-60px" />
  <DynamicScroller
    v-if="isMainViewReady"
    class="scroller flex-1"
    :items="chatStore.chatMessageList"
    :min-item-size="40"
    :buffer="10"
    key-field="clientKey"
    v-slot="{ item, index, active }">
    <DynamicScrollerItem
      :item="item"
      :active="active"
      :size-dependencies="[
        item.message.body,
        item.message.msgtype,
        item.message.content?.info?.h?._,
        item.message.content?.file?._,
        item.replyEvent
      ]"
      :data-index="index">
      <n-flex vertical class="flex-y-center mb-12px" :data-message-id="item.message.id" :data-message-index="index">
        <!-- 信息间隔时间 -->
        <span
          class="text-[var(--text-sm)] text-[--tjg-text-tertiary] select-none p-4px"
          v-if="item.timeBlock"
          @click.stop>
          {{ formatChatTime(item.message.sendTime) }}
        </span>
        <!-- 消息内容容器 -->
        <div
          @mouseenter="hoverId = item.message.id"
          :class="[
            'w-full box-border message-row',
            item.message.type === MsgEnum.RECALL ? 'min-h-22px' : 'min-h-62px',
            isGroup ? 'p-[14px_10px_14px_20px]' : 'chat-single p-[4px_10px_10px_20px]',
            { 'active-reply': activeReply === item.message.id },
            { 'message-row--multi-select': computeMsgHover(item) },
            { 'message-row--hoverable': !chatStore.isMsgMultiChoose },
            { 'message-row--private-mode': privateModeActive },
            { 'message-row--private-mode-sender': privateModeActive && isMessageFromMe(item) },
            { 'message-row--private-mode-receiver': privateModeActive && !isMessageFromMe(item) }
          ]"
          @click="
            () => {
              if (chatStore.isMsgMultiChoose && isMessageMultiSelectEnabled(item.message.type)) {
                item.isCheck = !item.isCheck
              }
            }
          ">
          <RenderMessage
            :message="item"
            :is-group="isGroup"
            :from-user="{ uid: getMessageSenderUid(item) }"
            :upload-progress="item.uploadProgress"
            @jump2-reply="emit('jumpToReply', $event)" />
        </div>
      </n-flex>
    </DynamicScrollerItem>
  </DynamicScroller>
  <div v-else class="message-list-placeholder">
    <div class="message-skeleton message-skeleton--left"></div>
    <div class="message-skeleton message-skeleton--right"></div>
    <div class="message-skeleton message-skeleton--left message-skeleton--short"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import EmptyState from '@/components/common/EmptyState.vue'
import { MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { formatChatTime } from '@/utils/ComputedTime'
import { createLogger } from '@/utils/Logger'
import { isMessageMultiSelectEnabled } from '@/utils/MessageSelect'

const props = defineProps<{
  isGroup: boolean
  privateModeActive: boolean
  activeReply: string
}>()

const emit = defineEmits<{
  jumpToReply: [eventId: string]
}>()

const { t } = useI18n()
const chatStore = useChatStore()
const globalStore = useGlobalStore()
const userStore = useUserStore()

const hoverId = ref('')
const logger = createLogger('ChatMessageList')

// 诊断：观察当前房间 hasLoadedOnce 状态变化，确认 UI 层是否收到翻转。
watch(
  () => chatStore.currentMessageOptions?.hasLoadedOnce,
  (hasLoadedOnce) => {
    logger.info(
      `[ChatMessageList] currentMessageOptions.hasLoadedOnce 变化: ${hasLoadedOnce}, roomId=${globalStore.currentSessionRoomId}`
    )
  },
  { immediate: true }
)

// 主视图就绪：当前房间消息完成首次加载即可渲染消息区。
// 原先还要求 currentSessionInfo?.roomId === currentRoomId（hasSessionBound），
// 但当会话尚未进入 sessionList（如从通知/搜索/好友页直接进入）时 getSession 取不到，
// 会导致消息已加载完成却永远卡在骨架屏（持续转圈）。会话元信息缺失只影响头部，
// 不应阻塞消息列表渲染，故此处仅以"消息是否已加载过"作为就绪门槛。
const isMainViewReady = computed(() => {
  const currentRoomId = globalStore.currentSessionRoomId ?? null
  if (!currentRoomId) {
    return false
  }

  const hasLoadedCurrentRoom = chatStore.currentMessageOptions?.hasLoadedOnce === true

  return hasLoadedCurrentRoom
})

const computeMsgHover = computed(() => (item: MessageType) => {
  if (!chatStore.isMsgMultiChoose || !isMessageMultiSelectEnabled(item.message.type)) {
    return false
  }

  if (chatStore.msgMultiChooseMode === 'forward') {
    return false
  }

  return hoverId.value === item.message.id || item.isCheck
})

const getMessageSenderUid = (message: MessageType): string => {
  return message.fromUser?.uid ?? ''
}

const isMessageFromMe = (item: MessageType) => getMessageSenderUid(item) === (userStore.userInfo?.uid ?? '')
</script>

<style scoped lang="scss">
// Discord 式消息行 hover 高亮（需求文档 6.5 节）
.message-row {
  transition: background-color var(--tjg-motion-duration-fast) ease;
  border-radius: 4px;
}

.message-row--hoverable:hover:not(.active-reply):not(.message-row--multi-select) {
  background: color-mix(in srgb, var(--tjg-text-primary) 4%, transparent);
}

.message-row--multi-select {
  background: color-mix(in srgb, var(--tjg-text-tertiary) 20%, transparent);
}

// 私密模式样式（原 .private-mode-active .message-row，scoped 边界下改为行内类）
.message-row--private-mode {
  border-left: 2px solid var(--tjg-color-danger-500);
}

.message-row--private-mode-sender {
  background: color-mix(in srgb, var(--tjg-color-danger-500) 8%, transparent);
  border-left: 2px solid var(--tjg-color-danger-500);
}

.message-row--private-mode-receiver {
  border: 1px solid color-mix(in srgb, var(--tjg-color-danger-500) 40%, transparent);
  border-left: 2px solid var(--tjg-color-danger-500);
}

.message-list-placeholder {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 20px 28px;
}

.message-skeleton {
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--tjg-surface-panel) 88%, var(--tjg-text-tertiary) 12%) 0%,
    color-mix(in srgb, var(--tjg-surface-panel) 78%, var(--tjg-text-tertiary) 22%) 50%,
    color-mix(in srgb, var(--tjg-surface-panel) 88%, var(--tjg-text-tertiary) 12%) 100%
  );
  background-size: 200% 100%;
  animation: chat-skeleton-shimmer 1.2s ease-in-out infinite;
}

.message-skeleton--left {
  width: min(320px, 78%);
}

.message-skeleton--right {
  width: min(260px, 64%);
  margin-left: auto;
}

.message-skeleton--short {
  width: min(200px, 52%);
}

@keyframes chat-skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}
</style>
