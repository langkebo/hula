<template>
  <div class="empty-state" :class="{ 'empty-state--compact': compact }">
    <div class="empty-state__icon" :class="{ 'empty-state__icon--compact': compact }">
      <Icon :icon="icon" />
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

withDefaults(
  defineProps<{
    icon?: string
    title?: string
    description?: string
    compact?: boolean
  }>(),
  {
    icon: 'mdi:inbox-outline',
    title: '',
    description: '',
    compact: false
  }
)
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
</style>
