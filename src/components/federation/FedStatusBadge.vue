<template>
  <span
    :class="['fed-status-badge', `fed-status-badge--${size}`]"
    :data-status="status"
    role="status"
    :aria-label="label"
    :style="{ '--fed-status-color': statusColor }">
    <svg
      class="fed-status-badge__dot"
      :class="{ 'fed-status-badge__dot--pulse': status === 'online' }"
      width="8"
      height="8"
      viewBox="0 0 8 8"
      fill="none"
      aria-hidden="true">
      <circle cx="4" cy="4" r="3" fill="currentColor" stroke="none" />
    </svg>
    <span class="fed-status-badge__label">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

type FedStatus = 'online' | 'degraded' | 'offline'

const props = withDefaults(
  defineProps<{
    status: FedStatus
    size?: 'small' | 'medium'
  }>(),
  {
    size: 'small'
  }
)

const { t } = useI18n()

/**
 * Status → --tjg-status-* token mapping.
 *
 * The task brief specifies a green/yellow/red traffic-light pattern for
 * online/degraded/offline. The existing --tjg-status-* tokens are modelled
 * after IM presence states:
 *   --tjg-status-online  → green  (#52c41a)  — healthy server
 *   --tjg-status-away    → yellow (#faad14)  — degraded (partial outage)
 *   --tjg-status-busy    → red    (#ff4d4f)  — offline (full outage)
 *
 * Note: --tjg-status-offline is gray (#909090) which represents an "unknown /
 * not-connected" presence state, not a server-down alarm. For federation
 * server monitoring, red is the conventional colour for a down server, so we
 * map `offline` → --tjg-status-busy (red) to match the brief's intent.
 */
const STATUS_COLOR_MAP: Record<FedStatus, string> = {
  online: 'var(--tjg-status-online)',
  degraded: 'var(--tjg-status-away)',
  offline: 'var(--tjg-status-busy)'
}

const STATUS_LABEL_KEY: Record<FedStatus, string> = {
  online: 'admin.federation_monitor.status_online',
  degraded: 'admin.federation_monitor.status_degraded',
  offline: 'admin.federation_monitor.status_offline'
}

const statusColor = computed(() => STATUS_COLOR_MAP[props.status])
const label = computed(() => t(STATUS_LABEL_KEY[props.status]))
</script>

<style scoped>
.fed-status-badge {
  --fed-status-color: var(--tjg-status-online);

  display: inline-flex;
  align-items: center;
  gap: var(--tjg-space-1);
  border-radius: var(--tjg-radius-full);
  font-weight: var(--tjg-font-weight-medium);
  white-space: nowrap;
  line-height: var(--tjg-line-height-tight);

  /* Light tinted background from the status color for visual grouping.
   * Text uses a darkened mix of the status colour with --tjg-text-primary
   * to ensure contrast >= 3:1 in both light and dark themes. */
  background: color-mix(in srgb, var(--fed-status-color) 10%, var(--tjg-surface-panel));
  color: color-mix(in srgb, var(--fed-status-color) 50%, var(--tjg-text-primary));
  border: 1px solid color-mix(in srgb, var(--fed-status-color) 25%, transparent);
}

.fed-status-badge--small {
  padding: 2px var(--tjg-space-2);
  font-size: var(--tjg-font-size-sm);
}

.fed-status-badge--medium {
  padding: var(--tjg-space-1) var(--tjg-space-3);
  font-size: var(--tjg-font-size-base);
}

.fed-status-badge__dot {
  flex-shrink: 0;
  color: var(--fed-status-color);
}

/* Subtle pulse for online status to indicate an active connection.
 * Respects prefers-reduced-motion via the global override in
 * design-tokens.css (animation-duration: 0.01ms). */
.fed-status-badge__dot--pulse {
  animation: fed-status-pulse 2s ease-in-out infinite;
}

@keyframes fed-status-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.fed-status-badge__label {
  /* Inherits the darkened status colour from .fed-status-badge for contrast. */
}
</style>
