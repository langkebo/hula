<template>
  <div
    v-if="burnEnabled"
    data-test="private-mode-banner"
    class="private-mode-banner">
    <svg class="private-mode-banner__icon">
      <use href="#timer"></use>
    </svg>
    <span class="private-mode-banner__text">
      {{ bannerText }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  burnEnabled: boolean
  remainingSeconds?: number
}>()

const bannerText = computed(() => {
  if (props.remainingSeconds === undefined) {
    return t('chat.private_mode.enabled')
  }
  const seconds = Math.max(0, props.remainingSeconds)
  if (seconds < 60) return `${t('chat.private_mode.burning')} ${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${t('chat.private_mode.burning')} ${minutes}m`
})
</script>

<style scoped>
.private-mode-banner {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  height: 32px;
  background: color-mix(in srgb, var(--hula-color-danger-500) 8%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--hula-color-danger-500) 20%, transparent);
  font-size: var(--hula-text-sm);
  color: var(--hula-color-danger-500);
}

.private-mode-banner__icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.private-mode-banner__text {
  white-space: nowrap;
}
</style>
