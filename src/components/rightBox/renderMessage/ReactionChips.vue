<template>
  <div v-if="reactions.length" class="reaction-chips" :class="{ 'justify-end': isMe }">
    <button
      v-for="reaction in reactions"
      :key="reaction.key"
      type="button"
      class="reaction-chip"
      :class="{ mine: reaction.me }"
      :disabled="loading"
      :aria-label="`${reaction.key} ${reaction.count}`"
      @click.stop="handleToggle(reaction.key)">
      <img v-if="emojiUrl(reaction.key)" :src="emojiUrl(reaction.key)!" alt="" class="chip-emoji" />
      <span v-else class="chip-text">{{ reaction.key }}</span>
      <span class="chip-count">{{ reaction.count }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useMitt } from '@/composables/common/useMitt'
import { useReactionFlow } from '@/composables/messaging/useReactionFlow'
import { MittEnum } from '@/enums'
import { matrixReactionService } from '@/services/matrix/messaging/MatrixReactionService'
import { createQuickReactionEmojis } from './quickReactionEmojis'

const props = defineProps<{
  roomId: string
  eventId: string
  isMe?: boolean
}>()

const { reactions, loading, getReactions, toggleReaction } = useReactionFlow({
  roomId: () => props.roomId,
  eventId: () => props.eventId
})

// 首屏同步读本地关系聚合：必须在首次渲染前填充，否则虚拟滚动测量行高时
// 拿不到 chip 高度（size-dependencies 里没有反应状态），chip 出现后行高不重算，
// 会被下一条消息行覆盖。这里刻意不用 onMounted。
// 只读本地聚合，避免为每条消息发一次 /relations 请求。
reactions.value = matrixReactionService.getReactionsForEvent(props.roomId, props.eventId)

const emojiMap = new Map(createQuickReactionEmojis((key) => key).map((item) => [item.key, item.url]))

const emojiUrl = (key: string): string | undefined => emojiMap.get(key)

const handleToggle = (key: string): void => {
  void toggleReaction(key)
}

// 冷启动 / 新设备登录时，本地时间线里可能残留已被撤回的回应（撤回事件不在本地窗口内），
// 只靠本地聚合会让 chip 复活。已有本地 chip 时向服务端核验一次（空则不发请求，避免逐条消息打接口），
// 服务端是全量回应的权威来源，撤回后必须归零。
onMounted(() => {
  if (!reactions.value.length) return
  void getReactions({ forceRefresh: true })
})

// 房间内消息反应变更时刷新：仅处理与本条消息相关的反应事件/撤回。
useMitt.on<{ roomId: string; eventId?: string }>(MittEnum.MSG_REACTIONS_CHANGED, ({ roomId, eventId }) => {
  if (roomId !== props.roomId) return
  if (eventId && eventId !== props.eventId) return
  void getReactions({ forceRefresh: true })
})
</script>

<style scoped lang="scss">
.reaction-chips {
  @apply flex flex-wrap items-center gap-4px mt-2px;
}

.reaction-chip {
  @apply flex items-center gap-2px h-22px px-6px rounded-full cursor-pointer;
  background: var(--tjg-fill-hover);
  border: 1px solid transparent;
  color: var(--tjg-text-secondary);

  &.mine {
    background: color-mix(in srgb, var(--tjg-color-primary-500) 14%, transparent);
    border-color: var(--tjg-color-primary-500);
  }

  &:disabled {
    cursor: default;
    opacity: 0.7;
  }
}

.chip-emoji {
  @apply w-14px h-14px;
}

.chip-text {
  @apply text-12px leading-none;
}

.chip-count {
  @apply text-11px leading-none;
  color: var(--tjg-text-tertiary);
}
</style>
