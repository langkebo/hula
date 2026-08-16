<template>
  <article
    class="room-card flex items-center gap-[--tjg-space-3] p-[--tjg-space-3] rounded-[--tjg-radius-sm] bg-[--tjg-surface-panel] border border-[--tjg-border-muted] cursor-pointer outline-none"
    data-testid="room-card"
    role="button"
    tabindex="0"
    :aria-label="item.name"
    @click="handlePreview"
    @keydown.enter.self.prevent="handlePreview"
    @keydown.space.self.prevent="handlePreview">
    <div
      class="room-card__avatar shrink-0 flex items-center justify-center size-[40px] overflow-hidden rounded-[--tjg-radius-full] bg-[--tjg-surface-subtle]">
      <img
        v-if="item.avatarUrl"
        :src="item.avatarUrl"
        :alt="''"
        class="room-card__avatar-img w-full h-full object-cover"
        data-testid="room-avatar-img" />
      <span
        v-else
        class="room-card__avatar-placeholder text-[--tjg-text-secondary]"
        data-testid="room-avatar-placeholder">
        {{ avatarPlaceholder }}
      </span>
    </div>

    <div class="room-card__info flex-1 min-w-0">
      <div class="room-card__header flex items-center gap-[--tjg-space-2]">
        <span class="room-card__name truncate text-[--tjg-text-primary]" :title="item.name">{{ item.name }}</span>
        <span
          v-if="item.isFederated"
          class="room-card__federation-badge inline-flex items-center gap-2px shrink-0 px-6px py-1px rounded-[--tjg-radius-xs] bg-[--tjg-color-info-100] text-[--tjg-color-info-600]"
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

      <div class="room-card__meta flex items-center gap-[--tjg-space-2] mt-2px">
        <span
          class="room-card__members inline-flex items-center gap-4px text-[--tjg-text-secondary]"
          :aria-label="t('room.discovery.members', { count: item.numJoinedMembers })">
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
          {{ item.numJoinedMembers }}
        </span>
      </div>

      <p v-if="item.topic" class="room-card__topic truncate mt-2px text-[--tjg-text-tertiary]" data-testid="room-topic">
        {{ truncatedTopic }}
      </p>
    </div>

    <n-button
      class="room-card__join shrink-0"
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
  item: RoomCardData
}>()

const emit = defineEmits<{
  join: [roomId: string]
  preview: [roomId: string]
}>()

const { t } = useI18n()

const TOPIC_MAX_LEN = 60

const avatarPlaceholder = computed(() => props.item.name?.charAt(0) || '?')

const truncatedTopic = computed(() => {
  const topic = props.item.topic ?? ''
  if (topic.length <= TOPIC_MAX_LEN) return topic
  return `${topic.slice(0, TOPIC_MAX_LEN)}...`
})

const handleJoin = () => {
  emit('join', props.item.roomId)
}

const handlePreview = () => {
  emit('preview', props.item.roomId)
}
</script>

<style scoped lang="scss">
.room-card {
  box-shadow: var(--tjg-shadow-card);
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

.room-card__avatar-placeholder {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
}

.room-card__name {
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-medium);
}

.room-card__federation-badge {
  font-size: var(--tjg-font-size-2xs);
  line-height: 1.4;
}

.room-card__members {
  font-size: var(--tjg-font-size-sm);
}

.room-card__topic {
  margin: 2px 0 0;
  font-size: var(--tjg-font-size-sm);
}

@media (prefers-reduced-motion: reduce) {
  .room-card {
    transition: none;
  }
}
</style>
