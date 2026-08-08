<template>
  <div class="token-usage-meter" :data-level="level" data-testid="token-usage-meter">
    <div
      class="token-usage-meter__bar"
      data-testid="token-usage-meter-bar"
      role="progressbar"
      :aria-valuenow="used"
      :aria-valuemin="0"
      :aria-valuemax="total > 0 ? total : 1"
      :aria-label="t('ai_assistant.robot.token_usage')">
      <div
        class="token-usage-meter__fill"
        data-testid="token-usage-meter-fill"
        :style="{ width: `${fillPercent}%` }"></div>
    </div>
    <span class="token-usage-meter__text">
      <span class="token-usage-meter__used">{{ used }}</span>
      <span class="token-usage-meter__separator">/</span>
      <span class="token-usage-meter__total">{{ total > 0 ? total : t('ai_assistant.robot.unlimited') }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  used: number
  total: number
}>()

const { t } = useI18n()

const fillPercent = computed(() => {
  if (props.total <= 0) return 0
  const pct = (props.used / props.total) * 100
  return Math.min(Math.max(pct, 0), 100)
})

const level = computed<'normal' | 'warning' | 'danger'>(() => {
  if (props.total <= 0) return 'normal'
  const pct = props.used / props.total
  if (pct >= 1) return 'danger'
  if (pct >= 0.8) return 'warning'
  return 'normal'
})
</script>

<style scoped lang="scss">
.token-usage-meter {
  display: inline-flex;
  align-items: center;
  gap: var(--tjg-space-1);
}

.token-usage-meter__bar {
  width: 60px;
  height: 4px;
  border-radius: var(--tjg-radius-full);
  background: var(--tjg-settings-meter-bg);
  overflow: hidden;
}

.token-usage-meter__fill {
  height: 100%;
  border-radius: var(--tjg-radius-full);
  background: var(--tjg-color-primary-500);
  transition: width var(--tjg-motion-duration-normal) var(--tjg-motion-ease-standard);
}

/* Level-specific fill colors */
.token-usage-meter[data-level='normal'] .token-usage-meter__fill {
  background: var(--tjg-color-primary-500);
}

.token-usage-meter[data-level='warning'] .token-usage-meter__fill {
  background: var(--tjg-color-warning-500);
}

.token-usage-meter[data-level='danger'] .token-usage-meter__fill {
  background: var(--tjg-color-danger-500);
}

.token-usage-meter__text {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  font-size: var(--tjg-font-size-sm);
  white-space: nowrap;
}

.token-usage-meter__used {
  color: var(--tjg-text-secondary);
  font-weight: var(--tjg-font-weight-medium);
}

.token-usage-meter__separator {
  color: var(--tjg-text-tertiary);
}

.token-usage-meter__total {
  color: var(--tjg-text-tertiary);
}

@media (prefers-reduced-motion: reduce) {
  .token-usage-meter__fill {
    transition: none;
  }
}
</style>
