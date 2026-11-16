<template>
  <span
    v-if="visible"
    class="account-status-badge"
    :class="`account-status-badge--${displayStatus}`"
    :title="statusLabel"
    :aria-label="statusLabel"
    data-testid="account-status-badge"
    :data-status="displayStatus"
    role="status">
    <svg
      class="account-status-badge__icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5">
      <template v-if="displayStatus === 'normal'">
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12 2.5 2.5 4.5-5" stroke-linecap="round" stroke-linejoin="round" />
      </template>
      <template v-else-if="displayStatus === 'locked'">
        <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
        <path d="M8.5 10.5V8a3.5 3.5 0 1 1 7 0v2.5" stroke-linecap="round" />
      </template>
      <template v-else-if="displayStatus === 'suspended'">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5v5M14.5 9.5v5" stroke-linecap="round" />
      </template>
      <template v-else>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.8 9.4a2.3 2.3 0 1 1 3.4 2c-.7.4-1.2.8-1.2 1.7" stroke-linecap="round" />
        <path d="M12 16.2h.01" stroke-linecap="round" />
      </template>
    </svg>
    <span class="account-status-badge__label">{{ statusLabel }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useServerCapability } from '@/services/matrix/MatrixCapabilityService'
import { matrixAccountStatusService } from '@/services/matrix/user/MatrixAccountStatusService'

type AccountStatusKind = 'normal' | 'locked' | 'suspended' | 'unknown'

const props = defineProps<{
  userId: string
  /** 测试或上游已拿到状态时可直接传入，跳过自身请求 */
  status?: AccountStatusKind
}>()

const { t } = useI18n()
const { isCapabilityAvailable } = useServerCapability()

const available = computed(() => isCapabilityAvailable('account-status'))
const resolvedStatus = ref<AccountStatusKind>('unknown')
const displayStatus = computed<AccountStatusKind>(() => props.status ?? resolvedStatus.value)
const visible = computed(() => available.value && Boolean(props.userId))

const statusLabel = computed(() => {
  switch (displayStatus.value) {
    case 'normal':
      return t('friend.detail.account_status_normal')
    case 'locked':
      return t('friend.detail.account_status_locked')
    case 'suspended':
      return t('friend.detail.account_status_suspended')
    default:
      return t('friend.detail.account_status_unknown')
  }
})

const loadStatus = async () => {
  if (!props.userId || props.status) return
  const statuses = await matrixAccountStatusService.getAccountStatuses([props.userId])
  const entry = statuses[props.userId]
  if (!entry) {
    resolvedStatus.value = 'unknown'
  } else if (entry.locked) {
    resolvedStatus.value = 'locked'
  } else if (entry.suspended) {
    resolvedStatus.value = 'suspended'
  } else {
    resolvedStatus.value = 'normal'
  }
}

watch(
  [() => props.userId, available],
  ([userId, canUse]) => {
    if (userId && canUse) void loadStatus()
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.account-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  line-height: 16px;
  border-radius: var(--tjg-radius-full);
  border: 1px solid transparent;
  white-space: nowrap;
}

.account-status-badge__icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.account-status-badge--normal {
  color: var(--tjg-color-success-600);
  background: var(--tjg-color-success-100);
  border-color: var(--tjg-color-success-100);
}

.account-status-badge--locked {
  color: var(--tjg-color-danger-600);
  background: var(--tjg-color-danger-100);
  border-color: var(--tjg-color-danger-100);
}

.account-status-badge--suspended {
  color: var(--tjg-color-warning-600);
  background: var(--tjg-color-warning-100);
  border-color: var(--tjg-color-warning-100);
}

.account-status-badge--unknown {
  color: var(--tjg-text-tertiary);
  background: var(--tjg-surface-input);
  border-color: var(--tjg-border-muted);
}
</style>
