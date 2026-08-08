<template>
  <div class="theme-switcher">
    <div
      data-test="theme-switcher-group"
      class="theme-switcher__group"
      role="group"
      :aria-label="t('setting.appearance.theme_section')">
      <button
        v-for="option in themeOptions"
        :key="option.value"
        data-test="theme-option"
        :data-value="option.value"
        type="button"
        class="theme-switcher__option"
        :class="{ 'theme-switcher__option--active': modelValue === option.value }"
        :aria-pressed="modelValue === option.value"
        @click="handleSelect(option.value)">
        <span class="theme-switcher__icon" v-html="option.icon" />
        <span class="theme-switcher__label">{{ option.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { ThemeEnum } from '@/enums'
import { useSettingStore } from '@/stores/domains/settings/setting'

defineOptions({
  name: 'ThemeSwitcher'
})

type ThemeValue = 'light' | 'dark' | 'os'

const props = defineProps<{
  modelValue: ThemeValue
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ThemeValue]
}>()

const { t } = useI18n()
const settingStore = useSettingStore()
const { showFeedback } = useActionFeedback()

// SVG 图标：1.5px stroke-width，currentColor 描边，符合设计规范
const sunIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>`

const moonIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>`

const monitorIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>`

const themeOptions = computed(() => [
  { value: ThemeEnum.LIGHT, label: t('setting.appearance.theme_light'), icon: sunIcon },
  { value: ThemeEnum.DARK, label: t('setting.appearance.theme_dark'), icon: moonIcon },
  { value: ThemeEnum.OS, label: t('setting.appearance.theme_auto'), icon: monitorIcon }
])

function handleSelect(value: ThemeValue) {
  // 点击当前已选中项时不重复触发切换
  if (props.modelValue === value) return

  settingStore.toggleTheme(value)
  showFeedback(t('setting.appearance.feedback.theme_changed'), 'success')
  emit('update:modelValue', value)
}
</script>

<style scoped>
.theme-switcher__group {
  display: flex;
  gap: var(--tjg-space-3);
}

.theme-switcher__option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--tjg-space-2);
  padding: var(--tjg-space-3) var(--tjg-space-4);
  border-radius: var(--tjg-radius-md);
  border: 2px solid transparent;
  background-color: var(--tjg-surface-panel-muted);
  cursor: pointer;
  transition:
    border-color var(--tjg-motion-duration-normal) var(--tjg-motion-ease-standard),
    background-color var(--tjg-motion-duration-normal) var(--tjg-motion-ease-standard);
}

.theme-switcher__option:hover {
  border-color: color-mix(in srgb, var(--tjg-color-info-500) 30%, transparent);
  background-color: var(--tjg-surface-sidebar-hover);
}

.theme-switcher__option:focus-visible {
  outline: 2px solid var(--tjg-color-info-500);
  outline-offset: 2px;
}

.theme-switcher__option--active {
  border-color: var(--tjg-color-primary-500);
  background-color: var(--tjg-color-primary-50);
}

.theme-switcher__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--tjg-text-secondary);
}

.theme-switcher__option--active .theme-switcher__icon {
  color: var(--tjg-color-primary-500);
}

.theme-switcher__label {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
}

.theme-switcher__option--active .theme-switcher__label {
  color: var(--tjg-text-primary);
  font-weight: var(--tjg-font-weight-medium);
}

@media (prefers-reduced-motion: reduce) {
  .theme-switcher__option {
    transition: none;
  }
}
</style>
