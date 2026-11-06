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
            {{ t('home.action.more') }}
          </n-button>
        </template>
        <Emoticon @emojiHandle="handleEmojiSelect" :all="false" />
      </n-popover>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { MarkEnum } from '@/enums'
import { matrixReactionService } from '@/services/matrix/messaging/MatrixReactionService'
import { createLogger } from '@/utils/Logger'
import { createQuickReactionEmojis, type QuickReactionEmoji } from './quickReactionEmojis'

const logger = createLogger('ReactionPicker')
const Emoticon = defineAsyncComponent(() => import('@/components/rightBox/emoticon/index.vue'))

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

const quickEmojis = computed(() => createQuickReactionEmojis(t))

const hasReacted = (value: MarkEnum): boolean => {
  return props.userReactions?.[String(value)] ?? false
}

const handleReaction = async (emoji: QuickReactionEmoji) => {
  try {
    const hasExisting = hasReacted(emoji.value)
    if (hasExisting) {
      await matrixReactionService.toggleReaction(props.roomId, props.eventId, emoji.key)
      emit('reaction-removed', String(emoji.value))
    } else {
      await matrixReactionService.addReaction(props.roomId, props.eventId, emoji.key)
      emit('reaction-added', String(emoji.value))
    }
  } catch (error) {
    logger.error('Reaction operation failed:', error)
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
      logger.error('Failed to add emoji reaction:', error)
    }
  }
}
</script>

<style scoped lang="scss">
.reaction-picker {
  @apply flex flex-col gap-8px p-8px bg-[--tjg-surface-panel] rounded-8px;
  box-shadow: var(--tjg-shadow-md);
}

.reaction-grid {
  @apply flex flex-wrap gap-6px;
}

.reaction-item {
  @apply flex-center w-32px h-32px rounded-[var(--tjg-radius-md)] cursor-pointer transition-[width,transform,opacity,color,background-color,border-color,box-shadow];

  &:hover {
    background: var(--tjg-fill-hover);
    transform: scale(1.1);
  }

  &.active {
    background: color-mix(in srgb, var(--tjg-color-primary-500) 16%, transparent);
  }
}

.emoji-img {
  @apply w-24px h-24px;
}

.more-reactions {
  @apply flex-center border-t-1px border-solid border-[--tjg-border-default] pt-8px;
}
</style>
