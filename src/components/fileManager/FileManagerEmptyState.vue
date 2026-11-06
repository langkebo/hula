<template>
  <div class="flex-center h-full">
    <div class="empty-content">
      <Icon :icon="resolvedIcon" class="empty-icon mb-16px" :width="58" />

      <!-- 标题 -->
      <h3
        v-if="title"
        class="empty-title text-[length:var(--tjg-font-size-2lg)] font-500 text-[--tjg-text-primary] mb-8px m-0">
        {{ title }}
      </h3>

      <!-- 操作按钮 -->
      <div v-if="$slots.actions" class="empty-actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    icon?: string
    title?: string
  }>(),
  {
    icon: 'folder',
    title: ''
  }
)

const iconMap: Record<string, string> = {
  search: 'mdi:magnify',
  folder: 'mdi:folder-outline',
  user: 'mdi:account-outline',
  message: 'mdi:message-text-outline',
  group: 'mdi:account-group-outline'
}

const resolvedIcon = computed(() => iconMap[props.icon] || props.icon)
</script>

<style scoped lang="scss">
.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  animation: fadeInUp var(--tjg-motion-duration-xslow) ease-out;
}

.empty-icon {
  color: var(--tjg-text-primary);
  opacity: 0.3;
  transition: opacity var(--tjg-motion-duration-slow) ease;
}

.empty-title {
  line-height: 1.2;
  animation: fadeInUp var(--tjg-motion-duration-xslow) ease-out var(--tjg-motion-duration-fast) both;
}

.empty-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  animation: fadeInUp var(--tjg-motion-duration-xslow) ease-out var(--tjg-motion-duration-slow) both;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 减少动画
@media (prefers-reduced-motion: reduce) {
  .empty-content,
  .empty-title,
  .empty-actions {
    animation: none;
  }

  .empty-icon {
    transition: none;
  }

  .empty-content:hover .empty-icon {
    transform: none;
  }
}
</style>
