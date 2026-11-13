<template>
  <div v-clickable class="space-card" @click="emit('select', space)">
    <div class="space-cover">
      <img v-if="space.avatarUrl" :src="space.avatarUrl" :alt="space.name" />
      <div v-else class="default-cover">
        <van-icon name="cluster-o" size="40" />
      </div>
    </div>
    <div class="space-info">
      <div class="space-name">{{ space.name }}</div>
      <div v-if="space.topic" class="space-topic">{{ space.topic }}</div>
      <div class="space-stats">
        <span>
          <van-icon name="friends-o" />
          {{ space.memberCount }}
        </span>
        <span>
          <van-icon name="chat-o" />
          {{ space.childCount }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SpaceInfo } from '@/services/matrix/room/MatrixSpaceService'

defineProps<{ space: SpaceInfo }>()

const emit = defineEmits<{ select: [space: SpaceInfo] }>()
</script>

<style scoped lang="scss">
.space-card {
  background: var(--tjg-glass-row-bg);
  border: var(--tjg-glass-border-soft);
  border-radius: var(--tjg-radius-xl);
  overflow: hidden;
  box-shadow: var(--tjg-glass-inner-highlight);
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
  transition:
    background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard),
    transform var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:active {
    background: var(--tjg-glass-row-bg-pressed);
    transform: scale(var(--tjg-glass-press-scale));
  }

  .space-cover {
    width: 100%;
    aspect-ratio: 16/9;
    background: var(--van-gray-2);
    display: flex;
    align-items: center;
    justify-content: center;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .default-cover {
      color: var(--van-gray-5);
    }
  }

  .space-info {
    padding: 12px;

    .space-name {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .space-topic {
      font-size: 12px;
      color: var(--van-text-color-2);
      margin-bottom: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .space-stats {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: var(--van-text-color-3);

      span {
        display: flex;
        align-items: center;
        gap: 4px;
      }
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .space-card {
    transition: none;
  }

  .space-card:active {
    transform: none;
  }
}
</style>
