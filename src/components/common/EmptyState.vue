<template>
  <div class="empty-state" :class="[variantClass, { 'empty-state--compact': compact }]" role="status">
    <div class="empty-state__icon" :class="{ 'empty-state__icon--compact': compact }">
      <!-- 内联 SVG 插图（优先于 iconify 图标） -->
      <svg
        v-if="illustration === 'no-conversations'"
        data-illustration="no-conversations"
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        stroke="var(--hula-text-quaternary)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round">
        <path d="M8 10h32a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H20l-8 6v-6H8a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2z" />
        <path d="M16 20h16M16 26h10" />
      </svg>
      <svg
        v-else-if="illustration === 'no-friends'"
        data-illustration="no-friends"
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        stroke="var(--hula-text-quaternary)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round">
        <circle cx="18" cy="16" r="6" />
        <path d="M8 38c0-6 4.5-10 10-10s10 4 10 10" />
        <circle cx="34" cy="18" r="5" />
        <path d="M30 33c3-1.5 5-4 5-7" />
      </svg>
      <svg
        v-else-if="illustration === 'no-spaces'"
        data-illustration="no-spaces"
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        stroke="var(--hula-text-quaternary)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round">
        <rect x="6" y="6" width="14" height="14" rx="2" />
        <rect x="28" y="6" width="14" height="14" rx="2" />
        <rect x="6" y="28" width="14" height="14" rx="2" />
        <rect x="28" y="28" width="14" height="14" rx="2" />
      </svg>
      <svg
        v-else-if="illustration === 'no-results'"
        data-illustration="no-results"
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        stroke="var(--hula-text-quaternary)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round">
        <circle cx="20" cy="20" r="12" />
        <line x1="29" y1="29" x2="40" y2="40" />
        <path d="M15 20h10M20 15v10" />
      </svg>
      <Icon v-else :icon="icon" />
    </div>
    <p v-if="title" class="empty-state__title">{{ title }}</p>
    <p v-if="description" class="empty-state__description">{{ description }}</p>
    <div v-if="$slots.actions" class="empty-state__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineOptions({ name: 'EmptyState' })

const props = withDefaults(
  defineProps<{
    icon?: string
    title?: string
    description?: string
    compact?: boolean
    variant?: 'default' | 'welcome' | 'subtle'
    /** 内联 SVG 插图类型（优先于 icon 属性） */
    illustration?: 'no-conversations' | 'no-friends' | 'no-spaces' | 'no-results'
  }>(),
  {
    icon: 'mdi:inbox-outline',
    title: '',
    description: '',
    compact: false,
    variant: 'default',
    illustration: undefined
  }
)

const variantClass = computed(() => `empty-state--${props.variant ?? 'default'}`)
</script>

<style scoped lang="scss">
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 24px;
  text-align: center;
  user-select: none;
}

.empty-state--compact {
  gap: 4px;
  padding: 16px 12px;
}

.empty-state__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  font-size: 40px;
  color: color-mix(in srgb, var(--hula-text-tertiary) 70%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--hula-text-tertiary) 8%, transparent);
}

.empty-state__icon--compact {
  width: 40px;
  height: 40px;
  font-size: 26px;
}

.empty-state__title {
  font-size: 14px;
  font-weight: 500;
  color: var(--hula-text-secondary);
  margin: 4px 0 0;
}

.empty-state__description {
  font-size: 13px;
  line-height: 1.55;
  color: var(--hula-text-tertiary);
  max-width: 320px;
  margin: 0;
}

.empty-state__actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}

.empty-state--welcome .empty-state__icon {
  color: var(--hula-color-primary-500);
  background: var(--hula-color-primary-100);
}

.empty-state--welcome .empty-state__title {
  color: var(--hula-text-primary);
  font-size: 16px;
}

.empty-state--subtle {
  opacity: 0.75;
}

.empty-state__enter-active {
  animation: empty-fade-in 240ms var(--hula-motion-ease-enter);
}

@keyframes empty-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
