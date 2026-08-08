<template>
  <span
    v-if="active"
    class="streaming-cursor streaming-cursor--active"
    data-testid="streaming-cursor"
    role="status"
    aria-hidden="false"
    :aria-label="t('ai_assistant.robot.ai_thinking')">
    <svg
      width="2"
      height="16"
      viewBox="0 0 2 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      aria-hidden="true">
      <line x1="1" y1="0" x2="1" y2="16" />
    </svg>
  </span>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  active: boolean
}>()

const { t } = useI18n()
</script>

<style scoped lang="scss">
.streaming-cursor {
  display: inline-flex;
  align-items: center;
  vertical-align: text-bottom;
  color: var(--tjg-color-primary-500);
  line-height: 1;
}

.streaming-cursor--active svg {
  animation: streaming-cursor-blink 1s steps(2, start) infinite;
}

@keyframes streaming-cursor-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

/* Respect prefers-reduced-motion: stop the blink animation.
 * The global override in design-tokens.css already sets
 * animation-duration to 0.01ms, but we also add a local
 * override for clarity and to ensure the cursor is visible
 * (not hidden at 50% opacity) when motion is reduced. */
@media (prefers-reduced-motion: reduce) {
  .streaming-cursor--active svg {
    animation: none;
    opacity: 1;
  }
}
</style>
