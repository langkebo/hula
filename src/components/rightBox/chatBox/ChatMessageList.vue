<template>
  <!-- 没有更多消息提示 -->
  <div
    v-show="isMainViewReady && chatStore.shouldShowNoMoreMessage"
    class="flex-center gap-6px h-32px flex-shrink-0 cursor-default select-none">
    <p class="text-[var(--text-sm)] text-[--tjg-text-tertiary]">{{ t('home.chat_main.no_more') }}</p>
  </div>

  <!-- 首屏加载失败：必须与「暂无消息」区分，否则用户会以为这个会话本来就是空的 -->
  <ErrorState
    v-if="isMainViewReady && chatStore.chatMessageList.length === 0 && initialLoadFailed"
    data-testid="message-list-load-error"
    illustration="network-error"
    :title="t('message.load_messages_failed')"
    :message="t('home.chat_main.load_failed_desc')"
    :retry-text="t('common.retry')"
    class="flex-1 py-60px"
    @retry="handleRetryInitialLoad" />

  <!-- 空状态（已排除「加载失败」这一分支） -->
  <EmptyState
    v-if="isMainViewReady && chatStore.chatMessageList.length === 0 && !initialLoadFailed"
    illustration="no-conversations"
    :title="t('home.chat_main.empty_title')"
    :description="t('home.chat_main.empty_desc')"
    class="flex-1 py-60px" />
  <DynamicScroller
    v-if="isMainViewReady"
    class="scroller flex-1"
    :items="chatStore.chatMessageList"
    :min-item-size="62"
    :buffer="10"
    key-field="clientKey"
    v-slot="{ item, index, active }">
    <DynamicScrollerItem
      :item="item"
      :active="active"
      :size-dependencies="[
        item.message.body,
        item.message.type,
        item.message.status,
        item.uploadProgress,
        item.message.content?.info?.h?._,
        item.message.content?.file?._,
        item.replyEvent
      ]"
      :data-index="index">
      <n-flex vertical class="flex-y-center mb-12px" :data-message-id="item.message.id" :data-message-index="index">
        <!-- 未读分隔线：进入会话时按未读边界快照插入一次 -->
        <div
          v-if="index === unreadDividerIndex"
          class="unread-divider"
          role="separator"
          :aria-label="t('home.chat_main.unread_divider')">
          <span class="unread-divider__label">{{ t('home.chat_main.unread_divider') }}</span>
        </div>
        <!-- 信息间隔时间：居中 chip，用 secondary 文本色保证小字号下的对比度 -->
        <span class="message-time-separator select-none" v-if="shouldShowTimeBlock(index)" @click.stop>
          {{ formatChatTime(item.message.sendTime) }}
        </span>
        <!-- 消息内容容器 -->
        <div
          @mouseenter="handleRowMouseEnter(item.message.id)"
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
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import { useUnreadDividerIndex } from '@/composables/chat/useUnreadDivider'
import { MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { formatChatTime } from '@/utils/ComputedTime'
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
const canHover = (() => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
})()

const handleRowMouseEnter = (messageId: string) => {
  // 触屏会合成 mouseenter，若直接写入会产生粘滞 hover 态
  if (!canHover) return
  hoverId.value = messageId
}

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

/**
 * 首屏加载失败：toast 一闪而过，列表又是空的 ⇒ 必须给一个持久、可重试的错误态。
 * 数据来源是 store 的 `loadFailed`（见 `chat/messageLoading.ts`）。
 */
const initialLoadFailed = computed(() => chatStore.currentMessageOptions?.loadFailed?.scope === 'initial')

/** 重试首屏：清空当前房间消息后重新走一次首屏加载（失败会再次落回本错误态） */
const handleRetryInitialLoad = (): void => {
  void chatStore.resetAndRefreshCurrentRoomMessages()
}

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

// 未读分隔线插入位置（进入会话时按未读边界快照）
const unreadDividerIndex = useUnreadDividerIndex()

// 微信式时间分割：首条或与上一条间隔超过 5 分钟才展示，避免连续消息逐条显示时间
const TIME_BLOCK_GAP_MS = 5 * 60 * 1000
const shouldShowTimeBlock = (index: number): boolean => {
  const list = chatStore.chatMessageList
  const current = list[index]
  if (!current) return false
  if (index === 0) return true
  const previous = list[index - 1]
  return current.message.sendTime - (previous?.message.sendTime ?? 0) >= TIME_BLOCK_GAP_MS
}
</script>

<style scoped lang="scss">
// Discord 式消息行 hover 高亮（需求文档 6.5 节）
.message-row {
  transition: background-color var(--tjg-motion-duration-fast) ease;
  border-radius: 4px;
}

// 触屏无真实 hover，只在具备指针悬停能力的设备上生效，避免点击后粘滞高亮
@media (hover: hover) and (pointer: fine) {
  .message-row--hoverable:hover:not(.active-reply):not(.message-row--multi-select) {
    background: color-mix(in srgb, var(--tjg-text-primary) 4%, transparent);
  }
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

.message-time-separator {
  align-self: center;
  padding: 2px 10px;
  font-size: var(--text-sm);
  color: var(--tjg-text-secondary);
  background: color-mix(in srgb, var(--tjg-surface-muted) 80%, transparent);
  border-radius: var(--tjg-radius-full);
}

.unread-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 4px 0;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--tjg-color-primary-500);
    opacity: 0.5;
  }
}

.unread-divider__label {
  flex-shrink: 0;
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-color-primary-500);
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
