<template>
  <div class="friend-item-actions" @click.stop>
    <n-tooltip trigger="hover" placement="top" :delay="300">
      <template #trigger>
        <button
          type="button"
          class="friend-item-actions__btn"
          :aria-label="t('home.friends_list.actions.message')"
          @click.stop="emit('message')">
          <svg class="size-14px"><use href="#message"></use></svg>
        </button>
      </template>
      {{ t('home.friends_list.actions.message') }}
    </n-tooltip>

    <n-tooltip trigger="hover" placement="top" :delay="300">
      <template #trigger>
        <button
          type="button"
          class="friend-item-actions__btn"
          :aria-label="t('home.friends_list.actions.profile')"
          @click.stop="emit('profile')">
          <svg class="size-14px"><use href="#info"></use></svg>
        </button>
      </template>
      {{ t('home.friends_list.actions.profile') }}
    </n-tooltip>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  uid: string
}>()

const emit = defineEmits<{
  message: []
  profile: []
}>()

const { t } = useI18n()
</script>

<style scoped lang="scss">
.friend-item-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transform: translateX(4px);
  transition:
    opacity 0.18s var(--hula-motion-ease-standard),
    transform 0.18s var(--hula-motion-ease-standard);
}

.hula-friend-list-item:hover .friend-item-actions,
.hula-friend-list-item.active .friend-item-actions {
  opacity: 1;
  transform: translateX(0);
}

.friend-item-actions__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--hula-text-secondary);
  cursor: pointer;
  transition:
    background-color 0.15s var(--hula-motion-ease-standard),
    color 0.15s var(--hula-motion-ease-standard);
}

.friend-item-actions__btn:hover {
  background: var(--hula-surface-list-hover);
  color: var(--hula-text-primary);
}

.friend-item-actions__btn:active {
  background: var(--hula-surface-panel-muted);
}

.friend-item-actions__btn:focus-visible {
  outline: 2px solid var(--hula-color-primary-500);
  outline-offset: 1px;
}
</style>
