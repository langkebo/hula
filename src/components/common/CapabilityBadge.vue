<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CapabilityState } from '@/types/capability'

const props = withDefaults(
  defineProps<{
    /** 能力三态 */
    state: CapabilityState
    /** 能力名称，缺省时只显示状态文案 */
    label?: string
    /** 紧凑模式：仅保留图形，文案对读屏可见 */
    compact?: boolean
  }>(),
  {
    label: '',
    compact: false
  }
)

const { t } = useI18n()

const STATE_LABEL_KEYS: Record<CapabilityState, string> = {
  ready: 'common.capability.ready',
  degraded: 'common.capability.degraded',
  unavailable: 'common.capability.unavailable'
}

const hintId = `capability-hint-${useId()}`
const expanded = ref(false)

const stateText = computed(() => t(STATE_LABEL_KEYS[props.state]))
</script>

<template>
  <div class="capability-badge-wrap">
    <span
      class="capability-badge"
      :class="[`capability-badge--${state}`, { 'capability-badge--compact': compact }]"
      data-test="capability-badge"
      role="status">
      <svg
        class="capability-badge__icon"
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true">
        <circle cx="8" cy="8" r="6.25" stroke="currentColor" />
        <g v-if="state === 'ready'">
          <path d="M5.2 8.4l1.9 1.9 3.7-4" stroke="currentColor" />
        </g>
        <g v-else-if="state === 'degraded'">
          <path d="M8 4.9v3.9" stroke="currentColor" />
          <circle cx="8" cy="11.1" r="0.75" fill="currentColor" stroke="none" />
        </g>
        <g v-else>
          <path d="M5.7 5.7l4.6 4.6M10.3 5.7l-4.6 4.6" stroke="currentColor" />
        </g>
      </svg>

      <span v-if="label || $slots.default" class="capability-badge__label">
        <slot>{{ label }}</slot>
      </span>
      <span class="capability-badge__state">{{ stateText }}</span>
    </span>

    <button
      v-if="state === 'unavailable'"
      type="button"
      class="capability-badge__details"
      data-test="capability-badge-details"
      :aria-expanded="expanded"
      :aria-controls="hintId"
      @click="expanded = !expanded">
      {{ t('common.capability.details') }}
    </button>

    <p
      v-if="state === 'unavailable' && expanded"
      :id="hintId"
      class="capability-badge__hint"
      data-test="capability-badge-hint">
      <slot name="hint">{{ t('common.capability.unavailable_hint') }}</slot>
    </p>
  </div>
</template>

<style scoped lang="scss">
.capability-badge-wrap {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  min-width: 0;
}

.capability-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px 1px 6px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 12px;
  line-height: 18px;
  color: var(--tjg-text-primary);
  background: var(--tjg-color-success-100);
}

.capability-badge__icon {
  flex: none;
}

.capability-badge__label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.capability-badge__state {
  white-space: nowrap;
  color: var(--tjg-text-secondary);
}

.capability-badge--ready {
  background: var(--tjg-color-success-100);
  border-color: color-mix(in srgb, var(--tjg-color-success-500) 32%, transparent);
}

.capability-badge--ready .capability-badge__icon {
  color: var(--tjg-color-success-500);
}

.capability-badge--degraded {
  background: var(--tjg-color-warning-100);
  border-color: color-mix(in srgb, var(--tjg-color-warning-500) 32%, transparent);
}

.capability-badge--degraded .capability-badge__icon {
  color: var(--tjg-color-warning-500);
}

.capability-badge--unavailable {
  background: var(--tjg-color-danger-100);
  border-color: color-mix(in srgb, var(--tjg-color-danger-500) 32%, transparent);
}

.capability-badge--unavailable .capability-badge__icon {
  color: var(--tjg-color-danger-500);
}

/* 紧凑模式：图形可见，文案对读屏保留 */
.capability-badge--compact {
  padding: 2px;
}

.capability-badge--compact .capability-badge__label,
.capability-badge--compact .capability-badge__state {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.capability-badge__details {
  padding: 0;
  border: 0;
  background: none;
  font-size: 12px;
  line-height: 18px;
  color: var(--tjg-text-secondary);
  text-decoration: underline;
  cursor: pointer;
}

.capability-badge__details:hover {
  color: var(--tjg-text-primary);
}

.capability-badge__details:focus-visible {
  outline: 2px solid var(--tjg-color-primary-500);
  outline-offset: 2px;
  border-radius: 2px;
}

.capability-badge__hint {
  flex-basis: 100%;
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--tjg-text-tertiary);
}
</style>
