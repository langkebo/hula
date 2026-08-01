<template>
  <div class="burn-toggle-wrapper">
    <button
      data-test="burn-toggle"
      class="burn-toggle-btn"
      :class="{ 'burn-toggle-btn--active': enabled }"
      :title="t('chat.burn.toggle_title')"
      @click="toggle">
      <svg class="burn-toggle-icon">
        <use href="#timer"></use>
      </svg>
    </button>

    <div v-if="enabled" data-test="burn-durations" class="burn-durations">
      <button
        v-for="opt in DURATIONS"
        :key="opt.value"
        :data-test="`burn-duration-${opt.value}`"
        class="burn-duration-btn"
        :class="{ 'burn-duration-btn--selected': opt.value === selectedDuration }"
        @click="selectDuration(opt.value)">
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  enabled: boolean
}>()

const emit = defineEmits<{
  'update:enabled': [value: boolean]
  'select-duration': [seconds: number]
}>()

const DURATIONS = [
  { value: 30, label: '30s' },
  { value: 60, label: '1m' },
  { value: 300, label: '5m' },
  { value: 3600, label: '1h' },
  { value: 86400, label: '24h' }
] as const

const selectedDuration = ref(60)

function toggle() {
  emit('update:enabled', !props.enabled)
}

function selectDuration(seconds: number) {
  selectedDuration.value = seconds
  emit('select-duration', seconds)
}
</script>

<style scoped>
.burn-toggle-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.burn-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  color: var(--hula-text-tertiary);
  transition: all 0.2s;
}

.burn-toggle-btn:hover {
  background: var(--hula-surface-list-hover);
  color: var(--hula-text-primary);
}

.burn-toggle-btn--active {
  background: color-mix(in srgb, var(--hula-color-danger-500) 15%, transparent);
  color: var(--hula-color-danger-500);
}

.burn-toggle-icon {
  width: 16px;
  height: 16px;
}

.burn-durations {
  display: flex;
  gap: 2px;
  padding: 2px;
  background: var(--hula-surface-elevated);
  border: 1px solid var(--hula-border-default);
  border-radius: 6px;
}

.burn-duration-btn {
  padding: 2px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  font-size: var(--hula-text-xs);
  color: var(--hula-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.burn-duration-btn:hover {
  background: var(--hula-surface-list-hover);
}

.burn-duration-btn--selected {
  background: var(--hula-color-primary-500);
  color: white;
}
</style>
