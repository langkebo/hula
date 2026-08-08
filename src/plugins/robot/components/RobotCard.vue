<template>
  <div
    :class="['robot-card', { 'robot-card--active': active }]"
    data-testid="robot-card"
    role="button"
    tabindex="0"
    :aria-label="robot.name"
    @click="handleClick"
    @keydown.enter.self.prevent="handleClick"
    @keydown.space.self.prevent="handleClick">
    <!-- Avatar -->
    <div class="robot-card__avatar shrink-0 relative">
      <img
        v-if="robot.avatar"
        :src="robot.avatar"
        :alt="''"
        class="robot-card__avatar-img"
        data-testid="robot-card-avatar-img" />
      <span v-else class="robot-card__avatar-placeholder" data-testid="robot-card-avatar-placeholder">
        {{ avatarPlaceholder }}
      </span>

      <!-- Online status dot (SVG) -->
      <span
        v-if="robot.online === true"
        class="robot-card__status robot-card__status--online"
        data-testid="robot-card-status-online"
        :aria-label="t('ai_assistant.robot.available')">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <circle cx="5" cy="5" r="4" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span
        v-else-if="robot.online === false"
        class="robot-card__status robot-card__status--offline"
        data-testid="robot-card-status-offline"
        :aria-label="t('ai_assistant.robot.unavailable')">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <circle cx="5" cy="5" r="4" fill="currentColor" stroke="none" />
        </svg>
      </span>
    </div>

    <!-- Info -->
    <div class="robot-card__info flex-1 min-w-0">
      <div class="robot-card__header flex items-center gap-[--tjg-space-1]">
        <span class="robot-card__name truncate" :title="robot.name" data-testid="robot-card-name">
          {{ robot.name }}
        </span>
        <span
          v-if="robot.model"
          class="robot-card__model shrink-0"
          data-testid="robot-card-model">
          {{ robot.model }}
        </span>
      </div>

      <div
        v-if="robot.messageCount !== undefined || robot.time"
        class="robot-card__meta flex items-center gap-[--tjg-space-2] mt-2px">
        <span
          v-if="robot.messageCount !== undefined"
          class="robot-card__message-count"
          data-testid="robot-card-message-count">
          {{ t('ai_assistant.robot.message_count', { count: robot.messageCount }) }}
        </span>
        <span v-if="robot.time" class="robot-card__time" data-testid="robot-card-time">
          {{ robot.time }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export interface RobotCardData {
  id: string
  name: string
  avatar?: string
  model?: string
  online?: boolean
  messageCount?: number
  time?: string
}

const props = withDefaults(
  defineProps<{
    robot: RobotCardData
    active?: boolean
  }>(),
  {
    active: false
  }
)

const emit = defineEmits<{
  click: [robot: RobotCardData]
}>()

const { t } = useI18n()

const avatarPlaceholder = computed(() => props.robot.name?.charAt(0) || '?')

const handleClick = () => {
  emit('click', props.robot)
}
</script>

<style scoped lang="scss">
.robot-card {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  padding: var(--tjg-space-2) var(--tjg-space-3);
  border-radius: var(--tjg-radius-sm);
  background: var(--tjg-surface-panel);
  border: 1px solid var(--tjg-border-muted);
  cursor: pointer;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition:
    background var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard),
    border-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover,
  &:focus-visible {
    background: var(--tjg-surface-list-hover);
    border-color: var(--tjg-border-default);
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--tjg-color-primary-200);
  }
}

.robot-card--active {
  border-color: var(--tjg-color-primary-500);
  box-shadow: 0 0 0 1px var(--tjg-color-primary-100) inset;
}

.robot-card__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  overflow: hidden;
  border-radius: var(--tjg-radius-full);
  background: var(--tjg-surface-subtle);
}

.robot-card__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.robot-card__avatar-placeholder {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-secondary);
}

.robot-card__status {
  position: absolute;
  bottom: -1px;
  right: -1px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: var(--tjg-radius-full);
  background: var(--tjg-surface-panel);
  border: 1.5px solid var(--tjg-surface-panel);
}

.robot-card__status--online {
  color: var(--tjg-status-online);
}

.robot-card__status--offline {
  color: var(--tjg-status-offline);
}

.robot-card__name {
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
}

.robot-card__model {
  display: inline-flex;
  align-items: center;
  padding: 1px var(--tjg-space-1);
  border-radius: var(--tjg-radius-xs);
  background: var(--tjg-color-primary-50);
  color: var(--tjg-color-primary-600);
  font-size: var(--tjg-font-size-2xs);
  font-weight: var(--tjg-font-weight-medium);
  line-height: 1.4;
  white-space: nowrap;
}

.robot-card__message-count {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-tertiary);
}

.robot-card__time {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-tertiary);
  margin-left: auto;
}

@media (prefers-reduced-motion: reduce) {
  .robot-card {
    transition: none;
  }
}
</style>
