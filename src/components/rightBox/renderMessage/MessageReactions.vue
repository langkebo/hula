<template>
  <div v-if="reactionList.length > 0" class="message-reactions">
    <n-popover v-for="reaction in reactionList" :key="reaction.key" trigger="hover" placement="top" :show-arrow="false">
      <template #trigger>
        <button
          type="button"
          class="reaction-badge"
          :class="{ 'reaction-badge--active': reaction.reacted }"
          @click="$emit('toggle', reaction.key)">
          <img :src="reaction.url" :alt="reaction.key" class="reaction-badge__emoji" />
          <span class="reaction-badge__count">{{ reaction.count }}</span>
        </button>
      </template>
      <span>{{ reaction.title }}</span>
    </n-popover>
  </div>
</template>

<script setup lang="ts">
import { MarkEnum } from '@/enums'

defineOptions({ name: 'MessageReactions' })

const props = defineProps<{
  reactions: Record<string, number>
  userReactions?: Record<string, boolean>
}>()

defineEmits<(e: 'toggle', key: string) => void>()

const EMOJI_MAP: Record<string, { title: string; url: string }> = {
  [MarkEnum.LIKE]: { title: '点赞', url: '/emojis/like.png' },
  [MarkEnum.HEART]: { title: '爱心', url: '/emojis/heart.png' },
  [MarkEnum.LOL]: { title: '笑哭', url: '/emojis/lol.png' },
  [MarkEnum.ANGRY]: { title: '愤怒', url: '/emojis/angry.png' },
  [MarkEnum.ROCKET]: { title: '火箭', url: '/emojis/rocket.png' },
  [MarkEnum.CELEBRATE]: { title: '礼炮', url: '/emojis/celebrate.png' }
}

const reactionList = computed(() => {
  return Object.entries(EMOJI_MAP)
    .filter(([key]) => (props.reactions?.[key] ?? 0) > 0 || (props.userReactions?.[key] ?? false))
    .map(([key, emoji]) => ({
      key,
      count: props.reactions?.[key] ?? 0,
      reacted: props.userReactions?.[key] ?? false,
      title: emoji.title,
      url: emoji.url
    }))
    .sort((a, b) => b.count - a.count)
})
</script>

<style scoped lang="scss">
.message-reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.reaction-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border: 1px solid var(--tjg-border-default);
  border-radius: 10px;
  background: var(--tjg-fill-default);
  cursor: pointer;
  transition: all var(--tjg-motion-duration-fast) ease;
  font-size: 11px;
  line-height: 1.4;
  color: var(--tjg-text-secondary);

  &:hover {
    background: var(--tjg-fill-hover);
    border-color: var(--tjg-color-primary-400);
  }

  &--active {
    background: color-mix(in srgb, var(--tjg-color-primary-500) 12%, transparent);
    border-color: var(--tjg-color-primary-400);
  }

  &__emoji {
    width: 14px;
    height: 14px;
  }

  &__count {
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
}
</style>
