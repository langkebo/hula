<template>
  <section class="contact-group-section" :class="{ 'contact-group-section--collapsed': collapsed }">
    <button
      type="button"
      data-test="group-header"
      class="contact-group-section__header"
      :aria-expanded="!collapsed"
      :aria-label="groupName"
      @click="$emit('toggle')">
      <svg
        data-test="group-arrow"
        class="contact-group-section__arrow"
        :class="{ 'contact-group-section__arrow--collapsed': collapsed }"
        viewBox="0 0 16 16"
        width="12"
        height="12"
        aria-hidden="true">
        <path
          d="M4 6L8 10L12 6"
          stroke="currentColor"
          stroke-width="1.5"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round" />
      </svg>
      <span data-test="group-name" class="contact-group-section__name">{{ groupName }}</span>
      <span data-test="group-count" class="contact-group-section__count">{{ friends.length }}</span>
    </button>

    <div v-show="!collapsed" class="contact-group-section__body" role="list">
      <FriendListItem
        v-for="friend in friends"
        :key="friend.userId"
        :item="friend"
        :selected="friend.userId === selectedUserId"
        :query="query"
        @select="$emit('select-friend', $event)"
        @send-message="$emit('send-message', $event)"
        @remove="$emit('remove', $event)"
        @more="$emit('more', $event)"
        @contextmenu="$emit('contextmenu', $event)" />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { MatrixContact } from '@/stores/domains/chat/contacts'
import FriendListItem from './FriendListItem.vue'

withDefaults(
  defineProps<{
    groupName: string
    friends: MatrixContact[]
    collapsed: boolean
    selectedUserId?: string
    query?: string
  }>(),
  {
    selectedUserId: '',
    query: ''
  }
)

defineEmits<{
  toggle: []
  'select-friend': [item: MatrixContact]
  'send-message': [item: MatrixContact]
  remove: [item: MatrixContact]
  more: [payload: { item: MatrixContact; event: MouseEvent }]
  contextmenu: [payload: { item: MatrixContact; event: MouseEvent }]
}>()
</script>

<style scoped lang="scss">
.contact-group-section {
  display: flex;
  flex-direction: column;
}

.contact-group-section__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--tjg-text-tertiary);
  font-size: var(--tjg-font-size-sm, 12px);
  width: 100%;
  text-align: left;
  border-radius: var(--tjg-radius-xs, 4px);
  transition: background-color var(--tjg-motion-duration-fast, 120ms) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-surface-list-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: 2px;
  }
}

.contact-group-section__arrow {
  flex-shrink: 0;
  color: var(--tjg-text-tertiary);
  transition: transform var(--tjg-motion-duration-normal, 180ms) var(--tjg-motion-ease-standard);
}

.contact-group-section__arrow--collapsed {
  transform: rotate(-90deg);
}

.contact-group-section__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-group-section__count {
  flex-shrink: 0;
  color: var(--tjg-text-tertiary);
  font-size: var(--tjg-font-size-sm, 12px);
}

.contact-group-section__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 4px;
}

@media (prefers-reduced-motion: reduce) {
  .contact-group-section__header,
  .contact-group-section__arrow {
    transition: none;
  }
}
</style>
