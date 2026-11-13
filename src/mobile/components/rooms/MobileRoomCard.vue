<template>
  <div
    class="flex items-center gap-12px px-16px py-12px tap-highlight"
    :data-testid="`mobile-room-item-${item.roomId}`"
    @click="emit('click')">
    <div class="flex-shrink-0">
      <van-badge :offset="[-6, 6]" color="var(--tjg-color-danger-500)" :content="unreadLabel" :max="99">
        <img
          class="size-48px rounded-12px object-cover"
          :src="item.avatarUrl || '/logo.png'"
          :alt="item.name"
          loading="lazy"
          decoding="async"
          @error="($event.target as HTMLImageElement).src = '/logo.png'" />
      </van-badge>
    </div>

    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-6px min-w-0">
        <span class="text-15px font-500 text-[--tjg-text-primary] truncate">{{ item.name }}</span>
        <svg
          v-if="item.isEncrypted"
          class="size-12px flex-shrink-0 color-[--tjg-color-success-500]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          :aria-label="encryptedLabel"
          role="img">
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      </div>
      <div class="text-12px text-[--tjg-text-tertiary] truncate mt-2px" data-testid="room-summary">
        {{ summaryText }}
      </div>
    </div>

    <div class="flex flex-col items-end gap-4px flex-shrink-0">
      <span class="text-11px text-[--tjg-text-tertiary]" data-testid="room-active-time">{{ timeLabel }}</span>
      <span class="text-11px text-[--tjg-text-tertiary]">{{ item.memberCount }} {{ membersLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RoomCardModel } from '@/mobile/views/rooms/roomListModel'
import { formatUnreadCount } from '@/mobile/views/rooms/roomListModel'

const props = defineProps<{
  item: RoomCardModel
  summaryText: string
  timeLabel: string
  membersLabel: string
  encryptedLabel: string
}>()

const emit = defineEmits<{
  click: []
}>()

const unreadLabel = computed(() => formatUnreadCount(props.item.unreadCount))
</script>

<style scoped lang="scss">
.tap-highlight {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;

  &:active {
    background-color: var(--tjg-bg-pressed);
  }
}
</style>
