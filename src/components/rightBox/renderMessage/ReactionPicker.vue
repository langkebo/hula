<template>
  <div class="reaction-picker">
    <div class="reaction-grid">
      <div
        v-for="emoji in quickEmojis"
        :key="emoji.value"
        class="reaction-item"
        :class="{ active: hasReacted(emoji.value) }"
        @click="handleReaction(emoji)">
        <img :src="emoji.url" :alt="emoji.title" class="emoji-img" />
      </div>
    </div>
    <div class="more-reactions">
      <n-popover trigger="click" placement="top" :show-arrow="false">
        <template #trigger>
          <n-button text size="tiny">
            <template #icon>
              <svg class="size-16px">
                <use href="#smiling-face"></use>
              </svg>
            </template>
            {{ t('message.more_reactions') }}
          </n-button>
        </template>
        <Emoticon @emojiHandle="handleEmojiSelect" :all="false" />
      </n-popover>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { MarkEnum } from '@/enums'
import { matrixReactionService } from '@/services/matrix'
import Emoticon from '@/components/rightBox/emoticon/index.vue'

import { createLogger } from '@/utils/Logger'
const logger = createLogger('ReactionPicker')

const props = defineProps<{
  roomId: string
  eventId: string
  userReactions?: Record<string, boolean>
}>()

const emit = defineEmits<{
  (e: 'reaction-added', key: string): void
  (e: 'reaction-removed', key: string): void
}>()

const { t } = useI18n()

const quickEmojis = [
  { value: MarkEnum.LIKE, title: '点赞', url: '/emojis/like.png' },
  { value: MarkEnum.HEART, title: '爱心', url: '/emojis/heart.png' },
  { value: MarkEnum.LOL, title: '笑哭', url: '/emojis/lol.png' },
  { value: MarkEnum.ANGRY, title: '愤怒', url: '/emojis/angry.png' },
  { value: MarkEnum.ROCKET, title: '火箭', url: '/emojis/rocket.png' },
  { value: MarkEnum.FLOWER, title: '鲜花', url: '/emojis/flower.png' }
]

const hasReacted = (value: MarkEnum): boolean => {
  return props.userReactions?.[String(value)] ?? false
}

const handleReaction = async (emoji: { value: MarkEnum; title: string }) => {
  try {
    const hasExisting = hasReacted(emoji.value)
    if (hasExisting) {
      await matrixReactionService.toggleReaction(props.roomId, props.eventId, emoji.title)
      emit('reaction-removed', String(emoji.value))
    } else {
      await matrixReactionService.addReaction(props.roomId, props.eventId, emoji.title)
      emit('reaction-added', String(emoji.value))
    }
  } catch (error) {
    logger.error('反应操作失败:', error)
  }
}

const handleEmojiSelect = async (
  emoji: string | { renderUrl: string; serverUrl: string },
  type: 'emoji' | 'emoji-url' = 'emoji'
) => {
  if (type === 'emoji-url') {
    const emojiUrl = typeof emoji === 'string' ? emoji : emoji.serverUrl
    try {
      await matrixReactionService.addReaction(props.roomId, props.eventId, emojiUrl)
      emit('reaction-added', emojiUrl)
    } catch (error) {
      logger.error('添加表情反应失败:', error)
    }
  }
}
</script>

<style scoped lang="scss">
.reaction-picker {
  @apply flex flex-col gap-8px p-8px bg-[--bg-emoji] rounded-8px;
  box-shadow: 2px 2px 12px 2px var(--box-shadow-color);
}

.reaction-grid {
  @apply flex flex-wrap gap-6px;
}

.reaction-item {
  @apply flex-center w-32px h-32px rounded-6px cursor-pointer transition-all;

  &:hover {
    background: var(--emoji-hover);
    transform: scale(1.1);
  }

  &.active {
    background: var(--color-primary-hover);
  }
}

.emoji-img {
  @apply w-24px h-24px;
}

.more-reactions {
  @apply flex-center border-t-1px border-solid border-[--border-color] pt-8px;
}
</style>
