<template>
  <article
    class="room-card"
    data-testid="room-card"
    role="button"
    tabindex="0"
    :aria-label="room.name"
    @click="handlePreview"
    @keydown.enter.prevent="handlePreview"
    @keydown.space.prevent="handlePreview">
    <div class="room-card__avatar">
      <img
        v-if="room.avatarUrl"
        :src="room.avatarUrl"
        :alt="''"
        class="room-card__avatar-img"
        data-testid="room-avatar-img" />
      <span v-else class="room-card__avatar-placeholder" data-testid="room-avatar-placeholder">
        {{ avatarPlaceholder }}
      </span>
    </div>

    <div class="room-card__info">
      <div class="room-card__header">
        <span class="room-card__name" :title="room.name">{{ room.name }}</span>
        <span
          v-if="room.isFederated"
          class="room-card__federation-badge"
          data-testid="room-federation-badge"
          :title="t('room.discovery.federated')">
          <svg
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3a14 14 0 0 1 0 18" />
            <path d="M12 3a14 14 0 0 0 0 18" />
          </svg>
          {{ t('room.discovery.federated') }}
        </span>
      </div>

      <div class="room-card__meta">
        <span class="room-card__members">
          <svg
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {{ room.numJoinedMembers }}
        </span>
      </div>

      <p v-if="room.topic" class="room-card__topic" data-testid="room-topic">{{ truncatedTopic }}</p>
    </div>

    <n-button
      class="room-card__join"
      size="small"
      type="primary"
      secondary
      data-testid="room-join-btn"
      @click.stop="handleJoin">
      {{ t('room.discovery.join') }}
    </n-button>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export interface RoomCardData {
  roomId: string
  name: string
  topic?: string
  numJoinedMembers: number
  avatarUrl?: string
  /** 是否为联邦房间（跨 homeserver） */
  isFederated?: boolean
}

const props = defineProps<{
  room: RoomCardData
}>()

const emit = defineEmits<{
  join: [roomId: string]
  preview: [roomId: string]
}>()

const { t } = useI18n()

const TOPIC_MAX_LEN = 60

const avatarPlaceholder = computed(() => props.room.name?.charAt(0) || '?')

const truncatedTopic = computed(() => {
  const topic = props.room.topic ?? ''
  if (topic.length <= TOPIC_MAX_LEN) return topic
  return `${topic.slice(0, TOPIC_MAX_LEN)}...`
})

const handleJoin = () => {
  emit('join', props.room.roomId)
}

const handlePreview = () => {
  emit('preview', props.room.roomId)
}
</script>

<style scoped lang="scss">
.room-card {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-3);
  padding: var(--tjg-space-3);
  border-radius: var(--tjg-radius-sm);
  background: var(--tjg-surface-panel);
  border: 1px solid var(--tjg-border-muted);
  box-shadow: var(--tjg-shadow-card);
  cursor: pointer;
  outline: none;
  transition:
    box-shadow var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard),
    border-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover,
  &:focus-visible {
    border-color: var(--tjg-border-default);
    box-shadow: var(--tjg-shadow-card-hover);
  }

  &:focus-visible {
    box-shadow:
      var(--tjg-shadow-card-hover),
      0 0 0 2px var(--tjg-color-primary-200);
  }
}

.room-card__avatar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  overflow: hidden;
  border-radius: var(--tjg-radius-full);
  background: var(--tjg-surface-subtle);
}

.room-card__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.room-card__avatar-placeholder {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-secondary);
}

.room-card__info {
  flex: 1;
  min-width: 0;
}

.room-card__header {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
}

.room-card__name {
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-card__federation-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: var(--tjg-radius-xs);
  background: var(--tjg-color-info-100);
  color: var(--tjg-color-info-600);
  font-size: var(--tjg-font-size-2xs);
  line-height: 1.4;
}

.room-card__meta {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  margin-top: 2px;
}

.room-card__members {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
}

.room-card__topic {
  margin: 2px 0 0;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-card__join {
  flex-shrink: 0;
}

@media (prefers-reduced-motion: reduce) {
  .room-card {
    transition: none;
  }
}
</style>
