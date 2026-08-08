<template>
  <span class="chat-role-badge" data-testid="chat-role-badge" role="status">
    <span class="chat-role-badge__name truncate" data-testid="chat-role-badge-name" :title="role.name">
      {{ role.name }}
    </span>
    <span
      class="chat-role-badge__status"
      :class="`chat-role-badge__status--${statusType}`"
      :data-status="statusType"
      data-testid="chat-role-badge-status"
      :aria-label="statusLabel">
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
        <circle cx="4" cy="4" r="3" fill="currentColor" stroke="none" />
      </svg>
      <span class="chat-role-badge__status-label">{{ statusLabel }}</span>
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ChatRole } from '@/services/matrix/ai/ChatRoleService'

const props = defineProps<{
  role: ChatRole
}>()

const { t } = useI18n()

const statusType = computed<'available' | 'unavailable'>(() => (props.role.status === 0 ? 'available' : 'unavailable'))

const statusLabel = computed(() =>
  statusType.value === 'available' ? t('ai_assistant.robot.available') : t('ai_assistant.robot.unavailable')
)
</script>

<style scoped lang="scss">
.chat-role-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--tjg-space-1);
  white-space: nowrap;
  line-height: var(--tjg-line-height-tight);
}

.chat-role-badge__name {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
  max-width: 120px;
}

.chat-role-badge__status {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px var(--tjg-space-1);
  border-radius: var(--tjg-radius-xs);
  font-size: var(--tjg-font-size-2xs);
  font-weight: var(--tjg-font-weight-medium);
  line-height: 1.4;
  white-space: nowrap;
}

.chat-role-badge__status--available {
  color: var(--tjg-color-success-600);
  background: var(--tjg-color-success-100);
}

.chat-role-badge__status--unavailable {
  color: var(--tjg-color-danger-600);
  background: var(--tjg-color-danger-100);
}

.chat-role-badge__status-label {
  /* Inherits color from parent status class */
}
</style>
